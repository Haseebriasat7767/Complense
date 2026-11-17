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

describe('PDF evidence extraction with PDF.js', () => {
  it('extracts readable text from a compressed, text-based PDF', async () => {
    const source = [
      'Quarterly access review evidence for the production environment.',
      'The security team reviewed privileged accounts and removed unnecessary permissions.',
      'Approvals were recorded by the system owner and retained for audit review.',
    ].join(' ');
    const result = await extractText({
      buffer: await createPdf(source),
      extension: 'pdf',
      fileName: 'quarterly-access-review.pdf',
    });

    expect(result.method).toBe('pdf-text-layer');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.text).toContain('Quarterly access review evidence');
    expect(result.text).toContain('privileged accounts');
  });

  it('extracts text from every page of a five-page PDF', async () => {
    const pages = [
      'PAGE ONE: information security policy and governance responsibilities.',
      'PAGE TWO: quarterly access reviews and multifactor authentication requirements.',
      'PAGE THREE: encryption, data retention, and secure disposal requirements.',
      'PAGE FOUR: security logging, monitoring alerts, and incident response testing.',
      'PAGE FIVE: backup restoration tests and business continuity planning.',
    ];
    const result = await extractText({
      buffer: await createMultiPagePdf(pages),
      extension: 'pdf',
      fileName: 'five-page-security-policy.pdf',
    });

    expect(result.method).toBe('pdf-text-layer');
    for (const page of pages) expect(result.text).toContain(page);
    expect(result.note).toContain('5 PDF page(s)');
  });

  it('flags PDFs with pages that have no text layer for manual review', async () => {
    const result = await extractText({
      buffer: await createMultiPagePdf([
        'PAGE ONE: information security policy and governance responsibilities.',
        '',
        'PAGE THREE: security logging and incident response requirements.',
      ]),
      extension: 'pdf',
      fileName: 'partially-scanned-policy.pdf',
    });

    expect(result.method).toBe('pdf-text-layer');
    expect(result.text).toContain('PAGE ONE');
    expect(result.text).toContain('PAGE THREE');
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.note).toContain('only 2 of 3 PDF page(s)');
    expect(result.note).toContain('require OCR');
  });

  it('does not pretend an image-only or empty PDF has extractable text', async () => {
    const result = await extractText({
      buffer: await createPdf(''),
      extension: 'pdf',
      fileName: 'empty-scan.pdf',
    });

    expect(result.method).toBe('unavailable');
    expect(result.confidence).toBe(0);
    expect(result.text).toBe('');
  });
});
