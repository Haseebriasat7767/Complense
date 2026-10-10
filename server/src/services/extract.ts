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

function extractPdfText(buffer: Buffer): string {
  const source = buffer.toString('latin1');
  const chunks: string[] = [];
  // Read PDF streams and decompress Flate streams where possible. Only parse
  // text-showing operators inside streams, never document metadata dictionaries.
  const streamPattern = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streamPattern)) {
    const dictionary = match[1] ?? '';
    const rawStream = match[2] ?? '';
    let stream = Buffer.from(rawStream, 'latin1');
    // Many generated PDFs (including ReportLab exports) apply ASCII85 before
    // Flate compression. Decode filters in reverse stream order before parsing.
    try {
      if (/\/ASCII85Decode\b|\/A85\b/.test(dictionary)) {
        stream = decodeAscii85(stream);
      }
      if (/\/FlateDecode\b|\/Fl\b/.test(dictionary)) {
        stream = inflateSync(stream);
      } else if (/\/Filter\b/.test(dictionary) && !/\/ASCII85Decode\b|\/A85\b/.test(dictionary)) {
        continue;
      }
    } catch {
      continue;
    }
    const body = stream.toString('latin1');
    // Capture literal strings used by Tj and TJ text-showing operators.
    const operatorPattern = /\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:.|\n)*?)\]\s*TJ/g;
    for (const op of body.matchAll(operatorPattern)) {
      if (op[1] !== undefined) {
        chunks.push(decodePdfLiteral(op[1]));
      } else if (op[2] !== undefined) {
        for (const part of op[2].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
          chunks.push(decodePdfLiteral(part[1] ?? ''));
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
    const looksLikePolicy = /\b(policy|security|access|incident|risk|control|authentication|backup|employee|information)\b/i.test(cleaned);
    if (cleaned.length >= 80 && looksLikePolicy) {
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
