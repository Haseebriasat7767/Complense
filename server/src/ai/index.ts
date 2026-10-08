/**
 * AI abstraction layer.
 *
 * `analyzeEvidence` and `writeNarrative` are the only two entry points the rest
 * of the application uses. If no provider is configured — which is the default
 * — the deterministic demo implementation answers instantly and the UI reports
 * "Demo Analysis Mode". No code path throws because a key is missing.
 *
 * Contract: the deterministic engine always produces the assessment. A
 * configured provider may only improve the wording of the narrative.
 */
import { analysisMode, config, isExternalAiEnabled } from '../config.js';
import { logger } from '../logger.js';
import type { ControlAssessment, Finding, ReadinessScore } from '../domain/types.js';
import { demoNarrative, demoSummary } from './providers/demo.js';
import { externalNarrative, externalSummary } from './providers/openai-compatible.js';

export type AnalysisMode = 'demo-analysis' | 'external-ai';

export type EvidenceAnalysisRequest = {
  fileName: string;
  category: string;
  content: string;
};

export type EvidenceAnalysisResult = {
  mode: AnalysisMode;
  provider: string;
  summary: string;
  keywords: string[];
};

export type NarrativeRequest = {
  companyName: string;
  frameworkName: string;
  readiness: ReadinessScore;
  findings: Finding[];
  evidenceCount: number;
  analysisModeLabel: string;
};

export type NarrativeResult = {
  mode: AnalysisMode;
  provider: string;
  executiveSummary: string;
  themes: string[];
};

export function currentMode(): AnalysisMode {
  return analysisMode();
}

export function modeLabel(mode: AnalysisMode = currentMode()): string {
  return mode === 'external-ai'
    ? `AI-assisted analysis (${config.ai.provider})`
    : 'Demo Analysis Mode (deterministic local analysis)';
}

/**
 * Summarise a single evidence document.
 * Deterministic fallback: first meaningful lines + matched control keywords.
 */
export async function analyzeEvidence(request: EvidenceAnalysisRequest): Promise<EvidenceAnalysisResult> {
  if (isExternalAiEnabled()) {
    try {
      const result = await externalSummary(request);
      if (result) {
        return {
          mode: 'external-ai',
          provider: config.ai.provider,
          summary: result.summary,
          keywords: result.keywords,
        };
      }
      logger.warn('AI provider returned no usable summary — falling back to demo analysis');
    } catch (error) {
      logger.warn('AI provider call failed — falling back to demo analysis', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  const local = demoSummary({
    content: request.content,
    fileName: request.fileName,
    category: request.category,
  });
  return {
    mode: 'demo-analysis',
    provider: 'complylens-deterministic',
    summary: local.summary,
    keywords: local.keywords,
  };
}

/** Executive narrative for the readiness report. */
export async function writeNarrative(request: NarrativeRequest): Promise<NarrativeResult> {
  if (isExternalAiEnabled()) {
    try {
      const result = await externalNarrative(request);
      if (result) {
        return {
          mode: 'external-ai',
          provider: config.ai.provider,
          executiveSummary: result.executiveSummary,
          themes: result.themes,
        };
      }
    } catch (error) {
      logger.warn('AI narrative call failed — using deterministic narrative', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  const local = demoNarrative({
    companyName: request.companyName,
    frameworkName: request.frameworkName,
    readiness: request.readiness,
    findings: request.findings,
    evidenceCount: request.evidenceCount,
  });
  return {
    mode: 'demo-analysis',
    provider: 'complylens-deterministic',
    executiveSummary: local.executiveSummary,
    themes: local.themes,
  };
}

export type { ControlAssessment };
