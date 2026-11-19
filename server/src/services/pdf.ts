import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ExtractionResult } from './extract.js';

const exec = promisify(execFile);
const MAX_PAGES = 20;
const MAX_CHARS = 200_000;
const TIMEOUT_MS = 90_000;
// Bound expensive rasterization/OCR across concurrent uploads in this process.
let active = false;

/** Local Poppler + Tesseract pipeline. No evidence is sent to external services. */
export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const unavailable = (note: string): ExtractionResult => ({ text: '', method: 'unavailable', confidence: 0, note });
  if (active) return unavailable('PDF processing is busy. Please upload this file again shortly.');
  active = true;
  let directory: string | undefined;
  const deadline = Date.now() + TIMEOUT_MS;
  const run = async (command: string, args: string[]) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('PDF processing timed out');
    return exec(command, args, { timeout: remaining, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, OMP_THREAD_LIMIT: '1' } });
  };
  try {
    directory = await mkdtemp(path.join(tmpdir(), 'complylens-pdf-'));
    const input = path.join(directory, 'input.pdf');
    await writeFile(input, buffer, { mode: 0o600 });
    const { stdout: info } = await run('pdfinfo', [input]);
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!Number.isInteger(pages) || pages < 1) return unavailable('The PDF has no readable pages.');
    if (pages > MAX_PAGES) return unavailable(`PDF processing supports up to ${MAX_PAGES} pages. Split this document into smaller files and upload again.`);
    const parts: string[] = [];
    let usedOcr = false;
    let incomplete = false;
    let totalChars = 0;
    for (let page = 1; page <= pages; page++) {
      const { stdout } = await run('pdftotext', ['-f', String(page), '-l', String(page), '-layout', input, '-']);
      let text = stdout.replace(/\f/g, '').trim();
      // A sparse text layer can be a scanner watermark, not page content.
      if (text.length < 80) {
        usedOcr = true;
        const prefix = path.join(directory, 'page');
        await run('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', '2400', '-png', input, prefix]);
        const { stdout: recognized } = await run('tesseract', [`${prefix}.png`, 'stdout', '-l', 'eng', 'tsv']);
        const words: string[] = [];
        const confidences: number[] = [];
        for (const line of recognized.split('\n').slice(1)) {
          const columns = line.split('\t');
          const word = columns.slice(11).join('\t').trim();
          const confidence = Number(columns[10]);
          if (columns[0] === '5' && word && Number.isFinite(confidence) && confidence >= 0) {
            words.push(word);
            confidences.push(confidence);
          }
        }
        const ocr = words.join(' ');
        // Keep short valid text when recognition finds nothing useful.
        if (ocr.length > text.length) text = ocr;
        if (!confidences.length || confidences.reduce((a, b) => a + b, 0) / confidences.length < 60) incomplete = true;
      }
      if (!text) incomplete = true;
      totalChars += text.length;
      if (totalChars > MAX_CHARS) return unavailable('PDF text exceeds the processing limit. Split this document into smaller files and upload again.');
      parts.push(text);
    }
    const text = parts.join('\n\n').trim();
    if (!text) return unavailable('No readable text was found, including after OCR. Upload a clearer scan or a text-based PDF.');
    return {
      text,
      method: usedOcr ? 'pdf-ocr' : 'pdf-text-layer',
      // OCR must not automatically satisfy compliance controls.
      confidence: usedOcr || incomplete ? 0.7 : 0.9,
      note: usedOcr
        ? 'Local OCR was used. Verify recognized text against the original PDF; this evidence requires manual review.'
        : 'Text extracted from the PDF text layer.',
    };
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    return unavailable(missing
      ? 'PDF processing tools are unavailable. Install Poppler and Tesseract with English language data, then re-upload the PDF.'
      : 'PDF processing failed or exceeded the 90-second limit. The file may be damaged, password-protected, or too complex. Upload an unlocked PDF or split it into smaller files.');
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    active = false;
  }
}
