/**
 * Authentication routes.
 *
 * Demo mode issues a session for the seeded demo workspace without
 * credentials. Real accounts work too (scrypt hashes, signed session tokens)
 * and are scoped to their own organisation.
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { createSessionToken } from '../auth/tokens.js';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import {
  organizationDto,
  userDto,
  workspaceDto,
} from '../http/dto.js';
import { rateLimit } from '../http/security.js';
import { buildDemoEvidence } from '../domain/evidence-seed.js';
import { optionalBoolean, optionalString, requireEmail, requireObjectBody, requirePassword, requireString } from '../http/validate.js';
import { getStore } from '../store/index.js';
import type { Organization, User, Workspace } from '../domain/types.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  name: 'auth',
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts. Try again in a few minutes.',
});

function sessionPayload(user: User) {
  const { token, expiresAt } = createSessionToken({
    sub: user.id,
    email: user.email,
    org: user.organizationId,
    role: user.role,
    demo: user.isDemoUser,
  });
  return { token, expiresAt };
}

async function sessionResponse(user: User) {
  const store = getStore();
  const [organization, workspaces] = await Promise.all([
    store.getOrganization(user.organizationId),
    store.listWorkspaces(user.organizationId),
  ]);
  if (!organization) throw ApiError.forbidden('This account is no longer associated with an organisation.');
  const workspace = workspaces.find((item) => item.isDefault) ?? workspaces[0] ?? null;

  return {
    ...sessionPayload(user),
    user: userDto(user),
    organization: organizationDto(organization),
    workspace: workspace ? workspaceDto(workspace) : null,
    workspaces: workspaces.map(workspaceDto),
    persistence: store.kind,
  };
}

authRouter.post(
  '/signup',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = requireObjectBody(req.body);
    const name = requireString(body.name, 'name', { max: 120 });
    const email = requireEmail(body.email);
    const password = requirePassword(body.password);
    const organizationName = requireString(body.organizationName, 'organizationName', { max: 120 });
    const jobTitle = optionalString(body.jobTitle, 'jobTitle', 120) ?? 'Security Owner';
    const seedDemo = optionalBoolean(body.seedDemo, 'seedDemo') ?? true;

    const store = getStore();
    const existing = await store.getUserByEmail(email);
    if (existing) {
      throw ApiError.conflict('An account already exists for this email address.');
    }

    const now = new Date().toISOString();
    const organizationId = `org-${crypto.randomBytes(6).toString('hex')}`;
    const workspaceId = `ws-${crypto.randomBytes(6).toString('hex')}`;
    const userId = `usr-${crypto.randomBytes(6).toString('hex')}`;

    const organization: Organization = {
      id: organizationId,
      name: organizationName,
      slug: organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
      plan: 'starter',
      primaryFramework: 'soc2',
      industry: optionalString(body.industry, 'industry', 120) ?? 'Not specified',
      employeeCount: 0,
      createdAt: now,
      settings: {
        defaultFramework: 'soc2',
        monthlyDigest: true,
        gapAlerts: true,
        reportReadyEmails: true,
        uploadNotifications: true,
        mfaRequired: false,
        sessionTimeoutMinutes: 60,
        allowedUploadTypes: config.uploads.allowedExtensions,
        retentionDays: 365,
      },
    };

    const user: User = {
      id: userId,
      organizationId,
      email,
      name,
      jobTitle,
      role: 'owner',
      isDemoUser: false,
      passwordHash: await hashPassword(password),
      createdAt: now,
      lastLoginAt: now,
    };

    const workspace: Workspace = {
      id: workspaceId,
      organizationId,
      name: 'Compliance Workspace',
      isDemo: false,
      isDefault: true,
      createdAt: now,
      ownerUserId: userId,
    };

    await store.createAccount({ organization, workspace, user });

    if (seedDemo) {
      // Optional starter sample data, clearly labelled as sample in the UI.
      const samples = buildDemoEvidence(organizationId, workspaceId, `${user.name} (sample import)`);
      for (const sample of samples) {
        await store.createEvidence({
          ...sample,
          id: undefined,
          source: 'demo',
          summary: `${sample.summary} (Sample document imported at signup.)`,
        });
      }
    }

    await store.recordAuditEvent({
      organizationId,
      actor: user.email,
      action: 'account.created',
      target: organizationName,
      at: now,
    });

    res.status(201).json(await sessionResponse(user));
  }),
);

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = requireObjectBody(req.body);
    const email = requireEmail(body.email);
    const password = requireString(body.password, 'password', { min: 1, max: 200, trim: false });

    const store = getStore();
    const user = await store.getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw ApiError.unauthorized('Email or password is incorrect.');
    }

    await store.touchLastLogin(user.id);
    res.json(await sessionResponse(user));
  }),
);

authRouter.post(
  '/demo',
  loginLimiter,
  asyncHandler(async (_req, res) => {
    if (!config.demoMode) {
      throw ApiError.forbidden('Demo access is disabled for this deployment. Sign in instead.');
    }
    const store = getStore();
    const user = await store.getUserByEmail(config.demo.userEmail);
    if (!user) throw ApiError.notFound('The demo workspace is not available on this deployment.');
    await store.touchLastLogin(user.id);
    res.json(await sessionResponse(user));
  }),
);

authRouter.post('/logout', (_req, res) => {
  // Sessions are stateless signed tokens; the client discards the token.
  res.json({ ok: true, message: 'Signed out.' });
});

authRouter.post(
  '/forgot-password',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = requireObjectBody(req.body);
    const email = requireEmail(body.email);
    const store = getStore();
    const user = await store.getUserByEmail(email);

    // Always the same response so accounts cannot be enumerated.
    res.json({
      ok: true,
      emailDeliveryEnabled: false,
      message:
        'If an account exists for that address, a reset link would be sent. Email delivery is not configured in this build, so no message was sent.',
      accountFound: Boolean(user),
    });
  }),
);

authRouter.get(
  '/session',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const store = getStore();
    const user = await store.getUserById(session.sub);
    if (!user) throw ApiError.unauthorized('Session is no longer valid.');
    res.json(await sessionResponse(user));
  }),
);
