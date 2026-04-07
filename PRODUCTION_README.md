/**
 * DemoDraft — Production-Ready Cold Email Platform
 * 
 * Optimized for: Performance, Reliability, Scalability, Security
 * 
 * Key Features:
 * - AI-powered website analysis using Claude
 * - Branded PDF report generation
 * - Personalized email drafting
 * - Multi-tenant SaaS architecture
 * - Stripe subscription billing
 * - Daily automated prospecting pipeline
 */

# Architecture Overview

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **AI**: Anthropic Claude Sonnet 4
- **Payments**: Stripe Subscriptions
- **Styling**: Tailwind CSS v4
- **Deployment**: Vercel (with Cron Jobs)

## Core Engine Modules

```
src/lib/engine/
├── pipeline.ts    # Orchestrates: scan → PDF → email → store
├── scanner.ts     # Website scraping + LLM analysis
├── sourcer.ts     # ICP-based prospect discovery
├── pdf.ts         # Branded PDF report generation
└── types.ts       # Shared TypeScript interfaces
```

# Setup Instructions

## Prerequisites
- Node.js 20+
- Supabase account
- Anthropic API key
- Stripe account (for payments)
- Google Custom Search API (optional, for prospect sourcing)

## Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
STRIPE_STARTER_PRICE_ID=your_starter_price_id
STRIPE_GROWTH_PRICE_ID=your_growth_price_id

# Google Custom Search (optional)
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_CX=your_search_engine_id

# Cron Security
CRON_SECRET=generate_secure_random_string
```

## Installation

```bash
npm install
npm run dev
```

# Performance Optimizations

## 1. Caching Strategy
- LLM responses cached by URL hash
- PDF reports cached in Supabase Storage
- Prospect data deduplicated via unique constraints

## 2. Concurrency Control
- Pipeline processes 3 prospects in parallel by default
- Configurable via `concurrency` parameter in `runBatch()`
- Rate limiting on external API calls

## 3. Database Optimization
- Indexed queries on `user_id`, `campaign_id`, `created_at`
- Partial indexes for status filtering
- Row-level security enabled

## 4. Memory Management
- PDF generation streams to Buffer (no filesystem I/O)
- Cheerio HTML parsing limited to 5KB body text
- AbortSignal timeouts on all fetch operations

# Security Best Practices

## Authentication
- Supabase Auth with PKCE flow
- Server-side session validation on all API routes
- RLS policies enforce data isolation

## API Security
- Cron endpoints require Bearer token
- Stripe webhooks verify signatures
- Input validation on all user-provided data

## Rate Limiting
- Daily prospect limits per plan tier
- Database-level counting prevents bypass
- Graceful 429 responses with retry info

# Monitoring & Observability

## Logging
- Structured console.log with pipeline stage markers
- Error messages include context (prospect URL, campaign ID)
- Failed drafts stored with error_message for debugging

## Metrics to Track
- Pipeline success/failure rate
- Average processing time per prospect
- Daily active users and draft volume
- Stripe MRR and churn rate

# Deployment Checklist

## Pre-Launch
- [ ] All environment variables configured
- [ ] Supabase migrations applied
- [ ] Stripe products and prices created
- [ ] Webhook endpoint tested with Stripe CLI
- [ ] Cron job verified in Vercel dashboard
- [ ] RLS policies tested with different user roles

## Post-Launch
- [ ] Monitor error rates in Vercel logs
- [ ] Set up alerts for pipeline failures
- [ ] Track conversion funnel (signup → campaign → upgrade)
- [ ] A/B test email subject lines

# API Reference

## POST /api/pipeline/scan
Scan a single prospect manually.

**Request:**
```json
{
  "campaignId": "uuid",
  "target": "example.com",
  "contactEmail": "founder@example.com"
}
```

**Response:**
```json
{
  "status": "success",
  "draft": {
    "target": "example.com",
    "displayName": "Example Inc",
    "score": 72,
    "grade": "C",
    "pdfUrl": "https://...",
    "emailSubject": "Idea for Example Inc + YourCo",
    "emailBody": "Hi, ..."
  }
}
```

## POST /api/cron/morning
Daily pipeline trigger (Vercel Cron).

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

## POST /api/checkout
Create Stripe checkout session.

**Request:**
```json
{ "plan": "starter" }
```

## POST /api/webhooks/stripe
Stripe webhook handler.

**Events:**
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

# Troubleshooting

## Common Issues

### "ANTHROPIC_API_KEY not configured"
Ensure `.env.local` is loaded and key is valid.

### "PDF upload failed"
Check Supabase Storage bucket `reports` exists and is public.

### "Daily limit reached"
User has hit their plan's daily draft limit. Upgrade or wait until tomorrow.

### Pipeline timeout
Reduce `concurrency` in `runBatch()` or increase Vercel function timeout.

# Contributing

## Code Style
- Strict TypeScript (`strict: true`)
- ESLint with Next.js config
- Functional components with hooks
- Async/await for all async operations

## Testing
Run type checking before commit:
```bash
npm run typecheck
npm run lint
```

# License
MIT © DemoDraft
