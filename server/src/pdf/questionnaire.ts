/**
 * Questionnaire + auditor-package PDFs (pdfkit).
 *
 * The questionnaire export is the completed questionnaire a buyer hands to
 * a customer: every question, its answer, and whether the answer was reused
 * from the library (with explicit human confirmation) or written fresh.
 *
 * The auditor package is the evidence bundle a buyer hands to an auditor:
 * readiness scores, control status, open findings, evidence inventory and
 * the approved reusable answers. It is a readiness assessment, not a
 * certification — the disclaimer is printed on every page set.
 */
import PDFDocument from 'pdfkit';
import type {
  ControlAssessment,
  Finding,
  Organization,
  Questionnaire,
  QuestionnaireItem,
  ReadinessScore,
  ReusableAnswer,
  Workspace,
} from '../domain/types.js';
import { formatDate } from '../domain/reports.js';

const COLORS = {
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  panel: '#f8fafc',
  brand: '#0f766e',
  reused: '#0f766e',
  custom: '#92400e',
};

const PAGE = { size: 'A4' as const, margins: { top: 56, bottom: 64, left: 56, right: 56 } };

function footer(doc: PDFKit.PDFDocument, text: string): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(text, PAGE.margins.left, doc.page.height - 40, {
        width: doc.page.width - PAGE.margins.left - PAGE.margins.right,
        align: 'center',
      });
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(1.2).fontSize(14).fillColor(COLORS.ink).text(title);
  doc.moveDown(0.3);
  doc.strokeColor(COLORS.border).lineWidth(1).moveTo(PAGE.margins.left, doc.y).lineTo(doc.page.width - PAGE.margins.right, doc.y).stroke();
  doc.moveDown(0.6);
}

function body(doc: PDFKit.PDFDocument, text: string, size = 10): void {
  doc.fontSize(size).fillColor(COLORS.body).text(text, { width: doc.page.width - PAGE.margins.left - PAGE.margins.right });
}

export function renderQuestionnairePdf(input: {
  organization: Organization;
  questionnaire: Questionnaire;
  items: QuestionnaireItem[];
}): PDFKit.PDFDocument {
  const { organization, questionnaire, items } = input;
  const doc = new PDFDocument({
    ...PAGE,
    bufferPages: true,
    info: {
      Title: `${questionnaire.title} — ${organization.name}`,
      Author: 'ComplyLens AI',
      Subject: 'Security questionnaire response',
      Keywords: 'security questionnaire, SOC 2, ISO 27001, vendor assessment',
    },
  });

  doc.rect(0, 0, doc.page.width, 150).fill(COLORS.ink);
  doc.fillColor('#ffffff').fontSize(22).text('Security questionnaire', PAGE.margins.left, 48, { width: doc.page.width - 112 });
  doc.fontSize(12).fillColor('#cbd5e1').text(`${organization.name} — ${questionnaire.title}`, PAGE.margins.left, 82);
  doc.fontSize(10).text(`Requested by: ${questionnaire.requester || '—'} · Status: ${questionnaire.status}`, PAGE.margins.left, 104);
  doc.fontSize(10).text(`Generated ${formatDate(new Date().toISOString())}`, PAGE.margins.left, 120);
  doc.moveDown(6);

  const answered = items.filter((item) => item.status === 'answered').length;
  body(doc, `${answered} of ${items.length} questions answered. Answers marked "Reused from library" were reviewed and explicitly confirmed by a human before submission; they are not auto-generated claims.`);
  doc.moveDown(0.5);

  items.forEach((item, index) => {
    sectionTitle(doc, `Q${index + 1} — ${item.category || item.framework}`);
    body(doc, item.question, 11);
    doc.moveDown(0.3);
    if (item.answer) {
      body(doc, item.answer);
      doc.moveDown(0.3);
      const source =
        item.answerSource === 'library'
          ? `Reused from answer library${item.reuseConfirmed ? ' (human-confirmed)' : ' (not confirmed)'}`
          : 'Written for this questionnaire';
      doc.fontSize(9).fillColor(item.answerSource === 'library' ? COLORS.reused : COLORS.custom).text(source);
    } else {
      doc.fontSize(10).fillColor(COLORS.muted).text('Not answered yet.');
    }
    doc.moveDown(0.5);
  });

  doc.moveDown(1);
  doc.fontSize(9).fillColor(COLORS.muted).text(
    'Disclaimer: answers describe the organisation’s stated practices as recorded in ComplyLens AI. They are not an audit opinion, certification, or guarantee of compliance.',
  );
  footer(doc, 'ComplyLens AI — Security questionnaire response (not a certification)');
  doc.end();
  return doc;
}

export function renderAuditorPackagePdf(input: {
  organization: Organization;
  workspace: Workspace;
  frameworkKey: 'soc2' | 'iso27001';
  frameworkName: string;
  readiness: ReadinessScore;
  assessments: ControlAssessment[];
  findings: Finding[];
  evidence: Array<{ fileName: string; category: string; status: string; mappedControls: number; uploadedAt: string }>;
  answers: ReusableAnswer[];
}): PDFKit.PDFDocument {
  const { organization, workspace, frameworkKey, frameworkName, readiness, assessments, findings, evidence, answers } = input;
  const doc = new PDFDocument({
    ...PAGE,
    bufferPages: true,
    info: {
      Title: `Auditor package — ${organization.name} (${frameworkName})`,
      Author: 'ComplyLens AI',
      Subject: 'Readiness evidence package for auditor review',
      Keywords: 'SOC 2, ISO 27001, auditor package, evidence, readiness',
    },
  });

  doc.rect(0, 0, doc.page.width, 170).fill(COLORS.ink);
  doc.fillColor('#ffffff').fontSize(22).text('Auditor evidence package', PAGE.margins.left, 48, { width: doc.page.width - 112 });
  doc.fontSize(12).fillColor('#cbd5e1').text(`${organization.name} — ${frameworkName}`, PAGE.margins.left, 82);
  doc.fontSize(10).text(`Workspace: ${workspace.name} · Framework: ${frameworkKey}`, PAGE.margins.left, 104);
  doc.fontSize(10).text(`Readiness index: ${readiness.index}% (${readiness.bandLabel}) · ${formatDate(new Date().toISOString())}`, PAGE.margins.left, 120);
  doc.fontSize(10).text(`Controls reviewed ${readiness.counts.reviewed}/${readiness.counts.total} · Passed ${readiness.counts.passed} · Open findings ${readiness.openFindings}`, PAGE.margins.left, 136);
  doc.moveDown(7);

  body(doc, 'This package collects the readiness state an auditor needs for a first review: control status, open findings, the evidence inventory with control mappings, and the approved reusable questionnaire answers. It is a preliminary readiness assessment produced by ComplyLens AI — not an audit opinion or certification.');
  doc.moveDown(0.5);

  sectionTitle(doc, 'Control status');
  for (const assessment of assessments) {
    body(doc, `${assessment.controlCode} — ${assessment.name} · ${assessment.status} (${Math.round(assessment.confidence * 100)}% confidence)`, 9.5);
  }

  sectionTitle(doc, 'Open findings');
  if (findings.length === 0) {
    body(doc, 'No open findings.');
  } else {
    for (const finding of findings) {
      body(doc, `${finding.controlCode} [${finding.riskLevel}] ${finding.title} — ${finding.recommendation.fix}`, 9.5);
    }
  }

  sectionTitle(doc, 'Evidence inventory');
  if (evidence.length === 0) {
    body(doc, 'No evidence uploaded yet.');
  } else {
    for (const item of evidence) {
      body(doc, `${item.fileName} · ${item.category} · ${item.status} · mapped to ${item.mappedControls} control(s) · ${formatDate(item.uploadedAt)}`, 9.5);
    }
  }

  sectionTitle(doc, 'Approved reusable answers');
  const approved = answers.filter((answer) => answer.status === 'approved');
  if (approved.length === 0) {
    body(doc, 'No approved reusable answers yet.');
  } else {
    for (const answer of approved) {
      body(doc, `Q: ${answer.question}`, 9.5);
      doc.moveDown(0.2);
      body(doc, `A: ${answer.answer}`, 9.5);
      doc.moveDown(0.4);
    }
  }

  doc.moveDown(1);
  doc.fontSize(9).fillColor(COLORS.muted).text(
    'Disclaimer: ComplyLens AI is a readiness tool, not an auditor or certification body. Control mapping is deterministic text matching against the control library; an auditor must independently verify every claim before relying on it.',
  );
  footer(doc, 'ComplyLens AI — Auditor evidence package (preliminary readiness assessment, not a certification)');
  doc.end();
  return doc;
}
