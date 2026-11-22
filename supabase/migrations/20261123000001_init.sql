-- Socratic AI: initial schema (Nov 23, 2026)
--
-- Design decisions
-- 1. Server-only access. The browser never talks to Postgres. Every table has row-level
--    security ON and NO policies, so the anon/authenticated keys can read nothing; only the
--    Express API (service_role) can, and it enforces roles on every endpoint.
-- 2. Sandboxes. Every row belongs to a sandbox (ON DELETE CASCADE):
--      'seed' = the demo template (never shown directly), 'live' = real accounts
--      (e.g. Thursday's test), 'demo' = one per "Try as teacher/student" click, expiring.
--    Creating a demo sandbox copies the small rows (courses, assignments, submissions, flags,
--    vivas) and SHARES the heavy, immutable process-event logs via submissions.event_source_id.
--    The nightly reset deletes expired sandboxes; everything inside cascades away.
-- 3. Append-only evidence. process_events can never be updated, and only the reset function
--    may delete them. server_time is always set by the database, never by the client.
-- 4. Secrets stay server-side. Reference solutions, hidden tests and answer keys live in
--    assignment_secrets / answer_key columns that API responses must never include.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- sandboxes
create table public.sandboxes (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('seed', 'live', 'demo')),
  role        text check (role in ('teacher', 'student')),        -- demo sandboxes only
  ip_hash     text,                                                -- salted hash, for rate limits
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  check ((kind = 'demo') = (expires_at is not null))
);
create unique index sandboxes_one_seed on public.sandboxes (kind) where kind in ('seed', 'live');
create index sandboxes_expiry on public.sandboxes (expires_at) where kind = 'demo';

-- ---------------------------------------------------------------- people
create table public.profiles (
  id               uuid primary key default gen_random_uuid(),
  sandbox_id       uuid not null references public.sandboxes (id) on delete cascade,
  auth_user_id     uuid unique,                                    -- Supabase Auth user (real accounts)
  role             text not null check (role in ('teacher', 'student')),
  full_name        text not null check (length(full_name) between 1 and 120),
  email            text,
  initials         text not null check (length(initials) between 1 and 3),
  created_at       timestamptz not null default now()
);
create index profiles_sandbox on public.profiles (sandbox_id);

-- ---------------------------------------------------------------- courses and material
create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  sandbox_id  uuid not null references public.sandboxes (id) on delete cascade,
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  code        text not null check (length(code) between 2 and 20),      -- e.g. CS-101
  name        text not null check (length(name) between 2 and 120),
  section     text,
  term        text,
  join_code   text not null check (join_code ~ '^[A-Z2-9]{6}$'),        -- no 0/O/1/I confusion
  created_at  timestamptz not null default now(),
  unique (sandbox_id, join_code)
);
create index courses_sandbox on public.courses (sandbox_id);
create index courses_teacher on public.courses (teacher_id);

create table public.enrollments (
  sandbox_id  uuid not null references public.sandboxes (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (course_id, student_id)
);
create index enrollments_student on public.enrollments (student_id);

create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  sandbox_id  uuid not null references public.sandboxes (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  week        int  not null check (week between 1 and 20),
  title       text not null,
  notes_md    text not null default '',
  unique (course_id, week)
);

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  sandbox_id  uuid not null references public.sandboxes (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  body        text not null,
  posted_at   timestamptz not null default now()
);
create index announcements_course on public.announcements (course_id, posted_at desc);

-- ---------------------------------------------------------------- assignments
create table public.assignments (
  id               uuid primary key default gen_random_uuid(),
  sandbox_id       uuid not null references public.sandboxes (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  module_id        uuid references public.modules (id) on delete set null,
  type             text not null check (type in ('code', 'written', 'handwritten', 'quiz')),
  title            text not null check (length(title) between 2 and 120),
  instructions_md  text not null default '',
  language         text check (language in ('python', 'javascript', 'html')),
  starter_code     text not null default '',
  marks            int  not null default 10 check (marks between 1 and 1000),
  status           text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  opens_at         timestamptz,
  due_at           timestamptz,
  created_at       timestamptz not null default now(),
  check ((type = 'code') = (language is not null))
);
create index assignments_course on public.assignments (course_id, due_at);

create table public.integrity_rules (
  assignment_id        uuid primary key references public.assignments (id) on delete cascade,
  sandbox_id           uuid not null references public.sandboxes (id) on delete cascade,
  paste_blocked        boolean not null default true,
  workflow             text    not null default 'run_first' check (workflow in ('run_first', 'explain_first')),
  viva_questions       int     not null default 3  check (viva_questions between 0 and 5),
  viva_seconds_per_q   int     not null default 90 check (viva_seconds_per_q between 30 and 600),
  viva_weight          int     not null default 50 check (viva_weight between 0 and 100),   -- % of the grade
  variants_on          boolean not null default true,
  time_limit_minutes   int     check (time_limit_minutes between 1 and 600),
  fullscreen_required  boolean not null default false
);

-- Server-only: never selected into an API response.
create table public.assignment_secrets (
  assignment_id       uuid primary key references public.assignments (id) on delete cascade,
  sandbox_id          uuid not null references public.sandboxes (id) on delete cascade,
  reference_solution  text,
  hidden_tests        jsonb not null default '[]'::jsonb,   -- [{ "input": ..., "expected": ... }]
  variant_spec        jsonb not null default '{}'::jsonb    -- parameters that change per student
);

create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  sandbox_id     uuid not null references public.sandboxes (id) on delete cascade,
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  position       int  not null,
  kind           text not null check (kind in ('mcq', 'short')),
  prompt_md      text not null,
  options        jsonb,                                     -- mcq choices
  answer_key     jsonb not null,                            -- SERVER-ONLY
  marks          int  not null default 1,
  unique (assignment_id, position)
);

create table public.variants (
  id                     uuid primary key default gen_random_uuid(),
  sandbox_id             uuid not null references public.sandboxes (id) on delete cascade,
  assignment_id          uuid not null references public.assignments (id) on delete cascade,
  student_id             uuid not null references public.profiles (id) on delete cascade,
  params                 jsonb not null default '{}'::jsonb,
  rendered_instructions  text not null,
  created_at             timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- ---------------------------------------------------------------- submissions and evidence
create table public.submissions (
  id                uuid primary key default gen_random_uuid(),
  sandbox_id        uuid not null references public.sandboxes (id) on delete cascade,
  assignment_id     uuid not null references public.assignments (id) on delete cascade,
  student_id        uuid not null references public.profiles (id) on delete cascade,
  variant_id        uuid references public.variants (id) on delete set null,
  status            text not null default 'in_progress'
                    check (status in ('in_progress', 'submitted', 'viva_in_progress', 'graded')),
  content           text not null default '',                -- code or written answer
  image_path        text,                                    -- handwritten page (storage path)
  last_output       text,
  test_results      jsonb,                                   -- [{ "name", "passed" }] - no expected values
  tests_passed      int,
  tests_total       int,
  viva_score        int check (viva_score between 0 and 100),
  suggested_grade   numeric(6,2),
  final_grade       numeric(6,2),
  teacher_comment   text,
  teacher_decision  text check (teacher_decision in ('looks_fine', 'talk_to_student')),
  started_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  graded_at         timestamptz,
  -- Demo copies point at the seed submission whose event log they replay (logs are shared, never copied).
  event_source_id   uuid references public.submissions (id) on delete set null,
  unique (assignment_id, student_id)
);
create index submissions_assignment on public.submissions (assignment_id, status);
create index submissions_student on public.submissions (student_id);

create table public.process_events (
  id             bigint generated always as identity primary key,
  sandbox_id     uuid not null references public.sandboxes (id) on delete cascade,
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  seq            int  not null check (seq >= 1),            -- per-submission client sequence
  type           text not null check (type in (
                   'keys', 'delete', 'paste_attempt', 'run', 'error',
                   'focus_lost', 'focus_back', 'fullscreen_exit', 'snapshot', 'submit')),
  payload        jsonb not null default '{}'::jsonb,
  client_time    timestamptz not null,
  server_time    timestamptz not null default now(),
  unique (submission_id, seq)                               -- makes batch retries idempotent
);
create index process_events_submission on public.process_events (submission_id, seq);

create table public.ustaad_messages (
  id             uuid primary key default gen_random_uuid(),
  sandbox_id     uuid not null references public.sandboxes (id) on delete cascade,
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  role           text not null check (role in ('student', 'ustaad')),
  body           text not null,
  hint           text,
  created_at     timestamptz not null default now()
);
create index ustaad_messages_submission on public.ustaad_messages (submission_id, created_at);

create table public.viva_sessions (
  id                   uuid primary key default gen_random_uuid(),
  sandbox_id           uuid not null references public.sandboxes (id) on delete cascade,
  submission_id        uuid not null unique references public.submissions (id) on delete cascade,
  status               text not null default 'in_progress'
                       check (status in ('in_progress', 'completed', 'abandoned')),
  -- [{ kind, prompt, seconds_allowed, asked_at, answer, answered_at, auto_check }]
  -- auto_check.expected (ground truth from running the student's code) is SERVER-ONLY.
  questions            jsonb not null default '[]'::jsonb,
  current_index        int   not null default 0,
  rubric               jsonb,                               -- { goal, logic, output_prediction, modification }
  understanding_score  int check (understanding_score between 0 and 100),
  summary              text,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz
);

create table public.flags (
  id               uuid primary key default gen_random_uuid(),
  sandbox_id       uuid not null references public.sandboxes (id) on delete cascade,
  submission_id    uuid not null references public.submissions (id) on delete cascade,
  rule             text not null check (rule in (
                     'large_insertion', 'typing_faster_than_baseline', 'focus_loss_then_burst',
                     'correct_without_runs', 'perfect_tests_low_viva')),
  severity         text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  message          text not null,                           -- a plain sentence for the teacher
  evidence         jsonb not null default '{}'::jsonb,      -- { from_seq, to_seq, ... } for "Show me"
  teacher_status   text not null default 'open' check (teacher_status in ('open', 'dismissed', 'followed_up')),
  created_at       timestamptz not null default now()
);
create index flags_submission on public.flags (submission_id);

-- ---------------------------------------------------------------- operations
create table public.ai_usage (
  id             bigint generated always as identity primary key,
  sandbox_id     uuid references public.sandboxes (id) on delete set null,
  provider       text not null check (provider in ('gemini', 'groq', 'openrouter')),
  model          text not null,
  purpose        text not null check (purpose in ('hint', 'viva_question', 'viva_score', 'summary', 'handwriting', 'other')),
  input_tokens   int,
  output_tokens  int,
  latency_ms     int,
  ok             boolean not null,
  error_code     text,
  created_at     timestamptz not null default now()
);
create index ai_usage_created on public.ai_usage (created_at);

create table public.rate_limits (
  key           text not null,                              -- e.g. 'ai:sandbox:<id>' or 'ai:ip:<hash>'
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------- integrity of the event log
create or replace function public.process_events_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.server_time := now();                               -- the client can't choose its own timestamp
    return new;
  elsif tg_op = 'UPDATE' then
    raise exception 'process_events is append-only';
  elsif tg_op = 'DELETE' then
    if coalesce(current_setting('app.allow_event_delete', true), '') <> 'on' then
      raise exception 'process_events can only be deleted by the nightly reset';
    end if;
    return old;
  end if;
  return null;
end $$;

create trigger process_events_guard
  before insert or update or delete on public.process_events
  for each row execute function public.process_events_guard();

-- ---------------------------------------------------------------- functions called by the API
-- Atomic fixed-window rate limit. Returns true if the call is allowed.
create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count  int;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning count into v_count;
  return v_count <= p_max;
end $$;

-- Nightly reset: deletes expired demo sandboxes (everything inside cascades) and old counters.
create or replace function public.reset_demo() returns jsonb
language plpgsql as $$
declare
  v_sandboxes int;
  v_limits    int;
begin
  perform set_config('app.allow_event_delete', 'on', true);  -- this transaction only
  delete from public.sandboxes where kind = 'demo' and expires_at < now();
  get diagnostics v_sandboxes = row_count;
  delete from public.rate_limits where window_start < now() - interval '2 days';
  get diagnostics v_limits = row_count;
  return jsonb_build_object('sandboxes_deleted', v_sandboxes, 'rate_limit_rows_deleted', v_limits);
end $$;

-- Cheap liveness check for /api/health.
create or replace function public.health_ping() returns int language sql stable as $$ select 1 $$;

-- ---------------------------------------------------------------- lock everything down
do $$
declare t text;
begin
  foreach t in array array[
    'sandboxes', 'profiles', 'courses', 'enrollments', 'modules', 'announcements', 'assignments',
    'integrity_rules', 'assignment_secrets', 'quiz_questions', 'variants', 'submissions',
    'process_events', 'ustaad_messages', 'viva_sessions', 'flags', 'ai_usage', 'rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.reset_demo() from public, anon, authenticated;
revoke execute on function public.process_events_guard() from public, anon, authenticated;
revoke execute on function public.health_ping() from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
grant execute on function public.reset_demo() to service_role;
grant execute on function public.health_ping() to service_role;

-- The two fixed sandboxes.
insert into public.sandboxes (kind) values ('seed'), ('live');
