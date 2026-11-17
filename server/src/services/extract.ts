/**
 * Evidence text extraction.
 *
 * PDF text is read from content streams (including Flate-compressed streams)
 * rather than scanning the whole binary file, which can accidentally retain
 * C2PA/XMP metadata instead of the visible document. Files are parsed in
 * memory only. This lightweight parser supports common text-based PDFs; scanned
 * PDFs and unusual font encodings still require OCR/a dedicated PDF parser.
 */
import { inflateSync } from 'node:zlib';

export type ExtractionResult = {
  text: string;
  method: 'direct-text' | 'pdf-text-layer' | 'docx-text-layer' | 'unavailable';
  confidence: number;
  note: string;
};

const MAX_TEXT_CHARS = 200_000;

function clean(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1]?.length > 0))
    .join('\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function decodePdfLiteral(value: string): string {
  return value.replace(/\\([nrtbf()\\])/g, (_match, escaped: string) => {
    const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
    return map[escaped] ?? escaped;
  }).replace(/\\([0-7]{1,3})/g, (_match, octal: string) =>
    String.fromCharCode(parseInt(octal, 8)),
  );
}

/** Decode hexadecimal PDF text strings used by several PDF generators. */
function decodePdfHex(value: string): string {
  const hex = value.replace(/\s+/g, '');
  const normalized = hex.length % 2 === 0 ? hex : hex + '0';
  const bytes = Buffer.from(normalized, 'hex');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let decoded = '';
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      decoded += String.fromCharCode((bytes[index]! << 8) | bytes[index + 1]!);
    }
    return decoded;
  }
  return bytes.toString('latin1');
}

function decodeAscii85(input: Buffer): Buffer {
  let source = input.toString('latin1').replace(/\\s+/g, '');
  source = source.replace(/^<~/, '').replace(/~>$/, '');
  const output: number[] = [];
  let group: number[] = [];

  const flush = (values: number[], final = false) => {
    if (final && values.length === 1) return;
    const originalLength = values.length;
    const padded = [...values];
    while (padded.length < 5) padded.push(84); // 'u' padding
    // Five base-85 digits can exceed Number's 32-bit bitwise range.
    // Use BigInt so every ASCII85 group is decoded without truncation.
    let value = 0n;
    for (const digit of padded) value = value * 85n + BigInt(digit);
    if (value > 0xffff_ffffn) {
      throw new Error('Invalid ASCII85 group exceeds 32 bits.');
    }
    const bytes = [
      Number((value >> 24n) & 255n),
      Number((value >> 16n) & 255n),
      Number((value >> 8n) & 255n),
      Number(value & 255n),
    ];
    output.push(...bytes.slice(0, final ? originalLength - 1 : 4));
  };

  for (const char of source) {
    if (char === 'z' && group.length === 0) {
      output.push(0, 0, 0, 0);
      continue;
    }
    const code = char.charCodeAt(0) - 33;
    if (code < 0 || code > 84) continue;
    group.push(code);
    if (group.length === 5) {
      flush(group);
      group = [];
    }
  }
  if (group.length > 1) flush(group, true);
  return Buffer.from(output);
}

function extractPdfText(buffer: Buffer): string {
  // PDF stream lengths are byte counts, not character counts. Latin1 keeps a
  // one-to-one byte mapping so /Length can locate each stream precisely.
  const source = buffer.toString('latin1');
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const streamToken = source.indexOf('stream', cursor);
    if (streamToken < 0) break;
    const before = source[streamToken - 1] ?? '';
    const after = source[streamToken + 6] ?? '';
    if ((before && !/[\s>]/.test(before)) || (after && !/[\r\n\s]/.test(after))) {
      cursor = streamToken + 6;
      continue;
    }

    const dictionaryStart = source.lastIndexOf('<<', streamToken);
    const dictionaryEnd = source.lastIndexOf('>>', streamToken);
    if (dictionaryStart < 0 || dictionaryEnd < dictionaryStart) {
      cursor = streamToken + 6;
      continue;
    }
    const dictionary = source.slice(dictionaryStart, streamToken);
    const lineEnd = source.indexOf('\n', streamToken + 6);
    if (lineEnd < 0) break;
    const streamStart = lineEnd + 1;
    const declaredLength = /\/Length\s+(\d+)\b/.exec(dictionary);
    const endMarker = source.indexOf('endstream', streamStart);
    const streamEnd = declaredLength
      ? streamStart + Number(declaredLength[1])
      : endMarker;
    if (streamEnd < streamStart || streamEnd > source.length) {
      cursor = endMarker >= 0 ? endMarker + 9 : streamStart;
      continue;
    }

    const rawStream = source.slice(streamStart, streamEnd);
    cursor = endMarker >= 0 ? endMarker + 9 : streamEnd;
    let stream: Buffer<ArrayBufferLike> = Buffer.from(rawStream, 'latin1');

    // Decode the filter pipeline in the order declared by the PDF: ASCII85
    // wrapping is removed before the underlying Flate stream is inflated.
    try {
      const hasAscii85 = /\/ASCII85Decode\b|\/A85\b/.test(dictionary);
      const hasFlate = /\/FlateDecode\b|\/Fl\b/.test(dictionary);
      if (hasAscii85) stream = decodeAscii85(stream);
      if (hasFlate) stream = inflateSync(stream);
      if (/\/Filter\b/.test(dictionary) && !hasAscii85 && !hasFlate) continue;
    } catch {
      continue;
    }

    const body = stream.toString('latin1');
    const operatorPattern =
      /\(((?:\\.|[^\\)])*)\)\s*Tj|<([0-9A-Fa-f\s]+)>\s*Tj|\[([\s\S]*?)\]\s*TJ/g;
    for (const op of body.matchAll(operatorPattern)) {
      if (op[1] !== undefined) chunks.push(decodePdfLiteral(op[1]));
      else if (op[2] !== undefined) chunks.push(decodePdfHex(op[2]));
      else if (op[3] !== undefined) {
        const textToken = /\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/g;
        for (const part of op[3].matchAll(textToken)) {
          if (part[1] !== undefined) chunks.push(decodePdfLiteral(part[1]));
          else if (part[2] !== undefined) chunks.push(decodePdfHex(part[2]));
        }
      }
      chunks.push('\n');
    }
  }
  return chunks.join('');
}

/** Fallback for DOCX containers; PDF uses the stream-aware parser above. */
function scanBinaryForText(buffer: Buffer): { text: string; runs: number } {
  const ascii = buffer.toString('latin1');
  const matches = ascii.match(/[ -~\n\r\t]{24,}/g) ?? [];
  const meaningful = matches
    .map((chunk) => chunk.replace(/\s+/g, ' ').trim())
    .filter((chunk) => {
      if (chunk.length < 24) return false;
      const letters = (chunk.match(/[A-Za-z]/g) ?? []).length;
      return letters / chunk.length > 0.55;
    });
  return { text: meaningful.join('\n'), runs: meaningful.length };
}

export function extractText(input: {
  buffer: Buffer;
  extension: string;
  fileName: string;
}): ExtractionResult {
  const extension = input.extension.toLowerCase();

  if (['txt', 'csv', 'md', 'json', 'log'].includes(extension)) {
    const text = clean(input.buffer.toString('utf8'));
    if (!text) {
      return { text: '', method: 'unavailable', confidence: 0, note: 'The file contains no readable text.' };
    }
    return {
      text,
      method: 'direct-text',
      confidence: 1,
      note: `${text.length.toLocaleString('en-US')} characters read directly from the ${extension.toUpperCase()} file.`,
    };
  }

  if (extension === 'pdf') {
    const cleaned = clean(extractPdfText(input.buffer));
    // Avoid accepting metadata-only output as evidence text.
    // Accept any substantial readable text. Compliance evidence can be an
    // incident report, ticket export, audit log, contract, or complaint record;
    // requiring policy-specific words incorrectly rejects valid evidence.
    if (cleaned.length >= 80) {
      return {
        text: cleaned,
        method: 'pdf-text-layer',
        confidence: 0.8,
        note: 'Text extracted from PDF content streams. Verify the extracted text against the original document before relying on it.',
      };
    }
    return {
      text: '',
      method: 'unavailable',
      confidence: 0,
      note: 'No reliable readable text was found in the PDF content streams. The file may be scanned or use an unsupported encoding; upload a text-based PDF or OCR-processed copy.',
    };
  }

  if (extension === 'docx') {
    const { text, runs } = scanBinaryForText(input.buffer);
    const cleaned = clean(text);
    if (cleaned.length >= 200 && runs >= 4) {
      return {
        text: cleaned,
        method: 'docx-text-layer',
        confidence: 0.7,
        note: 'Text recovered heuristically from the DOCX file. Verify against the source document before relying on it.',
      };
    }
    return {
      text: '',
      method: 'unavailable',
      confidence: 0,
      note: 'No reliable text could be recovered from this DOCX file in this build.',
    };
  }

  return {
    text: '',
    method: 'unavailable',
    confidence: 0,
    note: `Files of type .${extension} cannot be parsed in this build. Supported: PDF, DOCX, TXT, CSV.`,
  };
}
