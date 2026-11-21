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
import { logger } from '../../logger.js';

type ChatMessage = { role: 'system' | 'user'; content: string };

/**
 * Google Gemini native REST fallback. The OpenAI-compatible endpoint can
 * return 404 for an unavailable compatibility route; retry through the
 * documented generateContent endpoint without changing the configured key.
 */
async function geminiNativeChat(messages: ChatMessage[], maxTokens: number, requestedModel = config.ai.model): Promise<string | null> {
  const model = requestedModel.replace(/^models\//, '');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': config.ai.apiKey,
      },
      body: JSON.stringify({
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    });

    if (!response.ok) {
      const diagnostic = await readProviderDiagnostic(response);
      logger.warn('Gemini native fallback rejected', {
        model,
        status: response.status,
        statusText: response.statusText.slice(0, 120),
        providerCode: diagnostic.code,
        providerMessage: diagnostic.message,
      });
      return null;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    return content || null;
  } catch (error) {
    logger.warn('Gemini native fallback failed', {
      model,
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return null;
  }
}

type ProviderDiagnostic = { code?: string; message?: string };

async function readProviderDiagnostic(response: Response): Promise<ProviderDiagnostic> {
  try {
    const raw = await response.text();
    const parsed = JSON.parse(raw) as {
      error?: { code?: string | number; status?: string; message?: string };
    };
    return {
      code: String(parsed.error?.status ?? parsed.error?.code ?? '').slice(0, 80) || undefined,
      message: String(parsed.error?.message ?? '').replace(/[\\r\\n\\t]+/g, ' ').slice(0, 240) || undefined,
    };
  } catch {
    return {};
  }
}

async function chat(messages: ChatMessage[], maxTokens = 600): Promise<string | null> {
  const isGemini = (() => {
    try {
      return new URL(config.ai.baseUrl).hostname === 'generativelanguage.googleapis.com';
    } catch {
      return false;
    }
  })();
  // Google has restricted new-project access to Gemini 2.5 models. Try the
  // configured model first, then current stable Developer API models on 404.
  const models = [...new Set([
    config.ai.model,
    ...(isGemini ? ['gemini-3.5-flash-lite', 'gemini-3.8-flash'] : []),
  ])];
  const endpoint = `${config.ai.baseUrl.replace(/\\/$/, '')}/chat/completions`;

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.ai.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const diagnostic = await readProviderDiagnostic(response);
        logger.warn('External AI request rejected', {
          provider: config.ai.provider,
          model,
          status: response.status,
          statusText: response.statusText.slice(0, 120),
          providerCode: diagnostic.code,
          providerMessage: diagnostic.message,
        });
        if (isGemini && response.status === 404) continue;
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        if (model !== config.ai.model) {
          logger.warn('Gemini model fallback succeeded', {
            configuredModel: config.ai.model,
            activeModel: model,
          });
        }
        return content.trim();
      }

      logger.warn('External AI response contained no usable message', {
        provider: config.ai.provider,
        model,
        responseShape: Array.isArray(payload.choices) ? 'choices_without_content' : 'missing_choices',
      });
      return null;
    } catch (error) {
      logger.warn('External AI request failed before a usable response', {
        provider: config.ai.provider,
        model,
        reason: controller.signal.aborted ? 'timeout' : error instanceof Error ? error.name : 'unknown',
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Last-resort direct Gemini REST path, with the same model fallback order.
  if (isGemini) {
    for (const model of models) {
      const nativeResult = await geminiNativeChat(messages, maxTokens, model);
      if (nativeResult) {
        if (model !== config.ai.model) {
          logger.warn('Gemini native model fallback succeeded', {
            configuredModel: config.ai.model,
            activeModel: model,
          });
        }
        return nativeResult;
      }
    }
  }
  return null;
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
