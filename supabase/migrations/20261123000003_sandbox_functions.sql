-- Demo sandboxes: one private copy of the seed per "Try as teacher / Try as student" click.
-- Small rows are copied with new ids; process-event logs are SHARED (never copied): each copied
-- submission points at the seed submission whose log it replays (event_source_id).

alter table public.sandboxes add column if not exists seeded_at timestamptz;

-- Empties a seed or demo sandbox (used by the seed script). Real ("live") data can't be cleared.
create or replace function public.clear_sandbox(p_sandbox uuid) returns void
language plpgsql as $$
declare v_kind text;
begin
  select kind into v_kind from public.sandboxes where id = p_sandbox;
  if v_kind is null then raise exception 'sandbox % not found', p_sandbox; end if;
  if v_kind = 'live' then raise exception 'live sandboxes hold real data and cannot be cleared'; end if;
  perform set_config('app.allow_event_delete', 'on', true);
  delete from public.profiles where sandbox_id = p_sandbox;      -- cascades to everything else
  delete from public.ai_usage where sandbox_id = p_sandbox;
end $$;

create or replace function public.seed_sandbox_id() returns uuid
language sql stable as $$ select id from public.sandboxes where kind = 'seed' $$;

-- Creates a demo sandbox and returns the visitor's identity in it.
-- The demo identities are the seed profiles with emails demo-teacher@… / demo-student@….
create or replace function public.create_demo_sandbox(p_role text, p_ip_hash text default null, p_hours int default 24)
returns jsonb language plpgsql as $$
declare
  v_seed uuid := public.seed_sandbox_id();
  v_new  uuid;
  v_profile uuid;
  v_name text;
  v_shift interval;
begin
  if p_role not in ('teacher', 'student') then raise exception 'role must be teacher or student'; end if;
  if v_seed is null then raise exception 'seed sandbox missing'; end if;
  -- Keep the demo looking current: every copied date moves forward by the time since seeding.
  select now() - coalesce(seeded_at, now()) into v_shift from public.sandboxes where id = v_seed;

  insert into public.sandboxes (kind, role, ip_hash, expires_at)
  values ('demo', p_role, p_ip_hash, now() + make_interval(hours => greatest(1, least(p_hours, 72))))
  returning id into v_new;

  -- old id -> new id for every copied row
  drop table if exists pg_temp._m;
  create temp table _m (old uuid primary key, new uuid not null) on commit drop;
  insert into _m select id, gen_random_uuid() from public.profiles       where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.courses        where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.modules        where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.announcements  where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.assignments    where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.quiz_questions where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.variants       where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.submissions    where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.ustaad_messages where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.viva_sessions  where sandbox_id = v_seed;
  insert into _m select id, gen_random_uuid() from public.flags          where sandbox_id = v_seed;

  insert into public.profiles (id, sandbox_id, role, full_name, email, initials, created_at)
  select m.new, v_new, p.role, p.full_name, p.email, p.initials, p.created_at + v_shift
  from public.profiles p join _m m on m.old = p.id where p.sandbox_id = v_seed;

  insert into public.courses (id, sandbox_id, teacher_id, code, name, section, term, join_code, created_at)
  select m.new, v_new, mt.new, c.code, c.name, c.section, c.term, c.join_code, c.created_at + v_shift
  from public.courses c join _m m on m.old = c.id join _m mt on mt.old = c.teacher_id where c.sandbox_id = v_seed;

  insert into public.enrollments (sandbox_id, course_id, student_id, joined_at)
  select v_new, mc.new, ms.new, e.joined_at + v_shift
  from public.enrollments e join _m mc on mc.old = e.course_id join _m ms on ms.old = e.student_id where e.sandbox_id = v_seed;

  insert into public.modules (id, sandbox_id, course_id, week, title, notes_md)
  select m.new, v_new, mc.new, x.week, x.title, x.notes_md
  from public.modules x join _m m on m.old = x.id join _m mc on mc.old = x.course_id where x.sandbox_id = v_seed;

  insert into public.announcements (id, sandbox_id, course_id, title, body, posted_at)
  select m.new, v_new, mc.new, a.title, a.body, a.posted_at + v_shift
  from public.announcements a join _m m on m.old = a.id join _m mc on mc.old = a.course_id where a.sandbox_id = v_seed;

  insert into public.assignments (id, sandbox_id, course_id, module_id, type, title, instructions_md, language, starter_code, marks, status, opens_at, due_at, created_at)
  select m.new, v_new, mc.new, mm.new, a.type, a.title, a.instructions_md, a.language, a.starter_code, a.marks, a.status, a.opens_at + v_shift, a.due_at + v_shift, a.created_at + v_shift
  from public.assignments a join _m m on m.old = a.id join _m mc on mc.old = a.course_id left join _m mm on mm.old = a.module_id
  where a.sandbox_id = v_seed;

  insert into public.integrity_rules (assignment_id, sandbox_id, paste_blocked, workflow, viva_questions, viva_seconds_per_q, viva_weight, variants_on, time_limit_minutes, fullscreen_required)
  select m.new, v_new, r.paste_blocked, r.workflow, r.viva_questions, r.viva_seconds_per_q, r.viva_weight, r.variants_on, r.time_limit_minutes, r.fullscreen_required
  from public.integrity_rules r join _m m on m.old = r.assignment_id where r.sandbox_id = v_seed;

  insert into public.assignment_secrets (assignment_id, sandbox_id, reference_solution, hidden_tests, variant_spec)
  select m.new, v_new, s.reference_solution, s.hidden_tests, s.variant_spec
  from public.assignment_secrets s join _m m on m.old = s.assignment_id where s.sandbox_id = v_seed;

  insert into public.quiz_questions (id, sandbox_id, assignment_id, position, kind, prompt_md, options, answer_key, marks)
  select m.new, v_new, ma.new, q.position, q.kind, q.prompt_md, q.options, q.answer_key, q.marks
  from public.quiz_questions q join _m m on m.old = q.id join _m ma on ma.old = q.assignment_id where q.sandbox_id = v_seed;

  insert into public.variants (id, sandbox_id, assignment_id, student_id, params, rendered_instructions, created_at)
  select m.new, v_new, ma.new, ms.new, v.params, v.rendered_instructions, v.created_at + v_shift
  from public.variants v join _m m on m.old = v.id join _m ma on ma.old = v.assignment_id join _m ms on ms.old = v.student_id
  where v.sandbox_id = v_seed;

  insert into public.submissions (id, sandbox_id, assignment_id, student_id, variant_id, status, content, image_path, last_output,
    test_results, tests_passed, tests_total, viva_score, suggested_grade, final_grade, teacher_comment, teacher_decision,
    started_at, submitted_at, graded_at, event_source_id)
  select m.new, v_new, ma.new, ms.new, mv.new, s.status, s.content, s.image_path, s.last_output,
    s.test_results, s.tests_passed, s.tests_total, s.viva_score, s.suggested_grade, s.final_grade, s.teacher_comment, s.teacher_decision,
    s.started_at + v_shift, s.submitted_at + v_shift, s.graded_at + v_shift, coalesce(s.event_source_id, s.id)
  from public.submissions s join _m m on m.old = s.id join _m ma on ma.old = s.assignment_id join _m ms on ms.old = s.student_id
  left join _m mv on mv.old = s.variant_id
  where s.sandbox_id = v_seed;

  insert into public.ustaad_messages (id, sandbox_id, submission_id, role, body, hint, created_at)
  select m.new, v_new, msub.new, u.role, u.body, u.hint, u.created_at + v_shift
  from public.ustaad_messages u join _m m on m.old = u.id join _m msub on msub.old = u.submission_id where u.sandbox_id = v_seed;

  insert into public.viva_sessions (id, sandbox_id, submission_id, status, questions, current_index, rubric, understanding_score, summary, started_at, completed_at)
  select m.new, v_new, msub.new, v.status, v.questions, v.current_index, v.rubric, v.understanding_score, v.summary, v.started_at + v_shift, v.completed_at + v_shift
  from public.viva_sessions v join _m m on m.old = v.id join _m msub on msub.old = v.submission_id where v.sandbox_id = v_seed;

  insert into public.flags (id, sandbox_id, submission_id, rule, severity, message, evidence, teacher_status, created_at)
  select m.new, v_new, msub.new, f.rule, f.severity, f.message, f.evidence, f.teacher_status, f.created_at + v_shift
  from public.flags f join _m m on m.old = f.id join _m msub on msub.old = f.submission_id where f.sandbox_id = v_seed;

  select p.id, p.full_name into v_profile, v_name
  from public.profiles p
  where p.sandbox_id = v_new and p.email = 'demo-' || p_role || '@pothohar.demo';
  if v_profile is null then raise exception 'seed has no demo % identity', p_role; end if;

  return jsonb_build_object('sandbox_id', v_new, 'profile_id', v_profile, 'full_name', v_name, 'role', p_role,
    'expires_at', (select expires_at from public.sandboxes where id = v_new));
end $$;

revoke execute on function public.clear_sandbox(uuid) from public, anon, authenticated;
revoke execute on function public.seed_sandbox_id() from public, anon, authenticated;
revoke execute on function public.create_demo_sandbox(text, text, int) from public, anon, authenticated;
grant execute on function public.clear_sandbox(uuid) to service_role;
grant execute on function public.seed_sandbox_id() to service_role;
grant execute on function public.create_demo_sandbox(text, text, int) to service_role;
