import { config } from '../config.js';

const BUCKET = 'evidence-originals';

function credentials() {
  const { supabaseUrl, supabaseSecretKey } = config.database;
  if (!supabaseUrl || !supabaseSecretKey) throw new Error('Original evidence storage is not configured.');
  const headers: Record<string, string> = { apikey: supabaseSecretKey };
  if (!supabaseSecretKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${supabaseSecretKey}`;
  return { base: supabaseUrl.replace(/\\/$/, ''), headers };
}

function objectUrl(base: string, path: string): string {
  const safePath = path.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${base}/storage/v1/object/${BUCKET}/${safePath}`;
}

async function checkedFetch(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error('Could not reach private evidence storage.');
  }
  if (!response.ok) {
    // Never include response bodies: Storage errors can contain object metadata.
    throw new Error(`Private evidence storage request failed (HTTP ${response.status}). Ensure the evidence-originals bucket migration is applied.`);
  }
  return response;
}

export async function uploadOriginalFile(path: string, bytes: Buffer, contentType: string): Promise<void> {
  const { base, headers } = credentials();
  await checkedFetch(objectUrl(base, path), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': contentType, 'x-upsert': 'false', 'cache-control': '3600' },
    body: new Uint8Array(bytes),
  });
}

export async function downloadOriginalFile(path: string): Promise<{ bytes: Buffer; contentType: string }> {
  const { base, headers } = credentials();
  const response = await checkedFetch(objectUrl(base, path), { method: 'GET', headers });
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
}

export async function deleteOriginalFile(path: string): Promise<void> {
  const { base, headers } = credentials();
  await checkedFetch(`${base}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [path] }),
  });
}
