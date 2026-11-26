-- Handwritten work (FR-11, FR-12): photographed pages live in a PRIVATE storage bucket that only the
-- server (service role) can read or write; teachers see a page through the API, never a public URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('handwritten', 'handwritten', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;

-- A flag for a page whose one-time code word wasn't found.
alter table public.flags drop constraint flags_rule_check;
alter table public.flags add constraint flags_rule_check check (rule in (
  'large_insertion', 'typing_faster_than_baseline', 'focus_loss_then_burst',
  'correct_without_runs', 'perfect_tests_low_viva', 'left_quiz_screen', 'code_word_missing'));
