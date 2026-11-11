(function () {
  'use strict';
  const M = window.Muehle;
  const $ = id => document.getElementById(id);
  const NAME = { w: 'Weiß', b: 'Schwarz' };
  const PHASE = { setzen: 'setzen', ziehen: 'ziehen', springen: 'springen' };
  const opp = c => (c === 'w' ? 'b' : 'w');

  let cur, history, legalNow, selected, pending, mode, human, thinking, end, gameId = 0;
  let zugAnim = null;      // { from, to } des zu animierenden Zugs (from null = neu gesetzt), einmal verbraucht
  let net = null;          // Online-Zustand { myColor, aktiv } oder null (= lokal)
  let onLocalMove = null;
  let onModeChange = null;

  function reset() {
    cur = M.start();
    history = [];
    selected = null;       // gewählter eigener Stein (Zieh-/Springphase)
    pending = null;        // Zugkandidaten, die noch auf die Wahl des zu entfernenden Steins warten
    thinking = false;
    legalNow = M.legal(cur);
    computeEnd();
  }

  // end: null | 'loss' (Spieler am Zug verliert) | 'draw' | 'rep'
  function computeEnd() {
    end = M.status(cur, legalNow);
    if (!end) {
      const key = M.posKey(cur);
      if (history.filter(h => M.posKey(h.state) === key).length + 1 >= 3) end = 'rep';
    }
  }

  function newGame() {
    gameId++;
    mode = $('mode').value;
    net = null;
    human = $('farbe').value;
    reset();
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
    render();
  }

  function syncMoves(serverZuege) {
    if (!net || !net.aktiv || !Array.isArray(serverZuege)) return false;
    if (serverZuege.length <= history.length) return false;
    const ok = applySerial(serverZuege.slice(history.length), true);
    selected = null; pending = null;
    const l = serverZuege[serverZuege.length - 1];
    if (l) zugAnim = { from: l.from == null ? null : l.from, to: l.to };
    render();
    return ok;
  }

  function applySerial(list, ton) {
    for (const mv of list) {
      const m = mv ? legalNow.find(x => M.sameMove(x, mv)) : null;
      if (!m) return false;
      if (ton && window.Sound) (m.remove !== null ? window.Sound.schlag : window.Sound.zug)();
      applyMove(m);
    }
    return true;
  }

  const serialMoves = () => history.map(h => ({ from: h.move.from, to: h.move.to, remove: h.move.remove }));

  function ergebnisCode() {
    if (!end) return null;
    if (end !== 'loss') return '1/2-1/2';
    return cur.turn === 'w' ? '0-1' : '1-0';
  }

  // ---------- Zug ausführen ----------
  function applyMove(m) {
    history.push({ state: cur, move: m, text: M.moveText(m) });
    cur = M.make(cur, m);
    selected = null;
    pending = null;
    legalNow = M.legal(cur);
    computeEnd();
  }

  function waehle(kand) {
    selected = null;
    const m0 = kand[0];
    zugAnim = { from: m0.from == null ? null : m0.from, to: m0.to };
    if (m0.remove === null) play(m0);
    else { pending = kand; render(); }   // Mühle geschlossen → erst Stein zum Entfernen wählen
  }

  function onPoint(p) {
    if (end || thinking) return;
    if (mode === 'ki' && cur.turn !== human) return;
    if (mode === 'online' && (!net || !net.aktiv || cur.turn !== net.myColor)) return;
    if (pending) {
      const m = pending.find(x => x.remove === p);
      if (m) play(m);
      return;
    }
    if (M.phase(cur, cur.turn) === 'setzen') {
      const kand = legalNow.filter(m => m.to === p);
      if (kand.length) waehle(kand);
      return;
    }
    if (selected !== null) {
      const kand = legalNow.filter(m => m.from === selected && m.to === p);
      if (kand.length) { waehle(kand); return; }
    }
    selected = (cur.board[p] === cur.turn && p !== selected && legalNow.some(m => m.from === p)) ? p : null;
    render();
  }

  function play(m) {
    if (window.Sound) (m.remove !== null ? window.Sound.schlag : window.Sound.zug)();
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
        const m = M.bestMove(cur, +$('stufe').value);
        thinking = false;
        if (m) { zugAnim = { from: m.from == null ? null : m.from, to: m.to }; play(m); }
        else render();
      }, 60);
    }, window.Anim.DUR);
  }

  function undo() {
    if (thinking || net) return;
    if (pending) { pending = null; render(); return; }
    if (!history.length) return;
    let n = 1;
    if (mode === 'ki') while (n < history.length && history[history.length - n].state.turn !== human) n++;
    cur = history[history.length - n].state;
    history.length -= n;
    selected = null;
    legalNow = M.legal(cur);
    computeEnd();
    render();
    if (mode === 'ki' && cur.turn !== human) aiTurn();
  }

  function render() {
    // Anzeige-Brett: wartet der Zug noch auf das Entfernen, liegt der eigene Stein schon.
    let disp = cur.board, raus = [];
    if (pending) {
      disp = M.make(cur, { from: pending[0].from, to: pending[0].to, remove: null }).board;
      raus = pending.map(m => m.remove);
    }
    const ziele = selected === null ? [] : legalNow.filter(m => m.from === selected).map(m => m.to);
    const last = history.length ? history[history.length - 1].move : null;

    let html = '';
    for (let p = 0; p < 24; p++) {
      const x = 8 + M.XY[p][0] * 14, y = 8 + M.XY[p][1] * 14, v = disp[p];
      const cls = ['mpunkt'];
      if (p === selected) cls.push('sel');
      if (ziele.includes(p)) cls.push('ziel');
      if (raus.includes(p)) cls.push('raus');
      if (last && !pending && (p === last.to || p === last.from)) cls.push('last');
      const label = M.name(p) + (v ? ', ' + NAME[v] : ', frei');
      html += '<button type="button" class="' + cls.join(' ') + '" data-p="' + p + '" style="left:' + x + '%;top:' + y + '%" aria-label="' + label + '">' +
        (v ? '<span class="stein ' + v + '"></span>' : '') + '</button>';
    }
    $('punkte').innerHTML = html;

    // Zug-Animation: Stein heranrutschen lassen (Ziehen/Springen) bzw. aufpoppen (Setzen)
    if (zugAnim) {
      const a = zugAnim; zugAnim = null;
      const ziel = $('punkte').children[a.to];
      const el = ziel && ziel.querySelector('.stein');
      if (el) {
        if (a.from == null) window.Anim.pop(el);
        else {
          const board = $('board');
          const dx = (M.XY[a.from][0] - M.XY[a.to][0]) * 14 / 100 * board.clientWidth;
          const dy = (M.XY[a.from][1] - M.XY[a.to][1]) * 14 / 100 * board.clientHeight;
          window.Anim.slide(el, dx, dy);
        }
      }
    }

    // Status
    const st = $('status');
    st.className = end ? 'ende' : '';
    const online = net && net.aktiv && (net.myColor === 'w' || net.myColor === 'b');
    if (end === 'loss') {
      const sieger = opp(cur.turn);
      st.textContent = online ? (sieger === net.myColor ? 'Du gewinnst!' : 'Gegner gewinnt.') : NAME[sieger] + ' gewinnt!';
    } else if (end === 'draw') st.textContent = 'Remis – 50 Züge ohne Mühle';
    else if (end === 'rep') st.textContent = 'Remis – dreifache Stellungswiederholung';
    else if (thinking) st.textContent = 'KI denkt …';
    else if (mode === 'online' && !net) st.textContent = 'Online-Modus';
    else if (pending) st.textContent = 'Mühle! Entferne einen Stein von ' + NAME[opp(cur.turn)];
    else {
      const wer = online ? (cur.turn === net.myColor ? 'Du bist am Zug' : 'Gegner am Zug') : NAME[cur.turn] + ' ist am Zug';
      st.textContent = wer + ' – ' + PHASE[M.phase(cur, cur.turn)];
    }

    // Steinzähler
    const info = col => NAME[col] + ': ' + M.count(cur.board, col) + ' auf dem Brett' + (cur.hand[col] ? ', ' + cur.hand[col] + ' zu setzen' : '');
    $('zaehler').innerHTML = info('w') + '<br>' + info('b');

    // Zugliste
    let z = '';
    for (let i = 0; i < history.length; i += 2) {
      z += '<span class="nr">' + (i / 2 + 1) + '.</span><span>' + history[i].text + '</span><span>' +
        (history[i + 1] ? history[i + 1].text : '') + '</span>';
    }
    const zl = $('zuege');
    zl.innerHTML = z;
    zl.scrollTop = zl.scrollHeight;

    $('zurueck').disabled = thinking || !!net || (!history.length && !pending);
    $('farbeWrap').style.display = $('stufeWrap').style.display = $('mode').value === 'ki' ? '' : 'none';
  }

  $('punkte').addEventListener('click', e => {
    const el = e.target.closest('.mpunkt');
    if (el) onPoint(+el.dataset.p);
  });
  $('neu').onclick = newGame;
  $('zurueck').onclick = undo;
  $('mode').onchange = newGame;
  $('farbe').onchange = newGame;

  window.MuehleUI = {
    startOnline: startOnline,
    syncMoves: syncMoves,
    setHandlers: function (h) {
      if (h && h.onLocalMove) onLocalMove = h.onLocalMove;
      if (h && h.onModeChange) onModeChange = h.onModeChange;
    }
  };

  newGame();
})();
