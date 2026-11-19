/**
 * Evidence text extraction for text-based PDFs, DOCX, TXT and CSV.
 * Scanned PDFs require OCR; this service reports that clearly rather than
 * pretending an image-only file contains extractable text.
 */
import { inflateSync, inflateRawSync } from 'node:zlib';
import { unzipSync } from 'fflate';

export type ExtractionResult = {
  text: string;
  method: 'direct-text' | 'pdf-text-layer' | 'pdf-ocr' | 'docx-text-layer' | 'unavailable';
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
  return value
    .replace(/\\([nrtbf()\\])/g, (_match, escaped: string) => {
      const map: Record<string, string> = {
        n: '\n', r: '\r', t: '\t', b: '\b', f: '\f',
        '(': '(', ')': ')', '\\': '\\',
      };
      return map[escaped] ?? escaped;
    })
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) =>
      String.fromCharCode(parseInt(octal, 8)),
    );
}

function decodeAscii85(input: Buffer): Buffer {
  let source = input.toString('latin1').replace(/\s+/g, '');
  source = source.replace(/^<~/, '').replace(/~>$/, '');
  const output: number[] = [];
  let group: number[] = [];
  const flush = (values: number[], final = false) => {
    if (final && values.length === 1) return;
    const originalLength = values.length;
    const padded = [...values];
    while (padded.length < 5) padded.push(84);
    let value = 0;
    for (const digit of padded) value = value * 85 + digit;
    const bytes = [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
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
  // The stream boundary can be CRLF or LF. Try both zlib-wrapped and raw
  // deflate streams because real-world PDF generators vary.
  const streamPattern = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streamPattern)) {
    const dictionary = match[1] ?? '';
    let stream: Buffer<ArrayBufferLike> = Buffer.from(match[2] ?? '', 'latin1');
    try {
      if (/\/ASCII85Decode\b|\/A85\b/.test(dictionary)) stream = decodeAscii85(stream);
      if (/\/FlateDecode\b|\/Fl\b/.test(dictionary)) {
        try { stream = inflateSync(stream); } catch { stream = inflateRawSync(stream); }
      } else if (/\/Filter\b/.test(dictionary) && !/\/ASCII85Decode\b|\/A85\b/.test(dictionary)) {
        continue;
      }
    } catch {
      continue;
    }
    const body = stream.toString('latin1');
    const operatorPattern = /\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:.|\n)*?)\]\s*TJ/g;
    for (const op of body.matchAll(operatorPattern)) {
      if (op[1] !== undefined) chunks.push(decodePdfLiteral(op[1]));
      else if (op[2] !== undefined) {
        for (const part of op[2].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
          chunks.push(decodePdfLiteral(part[1] ?? ''));
        }
      }
      chunks.push('\n');
    }
  }
  return chunks.join('');
}

/**
 * OCR fallback for scanned/image-only PDFs.
 *
 * PDF.js renders a bounded number of pages to PNG using the Node canvas
 * implementation; Tesseract.js recognizes the rendered page images. Workers
 * are always terminated and document/page resources are cleaned up.
 */
async function extractPdfWithOcr(buffer: Buffer): Promise<{ text: string; confidence: number; pages: number }> {
  const canvasModule = await import('@napi-rs/canvas');
  const { createCanvas, DOMMatrix, ImageData, Path2D } = canvasModule;
  // PDF.js expects browser geometry/image globals in Node. Supply the
  // compatible implementations from napi-rs/canvas before loading PDF.js.
  Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    stopAtErrors: false,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const pages: string[] = [];
  const confidences: number[] = [];
  const maxPages = Math.min(pdf.numPages, 10);
  try {
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise;
      const result = await worker.recognize(canvas.toBuffer('image/png'));
      const pageText = clean(result.data.text);
      if (pageText) pages.push(pageText);
      confidences.push(Number(result.data.confidence) || 0);
      page.cleanup();
    }
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }
  const text = clean(pages.join('\n\n'));
  const confidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : 0;
  return { text, confidence, pages: maxPages };
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

function extractDocxText(buffer: Buffer): string {
  const files = unzipSync(new Uint8Array(buffer));
  const xmlFiles = Object.keys(files).filter((name) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/i.test(name),
  );
  if (!xmlFiles.includes('word/document.xml')) {
    throw new Error('The DOCX archive does not contain word/document.xml.');
  }
  const parts: string[] = [];
  for (const name of xmlFiles) {
    const xml = new TextDecoder('utf-8').decode(files[name]);
    // Paragraphs, table cells and explicit line breaks are separated so
    // content is readable by downstream compliance mapping.
    const text = xml
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tc>/g, ' | ')
      .replace(/<[^>]+>/g, '');
    parts.push(decodeXml(text));
  }
  return clean(parts.join('\n'));
}

export async function extractText(input: {
  buffer: Buffer;
  extension: string;
  fileName: string;
}): Promise<ExtractionResult> {
  const extension = input.extension.toLowerCase();

  if (['txt', 'csv', 'md', 'json', 'log'].includes(extension)) {
    const text = clean(input.buffer.toString('utf8'));
    if (!text) return { text: '', method: 'unavailable', confidence: 0, note: 'The file contains no readable text.' };
    return {
      text, method: 'direct-text', confidence: 1,
      note: `${text.length.toLocaleString('en-US')} characters read directly from the ${extension.toUpperCase()} file.`,
    };
  }

  if (extension === 'pdf') {
    const text = clean(extractPdfText(input.buffer));
    if (text.length >= 40) {
      return {
        text, method: 'pdf-text-layer', confidence: 0.8,
        note: 'Text extracted from PDF content streams. Verify it against the original document before relying on it.',
      };
    }
    try {
      const ocr = await extractPdfWithOcr(input.buffer);
      if (ocr.text.length >= 20) {
        const confidence = ocr.confidence >= 65 ? 0.82 : 0.68;
        return {
          text: ocr.text,
          method: 'pdf-ocr',
          confidence,
          note: `OCR read ${ocr.text.length.toLocaleString('en-US')} characters from up to ${ocr.pages} PDF pages (average OCR confidence ${Math.round(ocr.confidence)}%). Review the extracted text against the original before relying on compliance conclusions.`,
        };
      }
      return {
        text: '', method: 'unavailable', confidence: 0,
        note: 'OCR ran, but it could not recognize enough readable text. The PDF may be blank, very low resolution, or use an unsupported language.',
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown OCR error';
      return {
        text: '', method: 'unavailable', confidence: 0,
        note: `PDF text extraction and OCR both failed: ${detail.slice(0, 220)}`,
      };
    }
  }

  if (extension === 'docx') {
    try {
      const text = extractDocxText(input.buffer);
      if (text.length >= 20) {
        return {
          text, method: 'docx-text-layer', confidence: 0.95,
          note: `${text.length.toLocaleString('en-US')} characters extracted from the DOCX document XML.`,
        };
      }
      return { text: '', method: 'unavailable', confidence: 0, note: 'The DOCX document contains no readable body text.' };
    } catch {
      return { text: '', method: 'unavailable', confidence: 0, note: 'The DOCX file could not be opened as a valid Office document. Re-save it as .docx and upload again.' };
    }
  }

  return {
    text: '', method: 'unavailable', confidence: 0,
    note: `Files of type .${extension} cannot be parsed in this build. Supported: PDF, DOCX, TXT, CSV.`,
  };
}
