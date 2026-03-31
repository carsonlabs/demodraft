/**
 * DemoDraft Engine — Core Types
 *
 * Adapted from the outreach-engine types for multi-tenant SaaS.
 * Every campaign defines its own brand config + analysis prompt.
 * The engine handles scanning, PDF generation, and email drafting.
 */

// ── Brand Config ────────────────────────────────────────────────────────────

export interface BrandConfig {
  name: string;
  company: string;
  site: string;
  email: string;
  calendarLink: string;
  tagline: string;
  colors: {
    primary: string;
    dark: string;
  };
}

// ── Scan Result ─────────────────────────────────────────────────────────────

export interface ScanCheck {
  name: string;
  status: "pass" | "warn" | "fail" | "skip";
  details: string;
  recommendation?: string;
  score: number;
  weight: number;
  category: string;
}

export interface ScanCategory {
  id: string;
  label: string;
  score: number;
  checkCount: number;
  passCount: number;
}

export interface ScanResult {
  target: string;
  displayName: string;
  overallScore: number;
  grade: string;
  subtitle?: string;
  categories: ScanCategory[];
  checks: ScanCheck[];
  meta?: Record<string, unknown>;
}

// ── Email Draft ─────────────────────────────────────────────────────────────

export interface EmailDraft {
  to: string | null;
  subject: string;
  body: string;
  pdfFilename: string;
  notes: string;
}

// ── PDF Options ─────────────────────────────────────────────────────────────

export interface PdfCustomPage {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
}

export interface PdfSection {
  type: "text" | "list" | "stat-row" | "table";
  heading?: string;
  content?: string;
  items?: string[];
  stats?: { label: string; value: string; color?: string }[];
  rows?: { cells: string[] }[];
  headers?: string[];
}

export interface CtaPageConfig {
  steps: { title: string; description: string }[];
}

export interface PricingTier {
  name: string;
  price: string;
  features: string[];
  highlighted?: boolean;
}

// ── Campaign (DB-driven plugin replacement) ─────────────────────────────────

export interface CampaignConfig {
  id: string;
  userId: string;
  name: string;
  brand: BrandConfig;
  valueProposition: string;
  productDescription: string;
  analysisPrompt?: string;
  emailTemplate?: string;
  pdfTemplate: "standard" | "minimal" | "bold";
  dailyProspectCount: number;
  ctaSteps?: CtaPageConfig;
  pricing?: PricingTier[];
}

// ── Prospect ────────────────────────────────────────────────────────────────

export interface ProspectInput {
  id: string;
  target: string;
  contactEmail?: string | null;
  contactName?: string | null;
}

// ── Pipeline ────────────────────────────────────────────────────────────────

export interface DraftResult {
  prospectId: string;
  target: string;
  displayName: string;
  scanScore: number;
  scanGrade: string;
  scanData: ScanResult;
  pdfBuffer: Buffer;
  pdfFilename: string;
  emailTo: string | null;
  emailSubject: string;
  emailBody: string;
  status: "success" | "error";
  error?: string;
}
