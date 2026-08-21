-- ── Gmail draft delivery support ────────────────────────────────────────────
-- Optional: when a campaign has gmail_draft = true, the pipeline also creates
-- a draft in the configured owner's Gmail mailbox after writing the DB row.

alter table public.campaigns
  add column if not exists gmail_draft boolean not null default false;

alter table public.drafts
  add column if not exists gmail_draft_id text;

-- Index so dashboard / CLI can quickly find drafts that have / don't have a
-- corresponding Gmail draft.
create index if not exists drafts_gmail_draft_id_idx
  on public.drafts (gmail_draft_id)
  where gmail_draft_id is not null;
