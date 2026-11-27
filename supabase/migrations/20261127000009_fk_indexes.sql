-- Indexes for foreign keys that had none. Without them every cascading delete of a sandbox (the
-- nightly reset) scans whole tables per row and hits the statement timeout, and every API query
-- filtered by sandbox_id scans more as demo sandboxes accumulate.
create index if not exists enrollments_sandbox on public.enrollments (sandbox_id);
create index if not exists modules_sandbox on public.modules (sandbox_id);
create index if not exists announcements_sandbox on public.announcements (sandbox_id);
create index if not exists assignments_sandbox on public.assignments (sandbox_id);
create index if not exists assignments_module on public.assignments (module_id);
create index if not exists integrity_rules_sandbox on public.integrity_rules (sandbox_id);
create index if not exists assignment_secrets_sandbox on public.assignment_secrets (sandbox_id);
create index if not exists quiz_questions_sandbox on public.quiz_questions (sandbox_id);
create index if not exists variants_sandbox on public.variants (sandbox_id);
create index if not exists variants_student on public.variants (student_id);
create index if not exists submissions_sandbox on public.submissions (sandbox_id);
create index if not exists submissions_variant on public.submissions (variant_id);
create index if not exists submissions_event_source on public.submissions (event_source_id);
create index if not exists process_events_sandbox on public.process_events (sandbox_id);
create index if not exists ustaad_messages_sandbox on public.ustaad_messages (sandbox_id);
create index if not exists viva_sessions_sandbox on public.viva_sessions (sandbox_id);
create index if not exists flags_sandbox on public.flags (sandbox_id);
create index if not exists ai_usage_sandbox on public.ai_usage (sandbox_id);
