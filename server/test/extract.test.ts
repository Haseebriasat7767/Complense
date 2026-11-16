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
