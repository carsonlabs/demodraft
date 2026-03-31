-- DemoDraft Initial Schema
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  company_name text,
  plan text not null default 'free' check (plan in ('free', 'starter', 'growth')),
  daily_limit int not null default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  gmail_refresh_token text,
  gmail_email text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Campaigns ───────────────────────────────────────────────────────────────
create table public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  -- Brand config
  brand_name text not null,
  brand_company text not null,
  brand_site text,
  brand_email text not null,
  brand_calendar_link text,
  brand_tagline text,
  brand_color_primary text not null default '#6366f1',
  brand_color_dark text not null default '#1e1b4b',
  -- LLM analysis config
  value_prop text not null,
  product_description text not null,
  analysis_prompt text,
  email_template text,
  pdf_template text not null default 'standard' check (pdf_template in ('standard', 'minimal', 'bold')),
  -- Schedule
  daily_prospect_count int not null default 10,
  send_time time not null default '08:00',
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Prospects ───────────────────────────────────────────────────────────────
create table public.prospects (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  target text not null,
  contact_name text,
  contact_email text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'skipped')),
  queued_for date,
  created_at timestamptz not null default now(),
  unique(campaign_id, target)
);

-- ── Drafts ──────────────────────────────────────────────────────────────────
create table public.drafts (
  id uuid primary key default uuid_generate_v4(),
  prospect_id uuid references public.prospects(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  scan_score int,
  scan_grade text,
  scan_data jsonb,
  pdf_url text,
  pdf_filename text,
  email_to text,
  email_subject text,
  email_body text,
  gmail_draft_id text,
  gmail_status text not null default 'pending'
    check (gmail_status in ('pending', 'created', 'sent', 'error')),
  status text not null default 'pending'
    check (status in ('pending', 'scanning', 'generating', 'ready', 'pushed', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ── Pipeline Runs ───────────────────────────────────────────────────────────
create table public.pipeline_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  run_date date not null default current_date,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  total_prospects int not null default 0,
  succeeded int not null default 0,
  failed int not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Usage Tracking ──────────────────────────────────────────────────────────
create table public.usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  period_start date not null,
  prospects_used int not null default 0,
  prospects_limit int not null,
  created_at timestamptz not null default now(),
  unique(user_id, period_start)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.prospects enable row level security;
alter table public.drafts enable row level security;
alter table public.pipeline_runs enable row level security;
alter table public.usage enable row level security;

create policy "own_rows" on public.profiles for all using (auth.uid() = id);
create policy "own_rows" on public.campaigns for all using (auth.uid() = user_id);
create policy "own_rows" on public.prospects for all using (auth.uid() = user_id);
create policy "own_rows" on public.drafts for all using (auth.uid() = user_id);
create policy "own_rows" on public.pipeline_runs for all using (auth.uid() = user_id);
create policy "own_rows" on public.usage for all using (auth.uid() = user_id);

-- ── Auto-create profile on signup ───────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index idx_prospects_campaign_status on public.prospects(campaign_id, status);
create index idx_prospects_queued on public.prospects(campaign_id, queued_for, status);
create index idx_drafts_campaign on public.drafts(campaign_id, created_at desc);
create index idx_drafts_user_status on public.drafts(user_id, status);
create index idx_pipeline_runs_date on public.pipeline_runs(user_id, run_date);

-- ── Storage bucket for PDFs ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict do nothing;

create policy "Users can upload their own reports"
  on storage.objects for insert
  with check (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Reports are publicly readable"
  on storage.objects for select
  using (bucket_id = 'reports');
