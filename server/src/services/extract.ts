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


/** Decode PDF hexadecimal strings (including UTF-16BE strings with a BOM). */
function decodePdfHex(value: string): string {
  const hex = value.replace(/\s+/g, '');
  if (!hex || !/^[0-9a-f]*$/i.test(hex)) return '';
  const bytes = Buffer.from(hex.length % 2 === 0 ? hex : hex + '0', 'hex');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const units: number[] = [];
    for (let i = 2; i + 1 < bytes.length; i += 2) units.push((bytes[i] << 8) | bytes[i + 1]);
    return String.fromCharCode(...units);
  }
  return bytes.toString('latin1');
}

function decodeTextOperand(operand: string): string {
  if (operand.startsWith('(') && operand.endsWith(')')) {
    return decodePdfLiteral(operand.slice(1, -1));
  }
  if (operand.startsWith('<') && operand.endsWith('>') && !operand.startsWith('<<')) {
    return decodePdfHex(operand.slice(1, -1));
  }
  return '';
}

/** Decode the ASCII85 filter commonly used before Flate compression in PDFs. */
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
    let value = 0;
    for (const digit of padded) value = value * 85 + digit;
    const bytes = [
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
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

function decodePdfHex(value: string): string {
  const hex = value.replace(/\s+/g, '');
  if (!hex || !/^[0-9a-f]+$/i.test(hex)) return '';
  const padded = hex.length % 2 === 0 ? hex : hex + '0';
  const bytes = Buffer.from(padded, 'hex');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.alloc(bytes.length - 2);
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      swapped[i - 2] = bytes[i + 1] ?? 0;
      swapped[i - 1] = bytes[i] ?? 0;
    }
    return swapped.toString('utf16le');
  }
  return bytes.toString('latin1');
}

function extractPdfText(buffer: Buffer): string {
  // Preserve byte offsets. A dictionary-to-stream regex can accidentally stop
  // at ">>" bytes inside compressed content and silently lose PDF text.
  const source = buffer.toString('latin1');
  const chunks: string[] = [];
  const streamHeader = /<<(.*?)>>\s*stream(?:\r\n|\n|\r)/gs;
  let header: RegExpExecArray | null;

  while ((header = streamHeader.exec(source)) !== null) {
    const dictionary = header[1] ?? '';
    const streamStart = streamHeader.lastIndex;
    const streamEnd = source.indexOf('endstream', streamStart);
    if (streamEnd < 0) break;

    let rawEnd = streamEnd;
    while (rawEnd > streamStart && (source[rawEnd - 1] === '\n' || source[rawEnd - 1] === '\r')) rawEnd--;
    let stream = Buffer.from(source.slice(streamStart, rawEnd), 'latin1');

    try {
      const filters = [...dictionary.matchAll(/\/(ASCII85Decode|A85|FlateDecode|Fl)\b/g)]
        .map((match) => match[1]);
      for (const filter of filters.reverse()) {
        if (filter === 'ASCII85Decode' || filter === 'A85') stream = decodeAscii85(stream);
        else if (filter === 'FlateDecode' || filter === 'Fl') stream = inflateSync(stream);
      }
      if (/\/Filter\b/.test(dictionary) && filters.length === 0) continue;
    } catch {
      continue;
    }

    const body = stream.toString('latin1');
    const operatorPattern = /(\(((?:\\.|[^\\)])*)\)|<([0-9a-fA-F\s]+)>)\s*Tj|\[((?:.|\n)*?)\]\s*TJ/g;
    for (const op of body.matchAll(operatorPattern)) {
      if (op[2] !== undefined) {
        chunks.push(decodePdfLiteral(op[2]));
      } else if (op[3] !== undefined) {
        chunks.push(decodePdfHex(op[3]));
      } else if (op[4] !== undefined) {
        const parts = /\\(((?:\\.|[^\\)])*)\\)|<([0-9a-fA-F\s]+)>/g;
        for (const part of op[4].matchAll(parts)) {
          chunks.push(part[1] !== undefined ? decodePdfLiteral(part[1]) : decodePdfHex(part[2] ?? ''));
        }
      }
      chunks.push('\n');
    }

    streamHeader.lastIndex = streamEnd + 'endstream'.length;
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
