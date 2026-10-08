/**
 * Evidence text extraction.
 *
 * ComplyLens never writes uploads to disk: files are parsed in memory and only
 * the extracted text is retained. Text-based formats are read directly. For
 * PDF and DOCX (compressed formats) a lightweight in-memory scan is attempted;
 * when no reliable text layer is available the document is marked
 * "needs review" rather than pretending it was analysed.
 *
 * In a production deployment this module is the single place to plug in
 * OCR or a document-parsing service.
 */
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
 * Recover readable ASCII runs from a binary container. This is a heuristic:
 * it works for uncompressed text layers and fails safely otherwise.
 */
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
    if (text.length === 0) {
      return {
        text: '',
        method: 'unavailable',
        confidence: 0,
        note: 'The file contains no readable text.',
      };
    }
    return {
      text,
      method: 'direct-text',
      confidence: 1,
      note: `${text.length.toLocaleString('en-US')} characters read directly from the ${extension.toUpperCase()} file.`,
    };
  }

  if (extension === 'pdf' || extension === 'docx') {
    const { text, runs } = scanBinaryForText(input.buffer);
    const cleaned = clean(text);
    if (cleaned.length >= 200 && runs >= 4) {
      return {
        text: cleaned,
        method: extension === 'pdf' ? 'pdf-text-layer' : 'docx-text-layer',
        confidence: 0.85,
        note: 'Text layer recovered from the uploaded file. Verify against the source document before relying on it.',
      };
    }
    if (cleaned.length >= 60) {
      return {
        text: cleaned,
        method: extension === 'pdf' ? 'pdf-text-layer' : 'docx-text-layer',
        confidence: 0.5,
        note: 'Only partial text could be recovered from this file. It is flagged for manual review.',
      };
    }
    return {
      text: '',
      method: 'unavailable',
      confidence: 0,
      note: 'No text layer was found. This is typical for scanned documents — upload a text-based export or an OCR-processed copy.',
    };
  }

  return {
    text: '',
    method: 'unavailable',
    confidence: 0,
    note: `Files of type .${extension} cannot be parsed in this build. Supported: PDF, DOCX, TXT, CSV.`,
  };
}
