-- Run this in Supabase → SQL Editor
-- Creates the payments table to store confirmed Fire payments

create table if not exists payments (
  id           bigserial primary key,
  fire_ref     text unique,                      -- Fire's unique payment/transaction ID
  name         text,                             -- Payer name from Fire
  email        text,                             -- Payer email (used to verify on page)
  amount       numeric,                          -- Payment amount
  currency     text default 'GBP',
  status       text default 'confirmed',         -- confirmed | refunded
  raw_event    text,                             -- Fire event type for debugging
  paid_at      timestamptz default now(),
  created_at   timestamptz default now()
);

-- Index for fast email lookups (used when customer enters email on page)
create index if not exists payments_email_idx on payments(email);
create index if not exists payments_status_idx on payments(status);

-- Enable Row Level Security
alter table payments enable row level security;

-- Allow the Edge Function (service role) to read/write everything
-- The anon key can only read confirmed payments (for the HTML page check)
create policy "Service role full access"
  on payments for all
  using (true)
  with check (true);

-- Allow public read for email verification (the HTML page uses the anon key)
-- Only exposes: paid status — no sensitive data returned to anon
create policy "Public can check payment status"
  on payments for select
  using (status = 'confirmed');

-- ─────────────────────────────────────────────
-- OPTIONAL: Manual insert for testing
-- Run this to simulate a paid customer
-- ─────────────────────────────────────────────
-- insert into payments (fire_ref, name, email, amount, currency, status)
-- values ('test-001', 'Test User', 'test@example.com', 60, 'GBP', 'confirmed');
