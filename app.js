(() => {
  const app = document.getElementById('app');
  const quiz = window.DUELLEN_QUIZ;
  const params = new URLSearchParams(location.search);
  let peer = null;
  let hostConnections = [];
  let tvConnection = null;
  let role = params.get('role') || null;
  let connectMessage = '';

  const makeId = () => Math.random().toString(36).slice(2, 9);
  const makeCode = () => String(Math.floor(1000 + Math.random() * 9000));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (s) => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatMoney = (n) => `${Number(n).toLocaleString('sv-SE')} kr`;

  let state = {
    roomCode: '',
    phase: 'setup',
    players: [
      { id: makeId(), name: 'Spelare 1', score: 0 },
      { id: makeId(), name: 'Spelare 2', score: 0 }
    ],
    used: {},
    active: null,
    showAnswer: false,
    winner: null
  };

  function cleanStateForTv() {
    return clone(state);
  }

  function broadcast() {
    if (role !== 'host') return;
    const payload = { type: 'state', state: cleanStateForTv() };
    hostConnections = hostConnections.filter(conn => conn && conn.open);
    hostConnections.forEach(conn => {
      try { conn.send(payload); } catch (_) {}
    });
  }

  function setState(mutator, shouldBroadcast = true) {
    mutator(state);
    render();
    if (shouldBroadcast) broadcast();
  }

  function peerAvailable() {
    return typeof window.Peer === 'function';
  }

  function destroyPeer() {
    try { if (tvConnection) tvConnection.close(); } catch (_) {}
    try { if (peer) peer.destroy(); } catch (_) {}
    peer = null;
    tvConnection = null;
    hostConnections = [];
  }

  function startHostNetwork(code) {
    destroyPeer();
    if (!peerAvailable()) {
      connectMessage = 'Nätverksbiblioteket kunde inte laddas. Kontrollera internetanslutningen.';
      render();
      return;
    }
    connectMessage = 'Startar spelrum…';
    render();
    peer = new Peer(`duellen-${code}`);
    peer.on('open', () => {
      connectMessage = 'Spelrummet är öppet. TV:n kan ansluta nu.';
      render();
    });
    peer.on('connection', conn => {
      hostConnections.push(conn);
      conn.on('open', () => {
        connectMessage = `TV ansluten (${hostConnections.filter(c => c.open).length})`;
        conn.send({ type: 'state', state: cleanStateForTv() });
        render();
      });
      conn.on('data', data => {
        if (data && data.type === 'requestState') {
          conn.send({ type: 'state', state: cleanStateForTv() });
        }
      });
      conn.on('close', () => {
        connectMessage = 'TV frånkopplad. Den kan ansluta igen med samma kod.';
        render();
      });
    });
    peer.on('error', err => {
      if (err && err.type === 'unavailable-id') {
        const next = makeCode();
        state.roomCode = next;
        startHostNetwork(next);
      } else {
        connectMessage = 'Kunde inte öppna spelrummet. Ladda om sidan och försök igen.';
        render();
      }
    });
  }

  function connectTv(code) {
    destroyPeer();
    if (!peerAvailable()) {
      connectMessage = 'Nätverksbiblioteket kunde inte laddas. Kontrollera internetanslutningen.';
      render();
      return;
    }
    connectMessage = 'Ansluter till programledaren…';
    render();
    peer = new Peer();
    peer.on('open', () => {
      tvConnection = peer.connect(`duellen-${code}`, { reliable: true });
      tvConnection.on('open', () => {
        connectMessage = 'Ansluten till Duellen.';
        tvConnection.send({ type: 'requestState' });
        render();
      });
      tvConnection.on('data', data => {
        if (data && data.type === 'state' && data.state) {
          state = data.state;
          connectMessage = 'Ansluten';
          render();
        }
      });
      tvConnection.on('close', () => {
        connectMessage = 'Kontakten med programledaren bröts. Försök ansluta igen.';
        render();
      });
      tvConnection.on('error', () => {
        connectMessage = 'Kunde inte ansluta. Kontrollera koden.';
        render();
      });
    });
    peer.on('error', () => {
      connectMessage = 'Kunde inte ansluta. Kontrollera koden och att programledaren har öppnat spelet.';
      render();
    });
  }

  function boardHtml({ interactive = false, host = false } = {}) {
    const cats = quiz.categories.map((cat, ci) => `<div class="tile category">${esc(cat.name)}</div>`).join('');
    let rows = '';
    for (let qi = 0; qi < 5; qi++) {
      rows += quiz.categories.map((cat, ci) => {
        const q = cat.questions[qi];
        const key = `${ci}-${qi}`;
        const used = !!state.used[key];
        if (interactive) {
          return `<button class="tile value selectable ${used ? 'used' : ''}" data-q="${key}" ${used ? 'disabled' : ''} aria-label="${esc(cat.name)} ${q.value}">${used ? '—' : q.value}</button>`;
        }
        return `<div class="tile value ${used ? 'used' : ''}">${used ? '—' : q.value}</div>`;
      }).join('');
    }
    return `<div class="board-wrap ${host ? 'host-board' : ''}"><div class="board-frame"><div class="board">${cats}${rows}</div></div></div>`;
  }

  function scorebarHtml() {
    if (!state.players.length) return '';
    return `<div class="scorebar">${state.players.map(p => `<div class="score-card"><div class="score-name">${esc(p.name)}</div><div class="score-value">${formatMoney(p.score)}</div></div>`).join('')}</div>`;
  }

  function renderHome() {
    app.innerHTML = `
      <section class="screen">
        <div class="brand">Duellen</div>
        <div class="subtitle">Familjens egen frågesport</div>
        <div class="panel">
          <h2>Välj skärm</h2>
          <div class="role-grid">
            <button class="role-card" id="choose-host"><strong>📱 Programledare</strong><span>Starta spelet, se facit, välj frågor och dela ut poäng.</span></button>
            <button class="role-card" id="choose-tv"><strong>📺 TV / spelplan</strong><span>Anslut med fyrsiffrig kod och visa spelplan, frågor och poäng.</span></button>
          </div>
        </div>
      </section>`;
    document.getElementById('choose-host').addEventListener('click', () => {
      role = 'host';
      state.roomCode = makeCode();
      state.phase = 'setup';
      history.replaceState({}, '', '?role=host');
      startHostNetwork(state.roomCode);
    });
    document.getElementById('choose-tv').addEventListener('click', () => {
      role = 'tv';
      history.replaceState({}, '', '?role=tv');
      render();
    });
  }

  function renderTvConnect() {
    app.innerHTML = `
      <section class="screen">
        <div class="brand">Duellen</div>
        <div class="panel">
          <h2>Anslut TV:n</h2>
          <form id="tv-form">
            <div class="field"><label for="room">Spelkod</label><input id="room" inputmode="numeric" maxlength="4" placeholder="1234" autocomplete="off" required /></div>
            <div class="actions"><button class="btn gold" type="submit">Anslut till spelet</button><button class="btn ghost" id="tv-back" type="button">Tillbaka</button></div>
            <p class="help">Programledaren ser koden på sin telefon när spelrummet har skapats.</p>
            ${connectMessage ? `<div class="notice">${esc(connectMessage)}</div>` : ''}
          </form>
        </div>
      </section>`;
    document.getElementById('tv-form').addEventListener('submit', e => {
      e.preventDefault();
      const code = document.getElementById('room').value.trim();
      if (!/^\d{4}$/.test(code)) {
        connectMessage = 'Koden ska vara fyra siffror.';
        render();
        return;
      }
      state.roomCode = code;
      state.phase = 'connecting';
      connectTv(code);
    });
    document.getElementById('tv-back').addEventListener('click', () => { role = null; connectMessage=''; history.replaceState({},'',location.pathname); render(); });
  }

  function renderHostSetup() {
    app.innerHTML = `
      <section class="screen">
        <div class="brand small">Duellen</div>
        <div class="panel">
          <h2>Skapa spel</h2>
          <div class="room-code">${esc(state.roomCode)}</div>
          <div class="status-line ${connectMessage.includes('ansluten') ? 'status-ok' : 'status-warn'}">${esc(connectMessage || 'Öppnar spelrum…')}</div>
          <div class="separator"></div>
          <h3>Spelare</h3>
          <div id="players" class="setup-players">
            ${state.players.map((p,i) => `<div class="field"><label for="p-${i}">Spelare ${i+1}</label><input id="p-${i}" data-player-name="${p.id}" value="${esc(p.name)}" maxlength="20" /></div>`).join('')}
          </div>
          <div class="actions">
            <button id="add-player" class="btn blue" type="button" ${state.players.length>=8?'disabled':''}>+ Lägg till spelare</button>
            <button id="remove-player" class="btn ghost" type="button" ${state.players.length<=1?'disabled':''}>Ta bort sista</button>
          </div>
          <div class="separator"></div>
          <p class="help">Öppna samma webbsida på TV:n, välj <strong>TV / spelplan</strong> och skriv in koden ovan. Programledarens telefon är sedan kontrollpanel och facit.</p>
          <div class="actions"><button id="start-game" class="btn gold" type="button">Starta Duellen</button></div>
        </div>
      </section>`;

    document.querySelectorAll('[data-player-name]').forEach(input => input.addEventListener('input', e => {
      const p = state.players.find(x => x.id === e.target.dataset.playerName);
      if (p) p.name = e.target.value;
    }));
    document.getElementById('add-player').addEventListener('click', () => setState(s => { if (s.players.length < 8) s.players.push({id:makeId(),name:`Spelare ${s.players.length+1}`,score:0}); }, false));
    document.getElementById('remove-player').addEventListener('click', () => setState(s => { if (s.players.length > 1) s.players.pop(); }, false));
    document.getElementById('start-game').addEventListener('click', () => {
      document.querySelectorAll('[data-player-name]').forEach(input => {
        const p = state.players.find(x => x.id === input.dataset.playerName);
        if (p) p.name = input.value.trim() || 'Spelare';
      });
      setState(s => { s.phase='board'; s.used={}; s.active=null; s.showAnswer=false; s.winner=null; s.players.forEach(p=>p.score=0); });
    });
  }

  function activeQuestionData() {
    if (!state.active) return null;
    const cat = quiz.categories[state.active.ci];
    const q = cat && cat.questions[state.active.qi];
    return q ? { cat, q } : null;
  }

  function renderHostGame() {
    const active = activeQuestionData();
    app.innerHTML = `
      <section class="screen">
        <div class="host-shell">
          <div class="host-header">
            <div><div class="brand small" style="text-align:left">Duellen</div><div class="host-code">Kod ${esc(state.roomCode)}</div></div>
            <div class="connection-badge">${esc(connectMessage || 'Spelrum aktivt')}</div>
          </div>
          ${active ? hostQuestionHtml(active.cat, active.q) : boardHtml({interactive:true,host:true})}
          ${scorebarHtml()}
          <div class="actions">
            <button id="finish-game" class="btn ghost" type="button">Avsluta spel</button>
            <button id="reset-game" class="btn danger" type="button">Nollställ</button>
          </div>
        </div>
      </section>`;

    document.querySelectorAll('[data-q]').forEach(btn => btn.addEventListener('click', () => {
      const [ci,qi] = btn.dataset.q.split('-').map(Number);
      setState(s => { s.active={ci,qi}; s.showAnswer=false; s.used[`${ci}-${qi}`]=true; });
    }));

    if (active) bindHostQuestion(active.q);

    document.getElementById('finish-game').addEventListener('click', () => {
      const max = Math.max(...state.players.map(p => p.score));
      const winners = state.players.filter(p => p.score === max);
      setState(s => { s.phase='winner'; s.winner={ names:winners.map(w=>w.name), score:max }; s.active=null; s.showAnswer=false; });
    });
    document.getElementById('reset-game').addEventListener('click', () => {
      if (confirm('Nollställa hela spelet och alla poäng?')) {
        setState(s => { s.phase='board'; s.used={}; s.active=null; s.showAnswer=false; s.winner=null; s.players.forEach(p=>p.score=0); });
      }
    });
  }

  function hostQuestionHtml(cat, q) {
    return `<div class="host-question">
      <h3>${esc(cat.name)} · ${q.value}</h3>
      <div class="q">${esc(q.question)}</div>
      <div class="answer-box"><small>Rätt svar – endast programledaren</small><strong>${esc(q.answer)}</strong></div>
      <div class="actions">
        <button id="toggle-answer" class="btn gold" type="button">${state.showAnswer ? 'Dölj svar på TV' : 'Visa rätt svar på TV'}</button>
        <button id="back-board" class="btn blue" type="button">Till spelplanen</button>
      </div>
      <div class="player-controls">
        ${state.players.map(p => `<div class="player-control">
          <strong>${esc(p.name)}</strong><div class="mini-score">${formatMoney(p.score)}</div>
          <div class="score-actions">
            <button class="btn success" data-score="${p.id}" data-delta="${q.value}" type="button">+${q.value}</button>
            <button class="btn danger" data-score="${p.id}" data-delta="-${q.value}" type="button">−${q.value}</button>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function bindHostQuestion(q) {
    document.getElementById('toggle-answer').addEventListener('click', () => setState(s => { s.showAnswer=!s.showAnswer; }));
    document.getElementById('back-board').addEventListener('click', () => setState(s => { s.active=null; s.showAnswer=false; }));
    document.querySelectorAll('[data-score]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.score;
      const delta = Number(btn.dataset.delta);
      setState(s => { const p=s.players.find(x=>x.id===id); if(p) p.score += delta; });
    }));
  }

  function renderTvGame() {
    const active = activeQuestionData();
    if (state.phase === 'winner' && state.winner) {
      renderWinner(true);
      return;
    }
    app.innerHTML = `<section class="screen">
      <div class="tv-topbar"><div class="brand tv-title">Duellen</div><div class="connection-badge">${esc(connectMessage || 'Ansluten')}</div></div>
      ${active ? `<div class="question-stage"><div class="question-kicker">${esc(active.cat.name)} · ${active.q.value} KR</div><div class="question-card">${state.showAnswer ? `<div><div class="question-text" style="font-size:clamp(24px,3.4vw,48px); margin-bottom:28px">${esc(active.q.question)}</div><div class="answer-reveal">${esc(active.q.answer)}</div></div>` : `<div class="question-text">${esc(active.q.question)}</div>`}</div></div>` : boardHtml()}
      ${scorebarHtml()}
    </section>`;
  }

  function renderWinner(tv = false) {
    const names = state.winner?.names || [];
    const score = state.winner?.score || 0;
    const label = names.length > 1 ? names.join(' & ') : (names[0] || '—');
    app.innerHTML = `<section class="screen"><div class="winner"><div class="brand">Duellen</div><div class="trophy">🏆</div><h2>${esc(label)}</h2><p>${names.length > 1 ? 'delar segern med' : 'vinner med'} <strong>${formatMoney(score)}</strong></p>${tv ? '' : '<div class="actions" style="justify-content:center"><button id="winner-back" class="btn gold" type="button">Till spelplanen</button></div>'}</div></section>`;
    if (!tv) document.getElementById('winner-back').addEventListener('click', () => setState(s => { s.phase='board'; s.winner=null; }));
  }

  function render() {
    if (!role) return renderHome();
    if (role === 'tv') {
      if (!state.roomCode || state.phase === 'connecting' || (!tvConnection && state.phase === 'setup')) return renderTvConnect();
      return renderTvGame();
    }
    if (role === 'host') {
      if (!state.roomCode) state.roomCode = makeCode();
      if (state.phase === 'setup') return renderHostSetup();
      if (state.phase === 'winner' && state.winner) return renderWinner(false);
      return renderHostGame();
    }
  }

  window.addEventListener('beforeunload', destroyPeer);

  if (role === 'host') {
    state.roomCode = makeCode();
    state.phase = 'setup';
    startHostNetwork(state.roomCode);
  } else {
    render();
  }
})();
