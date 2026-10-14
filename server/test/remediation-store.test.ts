import { afterEach, describe, expect, it } from 'vitest';
import type { RemediationEvent, RemediationRecord } from '../src/domain/types.js';
import { MemoryStore } from '../src/store/memory.js';

let store: MemoryStore | undefined;

function makeRecord(overrides: Partial<RemediationRecord> = {}): RemediationRecord {
  const now = '2026-10-14T12:00:00.000Z';
  return {
    id: 'rem-test-1',
    organizationId: 'org-demo',
    workspaceId: 'ws-demo',
    controlId: 'SOC2-CC6.1',
    controlCode: 'SOC2-CC6.1',
    title: 'Implement quarterly access reviews',
    description: 'Document and perform access reviews.',
    owner: 'Security',
    dueDate: '2026-11-01',
    status: 'open',
    priority: 'high',
    requiredProof: 'Approved access review record',
    createdBy: 'user-demo',
    createdAt: now,
    updatedAt: now,
    verifiedBy: null,
    verifiedAt: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<RemediationEvent> = {}): RemediationEvent {
  return {
    id: 'event-test-1',
    organizationId: 'org-demo',
    workspaceId: 'ws-demo',
    remediationId: 'rem-test-1',
    actorId: 'user-demo',
    action: 'created',
    detail: 'Remediation created',
    at: '2026-10-14T12:00:00.000Z',
    ...overrides,
  };
}

afterEach(async () => {
  await store?.close();
  store = undefined;
});

describe('MemoryStore remediation persistence', () => {
  it('creates, lists and retrieves a record only inside its organization and workspace', async () => {
    store = new MemoryStore();
    await store.init();
    const workspaces = await store.listWorkspaces('org-demo');
    const workspaceId = workspaces[0]?.id ?? 'ws-demo';
    const record = makeRecord({ organizationId: 'org-demo', workspaceId });
    await store.createRemediation(record);

    expect(await store.getRemediation(record.id, 'org-demo', workspaceId)).toEqual(record);
    expect(await store.listRemediations('org-demo', workspaceId)).toContainEqual(record);
    expect(await store.getRemediation(record.id, 'another-org', workspaceId)).toBeNull();
    expect(await store.getRemediation(record.id, 'org-demo', 'another-workspace')).toBeNull();
    expect(await store.listRemediations('another-org', workspaceId)).toEqual([]);
  });

  it('updates mutable fields without allowing identity or creator fields to be overwritten', async () => {
    store = new MemoryStore();
    await store.init();
    const workspaceId = (await store.listWorkspaces('org-demo'))[0]?.id ?? 'ws-demo';
    const record = makeRecord({ organizationId: 'org-demo', workspaceId });
    await store.createRemediation(record);

    const updated = await store.updateRemediation(record.id, 'org-demo', workspaceId, {
      status: 'in_progress',
      owner: 'IT Operations',
      id: 'attacker-controlled-id',
      organizationId: 'attacker-org',
      workspaceId: 'attacker-workspace',
      createdBy: 'attacker-user',
      createdAt: '2000-01-01T00:00:00.000Z',
    });
    expect(updated).toMatchObject({
      id: record.id,
      organizationId: 'org-demo',
      workspaceId,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      status: 'in_progress',
      owner: 'IT Operations',
    });
    expect(await store.updateRemediation(record.id, 'another-org', workspaceId, { status: 'verified' })).toBeNull();
  });

  it('stores and scopes event history and returns newest events first', async () => {
    store = new MemoryStore();
    await store.init();
    const workspaceId = (await store.listWorkspaces('org-demo'))[0]?.id ?? 'ws-demo';
    const record = makeRecord({ organizationId: 'org-demo', workspaceId });
    await store.createRemediation(record);
    await store.recordRemediationEvent(makeEvent({ organizationId: 'org-demo', workspaceId, at: '2026-10-13T12:00:00.000Z' }));
    await store.recordRemediationEvent(makeEvent({ id: 'event-test-2', organizationId: 'org-demo', workspaceId, action: 'status_changed', at: '2026-10-14T12:00:00.000Z' }));

    const events = await store.listRemediationEvents('org-demo', workspaceId, record.id);
    expect(events.map((event) => event.action)).toEqual(['status_changed', 'created']);
    expect(await store.listRemediationEvents('another-org', workspaceId, record.id)).toEqual([]);
    expect(await store.listRemediationEvents('org-demo', workspaceId, 'another-record')).toEqual([]);
  });
});
