/**
 * Evidence text extraction.
 *
 * PDF text is read from content streams (including Flate-compressed streams)
 * rather than scanning the whole binary file, which can accidentally retain
 * C2PA/XMP metadata instead of the visible document. Files are parsed in
 * memory only. This lightweight parser supports common text-based PDFs; scanned
 * PDFs and unusual font encodings still require OCR/a dedicated PDF parser.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';

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

/**
 * Extract selectable text with Mozilla PDF.js. This handles compressed streams,
 * embedded fonts, ToUnicode maps and normal PDF object structures.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const task = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const document = await task.promise;
  const pages: string[] = [];
  try {
    const pageLimit = Math.min(document.numPages, 100);
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = content.items
        .filter((item): item is typeof item & { str: string } => 'str' in item)
        .map((item) => item.str)
        .filter(Boolean);
      if (lines.length) pages.push(lines.join(' '));
      if (pages.join('\\n').length >= MAX_TEXT_CHARS) break;
    }
    return clean(pages.join('\\n\\n'));
  } finally {
    await document.destroy();
  }
}

/** Extract DOCX text from the actual WordprocessingML document body. */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return clean(result.value);
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

  if (extension === 'pdf') {
    try {
      const text = await extractPdfText(input.buffer);
      if (text.length >= 40) {
        return {
          text,
          method: 'pdf-text-layer',
          confidence: 0.95,
          note: `PDF.js extracted ${text.length.toLocaleString('en-US')} characters from the PDF text layer. Review the extracted text before relying on control mappings.`,
        };
      }
      return {
        text: '',
        method: 'unavailable',
        confidence: 0,
        note: 'PDF.js could not find selectable text in this PDF. It may be scanned/image-only; OCR is required to read scanned pages.',
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown PDF parsing error';
      return {
        text: '',
        method: 'unavailable',
        confidence: 0,
        note: `PDF parsing failed: ${reason.slice(0, 240)}`,
      };
    }
  }

  if (extension === 'docx') {
    const cleaned = await extractDocxText(input.buffer);
    if (cleaned.length >= 20) {
      return {
        text: cleaned,
        method: 'docx-text-layer',
        confidence: 0.7,
        note: 'Mammoth extracted text from the DOCX document body. Verify against the source document before relying on it.',
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
