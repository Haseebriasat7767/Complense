/**
 * Optional OpenAI-compatible provider.
 *
 * Only used when ALL of the following are true:
 *   AI_PROVIDER=openai-compatible, AI_API_KEY is set, AI_ALLOW_EXTERNAL=true
 *
 * Any failure (network, quota, malformed response, timeout) resolves to null so
 * the caller falls back to the deterministic demo analysis. Evidence content is
 * truncated before transmission and is never logged.
 */
import { config } from '../../config.js';
import type { Finding, ReadinessScore } from '../../domain/types.js';

type ChatMessage = { role: 'system' | 'user'; content: string };

async function chat(messages: ChatMessage[], maxTokens = 600): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const response = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim() ? content.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const EVIDENCE_SYSTEM =
  'You summarise compliance evidence for a readiness assessment. Be factual and concise. Never claim compliance, certification or audit status. Two sentences maximum.';

export async function externalSummary(input: {
  content: string;
  fileName: string;
  category: string;
}): Promise<{ summary: string; keywords: string[] } | null> {
  const excerpt = input.content.slice(0, 4000);
  const answer = await chat(
    [
      { role: 'system', content: EVIDENCE_SYSTEM },
      {
        role: 'user',
        content: `File: ${input.fileName}\nCategory: ${input.category}\n\nText:\n${excerpt}\n\nReturn two sentences describing what evidence this document provides, then a line starting with "Keywords:" listing up to six comma-separated topics.`,
      },
    ],
    400,
  );
  if (!answer) return null;

  const [body, keywordLine] = answer.split(/Keywords:/i);
  const keywords =
    keywordLine
      ?.split(',')
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6) ?? [];

  return { summary: (body ?? answer).trim().slice(0, 400), keywords };
}

const NARRATIVE_SYSTEM =
  'You write executive summaries for compliance readiness reports. Use only the figures provided. State clearly that the report is a readiness indicator and not a certification or audit opinion. Do not invent facts. 120 to 180 words.';

export async function externalNarrative(input: {
  companyName: string;
  frameworkName: string;
  readiness: ReadinessScore;
  findings: Finding[];
  evidenceCount: number;
}): Promise<{ executiveSummary: string; themes: string[] } | null> {
  const { readiness, findings } = input;
  const lines = [
    `Company: ${input.companyName}`,
    `Framework: ${input.frameworkName}`,
    `Readiness index: ${readiness.index}% (${readiness.bandLabel})`,
    `Reviewed controls: ${readiness.counts.reviewed} — passed ${readiness.counts.passed}, needs attention ${readiness.counts.needsAttention}, missing ${readiness.counts.missing}, needs review ${readiness.counts.needsReview}`,
    `Evidence documents: ${input.evidenceCount}`,
    'Findings:',
    ...findings
      .slice(0, 12)
      .map((f) => `- ${f.controlCode} (${f.riskLevel}, ${f.priority}): ${f.title}. Missing: ${f.evidenceMissing.join('; ')}`),
    '',
    'Write the executive summary for the readiness report. End with a final sentence listing three themes as a comma-separated list prefixed by "Themes:".',
  ];

  const answer = await chat(
    [
      { role: 'system', content: NARRATIVE_SYSTEM },
      { role: 'user', content: lines.join('\n') },
    ],
    700,
  );
  if (!answer) return null;

  const [body, themeLine] = answer.split(/Themes:/i);
  const themes =
    themeLine
      ?.split(',')
      .map((theme) => theme.trim())
      .filter(Boolean)
      .slice(0, 4) ?? [];

  return {
    executiveSummary: (body ?? answer).trim().slice(0, 2000),
    themes: themes.length ? themes : ['Readiness', 'Evidence depth', 'Remediation sequencing'],
  };
}
