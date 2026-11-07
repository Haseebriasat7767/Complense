/** Persistent remediation plans and their audit history. */
import crypto from 'node:crypto';
import { Router } from 'express';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import { optionalEnum, optionalString, requireObjectBody } from '../http/validate.js';
import { getStore } from '../store/index.js';
import { resolveWorkspace } from './workspace.js';
import type { RemediationRecord, RemediationStatus, RemediationPriority } from '../domain/types.js';

export const remediationsRouter = Router();
remediationsRouter.use(requireAuth());

const statuses: RemediationStatus[] = ['open','in_progress','blocked','ready_for_review','verified','dismissed'];
const priorities: RemediationPriority[] = ['critical','high','medium','low'];
const newId = () => `rem-${crypto.randomBytes(8).toString('hex')}`;
const eventId = () => `rme-${crypto.randomBytes(8).toString('hex')}`;

remediationsRouter.get('/remediations', asyncHandler(async (req, res) => {
  const session = sessionOf(req);
  const workspace = await resolveWorkspace(req, typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined);
  const items = await getStore().listRemediations(session.org, workspace.id);
  res.json({ items, total: items.length });
}));

remediationsRouter.post('/remediations', asyncHandler(async (req, res) => {
  const session = sessionOf(req);
  const body = requireObjectBody(req.body);
  const workspace = await resolveWorkspace(req, typeof body.workspaceId === 'string' ? body.workspaceId : undefined);
  const now = new Date().toISOString();
  const status = optionalEnum(body.status, 'status', statuses) ?? 'open';
  const priority = optionalEnum(body.priority, 'priority', priorities) ?? 'medium';
  const controlId = optionalString(body.controlId, 'controlId', 120);
  const controlCode = optionalString(body.controlCode, 'controlCode', 80);
  const title = optionalString(body.title, 'title', 180);
  if (!controlId || !controlCode || !title) throw ApiError.badRequest('controlId, controlCode and title are required.');
  const record: RemediationRecord = {
    id: newId(), organizationId: session.org, workspaceId: workspace.id,
    controlId, controlCode, title,
    description: optionalString(body.description, 'description', 4000) ?? '',
    owner: optionalString(body.owner, 'owner', 180) ?? session.email,
    dueDate: optionalString(body.dueDate, 'dueDate', 40) ?? null,
    status, priority,
    requiredProof: optionalString(body.requiredProof, 'requiredProof', 4000) ?? '',
    createdBy: session.sub, createdAt: now, updatedAt: now,
    verifiedBy: null, verifiedAt: null,
  };
  const store = getStore();
  const created = await store.createRemediation(record);
  await store.recordRemediationEvent({
    id: eventId(), organizationId: session.org, workspaceId: workspace.id,
    remediationId: created.id, actorId: session.sub, action: 'created',
    detail: 'Remediation plan created.', at: now,
  });
  res.status(201).json({ remediation: created });
}));

remediationsRouter.get('/remediations/:id/events', asyncHandler(async (req, res) => {
  const session = sessionOf(req);
  const workspace = await resolveWorkspace(req, typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined);
  const store = getStore();
  const record = await store.getRemediation(req.params.id as string, session.org, workspace.id);
  if (!record) throw ApiError.notFound('Remediation not found.');
  const items = await store.listRemediationEvents(session.org, workspace.id, record.id);
  res.json({ items, total: items.length });
}));

remediationsRouter.patch('/remediations/:id', asyncHandler(async (req, res) => {
  const session = sessionOf(req);
  const workspace = await resolveWorkspace(req, typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined);
  const body = requireObjectBody(req.body);
  const store = getStore();
  const current = await store.getRemediation(req.params.id as string, session.org, workspace.id);
  if (!current) throw ApiError.notFound('Remediation not found.');
  const patch: Partial<RemediationRecord> = { updatedAt: new Date().toISOString() };
  for (const key of ['title','description','owner','dueDate','requiredProof'] as const) {
    if (body[key] !== undefined) {
      const limits = { title: 180, description: 4000, owner: 180, dueDate: 40, requiredProof: 4000 };
      (patch as Record<string, unknown>)[key] = body[key] === null && key === 'dueDate'
        ? null : optionalString(body[key], key, limits[key]) ?? '';
    }
  }
  if (body.status !== undefined) patch.status = optionalEnum(body.status, 'status', statuses);
  if (body.priority !== undefined) patch.priority = optionalEnum(body.priority, 'priority', priorities);
  if (patch.status === 'verified') {
    patch.verifiedBy = session.sub;
    patch.verifiedAt = patch.updatedAt!;
  }
  const updated = await store.updateRemediation(current.id, session.org, workspace.id, patch);
  if (!updated) throw ApiError.notFound('Remediation not found.');
  await store.recordRemediationEvent({
    id: eventId(), organizationId: session.org, workspaceId: workspace.id,
    remediationId: current.id, actorId: session.sub, action: 'updated',
    detail: `Updated fields: ${Object.keys(patch).join(', ')}`, at: patch.updatedAt!,
  });
  res.json({ remediation: updated });
}));
