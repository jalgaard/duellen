(() => {
  const app = document.getElementById('app');
  const familyQuiz = window.DUELLEN_QUIZ;
  const childQuiz = {
    title: 'Duellen', label: 'Barn', categories: [
      { name: 'SVERIGE', questions: [
        {value:100,question:'Vad heter Sveriges högsta berg?',answer:'Kebnekaise'},
        {value:200,question:'Vilken stad är Sveriges näst största sett till folkmängd?',answer:'Göteborg'},
        {value:300,question:'Vilket landskap ligger Örebro i?',answer:'Närke'},
        {value:400,question:'Vad heter sundet mellan Sverige och Danmark?',answer:'Öresund'},
        {value:500,question:'Vilken svensk vetenskapsman har gett namn åt temperaturskalan Celsius?',answer:'Anders Celsius'}
      ]},
      { name: 'VÄRLDEN', questions: [
        {value:100,question:'Vilken är världens största världsdel till ytan?',answer:'Asien'},
        {value:200,question:'Vad heter huvudstaden i Kanada?',answer:'Ottawa'},
        {value:300,question:'I vilket land ligger pyramiderna i Giza?',answer:'Egypten'},
        {value:400,question:'Vilken flod rinner genom London?',answer:'Themsen'},
        {value:500,question:'Vilken bergskedja brukar räknas som en del av gränsen mellan Europa och Asien?',answer:'Uralbergen'}
      ]},
      { name: 'NATUR & VETENSKAP', questions: [
        {value:100,question:'Vilken planet ligger närmast solen?',answer:'Merkurius'},
        {value:200,question:'Vilken gas behöver människor andas in för att överleva?',answer:'Syre'},
        {value:300,question:'Vad kallas processen när växter använder solljus för att skapa energi?',answer:'Fotosyntes'},
        {value:400,question:'Hur många ben har en vuxen människa vanligtvis i kroppen?',answer:'206'},
        {value:500,question:'Vilken enhet används för att mäta elektrisk ström?',answer:'Ampere'}
      ]},
      { name: 'SPORT & SPEL', questions: [
        {value:100,question:'Hur många spelare från varje lag är på planen samtidigt i basket?',answer:'5'},
        {value:200,question:'Vilken schackpjäs rör sig i ett L-format mönster?',answer:'Springaren'},
        {value:300,question:'Hur lång är en olympisk simbassäng?',answer:'50 meter'},
        {value:400,question:'Hur många poäng är en touchdown värd i amerikansk fotboll före extrapoäng?',answer:'6 poäng'},
        {value:500,question:'Vilket land vann det allra första fotbolls-VM för herrar år 1930?',answer:'Uruguay'}
      ]},
      { name: 'FILM & KULTUR', questions: [
        {value:100,question:'Vad heter Marios bror i Nintendo-spelen?',answer:'Luigi'},
        {value:200,question:'Vad heter snögubben i Frost-filmerna?',answer:'Olaf'},
        {value:300,question:'Vilken superhjälte har det vanliga namnet Peter Parker?',answer:'Spider-Man'},
        {value:400,question:'Vad heter det fiktiva landet som Black Panther kommer från?',answer:'Wakanda'},
        {value:500,question:'Vem skrev bokserien om Percy Jackson?',answer:'Rick Riordan'}
      ]}
    ]
  };
  const quizzes = { family: familyQuiz, child: childQuiz };
  const params = new URLSearchParams(location.search);
  let role = params.get('role') || null;
  let peer = null, tvConnection = null, hostConnections = [], connectMessage = '';

  const id = () => Math.random().toString(36).slice(2,9);
  const code = () => String(Math.floor(1000 + Math.random() * 9000));
  const clone = x => JSON.parse(JSON.stringify(x));
  const esc = s => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money = n => `${Number(n).toLocaleString('sv-SE')} kr`;

  let state = {
    roomCode:'', phase:'setup', gameMode:'family',
    players:[{id:id(),name:'Spelare 1',score:0},{id:id(),name:'Spelare 2',score:0}],
    used:{}, active:null, showAnswer:false, winner:null
  };

  const quiz = () => quizzes[state.gameMode] || familyQuiz;
  const modeLabel = () => state.gameMode === 'child' ? 'Barn' : 'Familj';
  const broadcast = () => {
    if (role !== 'host') return;
    hostConnections = hostConnections.filter(c => c && c.open);
    hostConnections.forEach(c => { try { c.send({type:'state',state:clone(state)}); } catch(_){} });
  };
  const setState = (fn, send=true) => { fn(state); render(); if(send) broadcast(); };
  const destroyPeer = () => {
    try { tvConnection?.close(); } catch(_){}
    try { peer?.destroy(); } catch(_){}
    peer=null; tvConnection=null; hostConnections=[];
  };

  function startHostNetwork(room) {
    destroyPeer();
    if (typeof window.Peer !== 'function') { connectMessage='Nätverksbiblioteket kunde inte laddas.'; return render(); }
    connectMessage='Startar spelrum…'; render();
    peer = new Peer(`duellen-${room}`);
    peer.on('open',()=>{ connectMessage='Spelrummet är öppet. TV:n kan ansluta nu.'; render(); });
    peer.on('connection',conn=>{
      hostConnections.push(conn);
      conn.on('open',()=>{ connectMessage=`TV ansluten (${hostConnections.filter(c=>c.open).length})`; conn.send({type:'state',state:clone(state)}); render(); });
      conn.on('data',d=>{ if(d?.type==='requestState') conn.send({type:'state',state:clone(state)}); });
      conn.on('close',()=>{ connectMessage='TV frånkopplad. Den kan ansluta igen med samma kod.'; render(); });
    });
    peer.on('error',err=>{
      if(err?.type==='unavailable-id'){ state.roomCode=code(); startHostNetwork(state.roomCode); }
      else { connectMessage='Kunde inte öppna spelrummet. Ladda om sidan och försök igen.'; render(); }
    });
  }

  function connectTv(room) {
    destroyPeer();
    if (typeof window.Peer !== 'function') { connectMessage='Nätverksbiblioteket kunde inte laddas.'; return render(); }
    connectMessage='Ansluter till programledaren…'; render();
    peer = new Peer();
    peer.on('open',()=>{
      tvConnection = peer.connect(`duellen-${room}`,{reliable:true});
      tvConnection.on('open',()=>{ connectMessage='Ansluten till Duellen.'; tvConnection.send({type:'requestState'}); render(); });
      tvConnection.on('data',d=>{ if(d?.type==='state' && d.state){ state=d.state; connectMessage='Ansluten'; render(); } });
      tvConnection.on('close',()=>{ connectMessage='Kontakten med programledaren bröts. Försök ansluta igen.'; render(); });
      tvConnection.on('error',()=>{ connectMessage='Kunde inte ansluta. Kontrollera koden.'; render(); });
    });
    peer.on('error',()=>{ connectMessage='Kunde inte ansluta. Kontrollera koden och att programledaren har öppnat spelet.'; render(); });
  }

  function boardHtml(interactive=false,host=false){
    const qz=quiz();
    const cats=qz.categories.map(c=>`<div class="tile category">${esc(c.name)}</div>`).join('');
    let rows='';
    for(let qi=0;qi<5;qi++) rows += qz.categories.map((c,ci)=>{
      const q=c.questions[qi], key=`${ci}-${qi}`, used=!!state.used[key];
      return interactive
        ? `<button class="tile value selectable ${used?'used':''}" data-q="${key}" ${used?'disabled':''}>${used?'—':q.value}</button>`
        : `<div class="tile value ${used?'used':''}">${used?'—':q.value}</div>`;
    }).join('');
    return `<div class="board-wrap ${host?'host-board':''}"><div class="board-frame"><div class="board">${cats}${rows}</div></div></div>`;
  }
  const scorebar = () => `<div class="scorebar">${state.players.map(p=>`<div class="score-card"><div class="score-name">${esc(p.name)}</div><div class="score-value">${money(p.score)}</div></div>`).join('')}</div>`;
  function activeData(){
    if(!state.active) return null;
    const cat=quiz().categories[state.active.ci], q=cat?.questions[state.active.qi];
    return q?{cat,q}:null;
  }

  function renderHome(){
    app.innerHTML=`<section class="screen"><div class="brand">Duellen</div><div class="subtitle">Familjens egen frågesport</div><div class="panel"><h2>Välj skärm</h2><div class="role-grid"><button class="role-card" id="host"><strong>📱 Programledare</strong><span>Starta spelet, se facit, välj frågor och dela ut poäng.</span></button><button class="role-card" id="tv"><strong>📺 TV / spelplan</strong><span>Anslut med fyrsiffrig kod och visa spelplan, frågor och poäng.</span></button></div></div></section>`;
    document.getElementById('host').onclick=()=>{ role='host'; state.roomCode=code(); state.phase='setup'; history.replaceState({},'','?role=host'); startHostNetwork(state.roomCode); };
    document.getElementById('tv').onclick=()=>{ role='tv'; history.replaceState({},'','?role=tv'); render(); };
  }

  function renderTvConnect(){
    app.innerHTML=`<section class="screen"><div class="brand">Duellen</div><div class="panel"><h2>Anslut TV:n</h2><form id="tv-form"><div class="field"><label for="room">Spelkod</label><input id="room" inputmode="numeric" maxlength="4" placeholder="1234" required></div><div class="actions"><button class="btn gold" type="submit">Anslut till spelet</button><button class="btn ghost" id="back" type="button">Tillbaka</button></div>${connectMessage?`<div class="notice">${esc(connectMessage)}</div>`:''}</form></div></section>`;
    document.getElementById('tv-form').onsubmit=e=>{ e.preventDefault(); const r=document.getElementById('room').value.trim(); if(!/^\d{4}$/.test(r)){connectMessage='Koden ska vara fyra siffror.';return render();} state.roomCode=r; state.phase='connecting'; connectTv(r); };
    document.getElementById('back').onclick=()=>{ role=null; connectMessage=''; history.replaceState({},'',location.pathname); render(); };
  }

  function renderHostSetup(){
    const familySelected=state.gameMode==='family', childSelected=state.gameMode==='child';
    app.innerHTML=`<section class="screen"><div class="brand small">Duellen</div><div class="panel"><h2>Skapa spel</h2><div class="room-code">${esc(state.roomCode)}</div><div class="status-line">${esc(connectMessage||'Öppnar spelrum…')}</div><div class="separator"></div><h3>Välj variant</h3><div class="role-grid"><button class="role-card" data-mode="family" style="${familySelected?'outline:4px solid #fff36b;':''}"><strong>${familySelected?'✓ ':''}👨‍👩‍👧‍👦 Familj</strong><span>Originalfrågorna – blandad nivå för hela familjen.</span></button><button class="role-card" data-mode="child" style="${childSelected?'outline:4px solid #fff36b;':''}"><strong>${childSelected?'✓ ':''}🧒 Barn</strong><span>Nya frågor på ungefär 12-årsnivå – lagom kluriga.</span></button></div><div class="separator"></div><h3>Spelare</h3><div class="setup-players">${state.players.map((p,i)=>`<div class="field"><label>Spelare ${i+1}</label><input data-name="${p.id}" value="${esc(p.name)}" maxlength="20"></div>`).join('')}</div><div class="actions"><button id="add" class="btn blue" ${state.players.length>=8?'disabled':''}>+ Lägg till spelare</button><button id="remove" class="btn ghost" ${state.players.length<=1?'disabled':''}>Ta bort sista</button></div><div class="separator"></div><p class="help">Öppna samma webbsida på TV:n, välj <strong>TV / spelplan</strong> och skriv in koden ovan.</p><div class="actions"><button id="start" class="btn gold">Starta Duellen</button></div></div></section>`;
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setState(s=>{s.gameMode=b.dataset.mode;s.used={};s.active=null;s.showAnswer=false;}));
    document.querySelectorAll('[data-name]').forEach(inp=>inp.oninput=e=>{const p=state.players.find(x=>x.id===e.target.dataset.name);if(p)p.name=e.target.value;});
    document.getElementById('add').onclick=()=>setState(s=>{if(s.players.length<8)s.players.push({id:id(),name:`Spelare ${s.players.length+1}`,score:0});},false);
    document.getElementById('remove').onclick=()=>setState(s=>{if(s.players.length>1)s.players.pop();},false);
    document.getElementById('start').onclick=()=>{document.querySelectorAll('[data-name]').forEach(inp=>{const p=state.players.find(x=>x.id===inp.dataset.name);if(p)p.name=inp.value.trim()||'Spelare';});setState(s=>{s.phase='board';s.used={};s.active=null;s.showAnswer=false;s.winner=null;s.players.forEach(p=>p.score=0);});};
  }

  function renderHostGame(){
    const a=activeData();
    app.innerHTML=`<section class="screen"><div class="host-shell"><div class="host-header"><div><div class="brand small" style="text-align:left">Duellen</div><div class="host-code">Kod ${esc(state.roomCode)}</div></div><div class="connection-badge">${modeLabel()} · ${esc(connectMessage||'Spelrum aktivt')}</div></div>${a?hostQuestion(a):boardHtml(true,true)}${scorebar()}<div class="actions"><button id="finish" class="btn ghost">Avsluta spel</button><button id="reset" class="btn danger">Nollställ</button></div></div></section>`;
    document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const [ci,qi]=b.dataset.q.split('-').map(Number);setState(s=>{s.active={ci,qi};s.showAnswer=false;s.used[`${ci}-${qi}`]=true;});});
    if(a) bindQuestion(a.q);
    document.getElementById('finish').onclick=()=>{const max=Math.max(...state.players.map(p=>p.score)), winners=state.players.filter(p=>p.score===max);setState(s=>{s.phase='winner';s.winner={names:winners.map(w=>w.name),score:max};s.active=null;s.showAnswer=false;});};
    document.getElementById('reset').onclick=()=>{if(confirm('Nollställa hela spelet och alla poäng?'))setState(s=>{s.phase='board';s.used={};s.active=null;s.showAnswer=false;s.winner=null;s.players.forEach(p=>p.score=0);});};
  }
  function hostQuestion(a){
    return `<div class="host-question"><h3>${esc(a.cat.name)} · ${a.q.value}</h3><div class="q">${esc(a.q.question)}</div><div class="answer-box"><small>Rätt svar – endast programledaren</small><strong>${esc(a.q.answer)}</strong></div><div class="actions"><button id="answer" class="btn gold">${state.showAnswer?'Dölj svar på TV':'Visa rätt svar på TV'}</button><button id="board" class="btn blue">Till spelplanen</button></div><div class="player-controls">${state.players.map(p=>`<div class="player-control"><strong>${esc(p.name)}</strong><div class="mini-score">${money(p.score)}</div><div class="score-actions"><button class="btn success" data-score="${p.id}" data-delta="${a.q.value}">+${a.q.value}</button><button class="btn danger" data-score="${p.id}" data-delta="-${a.q.value}">−${a.q.value}</button></div></div>`).join('')}</div></div>`;
  }
  function bindQuestion(){
    document.getElementById('answer').onclick=()=>setState(s=>{s.showAnswer=!s.showAnswer;});
    document.getElementById('board').onclick=()=>setState(s=>{s.active=null;s.showAnswer=false;});
    document.querySelectorAll('[data-score]').forEach(b=>b.onclick=()=>setState(s=>{const p=s.players.find(x=>x.id===b.dataset.score);if(p)p.score+=Number(b.dataset.delta);}));
  }

  function renderTvGame(){
    if(state.phase==='winner'&&state.winner)return renderWinner(true);
    const a=activeData();
    const content=a?`<div class="question-stage"><div class="question-kicker">${esc(a.cat.name)} · ${a.q.value} KR</div><div class="question-card">${state.showAnswer?`<div><div class="question-text" style="font-size:clamp(24px,3.4vw,48px);margin-bottom:28px">${esc(a.q.question)}</div><div class="answer-reveal">${esc(a.q.answer)}</div></div>`:`<div class="question-text">${esc(a.q.question)}</div>`}</div></div>`:boardHtml();
    app.innerHTML=`<section class="screen"><div class="tv-topbar"><div class="brand tv-title">Duellen</div><div class="connection-badge">${modeLabel()} · ${esc(connectMessage||'Ansluten')}</div></div>${content}${scorebar()}</section>`;
  }

  function renderWinner(tv=false){
    const names=state.winner?.names||[], score=state.winner?.score||0, label=names.length>1?names.join(' & '):(names[0]||'—');
    app.innerHTML=`<section class="screen"><div class="winner"><div class="brand">Duellen</div><div class="trophy">🏆</div><h2>${esc(label)}</h2><p>${names.length>1?'delar segern med':'vinner med'} <strong>${money(score)}</strong></p>${tv?'':'<div class="actions" style="justify-content:center"><button id="back-board" class="btn gold">Till spelplanen</button><button id="new-round" class="btn blue">Ny omgång / byt variant</button></div>'}</div></section>`;
    if(!tv){document.getElementById('back-board').onclick=()=>setState(s=>{s.phase='board';s.winner=null;});document.getElementById('new-round').onclick=()=>setState(s=>{s.phase='setup';s.used={};s.active=null;s.showAnswer=false;s.winner=null;s.players.forEach(p=>p.score=0);});}
  }

  function render(){
    if(!role)return renderHome();
    if(role==='tv'){
      if(!state.roomCode||state.phase==='connecting'||(!tvConnection&&state.phase==='setup'))return renderTvConnect();
      return renderTvGame();
    }
    if(!state.roomCode)state.roomCode=code();
    if(state.phase==='setup')return renderHostSetup();
    if(state.phase==='winner'&&state.winner)return renderWinner(false);
    return renderHostGame();
  }

  window.addEventListener('beforeunload',destroyPeer);
  if(role==='host'){state.roomCode=code();state.phase='setup';startHostNetwork(state.roomCode);}else render();
})();
