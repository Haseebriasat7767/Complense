/**
 * Readiness report PDF (pdfkit).
 *
 * Server-side generation keeps the document identical for every browser and
 * avoids shipping a PDF engine to the client. The layout follows the standard
 * readiness report structure: cover, executive summary, control summary,
 * findings, remediation plan, evidence inventory and disclaimer.
 */
import PDFDocument from 'pdfkit';
import { FRAMEWORKS } from '../domain/frameworks.js';
import { formatDate } from '../domain/reports.js';
import type { ReportRecord } from '../domain/types.js';

const COLORS = {
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  panel: '#f8fafc',
  brand: '#0f766e',
  critical: '#b91c1c',
  high: '#c2410c',
  medium: '#a16207',
  low: '#15803d',
  passed: '#15803d',
};

const PAGE = { size: 'A4' as const, margins: { top: 56, bottom: 64, left: 56, right: 56 } };

function riskColor(risk: string): string {
  if (risk === 'critical') return COLORS.critical;
  if (risk === 'high') return COLORS.high;
  if (risk === 'medium') return COLORS.medium;
  return COLORS.low;
}

export function renderReportPdf(report: ReportRecord): PDFKit.PDFDocument {
  const doc = new PDFDocument({ ...PAGE, bufferPages: true, info: {
    Title: `${report.name} — ${report.companyName}`,
    Author: 'ComplyLens AI',
    Subject: 'Compliance readiness assessment (preliminary, non-certifying)',
    Keywords: 'readiness, gap analysis, SOC 2, ISO 27001, demo data',
  } });

  const { summary } = report;
  const framework = FRAMEWORKS[report.frameworkKey];
  const contentWidth = doc.page.width - PAGE.margins.left - PAGE.margins.right;

  /* ------------------------------- cover page ------------------------------ */
  doc.rect(0, 0, doc.page.width, 190).fill(COLORS.ink);
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('COMPLYLENS AI', PAGE.margins.left, 58, { characterSpacing: 1.2 });
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#94a3b8')
    .text('Know what’s missing before the auditor does.', PAGE.margins.left, 88);
  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .fillColor('#ffffff')
    .text('Compliance Readiness Assessment', PAGE.margins.left, 126);

  let y = 226;
  const metaRows: Array<[string, string]> = [
    ['Company', `${report.companyName} (Demo Data)`],
    ['Framework', `${framework.name}`],
    ['Assessment date', formatDate(report.generatedAt)],
    ['Prepared for', report.requestedBy],
    ['Analysis mode', summary.analysisMode],
  ];
  for (const [label, value] of metaRows) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(label.toUpperCase(), PAGE.margins.left, y, { characterSpacing: 0.6 });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink).text(value, PAGE.margins.left, y + 13, { width: contentWidth });
    y += 44;
  }

  // Readiness score block
  const scoreTop = y + 6;
  doc.roundedRect(PAGE.margins.left, scoreTop, contentWidth, 104, 10).fill(COLORS.panel);
  doc
    .font('Helvetica-Bold')
    .fontSize(44)
    .fillColor(COLORS.ink)
    .text(`${report.scoreIndex}%`, PAGE.margins.left + 24, scoreTop + 24, { width: 160 });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text('READINESS INDEX', PAGE.margins.left + 26, scoreTop + 76, { characterSpacing: 0.6 });
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(COLORS.ink)
    .text(summary.readiness.bandLabel, PAGE.margins.left + 200, scoreTop + 26, { width: contentWidth - 220 });
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(COLORS.body)
    .text(summary.readiness.methodology, PAGE.margins.left + 200, scoreTop + 46, {
      width: contentWidth - 220,
      lineGap: 2,
    });

  y = scoreTop + 126;
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.body)
    .text(
      `Reviewed ${summary.readiness.counts.reviewed} · Passed ${summary.readiness.counts.passed} · Needs attention ${summary.readiness.counts.needsAttention} · Missing ${summary.readiness.counts.missing} · Needs review ${summary.readiness.counts.needsReview}`,
      PAGE.margins.left,
      y,
      { width: contentWidth },
    );
  y += 22;
  doc
    .font('Helvetica-Oblique')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(
      'This workspace contains fictional sample data (AcmeCloud demo organisation). It is provided to demonstrate the product and does not describe a real company.',
      PAGE.margins.left,
      y,
      { width: contentWidth },
    );

  /* --------------------------- executive summary --------------------------- */
  doc.addPage();
  sectionTitle(doc, '1. Executive Summary', contentWidth);
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.body).text(summary.executiveSummary, {
    width: contentWidth,
    lineGap: 3,
  });

  /* ---------------------------- control summary ---------------------------- */
  /* ---------------------------- overall score ---------------------------- */
  y = doc.y + 26;
  sectionTitle(doc, '2. Overall Readiness Score', contentWidth, y);
  y = doc.y + 10;
  doc
    .font('Helvetica-Bold')
    .fontSize(26)
    .fillColor(COLORS.ink)
    .text(`${summary.readiness.index}%`, PAGE.margins.left, y, { width: 120 });
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.brand)
    .text(summary.readiness.bandLabel, PAGE.margins.left + 130, y + 4, { width: contentWidth - 130 });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.body)
    .text(summary.readiness.methodology, PAGE.margins.left + 130, y + 22, { width: contentWidth - 130, lineGap: 2 });
  y = doc.y + 18;

  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text('Readiness index components', PAGE.margins.left, y);
  y += 18;
  for (const component of summary.readiness.components) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.body).text(component.label, PAGE.margins.left, y, { width: 150 });
    const componentBarX = PAGE.margins.left + 158;
    const componentBarWidth = contentWidth - 158 - 70;
    doc.roundedRect(componentBarX, y + 1, componentBarWidth, 8, 4).fill(COLORS.border);
    doc.roundedRect(componentBarX, y + 1, Math.max(4, componentBarWidth * component.value), 8, 4).fill(COLORS.brand);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(`${Math.round(component.value * 100)}%`, componentBarX + componentBarWidth + 8, y, { width: 60, align: 'right' });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(component.description, PAGE.margins.left, y + 12, { width: contentWidth, lineGap: 1 });
    y = doc.y + 8;
  }

  /* ---------------------------- control summary ---------------------------- */
  y = ensureSpace(doc, y, 120);
  sectionTitle(doc, '3. Control Summary', contentWidth, y + 12);
  y = doc.y + 12;

  const counts = summary.readiness.counts;
  const tiles: Array<[string, number, string]> = [
    ['Passed', counts.passed, COLORS.passed],
    ['Needs attention', counts.needsAttention, COLORS.medium],
    ['Missing', counts.missing, COLORS.critical],
    ['Needs review', counts.needsReview, COLORS.muted],
  ];
  const tileWidth = (contentWidth - 24) / 4;
  tiles.forEach(([label, value, color], index) => {
    const x = PAGE.margins.left + index * (tileWidth + 8);
    doc.roundedRect(x, y, tileWidth, 66, 8).fill(COLORS.panel);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(color).text(String(value), x + 12, y + 12);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(label.toUpperCase(), x + 12, y + 40, {
      width: tileWidth - 20,
      characterSpacing: 0.4,
    });
  });
  y += 86;

  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text('By category', PAGE.margins.left, y);
  y += 16;
  tableHeader(doc, y, [['Category', 0.34], ['Controls', 0.14], ['Passed', 0.13], ['Attention', 0.16], ['Missing', 0.12], ['Review', 0.11]], contentWidth);
  y += 18;
  for (const row of summary.categoryBreakdown) {
    y = ensureSpace(doc, y, 22);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.body);
    doc.text(row.category, PAGE.margins.left + 4, y, { width: contentWidth * 0.34 - 6 });
    doc.text(String(row.total), PAGE.margins.left + contentWidth * 0.34, y);
    doc.text(String(row.passed), PAGE.margins.left + contentWidth * 0.48, y);
    doc.text(String(row.needsAttention), PAGE.margins.left + contentWidth * 0.61, y);
    doc.text(String(row.missing), PAGE.margins.left + contentWidth * 0.77, y);
    doc.text(String(row.needsReview), PAGE.margins.left + contentWidth * 0.89, y);
    y += 16;
    doc.moveTo(PAGE.margins.left, y - 5).lineTo(PAGE.margins.left + contentWidth, y - 5).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  }

  /* ------------------------ controls by status ------------------------ */
  doc.addPage();
  y = controlStatusSection(doc, '4. Passed Controls', summary.controlsByStatus.passed, contentWidth, COLORS.passed, PAGE.margins.top);
  y = controlStatusSection(doc, '5. Partially Covered Controls', summary.controlsByStatus.needsAttention, contentWidth, COLORS.medium, y + 22);
  y = controlStatusSection(doc, '6. Missing Controls', summary.controlsByStatus.missing, contentWidth, COLORS.critical, y + 22);
  y = controlStatusSection(
    doc,
    '7. Controls Awaiting Manual Review',
    summary.controlsByStatus.needsReview,
    contentWidth,
    COLORS.muted,
    y + 22,
  );

  /* ------------------------------- findings ------------------------------- */
  doc.addPage();
  sectionTitle(doc, '8. Critical Findings', contentWidth);
  y = doc.y + 10;
  y = findingList(doc, summary.criticalFindings, contentWidth, y, 'No critical findings were identified from the submitted evidence.');

  y = ensureSpace(doc, y, 110);
  sectionTitle(doc, '9. High-Risk Findings', contentWidth, y + 22);
  y = doc.y + 10;
  y = findingList(doc, summary.highFindings, contentWidth, y, 'No high-risk findings were identified from the submitted evidence.');

  /* ----------------------------- remediation ------------------------------ */
  y = ensureSpace(doc, y, 90);
  sectionTitle(doc, '10. Remediation Recommendations', contentWidth, y + 8);
  y = doc.y + 12;
  doc
    .font('Helvetica-Oblique')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text('Owner and timeline suggestions are generated guidance from the ComplyLens analysis layer. Validate them against your operating model.', PAGE.margins.left, y, { width: contentWidth });
  y = doc.y + 12;

  for (const recommendation of summary.recommendations) {
    y = ensureSpace(doc, y, 74);
    const boxHeight = 62;
    doc.roundedRect(PAGE.margins.left, y, contentWidth, boxHeight, 6).strokeColor(COLORS.border).lineWidth(0.8).stroke();
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.ink).text(`${recommendation.controlCode} · ${recommendation.priority}`, PAGE.margins.left + 12, y + 10, { width: 200 });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.body).text(recommendation.action, PAGE.margins.left + 12, y + 26, { width: contentWidth - 24, lineGap: 1.5, height: 30, ellipsis: true });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(`Suggested owner: ${recommendation.owner}   ·   Suggested timeline: ${recommendation.timelineLabel}`, PAGE.margins.left + 12, y + 50, { width: contentWidth - 24 });
    y += boxHeight + 8;
  }

  /* ----------------------------- evidence ------------------------------ */
  doc.addPage();
  sectionTitle(doc, '11. Evidence Inventory', contentWidth);
  y = doc.y + 12;
  tableHeader(doc, y, [['Document', 0.42], ['Category', 0.2], ['Size', 0.1], ['Uploaded', 0.15], ['Controls', 0.13]], contentWidth);
  y += 18;
  for (const item of summary.evidenceInventory) {
    y = ensureSpace(doc, y, 22);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.body);
    doc.text(item.fileName, PAGE.margins.left + 4, y, { width: contentWidth * 0.42 - 6 });
    doc.text(item.category, PAGE.margins.left + contentWidth * 0.42, y, { width: contentWidth * 0.2 - 6 });
    doc.text(item.sizeLabel, PAGE.margins.left + contentWidth * 0.62, y);
    doc.text(formatDate(item.uploadedAt), PAGE.margins.left + contentWidth * 0.72, y);
    doc.text(String(item.mappedControls), PAGE.margins.left + contentWidth * 0.9, y);
    y += 15;
    doc.moveTo(PAGE.margins.left, y - 4).lineTo(PAGE.margins.left + contentWidth, y - 4).strokeColor(COLORS.border).lineWidth(0.4).stroke();
  }

  /* --------------------------- final summary --------------------------- */
  y = ensureSpace(doc, y, 120);
  sectionTitle(doc, '12. Final Readiness Summary', contentWidth, y + 12);
  y = doc.y + 12;
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.body)
    .text(
      `${report.companyName} currently presents a readiness index of ${report.scoreIndex}% against ${framework.name}. ${counts.passed} of ${counts.reviewed} reviewed controls are evidenced, ${counts.needsAttention} require additional evidence, and ${counts.missing} have no supporting evidence at all. Addressing the ${summary.criticalFindings.length + summary.highFindings.length} critical and high-risk findings listed in sections 8 and 9 will materially improve readiness before an audit window opens.`,
      { width: contentWidth, lineGap: 3 },
    );

  y = doc.y + 16;
  doc
    .roundedRect(PAGE.margins.left, y, contentWidth, 60, 8)
    .fill('#fffbeb');
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#92400e')
    .text('DISCLAIMER', PAGE.margins.left + 12, y + 10, { characterSpacing: 0.6 });
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#78350f')
    .text(summary.disclaimer, PAGE.margins.left + 12, y + 24, { width: contentWidth - 24, lineGap: 2 });

  /* ------------------------------ footers ------------------------------ */
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const footerY = doc.page.height - 46;
    doc.moveTo(PAGE.margins.left, footerY - 10).lineTo(PAGE.margins.left + contentWidth, footerY - 10).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(
        'ComplyLens AI · preliminary readiness assessment · not a certification, audit opinion or legal advice · Demo Data workspace',
        PAGE.margins.left,
        footerY,
        { width: contentWidth - 60 },
      );
    doc.text(`Page ${index - range.start + 1} of ${range.count}`, PAGE.margins.left + contentWidth - 60, footerY, { width: 60, align: 'right' });
  }

  doc.end();
  return doc;
}

/** One control-status section (passed / partially covered / missing / awaiting review). */
function controlStatusSection(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: ReportRecord['summary']['controlsByStatus']['passed'],
  width: number,
  accent: string,
  startY: number,
): number {
  let y = ensureSpace(doc, startY, 110);
  sectionTitle(doc, title, width, y);
  y = doc.y + 10;

  if (rows.length === 0) {
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body).text('No controls in this state.', PAGE.margins.left, y, { width });
    return doc.y;
  }

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`${rows.length} control${rows.length === 1 ? '' : 's'}`, PAGE.margins.left, y, { width });
  y = doc.y + 10;

  for (const row of rows) {
    y = ensureSpace(doc, y, 40);
    doc.rect(PAGE.margins.left, y + 2, 3, 26).fill(accent);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(`${row.controlCode}`, PAGE.margins.left + 10, y, { width: 86 });
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(row.name, PAGE.margins.left + 100, y, { width: width - 100 });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(`${row.category} · risk ${row.riskLevel} · confidence ${Math.round(row.confidence * 100)}%`, PAGE.margins.left + 100, y + 11, {
        width: width - 100,
      });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.body)
      .text(row.detail, PAGE.margins.left + 100, y + 20, { width: width - 100, height: 22, ellipsis: true });
    y = doc.y + 10;
  }
  return y;
}

/** Compact list of findings for one risk band. */
function findingList(
  doc: PDFKit.PDFDocument,
  findings: ReportRecord['summary']['criticalFindings'],
  width: number,
  startY: number,
  emptyMessage: string,
): number {
  let y = startY;
  if (findings.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.body).text(emptyMessage, PAGE.margins.left, y, { width });
    return doc.y;
  }

  for (const finding of findings) {
    y = ensureSpace(doc, y, 46);
    doc.roundedRect(PAGE.margins.left, y, width, 34, 6).fill(COLORS.panel);
    doc.rect(PAGE.margins.left, y, 3, 34).fill(riskColor(finding.riskLevel));
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.ink).text(finding.controlCode, PAGE.margins.left + 12, y + 8, { width: 90 });
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body).text(finding.title, PAGE.margins.left + 100, y + 8, { width: width - 190 });
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(riskColor(finding.riskLevel))
      .text(finding.riskLevel.toUpperCase(), PAGE.margins.left + width - 80, y + 11, { width: 70, align: 'right', characterSpacing: 0.4 });
    y += 42;
  }
  return y;
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, width: number, y?: number): void {
  const top = y ?? doc.y;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.ink).text(title, PAGE.margins.left, top, { width });
  doc.moveTo(PAGE.margins.left, top + 20).lineTo(PAGE.margins.left + width, top + 20).strokeColor(COLORS.border).lineWidth(0.8).stroke();
  doc.y = top + 28;
}

function tableHeader(doc: PDFKit.PDFDocument, y: number, columns: Array<[string, number]>, width: number): void {
  let x = PAGE.margins.left;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
  for (const [label, ratio] of columns) {
    doc.text(label.toUpperCase(), x, y, { width: width * ratio - 6, characterSpacing: 0.4 });
    x += width * ratio;
  }
  doc.moveTo(PAGE.margins.left, y + 14).lineTo(PAGE.margins.left + width, y + 14).strokeColor(COLORS.border).lineWidth(0.6).stroke();
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  const limit = doc.page.height - PAGE.margins.bottom;
  if (y + needed <= limit) return y;
  doc.addPage();
  return PAGE.margins.top;
}
