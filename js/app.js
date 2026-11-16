(function () {
  'use strict';

  // ---------- Setup ----------
  const CFG = window.VIAREADY_CONFIG || {};
  const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const sb = LIVE ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const one = (x) => (Array.isArray(x) ? x[0] || null : x || null);

  // ---------- Demo data (used when Supabase is not configured) ----------
  function demoData() {
    const day = (offset, h, m) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(h, m, 0, 0); return d.toISOString(); };
    return {
      email: null,
      profile: { full_name: 'Sanne', exam_month: 'februari' },
      next: {
        id: 'demo-14', number: 14, starts_at: day(1, 10, 30), ends_at: day(1, 11, 30), instructor: 'Mark',
        topic: { title: 'Rotondes & rechts afslaan', video_duration: '2:40',
          description: 'Inrijden, rijstrook kiezen, richting aangeven bij het verlaten en letten op fietsers.',
          self_question: 'Hoe zeker voel je je op een rotonde met twee rijstroken?' }
      },
      quiz: [
        { question: 'Bij de ingang van de rotonde staan haaientanden. Wie heeft voorrang?', options: ['Verkeer dat de rotonde op wil', 'Verkeer dat al op de rotonde rijdt', 'Verkeer van rechts'], correct: 1, explanation: 'Haaientanden betekenen: verleen voorrang. Het verkeer óp de rotonde gaat voor.' },
        { question: 'Je verlaat de rotonde. Moet je richting aangeven?', options: ['Nee, dat hoeft niet', 'Ja, naar rechts', 'Alleen als er fietsers zijn'], correct: 1, explanation: 'Bij het verlaten van een rotonde geef je altijd richting aan naar rechts.' },
        { question: 'Je slaat rechtsaf. Op het fietspad naast je rijdt een fietser rechtdoor. Wat doe je?', options: ['Ik ga eerst, ik zat er al', 'Ik laat de fietser voorgaan', 'Ik toeter en rij door'], correct: 1, explanation: 'Rechtdoorgaand verkeer, ook op het fietspad, gaat voor afslaand verkeer.' },
        { question: 'Op een rotonde met twee rijstroken wil je de derde afslag nemen. Hoe kies je je rijstrook?', options: ['Altijd de rechter strook', 'De strook met de pijl voor jouw richting', 'Maakt niet uit'], correct: 1, explanation: 'Kies vóór de rotonde de rijstrook waarvan de pijl jouw richting aangeeft.' }
      ],
      prev: {
        number: 13, starts_at: day(-4, 10, 30), instructor: 'Mark', topic: { title: 'Kruispunten & voorrang' },
        feedback: {
          ratings: [{ skill: 'Kijkgedrag', score: 2 }, { skill: 'Snelheid aanpassen', score: 4 }, { skill: 'Voorrang verlenen', score: 3 }, { skill: 'Stuurbeheersing', score: 4 }],
          note: 'Kijk eerder over je rechterschouder bij rechts afslaan. Fietsers zie je nu te laat. Snelheid bij het naderen van kruispunten is al veel beter.',
          work_on: [{ title: 'Schoudercontrole rechts.', text: "Bekijk de video 'Dode hoek bij rechts afslaan' (1:50)." }, { title: 'Voorrang van rechts op gelijkwaardige kruispunten.', text: 'Oefen 10 theorievragen.' }]
        }
      },
      skills: [['Voorbereiding & wegrijden', 85], ['Rijden op rechte en bochtige wegen', 75], ['Kruispunten & voorrang', 60], ['Rotondes', 40], ['Bijzondere verrichtingen', 55], ['Inhalen & invoegen', 45], ['Snelweg', 25]].map(([cbr_part, percent]) => ({ cbr_part, percent })),
      lessonsDone: 13,
      prep: null
    };
  }

  // ---------- Live data (Supabase) ----------
  async function liveData(user) {
    const uid = user.id;
    const nowIso = new Date().toISOString();
    const lessonCols = 'id, number, starts_at, ends_at, status, topic_id, topic:topics(*), instructor:profiles!lessons_instructor_id_fkey(full_name)';

    const [profileR, nextR, prevR, skillsR, doneR] = await Promise.all([
      sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      sb.from('lessons').select(lessonCols).eq('student_id', uid).eq('status', 'planned').gte('ends_at', nowIso).order('starts_at').limit(1),
      sb.from('lessons').select(lessonCols + ', feedback:lesson_feedback(*)').eq('student_id', uid).eq('status', 'done').order('starts_at', { ascending: false }).limit(1),
      sb.from('skill_progress').select('cbr_part, percent').eq('student_id', uid).order('sort'),
      sb.from('lessons').select('id', { count: 'exact', head: true }).eq('student_id', uid).eq('status', 'done')
    ]);
    const err = [profileR, nextR, prevR, skillsR, doneR].find((r) => r.error);
    if (err) throw err.error;

    const norm = (l) => l && ({ ...l, topic: one(l.topic), instructor: (one(l.instructor) || {}).full_name || null, feedback: one(l.feedback) });
    const next = norm(one(nextR.data));
    const prev = norm(one(prevR.data));

    let quiz = [], prep = null;
    if (next) {
      const [quizR, prepR] = await Promise.all([
        next.topic_id ? sb.from('quiz_questions').select('question, options, correct, explanation').eq('topic_id', next.topic_id).order('sort') : Promise.resolve({ data: [] }),
        sb.from('lesson_prep').select('*').eq('lesson_id', next.id).maybeSingle()
      ]);
      quiz = quizR.data || [];
      prep = prepR.data || null;
    }

    return {
      uid,
      email: user.email,
      profile: profileR.data || { full_name: user.email },
      next, prev, quiz, prep,
      skills: skillsR.data || [],
      lessonsDone: doneR.count || 0
    };
  }

  // ---------- Formatting ----------
  const fmtDay = (iso) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '');
  const fmtTime = (iso) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  function relDay(iso) {
    const a = new Date(); a.setHours(0, 0, 0, 0);
    const b = new Date(iso); b.setHours(0, 0, 0, 0);
    const n = Math.round((b - a) / 86400000);
    return n === 0 ? 'vandaag' : n === 1 ? 'morgen' : n === 2 ? 'overmorgen' : 'over ' + n + ' dagen';
  }
  const firstName = (name) => String(name || '').split(' ')[0];
  const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

  // ---------- State ----------
  let D = null;                 // loaded data
  let prep = emptyPrep();
  function emptyPrep() { return { self: null, video: false, quiz: {}, route: false }; }
  const localKey = () => 'viaready-prep-' + (D && D.next ? D.next.id : 'none');

  function loadPrep() {
    prep = emptyPrep();
    if (D.prep) {
      prep = { self: D.prep.self_rating, video: !!D.prep.video_watched, quiz: D.prep.quiz_answers || {}, route: !!D.prep.route_viewed };
      return;
    }
    try { const s = JSON.parse(localStorage.getItem(localKey()) || 'null'); if (s) prep = Object.assign(emptyPrep(), s); } catch (e) { /* storage unavailable */ }
  }

  let saveTimer = null;
  function savePrep() {
    try { localStorage.setItem(localKey(), JSON.stringify(prep)); } catch (e) { /* ignore */ }
    if (!LIVE || !D.next) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (!D.uid) return;
      const { error } = await sb.from('lesson_prep').upsert({
        lesson_id: D.next.id, student_id: D.uid, self_rating: prep.self, video_watched: prep.video,
        quiz_answers: prep.quiz, route_viewed: prep.route, updated_at: new Date().toISOString()
      });
      if (error) console.warn('Opslaan mislukt', error);
    }, 400);
  }

  // ---------- Routing ----------
  const VIEWS = ['login', 'vandaag', 'voorbereiding', 'voortgang', 'feedback', 'account'];
  let signedIn = !LIVE;
  function show(name) {
    if (!signedIn) name = 'login';
    else if (!VIEWS.includes(name) || name === 'login') name = 'vandaag';
    VIEWS.forEach((v) => $('v-' + v).classList.toggle('active', v === name));
    document.body.classList.toggle('login', name === 'login');
    document.querySelectorAll('.tab').forEach((t) => { if (t.dataset.go === name) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  }
  const route = () => show((location.hash || '#vandaag').slice(1));
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
  window.addEventListener('hashchange', route);
  $('avatar').addEventListener('click', () => { location.hash = 'account'; });

  // ---------- Steps accordion ----------
  document.querySelectorAll('.step-head').forEach((h) => h.addEventListener('click', () => {
    const s = h.parentElement, open = !s.classList.contains('open');
    document.querySelectorAll('.step').forEach((x) => { x.classList.remove('open'); x.querySelector('.step-head').setAttribute('aria-expanded', 'false'); });
    if (open) { s.classList.add('open'); h.setAttribute('aria-expanded', 'true'); }
  }));

  // ---------- Prep interactions ----------
  const scale = document.querySelectorAll('#scale button');
  const selfMsgs = ['Geen zorgen: je instructeur begint rustig en bouwt op.', 'Je instructeur begint rustig en bouwt op.', 'Je instructeur wisselt rustige en drukke situaties af.', 'Je instructeur gaat sneller door naar lastigere situaties.', 'Je instructeur kiest drukke situaties, bijvoorbeeld in de spits.'];
  scale.forEach((b, i) => b.addEventListener('click', () => { prep.self = i + 1; savePrep(); renderPrep(); }));
  $('videoDone').addEventListener('click', () => { prep.video = true; savePrep(); renderPrep(); });
  $('routeDone').addEventListener('click', () => { prep.route = true; savePrep(); renderPrep(); });
  $('resetPrep').addEventListener('click', () => { prep = emptyPrep(); savePrep(); renderPrep(); });

  function buildQuiz() {
    const el = $('quiz');
    el.innerHTML = '';
    (D.quiz || []).forEach((item, qi) => {
      const d = document.createElement('div');
      d.className = 'q';
      d.innerHTML = '<p class="small"><b>' + (qi + 1) + '. ' + esc(item.question) + '</b></p>';
      (item.options || []).forEach((opt, oi) => {
        const b = document.createElement('button');
        b.className = 'opt'; b.textContent = opt; b.id = 'q' + qi + 'o' + oi;
        b.addEventListener('click', () => { if (prep.quiz[qi] !== undefined) return; prep.quiz[qi] = oi; savePrep(); renderPrep(); });
        d.appendChild(b);
      });
      const ex = document.createElement('p'); ex.className = 'expl'; ex.textContent = item.explanation || ''; d.appendChild(ex);
      el.appendChild(d);
    });
  }

  function renderPrep() {
    const Q = D.quiz || [];
    scale.forEach((b, i) => b.setAttribute('aria-pressed', prep.self === i + 1 ? 'true' : 'false'));
    $('selfMsg').textContent = prep.self ? selfMsgs[prep.self - 1] : 'Je instructeur past de les aan op jouw antwoord.';
    $('quiz').querySelectorAll('.q').forEach((d, qi) => {
      const ans = prep.quiz[qi];
      d.classList.toggle('answered', ans !== undefined);
      d.querySelectorAll('.opt').forEach((b, oi) => {
        b.classList.remove('right', 'wrong');
        if (ans !== undefined) { if (oi === Q[qi].correct) b.classList.add('right'); else if (oi === ans) b.classList.add('wrong'); }
      });
    });
    const answered = Object.keys(prep.quiz).length;
    const correct = Object.entries(prep.quiz).filter(([q, o]) => Q[q] && Q[q].correct === o).length;
    $('quizSub').textContent = Q.length === 0 ? 'Geen vragen voor dit onderwerp'
      : answered >= Q.length ? 'Score: ' + correct + ' van ' + Q.length + ' goed' : answered + ' van ' + Q.length + ' beantwoord';
    const done = { self: !!prep.self, video: prep.video, quiz: Q.length === 0 || answered >= Q.length, route: prep.route };
    document.querySelectorAll('.step').forEach((s) => {
      const k = s.dataset.step;
      s.classList.toggle('done', !!done[k]);
      s.querySelector('.check').textContent = done[k] ? '✓' : { self: 1, video: 2, quiz: 3, route: 4 }[k];
    });
    const n = Object.values(done).filter(Boolean).length;
    $('homeRing').style.setProperty('--p', n * 25);
    $('homeRingTxt').textContent = n + '/4';
    $('readyCard').hidden = n < 4;
  }

  // ---------- Render everything ----------
  function render() {
    const name = D.profile.full_name || 'leerling';
    $('hello').textContent = 'Hoi ' + firstName(name) + ',';
    $('avatar').textContent = initials(name);
    $('accName').textContent = name;
    $('accEmail').textContent = D.email || 'Demo-modus · voorbeeldgegevens';
    $('logoutBtn').hidden = !LIVE;
    $('demoNote').hidden = LIVE;

    // next lesson
    const lessonCard = document.querySelector('.card.lesson');
    const n = D.next;
    lessonCard.hidden = !n;
    $('steps').hidden = !n;
    $('resetPrep').hidden = !n;
    let empty = $('prepEmpty');
    if (!empty) { empty = document.createElement('div'); empty.id = 'prepEmpty'; empty.className = 'card'; empty.innerHTML = '<h3>Nog geen les gepland</h3><p class="small muted">Zodra je instructeur je volgende les inplant, verschijnt hier de voorbereiding.</p>'; $('steps').after(empty); }
    empty.hidden = !!n;
    if (n) {
      const t = n.topic || {};
      const when = relDay(n.starts_at);
      $('homeH1').textContent = 'Je volgende les is ' + when;
      $('lessonTag').textContent = (n.number ? 'Les ' + n.number + ' · ' : '') + when;
      $('lessonTitle').textContent = t.title || 'Rijles';
      $('lessonWhen').textContent = fmtDay(n.starts_at) + ' · ' + fmtTime(n.starts_at) + '–' + fmtTime(n.ends_at) + (n.instructor ? ' · met ' + firstName(n.instructor) : '');
      $('prepTag').textContent = 'Lesvoorbereiding' + (n.number ? ' · les ' + n.number : '');
      $('prepTitle').textContent = t.title || 'Rijles';
      $('selfQ').textContent = t.self_question || 'Hoe zeker voel je je bij dit onderwerp?';
      $('videoSub').textContent = 'Video' + (t.video_duration ? ' · ' + t.video_duration : '');
      $('videoDur').textContent = t.video_duration || '';
      $('videoDesc').textContent = t.description || '';
    } else {
      $('homeH1').textContent = 'Er staat nog geen les gepland';
    }

    // readiness
    const sk = D.skills || [];
    const ready = sk.length ? Math.round(sk.reduce((a, s) => a + s.percent, 0) / sk.length) : 0;
    const lvl = (p) => (p >= 70 ? ['good', 'Goed'] : p >= 50 ? ['warn', 'Op weg'] : ['bad', 'Oefenen']);
    $('readyPill').textContent = ready + '%';
    $('readyPill').className = 'pill tabular ' + lvl(ready)[0];
    $('readyBar').style.width = ready + '%';
    const weakest = sk.slice().sort((a, b) => a.percent - b.percent).slice(0, 2).map((s) => s.cbr_part);
    $('readyText').textContent = weakest.length ? 'Hier valt nog het meeste te winnen: ' + weakest.join(' en ') + '.' : 'Je instructeur vult je voortgang in na de lessen.';
    $('progH1').textContent = ready + '% klaar voor je praktijkexamen';
    $('progSub').textContent = D.lessonsDone + (D.lessonsDone === 1 ? ' les' : ' lessen') + ' gehad' + (D.profile.exam_month ? ' · examen gepland: ' + D.profile.exam_month : '');
    $('skills').innerHTML = sk.length ? sk.map((s) => {
      const [c, l] = lvl(s.percent);
      return '<div class="skill"><div class="row between"><span class="small"><b>' + esc(s.cbr_part) + '</b></span><span class="pill ' + c + ' tabular">' + l + ' · ' + s.percent + '%</span></div><div class="bar"><i style="width:' + s.percent + '%"></i></div></div>';
    }).join('') : '<p class="small muted">Nog geen voortgang. Je instructeur vult dit in na je lessen.</p>';

    // feedback of previous lesson
    const p = D.prev, f = p && p.feedback;
    const fbCard = $('lastNote').closest('.card');
    fbCard.hidden = !f;
    if (p && f) {
      const meta = (p.instructor ? firstName(p.instructor) + ' · ' : '') + (p.number ? 'les ' + p.number + ' · ' : '') + fmtDay(p.starts_at);
      $('lastNote').textContent = '“' + (f.note || 'Geen opmerking') + '”';
      $('lastMeta').textContent = meta;
      $('fbTag').textContent = 'Na de les' + (p.number ? ' · les ' + p.number : '');
      $('fbTitle').textContent = (p.topic && p.topic.title) || 'Rijles';
      $('fbMeta').textContent = fmtDay(p.starts_at) + (p.instructor ? ' · ' + firstName(p.instructor) : '');
      $('fbNote').textContent = '“' + (f.note || 'Geen opmerking') + '”';
      $('rated').innerHTML = (f.ratings || []).map((r) => '<div class="row between"><span class="small">' + esc(r.skill) + '</span><span class="dots" aria-label="' + r.score + ' van 5">' + [1, 2, 3, 4, 5].map((i) => '<b class="' + (i <= r.score ? 'on' : '') + '"></b>').join('') + '</span></div>').join('');
      $('fbWork').innerHTML = (f.work_on || []).map((w, i) => '<div class="spot"><span class="num">' + (i + 1) + '</span><p class="small"><b>' + esc(w.title) + '</b> ' + esc(w.text) + '</p></div>').join('');
    } else {
      $('fbTag').textContent = 'Na de les';
      $('fbTitle').textContent = 'Nog geen feedback';
      $('fbMeta').textContent = 'Na je eerste les zet je instructeur hier de beoordeling.';
      $('fbNote').textContent = '';
      $('rated').innerHTML = '<p class="small muted">Nog geen beoordeling.</p>';
      $('fbWork').innerHTML = '';
    }

    buildQuiz();
    loadPrep();
    renderPrep();
  }

  // ---------- Login (e-mail code) ----------
  let loginEmail = '';
  const setMsg = (t, cls) => { $('loginMsg').textContent = t; $('loginMsg').className = 'small ' + (cls || ''); };

  $('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('emailInput').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg('Vul een geldig e-mailadres in.', 'msg-bad'); return; }
    $('emailBtn').disabled = true; setMsg('Code wordt verstuurd…');
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    $('emailBtn').disabled = false;
    if (error) { setMsg('Versturen mislukt: ' + error.message, 'msg-bad'); return; }
    loginEmail = email;
    $('emailForm').hidden = true; $('codeForm').hidden = false;
    setMsg('We hebben een code gestuurd naar ' + email + '. Kijk ook in je spam.', 'msg-good');
    $('codeInput').focus();
  });

  $('codeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = $('codeInput').value.replace(/\D/g, '');
    if (token.length !== 6) { setMsg('De code heeft 6 cijfers.', 'msg-bad'); return; }
    $('codeBtn').disabled = true; setMsg('Bezig met inloggen…');
    const { error } = await sb.auth.verifyOtp({ email: loginEmail, token, type: 'email' });
    $('codeBtn').disabled = false;
    if (error) { setMsg('Code klopt niet of is verlopen. Probeer het opnieuw.', 'msg-bad'); return; }
    setMsg('');
  });

  $('codeBack').addEventListener('click', () => { $('codeForm').hidden = true; $('emailForm').hidden = false; setMsg(''); });
  $('logoutBtn').addEventListener('click', async () => { if (sb) await sb.auth.signOut(); });

  // ---------- Start ----------
  async function loadFor(session) {
    if (!LIVE) { D = demoData(); signedIn = true; render(); route(); return; }
    if (!session) { signedIn = false; D = null; route(); return; }
    try {
      D = await liveData(session.user);
      signedIn = true;
      render();
      if (location.hash === '#login' || location.hash === '#account') location.hash = 'vandaag';
      route();
    } catch (err) {
      console.error(err);
      signedIn = false; route();
      setMsg('Gegevens laden mislukt: ' + (err.message || err), 'msg-bad');
    }
  }

  if (LIVE) {
    let lastUser = undefined;
    sb.auth.onAuthStateChange((_event, session) => {
      const uid = session ? session.user.id : null;
      if (uid === lastUser) return;
      lastUser = uid;
      setTimeout(() => loadFor(session), 0); // never await Supabase calls inside this callback
    });
  } else {
    loadFor(null);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
