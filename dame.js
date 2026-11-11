(function () {
  'use strict';
  const D = window.Dame;
  const $ = id => document.getElementById(id);
  const NAME = { w: 'Weiß', b: 'Schwarz' };
  const opp = c => (c === 'w' ? 'b' : 'w');

  let cur, history, legalNow, prefix, mode, human, flipped, thinking, end, gameId = 0;
  let zugAnim = null;      // { from, to } des zu animierenden Zugs, einmal von render() verbraucht
  let net = null;          // Online-Zustand { myColor, aktiv } oder null (= lokal)
  let onLocalMove = null;
  let onModeChange = null;

  function reset() {
    cur = D.start();
    history = [];
    prefix = null;         // bisher geklickter Weg des gewählten Steins, z. B. [start, station1]
    thinking = false;
    legalNow = D.legal(cur);
    end = D.status(cur, legalNow);
  }

  function newGame() {
    gameId++;
    mode = $('mode').value;
    net = null;
    human = $('farbe').value;
    reset();
    flipped = mode === 'ki' && human === 'b';
    render();
    if (onModeChange) onModeChange(mode);
    if (mode === 'ki' && cur.turn !== human) aiTurn();
  }

  // ---------- Online-Steuerung (von online.js genutzt) ----------
  function startOnline(myColor, zuege) {
    gameId++;
    mode = 'online';
    net = { myColor: myColor, aktiv: true };
    reset();
    applySerial(zuege || []);
    flipped = myColor === 'b';
    render();
  }

  function syncMoves(serverZuege) {
    if (!net || !net.aktiv || !Array.isArray(serverZuege)) return false;
    if (serverZuege.length <= history.length) return false;
    const ok = applySerial(serverZuege.slice(history.length), true);
    prefix = null;
    const l = serverZuege[serverZuege.length - 1];
    if (l && l.path) zugAnim = { from: l.path[0], to: l.path[l.path.length - 1] };
    render();
    return ok;
  }

  function applySerial(list, ton) {
    for (const mv of list) {
      const m = mv && Array.isArray(mv.path) ? legalNow.find(x => D.sameMove(x, mv.path)) : null;
      if (!m) return false;
      if (ton && window.Sound) (m.caps && m.caps.length ? window.Sound.schlag : window.Sound.zug)();
      applyMove(m);
    }
    return true;
  }

  const serialMoves = () => history.map(h => ({ path: h.move.path }));

  function ergebnisCode() {
    if (!end) return null;
    if (end === 'draw') return '1/2-1/2';
    return cur.turn === 'w' ? '0-1' : '1-0';   // Spieler am Zug hat verloren
  }

  // ---------- Zug ausführen ----------
  function applyMove(m) {
    history.push({ state: cur, move: m, text: D.moveText(m) });
    cur = D.make(cur, m);
    prefix = null;
    legalNow = D.legal(cur);
    end = D.status(cur, legalNow);
  }

  const beginntMit = (path, pre) => pre.every((x, i) => path[i] === x);

  function onSquare(sq) {
    if (end || thinking) return;
    if (mode === 'ki' && cur.turn !== human) return;
    if (mode === 'online' && (!net || !net.aktiv || cur.turn !== net.myColor)) return;
    if (prefix) {
      const weiter = legalNow.filter(m => beginntMit(m.path, prefix) && m.path[prefix.length] === sq);
      if (weiter.length) {
        prefix = prefix.concat(sq);
        const fertig = weiter.find(m => m.path.length === prefix.length);
        if (fertig) { play(fertig); return; }
        zugAnim = { from: prefix[prefix.length - 2], to: sq };   // Zwischenstation des Mehrfachschlags
        if (window.Sound) window.Sound.schlag();   // jede Zwischenstation schlägt einen Stein
        render();
        return;
      }
    }
    const p = cur.board[sq];
    const waehlbar = p !== '' && D.colorOf(p) === cur.turn && legalNow.some(m => m.path[0] === sq);
    const gleicher = prefix && prefix.length === 1 && prefix[0] === sq;
    prefix = (waehlbar && !gleicher) ? [sq] : null;
    render();
  }

  function play(m) {
    // Bei einem interaktiven Mehrfachschlag steht der Stein schon auf der vorletzten Station.
    const von = (prefix && prefix.length >= 2) ? prefix[prefix.length - 2] : m.path[0];
    zugAnim = { from: von, to: m.path[m.path.length - 1] };
    if (window.Sound) (m.caps && m.caps.length ? window.Sound.schlag : window.Sound.zug)();
    applyMove(m);
    render();
    if (net && net.aktiv) {
      if (onLocalMove) onLocalMove(serialMoves(), cur.turn, ergebnisCode());
      return;
    }
    if (!end && mode === 'ki' && cur.turn !== human) aiTurn();
  }

  function aiTurn() {
    const id = gameId;
    // Erst den Zug des Menschen zu Ende rutschen lassen, dann „KI denkt“ zeigen.
    setTimeout(() => {
      if (id !== gameId) return;
      thinking = true;
      render();
      setTimeout(() => {
        if (id !== gameId) return;
        const m = D.bestMove(cur, +$('stufe').value);
        thinking = false;
        if (m) play(m); else render();
      }, 60);
    }, window.Anim.DUR);
  }

  function undo() {
    if (thinking || net || !history.length) return;
    let n = 1;
    if (mode === 'ki') while (n < history.length && history[history.length - n].state.turn !== human) n++;
    cur = history[history.length - n].state;
    history.length -= n;
    prefix = null;
    legalNow = D.legal(cur);
    end = D.status(cur, legalNow);
    render();
    if (mode === 'ki' && cur.turn !== human) aiTurn();
  }

  function render() {
    // Anzeige-Brett: während eines Mehrfachschlags steht der Stein schon auf der letzten Station.
    const disp = cur.board.slice();
    let weg = [], ziele = [], sel = -1;
    if (prefix) {
      const kand = legalNow.filter(m => beginntMit(m.path, prefix));
      sel = prefix[prefix.length - 1];
      if (prefix.length > 1 && kand.length) {
        disp[sel] = disp[prefix[0]];
        disp[prefix[0]] = '';
        weg = kand[0].caps.slice(0, prefix.length - 1);
      }
      ziele = kand.map(m => m.path[prefix.length]);
    }
    const last = history.length ? history[history.length - 1].move : null;
    const zwang = !end && legalNow.length && legalNow[0].caps.length > 0;
    const amZugMensch = !thinking && !(mode === 'ki' && cur.turn !== human) &&
      !(mode === 'online' && (!net || cur.turn !== net.myColor));
    const kann = (zwang && !prefix && amZugMensch) ? legalNow.map(m => m.path[0]) : [];

    let html = '';
    for (let i = 0; i < 64; i++) {
      const sq = flipped ? 63 - i : i;
      const r = sq >> 3, c = sq & 7, p = disp[sq];
      const cls = ['sq', (r + c) % 2 === 0 ? 'hell' : 'dunkel'];
      if (last && (sq === last.path[0] || sq === last.path[last.path.length - 1])) cls.push('last');
      if (sq === sel) cls.push('sel');
      if (ziele.includes(sq)) cls.push('ziel');
      if (kann.includes(sq)) cls.push('kann');
      html += '<div class="' + cls.join(' ') + '" data-sq="' + sq + '">';
      const row = Math.floor(i / 8), col = i % 8;
      if (col === 0) html += '<span class="coord rang">' + (8 - r) + '</span>';
      if (row === 7) html += '<span class="coord linie">' + 'abcdefgh'[c] + '</span>';
      if (p !== '') {
        html += '<span class="stein ' + D.colorOf(p) + (D.isKing(p) ? ' dame' : '') + (weg.includes(sq) ? ' weg' : '') + '"></span>';
      }
      html += '</div>';
    }
    $('board').innerHTML = html;

    // Zug-Animation: Zielstein von seinem Startfeld heranrutschen lassen
    if (zugAnim) {
      const a = zugAnim; zugAnim = null;
      const iFrom = flipped ? 63 - a.from : a.from, iTo = flipped ? 63 - a.to : a.to;
      const cell = $('board').clientWidth / 8;
      const dx = ((iFrom % 8) - (iTo % 8)) * cell;
      const dy = ((iFrom >> 3) - (iTo >> 3)) * cell;
      const cellEl = $('board').children[iTo];
      if (cellEl) window.Anim.slide(cellEl.querySelector('.stein'), dx, dy);
    }

    // Status
    const st = $('status');
    st.className = end ? 'ende' : '';
    const online = net && net.aktiv && (net.myColor === 'w' || net.myColor === 'b');
    if (end === 'loss') {
      const sieger = opp(cur.turn);
      st.textContent = online ? (sieger === net.myColor ? 'Du gewinnst!' : 'Gegner gewinnt.') : NAME[sieger] + ' gewinnt!';
    } else if (end === 'draw') st.textContent = 'Remis – 40 Züge ohne Fortschritt';
    else if (thinking) st.textContent = 'KI denkt …';
    else if (mode === 'online' && !net) st.textContent = 'Online-Modus';
    else {
      const wer = online ? (cur.turn === net.myColor ? 'Du bist am Zug' : 'Gegner am Zug') : NAME[cur.turn] + ' ist am Zug';
      st.textContent = wer + (zwang ? ' – Schlagzwang' : '');
    }

    // Steinzähler
    const zahl = col => cur.board.filter(p => p !== '' && D.colorOf(p) === col).length;
    $('zaehler').textContent = 'Weiß: ' + zahl('w') + ' Steine · Schwarz: ' + zahl('b') + ' Steine';

    // Zugliste
    let z = '';
    for (let i = 0; i < history.length; i += 2) {
      z += '<span class="nr">' + (i / 2 + 1) + '.</span><span>' + history[i].text + '</span><span>' +
        (history[i + 1] ? history[i + 1].text : '') + '</span>';
    }
    const zl = $('zuege');
    zl.innerHTML = z;
    zl.scrollTop = zl.scrollHeight;

    $('zurueck').disabled = thinking || !history.length || !!net;
    $('farbeWrap').style.display = $('stufeWrap').style.display = $('mode').value === 'ki' ? '' : 'none';
  }

  $('board').addEventListener('click', e => {
    const el = e.target.closest('.sq');
    if (el) onSquare(+el.dataset.sq);
  });
  $('neu').onclick = newGame;
  $('zurueck').onclick = undo;
  $('drehen').onclick = () => { flipped = !flipped; render(); };
  $('mode').onchange = newGame;
  $('farbe').onchange = newGame;

  window.DameUI = {
    startOnline: startOnline,
    syncMoves: syncMoves,
    setHandlers: function (h) {
      if (h && h.onLocalMove) onLocalMove = h.onLocalMove;
      if (h && h.onModeChange) onModeChange = h.onModeChange;
    }
  };

  newGame();
})();
