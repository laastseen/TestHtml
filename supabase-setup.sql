-- Выполнить целиком в SQL Editor проекта Supabase. Повторный запуск безопасен для результатов.
begin;
create table if not exists public.teachers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.attempts (
  id uuid primary key,
  student_name text not null check (char_length(btrim(student_name)) between 1 and 80),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  question_order jsonb not null check (jsonb_typeof(question_order) = 'array'),
  score integer not null check (score between 0 and 28),
  answered_count integer not null check (answered_count between 0 and 28),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  received_at timestamptz not null default now(),
  check (finished_at >= started_at)
);
create index if not exists attempts_received_idx on public.attempts(received_at desc, id desc);
alter table public.teachers enable row level security;
alter table public.attempts enable row level security;
revoke all on public.teachers, public.attempts from public, anon, authenticated;
grant select on public.teachers, public.attempts to authenticated;
drop policy if exists teachers_read_self on public.teachers;
create policy teachers_read_self on public.teachers for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists teachers_read_attempts on public.attempts;
create policy teachers_read_attempts on public.attempts for select to authenticated
  using (exists(select 1 from public.teachers where user_id = (select auth.uid())));

-- Единственная публичная операция: приём новой попытки. Читать и менять записи нельзя.
create or replace function public.submit_attempt(
  p_id uuid, p_name text, p_answers jsonb, p_order jsonb,
  p_started_at timestamptz, p_finished_at timestamptz
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_key text; v_value jsonb; v_score integer := 0; v_count integer := 0;
  v_correct integer[] := array[1,2,1,1,2,0,2,1,2,2,3,1,2,2,2,2,1,1,0,2,2,1,2,1,2,2,2,1];
  v_existing public.attempts%rowtype;
begin
  if p_id is null or p_name is null or char_length(btrim(p_name)) not between 1 and 80
     or p_answers is null or jsonb_typeof(p_answers) <> 'object'
     or p_order is null or jsonb_typeof(p_order) <> 'array'
     or p_started_at is null or p_finished_at is null
     or not isfinite(p_started_at) or not isfinite(p_finished_at)
     or p_finished_at < p_started_at then
    raise exception 'Invalid attempt' using errcode = '22023';
  end if;
  if jsonb_array_length(p_order) <> 28 or
     (select count(distinct value) from jsonb_array_elements(p_order)) <> 28 or
     exists(select 1 from jsonb_array_elements(p_order) as item(value)
       where jsonb_typeof(value) <> 'number' or value::text !~ '^([1-9]|1[0-9]|2[0-8])$') then
    raise exception 'Invalid question order' using errcode = '22023';
  end if;
  for v_key,v_value in select key,value from jsonb_each(p_answers) loop
    if v_key !~ '^([1-9]|1[0-9]|2[0-8])$' or jsonb_typeof(v_value) <> 'number' or v_value::text !~ '^[0-3]$' then
      raise exception 'Invalid answer' using errcode = '22023';
    end if;
    v_count := v_count + 1;
    if v_correct[v_key::integer] = v_value::text::integer then v_score := v_score + 1; end if;
  end loop;
  insert into public.attempts(id,student_name,answers,question_order,score,answered_count,started_at,finished_at)
    values(p_id,btrim(p_name),p_answers,p_order,v_score,v_count,p_started_at,p_finished_at)
    on conflict(id) do nothing;
  -- Повторная отправка подтверждается, но никогда не перезаписывает попытку.
  select * into v_existing from public.attempts where id=p_id;
  if v_existing.student_name <> btrim(p_name) or v_existing.answers <> p_answers
     or v_existing.question_order <> p_order or v_existing.started_at <> p_started_at
     or v_existing.finished_at <> p_finished_at then
    raise exception 'Attempt ID already used' using errcode = '22023';
  end if;
  return p_id;
end;
$$;
revoke all on function public.submit_attempt(uuid,text,jsonb,jsonb,timestamptz,timestamptz) from public;
grant execute on function public.submit_attempt(uuid,text,jsonb,jsonb,timestamptz,timestamptz) to anon, authenticated;
commit;
