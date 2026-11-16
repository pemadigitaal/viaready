-- ViaReady demo data for ONE test student.
-- 1. Log in once in the app with your e-mail (so your account exists).
-- 2. Replace the e-mail below with yours.
-- 3. Run this in Supabase: SQL Editor -> New query -> paste -> Run.

do $$
declare
  v_email   text := 'jouw@email.nl';      -- <-- change this
  v_student uuid;
  v_school  uuid;
  v_prev    uuid;
  v_next    uuid;
begin
  select id into v_student from auth.users where email = v_email;
  if v_student is null then
    raise exception 'Geen account gevonden voor %. Log eerst één keer in via de app.', v_email;
  end if;

  insert into schools (name, city) values ('Demo Rijschool', 'Maastricht') returning id into v_school;

  update profiles set school_id = v_school, role = 'student', exam_month = 'februari'
  where id = v_student;

  -- previous lesson (done) + feedback
  insert into lessons (school_id, student_id, number, starts_at, ends_at, topic_id, status)
  values (v_school, v_student, 13, now() - interval '4 days', now() - interval '4 days' + interval '1 hour', 'kruispunten', 'done')
  returning id into v_prev;

  insert into lesson_feedback (lesson_id, ratings, note, work_on) values (
    v_prev,
    '[{"skill":"Kijkgedrag","score":2},{"skill":"Snelheid aanpassen","score":4},{"skill":"Voorrang verlenen","score":3},{"skill":"Stuurbeheersing","score":4}]',
    'Kijk eerder over je rechterschouder bij rechts afslaan. Fietsers zie je nu te laat. Snelheid bij het naderen van kruispunten is al veel beter.',
    '[{"title":"Schoudercontrole rechts.","text":"Bekijk de video ''Dode hoek bij rechts afslaan'' (1:50)."},{"title":"Voorrang van rechts op gelijkwaardige kruispunten.","text":"Oefen 10 theorievragen."}]'
  );

  -- next lesson (tomorrow 10:30)
  insert into lessons (school_id, student_id, number, starts_at, ends_at, topic_id)
  values (v_school, v_student, 14,
          date_trunc('day', now()) + interval '1 day 10 hours 30 minutes',
          date_trunc('day', now()) + interval '1 day 11 hours 30 minutes',
          'rotondes')
  returning id into v_next;

  -- progress per CBR part
  insert into skill_progress (student_id, cbr_part, percent, sort) values
    (v_student, 'Voorbereiding & wegrijden', 85, 1),
    (v_student, 'Rijden op rechte en bochtige wegen', 75, 2),
    (v_student, 'Kruispunten & voorrang', 60, 3),
    (v_student, 'Rotondes', 40, 4),
    (v_student, 'Bijzondere verrichtingen', 55, 5),
    (v_student, 'Inhalen & invoegen', 45, 6),
    (v_student, 'Snelweg', 25, 7)
  on conflict (student_id, cbr_part) do update set percent = excluded.percent, sort = excluded.sort;
end $$;
