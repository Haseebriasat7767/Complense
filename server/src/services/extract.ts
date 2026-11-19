/** Evidence text extraction, with local OCR fallback for PDFs. */
import { extractPdf } from './pdf.js';

export type ExtractionResult = {
  text: string;
  method: 'direct-text' | 'pdf-text-layer' | 'docx-text-layer' | 'pdf-ocr' | 'unavailable';
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

export async function extractText(input: {
  buffer: Buffer;
  extension: string;
  fileName: string;
}): Promise<ExtractionResult> {
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

  if (extension === 'pdf') return extractPdf(input.buffer);

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
