/** Evidence text extraction for PDF, DOCX, TXT and CSV uploads. */
import { inflateRawSync } from 'node:zlib';
import { extractPdf } from './pdf.js';

export type ExtractionResult = {
  text: string;
  method: 'direct-text' | 'pdf-text-layer' | 'docx-text-layer' | 'pdf-ocr' | 'unavailable';
  confidence: number;
  note: string;
};

const MAX_TEXT_CHARS = 200_000;
const MAX_DOCX_XML_BYTES = 8 * 1024 * 1024;

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

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const point = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
  });
}

/** Read only word/document.xml from the ZIP central directory; never trust paths from the archive. */
function extractDocxXml(buffer: Buffer): string {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const minEocd = Math.max(0, buffer.length - 22 - 65_535);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= minEocd; offset--) {
    if (buffer.readUInt32LE(offset) === eocdSignature) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('DOCX ZIP directory is missing.');
  const entries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (centralOffset + centralSize > eocd || entries > 10_000) throw new Error('DOCX ZIP directory is invalid.');

  let cursor = centralOffset;
  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== centralSignature) throw new Error('DOCX ZIP entry is invalid.');
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (name !== 'word/document.xml') continue;
    if ((flags & 1) !== 0) throw new Error('Encrypted DOCX files are not supported.');
    if (uncompressedSize > MAX_DOCX_XML_BYTES || compressedSize > buffer.length) throw new Error('DOCX document XML exceeds the extraction limit.');
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== localSignature) throw new Error('DOCX local file entry is invalid.');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw new Error('DOCX document data is truncated.');
    const compressed = buffer.subarray(dataStart, dataEnd);
    let xml: Buffer;
    if (method === 0) xml = Buffer.from(compressed);
    else if (method === 8) xml = inflateRawSync(compressed, { maxOutputLength: MAX_DOCX_XML_BYTES });
    else throw new Error('DOCX uses an unsupported ZIP compression method.');
    if (xml.length > MAX_DOCX_XML_BYTES) throw new Error('DOCX document XML exceeds the extraction limit.');
    return xml.toString('utf8');
  }
  throw new Error('DOCX does not contain word/document.xml.');
}

function docxText(buffer: Buffer): string {
  const xml = extractDocxXml(buffer);
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:p\s*>/gi, '\n')
    .replace(/<\/w:tr\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return clean(decodeXmlEntities(withBreaks));
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
      text,
      method: 'direct-text',
      confidence: 1,
      note: text.length.toLocaleString('en-US') + ' characters read directly from the ' + extension.toUpperCase() + ' file.',
    };
  }

  if (extension === 'pdf') return extractPdf(input.buffer);

  if (extension === 'docx') {
    try {
      const text = docxText(input.buffer);
      if (text.length < 20) return { text: '', method: 'unavailable', confidence: 0, note: 'The DOCX document contains no readable body text.' };
      return {
        text,
        method: 'docx-text-layer',
        confidence: 0.9,
        note: text.length.toLocaleString('en-US') + ' characters extracted from the DOCX document body. Verify evidence against the original file.',
      };
    } catch (error) {
      return {
        text: '',
        method: 'unavailable',
        confidence: 0,
        note: error instanceof Error ? error.message : 'The DOCX file could not be read. Re-save it as a standard .docx file and try again.',
      };
    }
  }

  return {
    text: '',
    method: 'unavailable',
    confidence: 0,
    note: 'Files of type .' + extension + ' cannot be parsed in this build. Supported: PDF, DOCX, TXT, CSV.',
  };
}
