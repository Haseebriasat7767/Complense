/**
 * Evidence text extraction.
 *
 * PDFs are parsed with Mozilla PDF.js so text is read from the document's
 * page model rather than by scanning binary streams. Scanned/image-only PDFs
 * still require OCR and are reported as unavailable instead of being marked
 * successfully analysed.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type ExtractionResult = {
  text: string;
  method: 'direct-text' | 'pdf-text-layer' | 'docx-text-layer' | 'unavailable';
  confidence: number;
  note: string;
};

const MAX_TEXT_CHARS = 200_000;
const MAX_PDF_PAGES = 1_000;

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

/** Extract page text with PDF.js, respecting PDF object graphs and font maps. */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number; pagesWithText: number }> {
  const task = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    stopAtErrors: false,
    verbosity: 0,
  });

  const document = await task.promise;
  try {
    if (document.numPages > MAX_PDF_PAGES) {
      throw new Error(`PDF exceeds the ${MAX_PDF_PAGES}-page extraction limit.`);
    }

    const pageTexts: string[] = [];
    let pagesWithText = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const parts: string[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        if (item.str) parts.push(item.str);
        if (item.hasEOL) parts.push('\n');
        else parts.push(' ');
      }
      const pageText = parts.join('');
      pageTexts.push(pageText);
      if (pageText.trim().length >= 20) pagesWithText += 1;
      page.cleanup();
    }

    return { text: pageTexts.join('\n\n'), pages: document.numPages, pagesWithText };
  } finally {
    await document.destroy();
  }
}

/** Fallback for DOCX containers. PDF extraction is handled by PDF.js above. */
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

  if (extension === 'pdf') {
    try {
      const extracted = await extractPdfText(input.buffer);
      const cleaned = clean(extracted.text);
      if (cleaned.length >= 80) {
        return {
          text: cleaned,
          method: 'pdf-text-layer',
          confidence: extracted.pagesWithText === extracted.pages ? 0.9 : 0.65,
          note: extracted.pagesWithText === extracted.pages
            ? `${cleaned.length.toLocaleString('en-US')} characters extracted from all ${extracted.pages} PDF page(s) using PDF.js. Verify against the source document before relying on it.`
            : `${cleaned.length.toLocaleString('en-US')} characters extracted, but readable text was found on only ${extracted.pagesWithText} of ${extracted.pages} PDF page(s). ${extracted.pages - extracted.pagesWithText} page(s) appear scanned or image-only and require OCR; this upload is flagged for manual review.` ,
        };
      }
      return {
        text: '',
        method: 'unavailable',
        confidence: 0,
        note: 'PDF.js found no reliable text layer. The file may be scanned or image-only; OCR is required before it can be analysed.',
      };
    } catch (error) {
      return {
        text: '',
        method: 'unavailable',
        confidence: 0,
        note: error instanceof Error
          ? `PDF parsing failed: ${error.message.slice(0, 240)}`
          : 'PDF parsing failed. Please try a valid text-based PDF or an OCR-processed copy.',
      };
    }
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
