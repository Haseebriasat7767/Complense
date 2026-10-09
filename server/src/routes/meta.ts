/**
 * Public metadata routes: health, product metadata, framework catalogue.
 * These endpoints are unauthenticated and expose no customer data.
 */
import { Router } from 'express';
import { analysisMode, config } from '../config.js';
import { categoriesForFramework, frameworkSummary } from '../domain/controls.js';
import { FRAMEWORKS } from '../domain/frameworks.js';
import { SCORE_WEIGHTS, SCORE_METHODOLOGY } from '../domain/scoring.js';
import { asyncHandler } from '../http/errors.js';
import { DISCLAIMERS } from '../http/dto.js';
import { getStore } from '../store/index.js';

export const metaRouter = Router();

export const PRODUCT = {
  name: 'ComplyLens AI',
  tagline: 'Know what’s missing before the auditor does.',
  version: '0.1.0',
  stage: 'MVP — demo ready',
};

/**
 * Liveness + real database connectivity.
 *
 * A 200 here never means "the database is fine" on its own: `database.ok` is
 * the result of an actual query issued during this request, and the HTTP
 * status is 503 whenever a production deployment cannot reach its persistent
 * store. The payload intentionally contains no URL, connection string, key or
 * raw SQL error — only a sanitised detail string.
 */
metaRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const store = getStore();
    const database = await store.health();

    // Production must never advertise durable persistence while it is really
    // running on the in-memory store.
    const persistentInProduction = !config.isProduction || database.persistent;
    const healthy = database.ok && persistentInProduction;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      product: PRODUCT.name,
      version: PRODUCT.version,
      time: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      store: {
        kind: store.kind,
        detail: database.detail,
        persistent: database.persistent,
      },
      database: {
        kind: store.kind,
        persistent: database.persistent,
        // True only because a query actually succeeded a moment ago.
        connected: database.ok,
        checkedAt: new Date().toISOString(),
        ...(database.latencyMs === undefined ? {} : { latencyMs: database.latencyMs }),
        detail: database.detail,
      },
      demoMode: config.demoMode,
      analysisMode: analysisMode(),
      authRequired: config.authRequired,
    });
  }),
);

metaRouter.get('/meta', (_req, res) => {
  res.json({
    product: PRODUCT,
    frameworks: frameworkSummary().map((framework) => ({
      key: framework.key,
      name: framework.name,
      shortName: framework.shortName,
      version: framework.version,
      description: framework.description,
      intent: framework.intent,
      readinessLabel: framework.readinessLabel,
      controlCount: framework.controls,
      categoryCount: framework.categories,
      categories: categoriesForFramework(framework.key),
    })),
    analysis: {
      mode: analysisMode(),
      label:
        analysisMode() === 'external-ai'
          ? 'AI-assisted analysis enabled'
          : 'Demo Analysis Mode — deterministic local analysis, no external API required',
      scoring: { weights: SCORE_WEIGHTS, methodology: SCORE_METHODOLOGY },
    },
    uploads: {
      maxBytes: config.uploads.maxBytes,
      allowedExtensions: config.uploads.allowedExtensions,
    },
    demoMode: config.demoMode,
    authRequired: config.authRequired,
    disclaimers: DISCLAIMERS,
  });
});

metaRouter.get('/frameworks', (_req, res) => {
  res.json({
    items: Object.values(FRAMEWORKS).map((framework) => ({
      key: framework.key,
      name: framework.name,
      shortName: framework.shortName,
      version: framework.version,
      description: framework.description,
      intent: framework.intent,
      readinessLabel: framework.readinessLabel,
      categories: categoriesForFramework(framework.key),
    })),
    status: 'demo-ready',
  });
});
