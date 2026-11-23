/**
 * Plan entitlements — the single source of truth for what each plan may use.
 *
 * Limits are enforced server-side (never trust the client): evidence uploads,
 * report generation and questionnaire-library creation all check here first
 * and fail with HTTP 403 `plan_limit_reached` when the plan is full.
 *
 * Limits (per organisation):
 *   Free     $0   — 10 documents, 1 framework, 1 workspace, 1 report,
 *                    1 questionnaire, 25 reusable answers.
 *   Starter  $49  — 50 documents, 1 framework, 1 workspace, 3 reports,
 *                    3 questionnaires, 100 reusable answers.
 *   Growth   $149 — unlimited documents, 2 frameworks, 3 workspaces,
 *                    unlimited reports, 25 questionnaires, unlimited answers.
 *   Business $499 — unlimited everything.
 *
 * Framework note: the app stores a single `primaryFramework` per
 * organisation, so the 1-vs-2 framework limit cannot be enforced on the
 * current data model. The limit is recorded here and exposed through
 * /billing/usage, and enforcement will follow the enabled-frameworks model
 * change. Everything else in this table IS enforced.
 */
import { ApiError } from '../http/errors.js';
import { getStore } from '../store/index.js';
import type { Organization, PlanTier } from '../domain/types.js';

export type PlanResource = 'documents' | 'frameworks' | 'workspaces' | 'reports' | 'questionnaires' | 'reusableAnswers';

export type PlanLimits = Record<PlanResource, number>;

export const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    documents: 10,
    frameworks: 1,
    workspaces: 1,
    reports: 1,
    questionnaires: 1,
    reusableAnswers: 25,
  },
  starter: {
    documents: 50,
    frameworks: 1,
    workspaces: 1,
    reports: 3,
    questionnaires: 3,
    reusableAnswers: 100,
  },
  growth: {
    documents: UNLIMITED,
    frameworks: 2,
    workspaces: 3,
    reports: UNLIMITED,
    questionnaires: 25,
    reusableAnswers: UNLIMITED,
  },
  business: {
    documents: UNLIMITED,
    frameworks: UNLIMITED,
    workspaces: UNLIMITED,
    reports: UNLIMITED,
    questionnaires: UNLIMITED,
    reusableAnswers: UNLIMITED,
  },
};

export const PLAN_NAMES: Record<PlanTier, string> = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Growth',
  business: 'Business',
};

export const PLAN_PRICES: Record<PlanTier, string> = {
  free: '$0',
  starter: '$49',
  growth: '$149',
  business: '$499',
};

export function limitsFor(plan: PlanTier): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function formatLimit(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : 'Unlimited';
}

/** Current usage counts for an organisation, across all its workspaces. */
export async function usageFor(organizationId: string): Promise<Record<PlanResource, number>> {
  const store = getStore();
  const workspaces = await store.listWorkspaces(organizationId);
  let documents = 0;
  let reports = 0;
  for (const workspace of workspaces) {
    const [evidence, workspaceReports] = await Promise.all([
      store.listEvidence(organizationId, workspace.id),
      store.listReports(organizationId, workspace.id),
    ]);
    documents += evidence.length;
    reports += workspaceReports.length;
  }
  const [questionnaires, answers] = await Promise.all([
    store.countQuestionnaires(organizationId),
    store.countReusableAnswers(organizationId),
  ]);
  return {
    documents,
    // Single-primary-framework model: the organisation uses 1 framework today.
    frameworks: 1,
    workspaces: workspaces.length,
    reports,
    questionnaires,
    reusableAnswers: answers,
  };
}

/**
 * Throws HTTP 403 `plan_limit_reached` when the organisation is already at
 * its limit for the resource. Call BEFORE creating the resource so a
 * concurrent request cannot silently overshoot: the count is re-read from the
 * store at check time.
 */
export async function assertWithinLimit(
  organization: Organization,
  resource: PlanResource,
  usageOverride?: number,
): Promise<void> {
  const limits = limitsFor(organization.plan);
  const limit = limits[resource];
  if (!Number.isFinite(limit)) return;
  const usage = usageOverride ?? (await usageFor(organization.id))[resource];
  if (usage >= limit) {
    throw new ApiError(
      403,
      'plan_limit_reached',
      `Your ${PLAN_NAMES[organization.plan]} plan allows ${limit} ${resource}. You are using ${usage}. Upgrade to add more.`,
      { resource, plan: organization.plan, limit, used: usage },
    );
  }
}
