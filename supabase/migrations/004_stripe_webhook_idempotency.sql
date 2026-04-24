-- Stripe webhook idempotency log.
-- Prevents replay of `checkout.session.completed` / `subscription.updated`
-- from blindly re-upgrading a plan. Also protects against out-of-order
-- delivery reviving a cancelled subscription.
--
-- The webhook handler INSERTs the event.id here before processing; a second
-- delivery of the same event collides on PK and short-circuits.

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

-- Only the service role (webhook handler) touches this table. No user access.
create policy "stripe_webhook_events_service_role"
  on public.stripe_webhook_events
  for all
  to service_role
  using (true)
  with check (true);
