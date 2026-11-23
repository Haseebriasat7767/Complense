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

/** WordprocessingML parts whose text is evidence, not formatting. */
const DOCX_TEXT_PARTS = [
  'word/document.xml',
  'word/footnotes.xml',
  'word/endnotes.xml',
  'word/comments.xml',
];

function isDocxTextPart(name: string): boolean {
  return (
    DOCX_TEXT_PARTS.includes(name) ||
    /^word\/header\d+\.xml$/.test(name) ||
    /^word\/footer\d+\.xml$/.test(name)
  );
}

/** Read a (possibly ZIP64) size from an extra field block, tag 0x0001. */
function zip64Sizes(extra: Buffer): { compressedSize?: number; uncompressedSize?: number } {
  let cursor = 0;
  const result: { compressedSize?: number; uncompressedSize?: number } = {};
  while (cursor + 4 <= extra.length) {
    const tag = extra.readUInt16LE(cursor);
    const size = extra.readUInt16LE(cursor + 2);
    const value = extra.subarray(cursor + 4, cursor + 4 + size);
    if (tag === 0x0001 && value.length >= 16) {
      result.uncompressedSize = Number(value.readBigUInt64LE(0));
      result.compressedSize = Number(value.readBigUInt64LE(8));
      break;
    }
    cursor += 4 + size;
  }
  return result;
}

function inflateEntry(compressed: Buffer, method: number): Buffer {
  if (method === 0) return Buffer.from(compressed);
  if (method === 8) return inflateRawSync(compressed, { maxOutputLength: MAX_DOCX_XML_BYTES });
  throw new Error('DOCX uses an unsupported ZIP compression method.');
}

/** Read the named part from the ZIP central directory; never trust paths from the archive. */
function extractDocxPartFromCentral(buffer: Buffer, wanted: string): string | null {
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
    let compressedSize = buffer.readUInt32LE(cursor + 20);
    let uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const extra = buffer.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (name !== wanted) continue;
    if ((flags & 1) !== 0) throw new Error('Encrypted DOCX files are not supported.');
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      const sizes = zip64Sizes(extra);
      if (sizes.compressedSize !== undefined) compressedSize = sizes.compressedSize;
      if (sizes.uncompressedSize !== undefined) uncompressedSize = sizes.uncompressedSize;
    }
    if (uncompressedSize > MAX_DOCX_XML_BYTES || compressedSize > buffer.length) throw new Error('DOCX document XML exceeds the extraction limit.');
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== localSignature) throw new Error('DOCX local file entry is invalid.');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw new Error('DOCX document data is truncated.');
    const xml = inflateEntry(buffer.subarray(dataStart, dataEnd), method);
    if (xml.length > MAX_DOCX_XML_BYTES) throw new Error('DOCX document XML exceeds the extraction limit.');
    return xml.toString('utf8');
  }
  return null;
}

/**
 * Fallback for archives whose central directory is unreadable (corrupt
 * directory, unusual writer layout): scan the whole file for local file
 * headers, validate each candidate, and collect every WordprocessingML text
 * part. No sequential walk — a bad entry can never desynchronise the scan.
 * Deflate streams self-terminate, so entries written with a data descriptor
 * (sizes zeroed in the local header) inflate from the data start to the end
 * of the file and stop at the end of their own stream.
 */
function extractDocxPartsFromLocalHeaders(buffer: Buffer): Map<string, string> {
  const localHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const parts = new Map<string, string>();
  let searchFrom = 0;
  for (;;) {
    const cursor = buffer.indexOf(localHeader, searchFrom);
    if (cursor < 0 || cursor + 30 > buffer.length) break;
    searchFrom = cursor + 4;

    const flags = buffer.readUInt16LE(cursor + 6);
    const method = buffer.readUInt16LE(cursor + 8);
    let compressedSize = buffer.readUInt32LE(cursor + 18);
    const uncompressedSize = buffer.readUInt32LE(cursor + 22);
    const nameLength = buffer.readUInt16LE(cursor + 26);
    const extraLength = buffer.readUInt16LE(cursor + 28);
    if (nameLength === 0 || nameLength > 512 || extraLength > 65_535) continue;
    if (method !== 0 && method !== 8) continue;
    if ((flags & 1) !== 0) continue;
    const name = buffer.toString('utf8', cursor + 30, cursor + 30 + nameLength);
    if (!/^[\x20-\x7e]+$/.test(name) || !isDocxTextPart(name)) continue;
    const extra = buffer.subarray(cursor + 30 + nameLength, cursor + 30 + nameLength + extraLength);
    if (compressedSize === 0xffffffff) {
      const sizes = zip64Sizes(extra);
      if (sizes.compressedSize !== undefined) compressedSize = sizes.compressedSize;
    }
    if (uncompressedSize !== 0xffffffff && uncompressedSize > MAX_DOCX_XML_BYTES) continue;
    const dataStart = cursor + 30 + nameLength + extraLength;
    if (dataStart > buffer.length) continue;
    try {
      const end = compressedSize > 0 ? Math.min(dataStart + compressedSize, buffer.length) : buffer.length;
      const xml = inflateEntry(buffer.subarray(dataStart, end), method);
      if (xml.length <= MAX_DOCX_XML_BYTES) parts.set(name, xml.toString('utf8'));
    } catch {
      // One unreadable part must not lose the rest of the document.
    }
  }
  return parts;
}

function docxPartText(xml: string): string {
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:p\s*>/gi, '\n')
    .replace(/<\/w:tr\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return clean(decodeXmlEntities(withBreaks));
}

function docxText(buffer: Buffer): string {
  let documentXml: string | null = null;
  let centralError: Error | null = null;
  const extraParts: Array<[string, string]> = [];
  try {
    documentXml = extractDocxPartFromCentral(buffer, 'word/document.xml');
    if (documentXml !== null) {
      for (const name of [...DOCX_TEXT_PARTS, 'word/header1.xml', 'word/footer1.xml']) {
        if (name === 'word/document.xml') continue;
        try {
          const xml = extractDocxPartFromCentral(buffer, name);
          if (xml !== null) extraParts.push([name, xml]);
        } catch {
          // A single unreadable part must not lose the document body.
        }
      }
      // Numbered headers/footers beyond header1/footer1.
      for (let n = 2; n <= 9; n++) {
        for (const kind of ['header', 'footer']) {
          const name = `word/${kind}${n}.xml`;
          try {
            const xml = extractDocxPartFromCentral(buffer, name);
            if (xml !== null) extraParts.push([name, xml]);
          } catch {
            // Ignore missing/unreadable parts.
          }
        }
      }
    }
  } catch (error) {
    // Central directory unreadable — keep the diagnosis for the fallback
    // below, in case nothing is recoverable from the local headers either.
    centralError = error instanceof Error ? error : new Error('DOCX ZIP directory is unreadable.');
    documentXml = null;
  }
  if (documentXml === null) {
    const localParts = extractDocxPartsFromLocalHeaders(buffer);
    const localDocument = localParts.get('word/document.xml');
    if (!localDocument) throw centralError ?? new Error('DOCX does not contain word/document.xml.');
    documentXml = localDocument;
    for (const [name, xml] of localParts) {
      if (name !== 'word/document.xml') extraParts.push([name, xml]);
    }
  }
  const sections = [docxPartText(documentXml)];
  for (const [name, xml] of extraParts) {
    const text = docxPartText(xml);
    if (text.length > 0) sections.push(`[${name.replace('word/', '').replace('.xml', '')}]\n${text}`);
  }
  return clean(sections.join('\n'));
}

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
