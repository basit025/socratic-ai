-- Timed quizzes (FR-13, FR-16): a flag for leaving the quiz screen (fullscreen exits, tab switches).
alter table public.flags drop constraint flags_rule_check;
alter table public.flags add constraint flags_rule_check check (rule in (
  'large_insertion', 'typing_faster_than_baseline', 'focus_loss_then_burst',
  'correct_without_runs', 'perfect_tests_low_viva', 'left_quiz_screen'));
