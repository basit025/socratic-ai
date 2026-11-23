-- Real accounts (FR-01) live in the 'live' sandbox, separate from demo data.
-- Passwords are stored only as scrypt hashes ("scrypt$<N>$<salt b64>$<hash b64>").
alter table public.profiles add column if not exists password_hash text;
create unique index if not exists profiles_email_per_sandbox
  on public.profiles (sandbox_id, lower(email)) where email is not null;

create or replace function public.live_sandbox_id() returns uuid
language sql stable as $$ select id from public.sandboxes where kind = 'live' $$;
revoke execute on function public.live_sandbox_id() from public, anon, authenticated;
grant execute on function public.live_sandbox_id() to service_role;
