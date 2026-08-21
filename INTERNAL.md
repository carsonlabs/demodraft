# DemoDraft — Internal Tool Surface

Bearer-token API + CLI for driving the DemoDraft engine programmatically
from command-center, agents, or a terminal. Lives alongside the existing
SaaS surface — both can run on the same deploy.

## Setup

### 1. Apply migration 005

```bash
# Supabase SQL Editor → run:
cat supabase/migrations/005_gmail_draft_support.sql
```

Adds `campaigns.gmail_draft` (boolean) and `drafts.gmail_draft_id` (text).

### 2. Required env vars

```bash
INTERNAL_API_TOKEN=<long random string>
INTERNAL_OWNER_USER_ID=<your Supabase auth user UUID>
```

The owner UUID is the user that internal calls will attribute writes to.
Find it in Supabase → Authentication → Users → click your account.

### 3. Optional: Gmail draft delivery

To have generated drafts land in your Gmail inbox automatically:

```bash
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_FROM=you@example.com
```

One-time refresh token dance:
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client
   (type: Web application). Add `https://developers.google.com/oauthplayground`
   as an authorized redirect URI.
2. https://developers.google.com/oauthplayground → settings (⚙) → check
   "Use your own OAuth credentials" → paste your client ID + secret.
3. Authorize the scope `https://www.googleapis.com/auth/gmail.compose`.
4. Click "Exchange authorization code for tokens" → copy the `refresh_token`.

Set `gmail_draft = true` on a campaign to enable delivery for that campaign.

## API surface

All routes require `Authorization: Bearer ${INTERNAL_API_TOKEN}`.
All writes are attributed to `INTERNAL_OWNER_USER_ID`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/internal/health` | Probe — confirms env vars are set |
| POST | `/api/internal/campaigns` | Create campaign from nested JSON config |
| POST | `/api/internal/campaigns/:id/clone` | Clone campaign with optional overrides |
| POST | `/api/internal/prospects/import` | Bulk-insert up to 500 prospects |

## CLI

The CLI wraps the API for terminal-driven workflows.

```bash
export DEMODRAFT_BASE_URL=https://demodraft.app   # or http://localhost:3000
export DEMODRAFT_INTERNAL_TOKEN=$INTERNAL_API_TOKEN

# Probe
node bin/demodraft.js health

# Create a campaign from a JSON file
node bin/demodraft.js campaign create ./campaign.json

# Clone an existing campaign with a new name
node bin/demodraft.js campaign clone <campaign-id> ./overrides.json

# Bulk-import prospects (file = JSON array of {target, contactEmail?, contactName?})
node bin/demodraft.js prospects import <campaign-id> ./prospects.json
```

After `npm install`, the CLI is also available as `npx demodraft` thanks to
the `bin` field in `package.json`.

## Example: campaign.json

```json
{
  "name": "PaintPulse Q3 outreach",
  "brand": {
    "name": "Carson",
    "company": "PaintPulse",
    "site": "paintpulse.app",
    "email": "carson@paintpulse.app",
    "calendarLink": "https://cal.com/carson/paintpulse",
    "tagline": "Painter SMS gallery + AI chat"
  },
  "valueProposition": "Get every job into your portfolio with two SMS texts.",
  "productDescription": "PaintPulse — SMS-first portfolio + lead capture for painters.",
  "analysisPrompt": "Audit this painting company's website for portfolio gaps.",
  "pdfTemplate": "standard",
  "dailyProspectCount": 10,
  "icp": {
    "description": "Solo painters and 2-3 person crews in southern Ontario",
    "industry": "home services",
    "keywords": "painter contractor residential"
  },
  "gmailDraft": true
}
```

## Example: prospects.json

```json
[
  { "target": "painters-hamilton.ca", "contactEmail": "info@painters-hamilton.ca", "contactName": "Neil" },
  { "target": "smithpainting.ca" },
  { "target": "https://www.acmepainters.com", "contactEmail": "owner@acmepainters.com" }
]
```

Targets are normalized: protocol stripped, `www.` stripped, lowercased.
Duplicates within a batch — and existing prospects in the campaign — are
skipped (existing rows keep their current status, never reset to `queued`).
