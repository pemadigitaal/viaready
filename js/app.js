(function(){
  const KEY='viaready-prep-14';
  let state={self:null,video:false,quiz:{},route:false};
  try{const s=JSON.parse(localStorage.getItem(KEY)||'null'); if(s) state=Object.assign(state,s);}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}};

  const QUIZ=[
    {q:'Bij de ingang van de rotonde staan haaientanden. Wie heeft voorrang?',o:['Verkeer dat de rotonde op wil','Verkeer dat al op de rotonde rijdt','Verkeer van rechts'],a:1,e:'Haaientanden betekenen: verleen voorrang. Het verkeer óp de rotonde gaat voor.'},
    {q:'Je verlaat de rotonde. Moet je richting aangeven?',o:['Nee, dat hoeft niet','Ja, naar rechts','Alleen als er fietsers zijn'],a:1,e:'Bij het verlaten van een rotonde geef je altijd richting aan naar rechts.'},
    {q:'Je slaat rechtsaf. Op het fietspad naast je rijdt een fietser rechtdoor. Wat doe je?',o:['Ik ga eerst, ik zat er al','Ik laat de fietser voorgaan','Ik toeter en rij door'],a:1,e:'Rechtdoorgaand verkeer, ook op het fietspad, gaat voor afslaand verkeer.'},
    {q:'Op een rotonde met twee rijstroken wil je de derde afslag nemen. Hoe kies je je rijstrook?',o:['Altijd de rechter strook','De strook met de pijl voor jouw richting','Maakt niet uit'],a:1,e:'Kies vóór de rotonde de rijstrook waarvan de pijl jouw richting aangeeft.'}
  ];

  // routing
  const views=['vandaag','voorbereiding','voortgang','feedback'];
  function show(name){
    if(!views.includes(name)) name='vandaag';
    views.forEach(v=>document.getElementById('v-'+v).classList.toggle('active',v===name));
    document.querySelectorAll('.tab').forEach(t=>{if(t.dataset.go===name)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current');});
    window.scrollTo(0,0);
  }
  function route(){show((location.hash||'#vandaag').slice(1));}
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.go;}));
  window.addEventListener('hashchange',route);

  // steps accordion
  document.querySelectorAll('.step-head').forEach(h=>h.addEventListener('click',()=>{
    const s=h.parentElement, open=!s.classList.contains('open');
    document.querySelectorAll('.step').forEach(x=>{x.classList.remove('open');x.querySelector('.step-head').setAttribute('aria-expanded','false');});
    if(open){s.classList.add('open');h.setAttribute('aria-expanded','true');}
  }));

  // self assessment
  const scale=document.querySelectorAll('#scale button');
  const msgs=['Geen zorgen: Mark begint rustig op een enkelstrooks rotonde.','Mark begint met een rustige rotonde en bouwt op.','Mark wisselt rustige en drukke rotondes af.','Mark gaat snel door naar de dubbelstrooks rotonde.','Mark kiest drukke rotondes in de spits.'];
  scale.forEach((b,i)=>b.addEventListener('click',()=>{state.self=i+1;save();render();}));

  document.getElementById('videoDone').addEventListener('click',()=>{state.video=true;save();render();});
  document.getElementById('routeDone').addEventListener('click',()=>{state.route=true;save();render();});
  document.getElementById('resetPrep').addEventListener('click',()=>{state={self:null,video:false,quiz:{},route:false};save();render();});

  // quiz
  const quizEl=document.getElementById('quiz');
  QUIZ.forEach((item,qi)=>{
    const d=document.createElement('div');d.className='q';
    d.innerHTML='<p class="small"><b>'+(qi+1)+'. '+item.q+'</b></p>';
    item.o.forEach((opt,oi)=>{
      const b=document.createElement('button');b.className='opt';b.textContent=opt;b.id='q'+qi+'o'+oi;
      b.addEventListener('click',()=>{if(state.quiz[qi]!==undefined)return;state.quiz[qi]=oi;save();render();});
      d.appendChild(b);
    });
    const ex=document.createElement('p');ex.className='expl';ex.textContent=item.e;d.appendChild(ex);
    quizEl.appendChild(d);
  });

  function render(){
    scale.forEach((b,i)=>b.setAttribute('aria-pressed',state.self===i+1?'true':'false'));
    if(state.self) document.getElementById('selfMsg').textContent=msgs[state.self-1];
    quizEl.querySelectorAll('.q').forEach((d,qi)=>{
      const ans=state.quiz[qi];
      d.classList.toggle('answered',ans!==undefined);
      d.querySelectorAll('.opt').forEach((b,oi)=>{
        b.classList.remove('right','wrong');
        if(ans!==undefined){ if(oi===QUIZ[qi].a) b.classList.add('right'); else if(oi===ans) b.classList.add('wrong'); }
      });
    });
    const answered=Object.keys(state.quiz).length;
    const correct=Object.entries(state.quiz).filter(([q,o])=>QUIZ[q].a===o).length;
    document.getElementById('quizSub').textContent=answered===QUIZ.length?('Score: '+correct+' van '+QUIZ.length+' goed'):(answered+' van '+QUIZ.length+' beantwoord');
    const done={self:!!state.self,video:state.video,quiz:answered===QUIZ.length,route:state.route};
    document.querySelectorAll('.step').forEach(s=>{
      const k=s.dataset.step;s.classList.toggle('done',done[k]);
      s.querySelector('.check').textContent=done[k]?'✓':({self:1,video:2,quiz:3,route:4})[k];
    });
    const n=Object.values(done).filter(Boolean).length;
    document.getElementById('homeRing').style.setProperty('--p',n*25);
    document.getElementById('homeRingTxt').textContent=n+'/4';
    document.getElementById('readyCard').hidden=n<4;
  }

  // progress skills
  const SK=[['Voorbereiding & wegrijden',85],['Rijden op rechte en bochtige wegen',75],['Kruispunten & voorrang',60],['Rotondes',40],['Bijzondere verrichtingen',55],['Inhalen & invoegen',45],['Snelweg',25]];
  const lvl=p=>p>=70?['good','Goed']:p>=50?['warn','Op weg']:['bad','Oefenen'];
  document.getElementById('skills').innerHTML=SK.map(([n,p])=>{const[c,l]=lvl(p);
    return '<div class="skill"><div class="row between"><span class="small"><b>'+n+'</b></span><span class="pill '+c+' tabular">'+l+' · '+p+'%</span></div><div class="bar"><i style="width:'+p+'%"></i></div></div>';}).join('');

  // feedback ratings
  const RT=[['Kijkgedrag',2],['Snelheid aanpassen',4],['Voorrang verlenen',3],['Stuurbeheersing',4]];
  document.getElementById('rated').innerHTML=RT.map(([n,v])=>'<div class="row between"><span class="small">'+n+'</span><span class="dots" aria-label="'+v+' van 5">'+[1,2,3,4,5].map(i=>'<b class="'+(i<=v?'on':'')+'"></b>').join('')+'</span></div>').join('');

  render();route();
})();

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
