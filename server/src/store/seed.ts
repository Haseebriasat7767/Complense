/**
 * Demo workspace seed (DEMO DATA).
 *
 * Creates the fictional organisation "AcmeCloud", its demo workspace, two demo
 * users and the sample evidence corpus. Nothing here represents a real company,
 * real users or real revenue — the demo workspace is labelled as such
 * everywhere in the UI.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import { buildDemoEvidence } from '../domain/evidence-seed.js';
import { hashPassword } from '../auth/passwords.js';
import type { EvidenceRecord, Organization, User, Workspace } from '../domain/types.js';

/** Demo login shown on the sign-in screen (clearly labelled demo credentials). */
export const DEMO_CREDENTIALS = {
  email: 'demo@complylens.ai',
  password: 'DemoPass123!',
  inviteeEmail: 'analyst@complylens.ai',
  inviteePassword: 'AnalystPass123!',
} as const;

export type SeedResult = {
  organization: Organization;
  workspace: Workspace;
  owner: User;
  member: User;
  evidence: EvidenceRecord[];
};

export async function buildDemoSeed(): Promise<SeedResult> {
  const createdAt = '2026-09-10T08:00:00.000Z';
  const organization: Organization = {
    id: config.demo.organizationId,
    name: config.demo.organizationName,
    slug: 'acmecloud-demo',
    plan: 'growth',
    primaryFramework: 'soc2',
    industry: 'B2B SaaS — Cloud Infrastructure',
    employeeCount: 48,
    createdAt,
    settings: {
      defaultFramework: 'soc2',
      monthlyDigest: true,
      gapAlerts: true,
      reportReadyEmails: true,
      uploadNotifications: false,
      mfaRequired: true,
      sessionTimeoutMinutes: 30,
      allowedUploadTypes: ['pdf', 'docx', 'txt', 'csv'],
      retentionDays: 365,
    },
  };

  const workspace: Workspace = {
    id: config.demo.workspaceId,
    organizationId: organization.id,
    name: config.demo.workspaceName,
    isDemo: true,
    isDefault: true,
    createdAt,
    ownerUserId: 'usr-demo-owner',
  };

  const [ownerHash, memberHash] = await Promise.all([
    hashPassword(DEMO_CREDENTIALS.password),
    hashPassword(DEMO_CREDENTIALS.inviteePassword),
  ]);

  const owner: User = {
    id: 'usr-demo-owner',
    organizationId: organization.id,
    email: DEMO_CREDENTIALS.email,
    name: 'Dana Whitfield',
    jobTitle: 'Head of Security (demo persona)',
    role: 'owner',
    isDemoUser: true,
    passwordHash: ownerHash,
    createdAt,
    lastLoginAt: '2026-10-07T07:45:00.000Z',
  };

  const member: User = {
    id: 'usr-demo-member',
    organizationId: organization.id,
    email: DEMO_CREDENTIALS.inviteeEmail,
    name: 'Priya Raman',
    jobTitle: 'Compliance Analyst (demo persona)',
    role: 'member',
    isDemoUser: true,
    passwordHash: memberHash,
    createdAt: '2026-09-11T09:15:00.000Z',
  };

  const evidenceInputs = buildDemoEvidence(organization.id, workspace.id, owner.name);
  const evidence: EvidenceRecord[] = evidenceInputs.map((input) => ({
    ...input,
    id: input.id as string,
  }));

  return { organization, workspace, owner, member, evidence };
}

export async function logSeedSummary(kind: string, seed: SeedResult): Promise<void> {
  logger.info('Demo workspace seeded', {
    store: kind,
    organization: seed.organization.name,
    evidenceDocuments: seed.evidence.length,
    controls: '28 SOC 2 / 22 ISO 27001',
  });
}
