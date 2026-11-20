import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { extractText } from '../src/services/extract.js';

function makeDocx(xml: string): Buffer {
  const name = Buffer.from('word/document.xml');
  const raw = Buffer.from(xml, 'utf8');
  const compressed = deflateRawSync(raw);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const localRecord = Buffer.concat([local, name, compressed]);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const centralRecord = Buffer.concat([central, name]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralRecord.length, 12);
  eocd.writeUInt32LE(localRecord.length, 16);
  return Buffer.concat([localRecord, centralRecord, eocd]);
}

describe('DOCX extraction', () => {
  it('extracts paragraphs, tabs and XML entities from word/document.xml', async () => {
    const buffer = makeDocx(
      '<w:document xmlns:w="urn:w"><w:body><w:p><w:r><w:t>Access control policy &amp; MFA</w:t></w:r></w:p><w:p><w:r><w:t>Quarterly access review completed.</w:t></w:r><w:r><w:tab/><w:t>Owner: Security</w:t></w:r></w:p></w:body></w:document>',
    );
    const result = await extractText({ buffer, extension: 'docx', fileName: 'policy.docx' });
    expect(result.method).toBe('docx-text-layer');
    expect(result.text).toContain('Access control policy & MFA');
    expect(result.text).toContain('Quarterly access review completed.');
    expect(result.text).toContain('Owner: Security');
  });

  it('returns a controlled extraction failure for invalid DOCX input', async () => {
    const result = await extractText({ buffer: Buffer.from('not a zip file'), extension: 'docx', fileName: 'broken.docx' });
    expect(result.method).toBe('unavailable');
    expect(result.text).toBe('');
    expect(result.note).toMatch(/ZIP directory/i);
  });
});
