(function () {
  'use strict';
  const V = window.Vier;
  const $ = id => document.getElementById(id);
  const NAME = { w: 'Rot', b: 'Gelb' };

  let cur, history, mode, human, thinking, end, animIdx = -1, gameId = 0;
  let net = null;          // Online-Zustand { myColor, aktiv } oder null (= lokal)
  let onLocalMove = null;  // online: nach eigenem Zug Zustand senden
  let onModeChange = null; // bei Moduswechsel (für Online-Panel)

  function reset() {
    cur = V.start();
    history = [];
    thinking = false;
    end = V.status(cur);
    animIdx = -1;
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
    render();
    return ok;
  }

  function applySerial(list, ton) {
    for (const mv of list) {
      if (!mv || !V.legal(cur).includes(mv.c)) return false;
      if (ton && window.Sound) window.Sound.zug();
      applyMove(mv.c);
    }
    return true;
  }

  const serialMoves = () => history.map(h => ({ c: h.c }));

  function ergebnisCode() {
    if (!end.end) return null;
    if (end.end === 'draw') return '1/2-1/2';
    return end.winner === 'w' ? '1-0' : '0-1';
  }

  // ---------- Zug ausführen ----------
  function applyMove(c) {
    history.push({ state: cur, c: c });
    cur = V.make(cur, c);
    animIdx = cur.last;
    end = V.status(cur);
  }

  function onCol(c) {
    if (end.end || thinking) return;
    if (mode === 'ki' && cur.turn !== human) return;
    if (mode === 'online' && (!net || !net.aktiv || cur.turn !== net.myColor)) return;
    if (!V.legal(cur).includes(c)) return;
    play(c);
  }

  function play(c) {
    if (window.Sound) window.Sound.zug();
    applyMove(c);
    render();
    if (net && net.aktiv) {
      if (onLocalMove) onLocalMove(serialMoves(), cur.turn, ergebnisCode());
      return;
    }
    if (!end.end && mode === 'ki' && cur.turn !== human) aiTurn();
  }

  function aiTurn() {
    thinking = true;
    render();
    const id = gameId;
    setTimeout(() => {
      if (id !== gameId) return;
      const c = V.bestMove(cur, +$('stufe').value);
      thinking = false;
      if (c !== null) play(c); else render();
    }, 350);
  }

  function undo() {
    if (thinking || net || !history.length) return;
    // Gegen die KI bis zum letzten eigenen Zug zurückgehen.
    let n = 1;
    if (mode === 'ki') while (n < history.length && history[history.length - n].state.turn !== human) n++;
    cur = history[history.length - n].state;
    history.length -= n;
    end = V.status(cur);
    animIdx = -1;
    render();
    if (mode === 'ki' && cur.turn !== human) aiTurn();
  }

  function render() {
    const board = $('board');
    const fokus = document.activeElement && board.contains(document.activeElement) ? document.activeElement.dataset.c : null;
    let html = '';
    for (let c = 0; c < V.COLS; c++) {
      const voll = cur.board[c] !== '';
      html += '<button type="button" class="vcol" data-c="' + c + '" aria-label="Spalte ' + (c + 1) + '"' + (voll ? ' disabled' : '') + '>';
      for (let r = 0; r < V.ROWS; r++) {
        const i = r * V.COLS + c, v = cur.board[i];
        const gewinn = end.line && end.line.includes(i);
        html += '<span class="vzelle' + (gewinn ? ' gewinn' : '') + '">';
        if (v) html += '<span class="scheibe ' + v + (i === animIdx ? ' fall' : '') + '" style="--r:' + r + '"></span>';
        html += '</span>';
      }
      html += '</button>';
    }
    board.innerHTML = html;
    animIdx = -1;
    if (fokus !== null && fokus !== undefined) {
      const el = board.querySelector('.vcol[data-c="' + fokus + '"]:not(:disabled)');
      if (el) el.focus();
    }

    // Status
    const st = $('status');
    st.className = end.end ? 'ende' : '';
    const punkt = col => '<span class="punkt ' + col + '"></span>';
    if (end.end === 'win') {
      let wer = NAME[end.winner] + ' gewinnt!';
      if (net && net.aktiv && (net.myColor === 'w' || net.myColor === 'b')) wer = end.winner === net.myColor ? 'Du gewinnst!' : 'Gegner gewinnt.';
      st.innerHTML = punkt(end.winner) + wer;
    } else if (end.end === 'draw') st.textContent = 'Unentschieden – das Brett ist voll';
    else if (thinking) st.innerHTML = punkt(cur.turn) + 'KI denkt …';
    else if (mode === 'online' && !net) st.textContent = 'Online-Modus';
    else if (net && net.aktiv && (net.myColor === 'w' || net.myColor === 'b')) {
      st.innerHTML = punkt(cur.turn) + (cur.turn === net.myColor ? 'Du bist am Zug' : 'Gegner am Zug');
    } else st.innerHTML = punkt(cur.turn) + NAME[cur.turn] + ' ist am Zug';

    // Zugliste (Spalten a–g)
    let z = '';
    for (let i = 0; i < history.length; i += 2) {
      z += '<span class="nr">' + (i / 2 + 1) + '.</span><span>' + 'abcdefg'[history[i].c] + '</span><span>' +
        (history[i + 1] ? 'abcdefg'[history[i + 1].c] : '') + '</span>';
    }
    const zl = $('zuege');
    zl.innerHTML = z;
    zl.scrollTop = zl.scrollHeight;

    $('zurueck').disabled = thinking || !history.length || !!net;
    $('farbeWrap').style.display = $('stufeWrap').style.display = $('mode').value === 'ki' ? '' : 'none';
  }

  $('board').addEventListener('click', e => {
    const el = e.target.closest('.vcol');
    if (el) onCol(+el.dataset.c);
  });
  $('neu').onclick = newGame;
  $('zurueck').onclick = undo;
  $('mode').onchange = newGame;
  $('farbe').onchange = newGame;

  window.VierUI = {
    startOnline: startOnline,
    syncMoves: syncMoves,
    setHandlers: function (h) {
      if (h && h.onLocalMove) onLocalMove = h.onLocalMove;
      if (h && h.onModeChange) onModeChange = h.onModeChange;
    }
  };

  newGame();
})();
