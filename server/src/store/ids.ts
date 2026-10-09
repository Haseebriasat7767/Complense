/**
 * Prefixed record identifiers.
 *
 * ComplyLens uses readable text ids (`ev-<hex>`, `rpt-<hex>`, `aud-<hex>`)
 * rather than UUIDs: they are part of the public API contract and of the
 * deterministic demo seed (`ev-demo-<key>`), and the PostgreSQL schema stores
 * them as TEXT primary keys for exactly that reason.
 */
import crypto from 'node:crypto';

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}
