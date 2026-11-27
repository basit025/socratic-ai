-- "Book a pilot" requests from the landing page (institutions asking to try Socratic AI with a real class).
-- Server-only like every table: RLS on, no policies, no grants to anon/authenticated.
create table public.pilot_requests (
  id            bigint generated always as identity primary key,
  name          text not null check (char_length(name) between 2 and 120),
  email         text not null check (char_length(email) between 5 and 200),
  phone         text check (phone is null or char_length(phone) <= 40),
  institution   text not null check (char_length(institution) between 2 and 200),
  role          text not null check (role in ('teacher', 'head_of_department', 'administrator', 'student', 'other')),
  students      text check (students is null or students in ('under_100', '100_500', '500_2000', 'over_2000')),
  message       text check (message is null or char_length(message) <= 2000),
  ip_hash       text,
  created_at    timestamptz not null default now()
);
alter table public.pilot_requests enable row level security;
grant select, insert on public.pilot_requests to service_role;
grant usage, select on sequence public.pilot_requests_id_seq to service_role;
