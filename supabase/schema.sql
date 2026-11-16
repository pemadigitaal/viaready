-- ViaReady database schema (Supabase / Postgres)
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run

create extension if not exists pgcrypto;

-- ---------- Types ----------
do $$ begin
  create type user_role as enum ('student', 'instructor', 'admin');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  school_id uuid references schools on delete set null,
  role user_role not null default 'student',
  full_name text,
  exam_month text,                       -- e.g. 'februari'
  created_at timestamptz not null default now()
);

create table if not exists topics (
  id text primary key,                   -- e.g. 'rotondes'
  title text not null,                   -- 'Rotondes & rechts afslaan'
  cbr_part text not null,                -- matches skill_progress.cbr_part
  video_url text,
  video_duration text,                   -- '2:40'
  description text,
  self_question text                     -- question for zelfbeoordeling
);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null references topics on delete cascade,
  question text not null,
  options jsonb not null,                -- ["optie A","optie B","optie C"]
  correct int not null,                  -- index in options
  explanation text,
  sort int not null default 0
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools on delete cascade,
  student_id uuid not null references profiles on delete cascade,
  instructor_id uuid references profiles on delete set null,
  number int,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  topic_id text references topics,
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled'))
);
create index if not exists lessons_student_idx on lessons (student_id, starts_at);

create table if not exists lesson_prep (
  lesson_id uuid primary key references lessons on delete cascade,
  student_id uuid not null references profiles on delete cascade,
  self_rating int check (self_rating between 1 and 5),
  video_watched boolean not null default false,
  quiz_answers jsonb not null default '{}'::jsonb,   -- {"0":1,"1":1}
  route_viewed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists lesson_feedback (
  lesson_id uuid primary key references lessons on delete cascade,
  instructor_id uuid references profiles on delete set null,
  ratings jsonb not null default '[]'::jsonb,        -- [{"skill":"Kijkgedrag","score":2}]
  note text,
  work_on jsonb not null default '[]'::jsonb,        -- [{"title":"...","text":"..."}]
  created_at timestamptz not null default now()
);

create table if not exists skill_progress (
  student_id uuid not null references profiles on delete cascade,
  cbr_part text not null,
  percent int not null check (percent between 0 and 100),
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, cbr_part)
);

create table if not exists hard_spots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools on delete cascade,
  title text not null,
  description text,
  lat double precision,
  lng double precision,
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists lesson_spots (
  lesson_id uuid references lessons on delete cascade,
  spot_id uuid references hard_spots on delete cascade,
  sort int not null default 0,
  primary key (lesson_id, spot_id)
);

-- ---------- New user -> profile ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Helpers for policies ----------
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function my_school() returns uuid
language sql stable security definer set search_path = public as $$
  select school_id from profiles where id = auth.uid()
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('instructor', 'admin'), false)
$$;

-- ---------- Row Level Security ----------
alter table schools enable row level security;
alter table profiles enable row level security;
alter table topics enable row level security;
alter table quiz_questions enable row level security;
alter table lessons enable row level security;
alter table lesson_prep enable row level security;
alter table lesson_feedback enable row level security;
alter table skill_progress enable row level security;
alter table hard_spots enable row level security;
alter table lesson_spots enable row level security;

-- schools
drop policy if exists schools_read on schools;
create policy schools_read on schools for select to authenticated using (id = my_school());

-- profiles
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated
  using (id = auth.uid()
         or (is_staff() and school_id = my_school())
         or (school_id = my_school() and role in ('instructor', 'admin')));   -- students see their instructors' names
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = my_role() and school_id is not distinct from my_school());

-- topics + quiz: readable for every signed-in user
drop policy if exists topics_read on topics;
create policy topics_read on topics for select to authenticated using (true);
drop policy if exists quiz_read on quiz_questions;
create policy quiz_read on quiz_questions for select to authenticated using (true);

-- lessons
drop policy if exists lessons_read on lessons;
create policy lessons_read on lessons for select to authenticated
  using (student_id = auth.uid() or (is_staff() and school_id = my_school()));
drop policy if exists lessons_staff_write on lessons;
create policy lessons_staff_write on lessons for all to authenticated
  using (is_staff() and school_id = my_school())
  with check (is_staff() and school_id = my_school());

-- lesson_prep: student writes own, staff of the school reads
drop policy if exists prep_read on lesson_prep;
create policy prep_read on lesson_prep for select to authenticated
  using (student_id = auth.uid()
         or (is_staff() and exists (select 1 from lessons l where l.id = lesson_id and l.school_id = my_school())));
drop policy if exists prep_insert on lesson_prep;
create policy prep_insert on lesson_prep for insert to authenticated
  with check (student_id = auth.uid()
              and exists (select 1 from lessons l where l.id = lesson_id and l.student_id = auth.uid()));
drop policy if exists prep_update on lesson_prep;
create policy prep_update on lesson_prep for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- lesson_feedback: student reads own, staff writes
drop policy if exists feedback_read on lesson_feedback;
create policy feedback_read on lesson_feedback for select to authenticated
  using (exists (select 1 from lessons l where l.id = lesson_id
                 and (l.student_id = auth.uid() or (is_staff() and l.school_id = my_school()))));
drop policy if exists feedback_staff_write on lesson_feedback;
create policy feedback_staff_write on lesson_feedback for all to authenticated
  using (is_staff() and exists (select 1 from lessons l where l.id = lesson_id and l.school_id = my_school()))
  with check (is_staff() and exists (select 1 from lessons l where l.id = lesson_id and l.school_id = my_school()));

-- skill_progress
drop policy if exists skills_read on skill_progress;
create policy skills_read on skill_progress for select to authenticated
  using (student_id = auth.uid()
         or (is_staff() and exists (select 1 from profiles p where p.id = student_id and p.school_id = my_school())));
drop policy if exists skills_staff_write on skill_progress;
create policy skills_staff_write on skill_progress for all to authenticated
  using (is_staff() and exists (select 1 from profiles p where p.id = student_id and p.school_id = my_school()))
  with check (is_staff() and exists (select 1 from profiles p where p.id = student_id and p.school_id = my_school()));

-- hard_spots
drop policy if exists spots_read on hard_spots;
create policy spots_read on hard_spots for select to authenticated using (school_id = my_school());
drop policy if exists spots_staff_write on hard_spots;
create policy spots_staff_write on hard_spots for all to authenticated
  using (is_staff() and school_id = my_school()) with check (is_staff() and school_id = my_school());

-- lesson_spots
drop policy if exists lesson_spots_read on lesson_spots;
create policy lesson_spots_read on lesson_spots for select to authenticated
  using (exists (select 1 from lessons l where l.id = lesson_id
                 and (l.student_id = auth.uid() or (is_staff() and l.school_id = my_school()))));
drop policy if exists lesson_spots_staff_write on lesson_spots;
create policy lesson_spots_staff_write on lesson_spots for all to authenticated
  using (is_staff() and exists (select 1 from lessons l where l.id = lesson_id and l.school_id = my_school()))
  with check (is_staff() and exists (select 1 from lessons l where l.id = lesson_id and l.school_id = my_school()));

-- ---------- Content: topics + quiz ----------
insert into topics (id, title, cbr_part, video_duration, description, self_question) values
  ('rotondes', 'Rotondes & rechts afslaan', 'Rotondes', '2:40',
   'Inrijden, rijstrook kiezen, richting aangeven bij het verlaten en letten op fietsers.',
   'Hoe zeker voel je je op een rotonde met twee rijstroken?'),
  ('kruispunten', 'Kruispunten & voorrang', 'Kruispunten & voorrang', '3:10',
   'Gelijkwaardige kruispunten, voorrangswegen en verkeerslichten.',
   'Hoe zeker voel je je op een gelijkwaardig kruispunt?'),
  ('snelweg', 'Snelweg: invoegen & uitvoegen', 'Snelweg', '3:30',
   'Snelheid maken op de invoegstrook, spiegels, dode hoek en uitvoegen.',
   'Hoe zeker voel je je bij het invoegen op de snelweg?')
on conflict (id) do update set title = excluded.title, cbr_part = excluded.cbr_part,
  video_duration = excluded.video_duration, description = excluded.description, self_question = excluded.self_question;

delete from quiz_questions where topic_id = 'rotondes';
insert into quiz_questions (topic_id, question, options, correct, explanation, sort) values
  ('rotondes', 'Bij de ingang van de rotonde staan haaientanden. Wie heeft voorrang?',
   '["Verkeer dat de rotonde op wil","Verkeer dat al op de rotonde rijdt","Verkeer van rechts"]', 1,
   'Haaientanden betekenen: verleen voorrang. Het verkeer óp de rotonde gaat voor.', 1),
  ('rotondes', 'Je verlaat de rotonde. Moet je richting aangeven?',
   '["Nee, dat hoeft niet","Ja, naar rechts","Alleen als er fietsers zijn"]', 1,
   'Bij het verlaten van een rotonde geef je altijd richting aan naar rechts.', 2),
  ('rotondes', 'Je slaat rechtsaf. Op het fietspad naast je rijdt een fietser rechtdoor. Wat doe je?',
   '["Ik ga eerst, ik zat er al","Ik laat de fietser voorgaan","Ik toeter en rij door"]', 1,
   'Rechtdoorgaand verkeer, ook op het fietspad, gaat voor afslaand verkeer.', 3),
  ('rotondes', 'Op een rotonde met twee rijstroken wil je de derde afslag nemen. Hoe kies je je rijstrook?',
   '["Altijd de rechter strook","De strook met de pijl voor jouw richting","Maakt niet uit"]', 1,
   'Kies vóór de rotonde de rijstrook waarvan de pijl jouw richting aangeeft.', 4);
