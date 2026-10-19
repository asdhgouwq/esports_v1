begin;
alter table public.matches add column if not exists game_number integer check (game_number between 1 and 7);
alter table public.player_stats add column if not exists team text;
create table if not exists public.match_schedules (
  match_id text primary key, overview_page text not null, tournament text not null,
  stage text, team1 text, team2 text, team1_score integer, team2_score integer,
  winner text, best_of integer, datetime_utc timestamptz, has_time boolean not null default false,
  is_nullified boolean not null default false, source text not null default 'Leaguepedia',
  updated_at timestamptz not null default now()
);
create table if not exists public.game_drafts (
  game_id text primary key references public.matches(game_id) on delete cascade,
  raw_draft jsonb not null, source text not null default 'Leaguepedia',
  updated_at timestamptz not null default now()
);
create index if not exists match_schedules_event_date on public.match_schedules(overview_page, datetime_utc);
create index if not exists matches_series_game on public.matches(match_id, game_number);
alter table public.match_schedules enable row level security;
alter table public.game_drafts enable row level security;
notify pgrst, 'reload schema';
commit;
