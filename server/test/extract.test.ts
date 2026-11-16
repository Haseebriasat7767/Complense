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

  it('extracts text when a PDF stream has no newline before endstream', () => {
    const text = 'Northstar security policy requires quarterly access reviews and approved multifactor authentication for privileged production accounts.';
    const stream = `BT /F1 12 Tf (${text}) Tj ET`;
    // Minimal PDF content stream matching generators that put endstream
    // immediately after the declared stream bytes (without a trailing newline).
    const pdf = Buffer.from(
      `%PDF-1.4\\n1 0 obj\\n<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\\nstream\\n${stream}endstream\\nendobj\\n%%EOF`,
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
