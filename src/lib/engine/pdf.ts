/**
 * DemoDraft PDF Engine
 *
 * Generates branded multi-page PDF reports from a ScanResult.
 * Outputs to Buffer (for Supabase Storage upload) instead of filesystem.
 *
 * Pages: Cover → Score Overview → Detailed Checks → Top Issues → CTA
 */

import PDFDocument from "pdfkit";
import type {
  BrandConfig,
  ScanResult,
  ScanCheck,
  PdfCustomPage,
  CtaPageConfig,
  PricingTier,
} from "./types";

const W = 595.28; // A4 width
const H = 841.89; // A4 height
const M = 50; // margin
const CW = W - M * 2;
const FOOTER_Y = 800;

const BASE_COLORS = {
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  text: "#1e293b",
  muted: "#64748b",
  light: "#f8fafc",
  white: "#ffffff",
  headerBg: "#f1f5f9",
  stripe: "#f8fafc",
  rule: "#e2e8f0",
};

function scoreColor(score: number): string {
  if (score >= 75) return BASE_COLORS.success;
  if (score >= 50) return BASE_COLORS.warning;
  return BASE_COLORS.danger;
}

function gradeLabel(grade: string): string {
  const map: Record<string, string> = {
    A: "Excellent",
    B: "Good",
    C: "Needs Work",
    D: "Poor",
    F: "Critical",
  };
  return map[grade] ?? "";
}

export async function generatePdfBuffer(
  result: ScanResult,
  brand: BrandConfig,
  options?: {
    customPages?: PdfCustomPage[];
    ctaPage?: CtaPageConfig;
    pricing?: PricingTier[];
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: M, autoFirstPage: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let pageNum = 0;
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const primary = brand.colors.primary;
    const dark = brand.colors.dark;

    function newPage(bg = BASE_COLORS.white) {
      doc.addPage();
      pageNum++;
      doc.rect(0, 0, W, H).fill(bg);
    }

    function footer() {
      doc.save();
      doc.moveTo(M, FOOTER_Y).lineTo(W - M, FOOTER_Y).lineWidth(0.5).stroke(BASE_COLORS.rule);
      doc
        .fontSize(7)
        .fillColor(BASE_COLORS.muted)
        .text(`${brand.company}  |  ${brand.site}`, M, FOOTER_Y + 8, { lineBreak: false })
        .text(`Page ${pageNum}`, W - M - 30, FOOTER_Y + 8, { lineBreak: false });
      doc.restore();
    }

    // ── Page 1: Cover ─────────────────────────────────────────────────────
    newPage(dark);
    doc.rect(0, 0, W, 6).fill(primary);

    doc.fontSize(36).fillColor(BASE_COLORS.white).text(brand.company, M, 160, { width: CW });
    doc.fontSize(20).fillColor(BASE_COLORS.white).text("Report", M, 205, { width: CW });

    doc.fontSize(20).fillColor(primary).text(result.displayName, M, 280, { width: CW });
    if (result.subtitle) {
      doc.fontSize(11).fillColor(BASE_COLORS.muted).text(result.subtitle, M, 310, { width: CW });
    }
    doc.fontSize(12).fillColor(BASE_COLORS.muted).text(today, M, 335, { width: CW });

    doc.moveTo(M, 360).lineTo(M + 200, 360).lineWidth(2).stroke(primary);

    // Score circle
    const sc = scoreColor(result.overallScore);
    doc.circle(W - 150, 280, 55).lineWidth(6).stroke(sc);
    doc
      .fontSize(36)
      .fillColor(BASE_COLORS.white)
      .text(String(result.overallScore), W - 185, 262, { width: 70, align: "center" });
    doc
      .fontSize(10)
      .fillColor(BASE_COLORS.muted)
      .text(`Grade ${result.grade}`, W - 185, 305, { width: 70, align: "center" });

    doc.fontSize(10).fillColor(BASE_COLORS.muted).text("Prepared by", M, 385);
    doc.fontSize(14).fillColor(BASE_COLORS.white).text(brand.name, M, 402);
    doc.fontSize(11).fillColor(primary).text(brand.company, M, 422);

    doc.fontSize(9).fillColor("#4b5563").text(brand.tagline, M, 780);

    // ── Page 2: Score Overview ────────────────────────────────────────────
    newPage();
    doc.fontSize(22).fillColor(BASE_COLORS.text).text("Score Overview", M, 50, { lineBreak: false });
    doc.moveTo(M, 78).lineTo(M + 150, 78).lineWidth(3).stroke(primary);

    doc
      .fontSize(10)
      .fillColor(BASE_COLORS.muted)
      .text(
        `We ran ${result.checks.length} checks across ${result.categories.length} categories. Here's how ${result.displayName} performed.`,
        M,
        95,
        { width: CW }
      );

    // Overall score banner
    const bannerY = 135;
    doc.roundedRect(M, bannerY, CW, 80, 8).fill(dark);
    doc
      .fontSize(40)
      .fillColor(BASE_COLORS.white)
      .text(String(result.overallScore), M + 30, bannerY + 15, { lineBreak: false });
    doc
      .fontSize(12)
      .fillColor(BASE_COLORS.muted)
      .text("/ 100", M + 85, bannerY + 30, { lineBreak: false });
    doc
      .fontSize(24)
      .fillColor(sc)
      .text(`Grade ${result.grade}`, M + 180, bannerY + 20, { lineBreak: false });
    doc
      .fontSize(11)
      .fillColor(BASE_COLORS.muted)
      .text(gradeLabel(result.grade), M + 180, bannerY + 50, { lineBreak: false });

    // Category breakdown
    const catY = bannerY + 105;
    doc.fontSize(14).fillColor(BASE_COLORS.text).text("Category Breakdown", M, catY);

    result.categories.forEach((cat, i) => {
      const y = catY + 30 + i * 50;
      if (y + 50 > FOOTER_Y - 20) return;
      const barWidth = CW - 100;
      const fillWidth = (cat.score / 100) * barWidth;
      const barColor = scoreColor(cat.score);

      doc.fontSize(11).fillColor(BASE_COLORS.text).text(cat.label, M, y, { lineBreak: false });
      doc
        .fontSize(11)
        .fillColor(barColor)
        .text(`${cat.score}/100`, M + CW - 55, y, { lineBreak: false });
      doc
        .fontSize(8)
        .fillColor(BASE_COLORS.muted)
        .text(`${cat.passCount}/${cat.checkCount} checks passed`, M, y + 16, { lineBreak: false });

      doc.roundedRect(M, y + 30, barWidth, 8, 4).fill(BASE_COLORS.rule);
      if (fillWidth > 0) {
        doc.roundedRect(M, y + 30, Math.max(fillWidth, 8), 8, 4).fill(barColor);
      }
    });

    footer();

    // ── Detailed Checks (paginated) ──────────────────────────────────────
    const checks = result.checks;
    const ROW_H = 32;
    let isFirstChecksPage = true;
    let checkIdx = 0;

    while (checkIdx < checks.length) {
      newPage();
      let startY: number;

      if (isFirstChecksPage) {
        doc
          .fontSize(22)
          .fillColor(BASE_COLORS.text)
          .text("Detailed Checks", M, 50, { lineBreak: false });
        doc.moveTo(M, 78).lineTo(M + 150, 78).lineWidth(3).stroke(primary);
        doc
          .fontSize(10)
          .fillColor(BASE_COLORS.muted)
          .text(
            "Each check evaluates a specific aspect. Fails and warnings include actionable fixes.",
            M,
            95,
            { width: CW }
          );
        startY = 125;
        isFirstChecksPage = false;
      } else {
        doc
          .fontSize(12)
          .fillColor(BASE_COLORS.muted)
          .text("Detailed Checks (continued)", M, 55, { lineBreak: false });
        startY = 80;
      }

      // Table header
      const cols = [M, M + 25, M + 195, M + 340, M + 420];
      doc.rect(M, startY, CW, 20).fill(BASE_COLORS.headerBg);
      doc.fontSize(8).fillColor(BASE_COLORS.muted);
      doc.text("", cols[0]! + 5, startY + 6, { lineBreak: false });
      doc.text("Check", cols[1]! + 5, startY + 6, { lineBreak: false });
      doc.text("Result", cols[2]! + 5, startY + 6, { lineBreak: false });
      doc.text("Score", cols[3]! + 5, startY + 6, { lineBreak: false });
      doc.text("Category", cols[4]! + 5, startY + 6, { lineBreak: false });

      let y = startY + 20;

      while (checkIdx < checks.length && y + ROW_H < FOOTER_Y - 10) {
        const check = checks[checkIdx]!;
        if (checkIdx % 2 === 1) doc.rect(M, y, CW, ROW_H).fill(BASE_COLORS.stripe);

        const dotColor =
          check.status === "pass"
            ? BASE_COLORS.success
            : check.status === "warn"
              ? BASE_COLORS.warning
              : BASE_COLORS.danger;
        doc.circle(cols[0]! + 10, y + ROW_H / 2, 5).fill(dotColor);

        doc
          .fontSize(9)
          .fillColor(BASE_COLORS.text)
          .text(check.name, cols[1]! + 5, y + 4, { width: 165, lineBreak: false });

        let detail = check.details;
        if (detail.length > 55) detail = detail.slice(0, 52) + "...";
        doc
          .fontSize(7)
          .fillColor(BASE_COLORS.muted)
          .text(detail, cols[1]! + 5, y + 18, { width: 165, lineBreak: false });

        const statusLabel =
          check.status === "pass"
            ? "Pass"
            : check.status === "warn"
              ? "Warning"
              : check.status === "fail"
                ? "Fail"
                : "Skip";
        doc
          .fontSize(9)
          .fillColor(dotColor)
          .text(statusLabel, cols[2]! + 5, y + 10, { lineBreak: false });
        doc
          .fontSize(10)
          .fillColor(BASE_COLORS.text)
          .text(`${check.score}`, cols[3]! + 5, y + 10, { lineBreak: false });

        const catLabel = check.category
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        doc
          .fontSize(7)
          .fillColor(BASE_COLORS.muted)
          .text(catLabel, cols[4]! + 5, y + 10, { width: 70, lineBreak: false });

        y += ROW_H;
        checkIdx++;
      }

      footer();
    }

    // ── Top Issues & Fixes ───────────────────────────────────────────────
    const failsAndWarns = checks
      .filter((c) => c.status === "fail" || c.status === "warn")
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);

    if (failsAndWarns.length > 0) {
      newPage();
      doc
        .fontSize(22)
        .fillColor(BASE_COLORS.text)
        .text("Top Issues & Fixes", M, 50, { lineBreak: false });
      doc.moveTo(M, 78).lineTo(M + 180, 78).lineWidth(3).stroke(primary);
      doc
        .fontSize(10)
        .fillColor(BASE_COLORS.muted)
        .text("Highest-impact issues to fix first, sorted by importance.", M, 95, { width: CW });

      let issueY = 125;
      failsAndWarns.forEach((check, i) => {
        if (issueY > FOOTER_Y - 120) return;
        const statusColor = check.status === "fail" ? BASE_COLORS.danger : BASE_COLORS.warning;

        doc.circle(M + 10, issueY + 8, 10).fill(statusColor);
        doc
          .fontSize(10)
          .fillColor(BASE_COLORS.white)
          .text(String(i + 1), M + 6, issueY + 3, { lineBreak: false });
        doc.fontSize(11).fillColor(BASE_COLORS.text).text(check.name, M + 30, issueY);
        doc
          .fontSize(8)
          .fillColor(BASE_COLORS.muted)
          .text(check.details, M + 30, issueY + 16, { width: CW - 40 });

        if (check.recommendation) {
          doc
            .fontSize(8)
            .fillColor(primary)
            .text(`Fix: ${check.recommendation}`, M + 30, issueY + 30, { width: CW - 40 });
          issueY += 55;
        } else {
          issueY += 45;
        }
      });

      footer();
    }

    // ── Custom Pages ─────────────────────────────────────────────────────
    if (options?.customPages) {
      for (const page of options.customPages) {
        newPage();
        doc
          .fontSize(22)
          .fillColor(BASE_COLORS.text)
          .text(page.title, M, 50, { lineBreak: false });
        doc.moveTo(M, 78).lineTo(M + 180, 78).lineWidth(3).stroke(primary);

        if (page.subtitle) {
          doc.fontSize(10).fillColor(BASE_COLORS.muted).text(page.subtitle, M, 95, { width: CW });
        }

        let sectionY = page.subtitle ? 120 : 95;

        for (const section of page.sections) {
          if (sectionY > FOOTER_Y - 80) break;

          if (section.heading) {
            doc.fontSize(14).fillColor(BASE_COLORS.text).text(section.heading, M, sectionY);
            sectionY += 20;
          }

          if (section.type === "text" && section.content) {
            doc
              .fontSize(10)
              .fillColor(BASE_COLORS.muted)
              .text(section.content, M, sectionY, { width: CW });
            sectionY += 40;
          }

          if (section.type === "list" && section.items) {
            for (const item of section.items) {
              if (sectionY > FOOTER_Y - 30) break;
              doc.circle(M + 6, sectionY + 5, 3).fill(primary);
              doc
                .fontSize(9)
                .fillColor(BASE_COLORS.text)
                .text(item, M + 16, sectionY, { width: CW - 20 });
              sectionY += 18;
            }
            sectionY += 10;
          }

          if (section.type === "stat-row" && section.stats) {
            const statWidth = CW / section.stats.length;
            section.stats.forEach((stat, i) => {
              const x = M + i * statWidth;
              doc
                .fontSize(20)
                .fillColor(stat.color ?? primary)
                .text(stat.value, x, sectionY, { width: statWidth, align: "center" });
              doc
                .fontSize(8)
                .fillColor(BASE_COLORS.muted)
                .text(stat.label, x, sectionY + 25, { width: statWidth, align: "center" });
            });
            sectionY += 50;
          }
        }

        footer();
      }
    }

    // ── CTA Page ─────────────────────────────────────────────────────────
    newPage();
    doc.fontSize(22).fillColor(BASE_COLORS.text).text("Next Steps", M, 50, { lineBreak: false });
    doc.moveTo(M, 78).lineTo(M + 110, 78).lineWidth(3).stroke(primary);

    const steps = options?.ctaPage?.steps ?? [
      {
        title: "Review the full report",
        description: `Visit ${brand.site} for an interactive breakdown with actionable fixes.`,
      },
      {
        title: "Fix the quick wins first",
        description:
          "Most issues can be resolved in an afternoon. Start with the highest-impact items.",
      },
      {
        title: "Set up ongoing monitoring",
        description:
          "Things change fast. Regular scanning catches regressions before they cost you.",
      },
    ];

    let stepY = 100;
    steps.forEach((step, i) => {
      doc.circle(M + 10, stepY + 8, 10).fill(primary);
      doc
        .fontSize(10)
        .fillColor(BASE_COLORS.white)
        .text(String(i + 1), M + 6, stepY + 3, { lineBreak: false });
      doc.fontSize(11).fillColor(BASE_COLORS.text).text(step.title, M + 30, stepY);
      doc
        .fontSize(9)
        .fillColor(BASE_COLORS.muted)
        .text(step.description, M + 30, stepY + 16, { width: CW - 40 });
      stepY += 55;
    });

    // Pricing box
    if (options?.pricing && options.pricing.length > 0) {
      const ctaY = stepY + 20;
      const boxH = 120;
      doc.roundedRect(M, ctaY, CW, boxH, 8).fill(dark);
      doc.fontSize(14).fillColor(primary).text("Get Started", M + 25, ctaY + 18);

      const tierWidth = (CW - 50) / options.pricing.length;
      options.pricing.forEach((tier, i) => {
        const x = M + 25 + i * tierWidth;
        doc.fontSize(16).fillColor(BASE_COLORS.white).text(tier.name, x, ctaY + 42);
        doc.fontSize(11).fillColor(primary).text(tier.price, x, ctaY + 62);
        doc
          .fontSize(8)
          .fillColor(BASE_COLORS.muted)
          .text(tier.features.slice(0, 2).join(", "), x, ctaY + 78, { width: tierWidth - 10 });
      });

      doc.roundedRect(M + 30, ctaY + boxH - 25, CW - 60, 20, 4).fill(primary);
      doc
        .fontSize(9)
        .fillColor(BASE_COLORS.white)
        .text(`Book a walkthrough: ${brand.calendarLink}`, M + 50, ctaY + boxH - 20, {
          width: CW - 80,
          align: "center",
        });
    } else {
      const ctaY = stepY + 20;
      doc.roundedRect(M, ctaY, CW, 60, 8).fill(dark);
      doc
        .fontSize(12)
        .fillColor(BASE_COLORS.white)
        .text(`Run a free scan at ${brand.site}`, M + 25, ctaY + 12);
      doc.fontSize(10).fillColor(primary).text(brand.calendarLink, M + 25, ctaY + 32);
    }

    footer();

    // ── Finalize ─────────────────────────────────────────────────────────
    doc.end();
  });
}
