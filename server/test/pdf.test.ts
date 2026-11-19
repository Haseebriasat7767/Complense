import { afterEach, describe, expect, it, vi } from 'vitest';
const { run, removed, written } = vi.hoisted(() => ({ run: vi.fn(), removed: vi.fn().mockResolvedValue(undefined), written: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:util', () => ({ promisify: () => run }));
vi.mock('node:fs/promises', async (original) => ({
  ...await original<typeof import('node:fs/promises')>(),
  mkdtemp: vi.fn().mockResolvedValue('/tmp/complylens-test'),
  writeFile: written,
  rm: removed,
}));
import { extractText } from '../src/services/extract.js';

const extract = () => extractText({ buffer: Buffer.from('%PDF-test'), extension: 'pdf', fileName: 'scan.pdf' });
const tsv = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t95\tRecognized evidence from scan\n';
afterEach(() => { vi.clearAllMocks(); run.mockReset(); });

describe('PDF extraction with OCR fallback', () => {
  it('extracts text-based PDFs without rasterization', async () => {
    run.mockResolvedValueOnce({ stdout: 'Pages: 1' }).mockResolvedValueOnce({ stdout: 'Readable evidence text. '.repeat(10) });
    const result = await extract();
    expect(result.method).toBe('pdf-text-layer');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(run).toHaveBeenCalledTimes(2);
    expect(removed).toHaveBeenCalledWith('/tmp/complylens-test', { recursive: true, force: true });
  });
  it('recognizes scans locally but requires manual review', async () => {
    run.mockResolvedValueOnce({ stdout: 'Pages: 1' }).mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' }).mockResolvedValueOnce({ stdout: tsv });
    const result = await extract();
    expect(result.method).toBe('pdf-ocr');
    expect(result.text).toContain('Recognized evidence');
    expect(result.confidence).toBeLessThan(0.8);
    expect(run.mock.calls[2][0]).toBe('pdftoppm');
    expect(run.mock.calls[3][0]).toBe('tesseract');
  });
  it('preserves short valid text if OCR is blank', async () => {
    run.mockResolvedValueOnce({ stdout: 'Pages: 1' }).mockResolvedValueOnce({ stdout: 'Short policy.' })
      .mockResolvedValueOnce({ stdout: '' }).mockResolvedValueOnce({ stdout: '' });
    expect((await extract()).text).toBe('Short policy.');
  });
  it('rejects over-limit PDFs without partially analyzing them', async () => {
    run.mockResolvedValueOnce({ stdout: 'Pages: 21' });
    expect((await extract()).note).toContain('20 pages');
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('reports missing tools and cleans temporary files', async () => {
    run.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    expect((await extract()).note).toContain('Install Poppler');
    expect(removed).toHaveBeenCalled();
  });
  it('reports processing failures without retaining partial text', async () => {
    run.mockRejectedValueOnce(new Error('timeout'));
    expect((await extract()).text).toBe('');
    expect(removed).toHaveBeenCalled();
  });
});
