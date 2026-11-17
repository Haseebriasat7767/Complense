import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { extractText } from '../src/services/extract.js';

async function createPdf(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ compress: true });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    if (text) document.text(text);
    document.end();
  });
}


async function createMultiPagePdf(pages: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ compress: true });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    pages.forEach((page, index) => {
      if (index > 0) document.addPage();
      document.fontSize(11).text(page);
    });
    document.end();
  });
}

describe('PDF evidence extraction', () => {
  it('extracts readable text from a compressed, text-based PDF', async () => {
    const source = [
      'Quarterly access review evidence for the production environment.',
      'The security team reviewed privileged accounts and removed unnecessary permissions.',
      'Approvals were recorded by the system owner and retained for audit review.',
    ].join(' ');
    const result = extractText({
      buffer: await createPdf(source),
      extension: 'pdf',
      fileName: 'quarterly-access-review.pdf',
    });

    expect(result.method).toBe('pdf-text-layer');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.text).toContain('Quarterly access review evidence');
    expect(result.text).toContain('privileged accounts');
  });

  it('extracts text when a PDF stream has no newline before endstream', () => {
    const text = 'Northstar security policy requires quarterly access reviews and approved multifactor authentication for privileged production accounts.';
    const stream = `BT /F1 12 Tf (${text}) Tj ET`;
    // Minimal PDF content stream matching generators that put endstream
    // immediately after the declared stream bytes (without a trailing newline).
    const pdf = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream\nendobj\n%%EOF`,
      'latin1',
    );
    const result = extractText({
      buffer: pdf,
      extension: 'pdf',
      fileName: 'northstar-information-security-policy.pdf',
    });

    expect(result.method).toBe('pdf-text-layer');
    expect(result.text).toContain('quarterly access reviews');
    expect(result.text).toContain('multifactor authentication');
  });

  it('extracts text from every ASCII85+Flate compressed page stream', async () => {
    const { deflateSync } = await import('node:zlib');
    const encodeAscii85 = (input: Buffer): string => {
      let encoded = '';
      for (let offset = 0; offset < input.length; offset += 4) {
        const chunk = input.subarray(offset, offset + 4);
        const padded = Buffer.alloc(4);
        chunk.copy(padded);
        let value = BigInt(padded.readUInt32BE(0));
        const digits = new Array<string>(5);
        for (let index = 4; index >= 0; index -= 1) {
          digits[index] = String.fromCharCode(Number(value % 85n) + 33);
          value /= 85n;
        }
        encoded += digits.join('').slice(0, chunk.length + 1);
      }
      return encoded;
    };
    const pageOne = 'BT /F1 12 Tf (Page one contains the approved access control policy and quarterly access reviews.) Tj ET';
    const pageTwo = 'BT /F1 12 Tf (Page two requires multifactor authentication and annual incident response testing.) Tj ET';
    const streamOne = encodeAscii85(deflateSync(Buffer.from(pageOne, 'latin1')));
    const streamTwo = encodeAscii85(deflateSync(Buffer.from(pageTwo, 'latin1')));
    const pdf = Buffer.from(
      [
        '%PDF-1.4',
        '1 0 obj',
        `<< /Length ${Buffer.byteLength(streamOne, 'latin1')} /Filter [ /ASCII85Decode /FlateDecode ] >>`,
        'stream',
        streamOne,
        'endstream',
        'endobj',
        '2 0 obj',
        `<< /Length ${Buffer.byteLength(streamTwo, 'latin1')} /Filter [ /ASCII85Decode /FlateDecode ] >>`,
        'stream',
        streamTwo,
        'endstream',
        'endobj',
        '%%EOF',
      ].join('\n'),
      'latin1',
    );
    const result = extractText({
      buffer: pdf,
      extension: 'pdf',
      fileName: 'multi-page-security-policy.pdf',
    });

    expect(result.method).toBe('pdf-text-layer');
    expect(result.text).toContain('Page one contains the approved access control policy');
    expect(result.text).toContain('Page two requires multifactor authentication');
  });


  it('extracts text from every page of a five-page PDF', async () => {
    const pages = [
      'PAGE ONE: information security policy and governance responsibilities.',
      'PAGE TWO: quarterly access reviews and multifactor authentication requirements.',
      'PAGE THREE: encryption, data retention, and secure disposal requirements.',
      'PAGE FOUR: security logging, monitoring alerts, and incident response testing.',
      'PAGE FIVE: backup restoration tests and business continuity planning.',
    ];
    const result = extractText({
      buffer: await createMultiPagePdf(pages),
      extension: 'pdf',
      fileName: 'five-page-security-policy.pdf',
    });

    expect(result.method).toBe('pdf-text-layer');
    for (const page of pages) expect(result.text).toContain(page);
  });

  it('does not pretend an image-only or empty PDF has extractable text', async () => {
    const result = extractText({
      buffer: await createPdf(''),
      extension: 'pdf',
      fileName: 'empty-scan.pdf',
    });

    expect(result.method).toBe('unavailable');
    expect(result.confidence).toBe(0);
    expect(result.text).toBe('');
  });
});
