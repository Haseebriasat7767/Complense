/**
 * Public demo endpoints — no sign-in required.
 *
 * Guards the buyer trust surface: the AcmeCloud demo workspace must be
 * viewable without an account, must report the real engine scores
 * (SOC 2 77%, ISO 27001 61%), and must serve a downloadable sample PDF.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { attachErrorHandling, createApp } from '../src/app.js';
import { closeStore, initStore } from '../src/store/index.js';

vi.mock('../src/services/original-files.js', () => ({
  uploadOriginalFile: vi.fn().mockResolvedValue(undefined),
  downloadOriginalFile: vi.fn(),
  deleteOriginalFile: vi.fn().mockResolvedValue(undefined),
}));

let server: http.Server;
let base: string;

beforeAll(async () => {
  await initStore();
  const app = createApp();
  attachErrorHandling(app);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeStore();
});

describe('public demo', () => {
  it('GET /api/demo/readiness works without auth and reports the real engine scores', async () => {
    const response = await fetch(`${base}/api/demo/readiness`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      demo: boolean;
      companyName: string;
      frameworks: {
        soc2: { index: number; counts: { reviewed: number; passed: number } };
        iso27001: { index: number; counts: { reviewed: number; passed: number } };
      };
      documents: Array<{ fileName: string }>;
    };
    expect(body.demo).toBe(true);
    expect(body.companyName).toBe('AcmeCloud');
    expect(body.frameworks.soc2.index).toBe(77);
    expect(body.frameworks.soc2.counts).toMatchObject({ reviewed: 23, passed: 18 });
    expect(body.frameworks.iso27001.index).toBe(61);
    expect(body.frameworks.iso27001.counts).toMatchObject({ reviewed: 16, passed: 7 });
    expect(body.documents.length).toBe(10);
  });

  it('GET /api/demo/report.pdf serves a real PDF for each framework', async () => {
    for (const framework of ['soc2', 'iso27001'] as const) {
      const response = await fetch(`${base}/api/demo/report.pdf?framework=${framework}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/pdf');
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(Buffer.from(bytes.subarray(0, 5)).toString('ascii')).toBe('%PDF-');
      expect(bytes.length).toBeGreaterThan(1000);
    }
  });

  it('GET /api/demo/report.pdf rejects an unknown framework', async () => {
    const response = await fetch(`${base}/api/demo/report.pdf?framework=hipaa`);
    expect(response.status).toBe(400);
  });
});
