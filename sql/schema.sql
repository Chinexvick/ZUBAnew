-- AfriT Hub server schema. The server is the only judge of accounts, Premium and payments.
create extension if not exists citext;

create table if not exists users (
  id bigserial primary key,
  email citext not null unique,
  email_verified boolean not null default false,
  pw text not null,
  name text not null default '',
  username citext not null unique,
  kind text not null default 'individual' check (kind in ('individual','business')),
  biz_name text not null default '',
  biz_category text not null default '',
  language text not null default '',
  level smallint not null default 0 check (level between 0 and 4),
  premium_until timestamptz,
  session_version int not null default 1,
  failed_logins int not null default 0,
  locked_until timestamptz,
  wallet_frozen_until timestamptz,
  created_at timestamptz not null default now(),
  pw_changed_at timestamptz not null default now()
);

create table if not exists otps (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('verify','reset')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists otps_user on otps(user_id, purpose, created_at desc);

create table if not exists refresh_tokens (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  family uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  reason text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rt_family on refresh_tokens(family);

-- One wallet per account; one account per wallet.
create table if not exists wallets (
  user_id bigint primary key references users(id) on delete cascade,
  address citext not null unique check (address ~* '^0x[0-9a-f]{40}$'),
  linked_at timestamptz not null default now()
);

create table if not exists wallet_challenges (
  user_id bigint primary key references users(id) on delete cascade,
  nonce text not null,
  expires_at timestamptz not null
);

create table if not exists invoices (
  id uuid primary key,
  user_id bigint not null references users(id),
  purpose text not null check (purpose in ('premium','promo','party')),
  plan text not null,
  for_user_id bigint references users(id),
  usd numeric(12,2) not null check (usd > 0),
  zuba_units numeric(78,0) not null check (zuba_units > 0),
  usd_per_zuba numeric(30,18) not null,
  meta jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','paid','expired')),
  tx_hash citext unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz
);
create index if not exists inv_user on invoices(user_id, created_at desc);

create table if not exists promotions (
  id bigserial primary key,
  user_id bigint not null references users(id),
  invoice_id uuid not null unique references invoices(id),
  plan text not null,
  audience text not null default '',
  target text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

create table if not exists notifications (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  text text not null,
  data jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notes_user on notifications(user_id, created_at desc);

create table if not exists rate_hits (
  key text not null,
  bucket bigint not null,
  hits int not null default 0,
  primary key (key, bucket)
);

create table if not exists audit (
  id bigserial primary key,
  user_id bigint,
  event text not null,
  ip text,
  meta jsonb not null default '{}',
  at timestamptz not null default now()
);

-- Referrals: 2,000 ZUBA once the new member verifies their email and links a wallet.
alter table users add column if not exists referred_by bigint references users(id);
alter table users add column if not exists signup_ip text;
create table if not exists referrals (
  id bigserial primary key,
  referrer_id bigint not null references users(id),
  referee_id bigint not null unique references users(id),
  zuba bigint not null default 2000,
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  flag text,
  tx_hash citext,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists ref_referrer on referrals(referrer_id, created_at desc);

-- Orders paid from any wallet are matched by their exact amount.
alter table invoices add column if not exists exact boolean not null default false;

-- AI tutor: cached lesson audio, shared AI lessons and learner reports.
create table if not exists tts_cache (
  key text primary key,
  audio text not null,
  created_at timestamptz not null default now()
);
create table if not exists ai_lessons (
  lang text not null,
  stage int not null,
  unit int not null,
  content jsonb not null,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (lang, stage, unit)
);
create table if not exists lesson_reports (
  id bigserial primary key,
  user_id bigint references users(id) on delete set null,
  lang text not null,
  phrase text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
