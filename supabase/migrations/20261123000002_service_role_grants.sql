-- The API connects as service_role. On current Supabase projects new tables are not granted to
-- any API role by default, so grant service_role exactly what the server needs. anon and
-- authenticated still get nothing (the browser never reads the database directly).
-- process_events stays append-only: its trigger applies to service_role too.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Tables and sequences created by later migrations get the same grants automatically.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
