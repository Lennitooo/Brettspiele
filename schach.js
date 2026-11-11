(function () {
  'use strict';
  const E = window.Chess;
  const $ = id => document.getElementById(id);
  // Figuren-Grafik (cburnett-SVGs im Ordner pieces/). p z.B. 'K' (weiß) oder 'k' (schwarz).
  const pieceSrc = p => 'pieces/' + (E.isWhite(p) ? 'w' : 'b') + p.toUpperCase() + '.svg';

  let cur, history, legalNow, selected, mode, human, flipped, thinking, endText, pendingPromo, gameId = 0;
  let zugAnim = null;      // { from, to } des zu animierenden Zugs, einmal von render() verbraucht
  let net = null;          // Online-Zustand { myColor, aktiv } oder null (= lokal)
  let onLocalMove = null;  // online: nach eigenem Zug Zustand senden
  let onModeChange = null; // bei Moduswechsel (für Online-Panel)

  function newGame() {
    gameId++;
    mode = $('mode').value;
    net = null;
    human = $('farbe').value;
    cur = E.fromFEN(E.START_FEN);
    history = [];
    selected = null;
    thinking = false;
    endText = null;
    pendingPromo = null;
    legalNow = E.legal(cur);
    flipped = mode === 'ki' && human === 'b';
    render();
    if (onModeChange) onModeChange(mode);
    if (mode === 'ki' && cur.turn !== human) aiTurn();
  }

  // ---------- Online-Steuerung (von schach-online.js genutzt) ----------
  function startOnline(myColor, zuege) {
    gameId++;
    mode = 'online';
    net = { myColor: myColor, aktiv: true };
    cur = E.fromFEN(E.START_FEN);
    history = [];
    selected = null;
    thinking = false;
    endText = null;
    pendingPromo = null;
    legalNow = E.legal(cur);
    applySerial(zuege || []);
    flipped = myColor === 'b';
    render();
  }

  // Fehlende Züge vom Server nachspielen (idempotent, selbstheilend).
  function syncMoves(serverZuege) {
    if (!net || !net.aktiv || !Array.isArray(serverZuege)) return false;
    if (serverZuege.length <= history.length) return false;
    const ok = applySerial(serverZuege.slice(history.length), true);
    selected = null;
    const l = serverZuege[serverZuege.length - 1];
    if (l) zugAnim = { from: l.from, to: l.to };
    render();
    return ok;
  }

  function applySerial(list, ton) {
    for (const mv of list) {
      const m = legalNow.find(x => x.from === mv.from && x.to === mv.to && (x.promo || null) === (mv.promo || null));
      if (!m) return false;
      if (ton) spieleTon(m);
      applyMove(m);
    }
    return true;
  }

  // Klick beim Zug, satteres Geräusch beim Schlagen (normaler Schlag oder en passant).
  function spieleTon(m) {
    if (!window.Sound) return;
    const schlug = cur.board[m.to] !== '' || ((cur.board[m.from] || '').toLowerCase() === 'p' && m.to === cur.ep);
    (schlug ? window.Sound.schlag : window.Sound.zug)();
  }

  function serialMoves() {
    return history.map(h => ({ from: h.move.from, to: h.move.to, promo: h.move.promo || null }));
  }

  function ergebnisCode() {
    if (!endText) return null;
    if (endText.indexOf('Schachmatt') === 0) return cur.turn === 'w' ? '0-1' : '1-0';
    return '1/2-1/2';
  }

  // ---------- Zug ausführen ----------
  function applyMove(m) {
    const san = E.san(cur, m, legalNow);
    history.push({ state: cur, move: m, san });
    cur = E.make(cur, m);
    selected = null;
    pendingPromo = null;
    legalNow = E.legal(cur);
    computeEnd();
  }

  function onSquare(sq) {
    if (endText || thinking || pendingPromo) return;
    if (mode === 'ki' && cur.turn !== human) return;
    if (mode === 'online' && (!net || !net.aktiv || cur.turn !== net.myColor)) return;
    if (selected !== null) {
      const ms = legalNow.filter(m => m.from === selected && m.to === sq);
      if (ms.length) {
        if (ms[0].promo) askPromo(ms); else play(ms[0]);
        return;
      }
    }
    const p = cur.board[sq];
    selected = (p !== '' && E.colorOf(p) === cur.turn && selected !== sq) ? sq : null;
    markiere();   // nur Markierungen ändern – Brett nicht neu aufbauen (sonst flackern die Figuren)
  }

  // Auswahl-/Zielmarkierungen auf dem bestehenden Brett aktualisieren, ohne die Figuren neu zu zeichnen.
  function markiere() {
    const board = $('board');
    if (!board.children.length) { render(); return; }
    const last = history.length ? history[history.length - 1].move : null;
    const targets = selected === null ? [] : legalNow.filter(m => m.from === selected).map(m => m.to);
    const checkSq = (!endText || endText.startsWith('Schachmatt')) && E.inCheck(cur, cur.turn)
      ? cur.board.indexOf(cur.turn === 'w' ? 'K' : 'k') : -1;
    for (let i = 0; i < 64; i++) {
      const sq = flipped ? 63 - i : i, el = board.children[i];
      el.classList.toggle('last', !!last && (sq === last.from || sq === last.to));
      el.classList.toggle('sel', sq === selected);
      el.classList.toggle('check', sq === checkSq);
      const istZiel = targets.includes(sq);
      const schlag = istZiel && (cur.board[sq] !== '' || (cur.board[selected] || '').toLowerCase() === 'p' && sq === cur.ep);
      el.classList.toggle('ziel', istZiel);
      el.classList.toggle('schlag', schlag);
    }
  }

  function askPromo(ms) {
    pendingPromo = ms;
    const box = $('promoOpts');
    box.innerHTML = '';
    for (const l of 'qrbn') {
      const b = document.createElement('button');
      b.innerHTML = '<img src="pieces/' + (cur.turn === 'w' ? 'w' : 'b') + l.toUpperCase() + '.svg" alt="">';
      b.onclick = () => { $('promo').classList.remove('offen'); play(ms.find(m => m.promo === l)); };
      box.appendChild(b);
    }
    $('promo').classList.add('offen');
  }

  function play(m) {
    zugAnim = { from: m.from, to: m.to };
    spieleTon(m);
    applyMove(m);
    render();
    if (net && net.aktiv) {
      if (onLocalMove) onLocalMove(serialMoves(), cur.turn, ergebnisCode());
      return;
    }
    if (!endText && mode === 'ki' && cur.turn !== human) aiTurn();
  }

  function computeEnd() {
    const st = E.status(cur, legalNow);
    const key = E.posKey(cur);
    const reps = history.filter(h => E.posKey(h.state) === key).length + 1;
    const wer = cur.turn === 'w' ? 'Schwarz' : 'Weiß';
    if (st === 'checkmate') endText = 'Schachmatt – ' + wer + ' gewinnt!';
    else if (st === 'stalemate') endText = 'Patt – Unentschieden';
    else if (st === 'material') endText = 'Remis – zu wenig Material';
    else if (st === 'fifty') endText = 'Remis – 50-Züge-Regel';
    else if (reps >= 3) endText = 'Remis – dreifache Stellungswiederholung';
    else endText = null;
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
        const m = E.bestMove(cur, +$('stufe').value);
        thinking = false;
        if (m) play(m); else render();
      }, 60);
    }, window.Anim.DUR);
  }

  function undo() {
    if (thinking || net || !history.length) return;
    let n = mode === 'ki' ? (cur.turn === human ? 2 : 1) : 1;
    n = Math.min(n, history.length);
    cur = history[history.length - n].state;
    history.length -= n;
    legalNow = E.legal(cur);
    selected = null;
    endText = null;
    pendingPromo = null;
    render();
    if (mode === 'ki' && cur.turn !== human) aiTurn();
  }

  function render() {
    const last = history.length ? history[history.length - 1].move : null;
    const targets = selected === null ? [] : legalNow.filter(m => m.from === selected).map(m => m.to);
    const checkSq = (!endText || endText.startsWith('Schachmatt')) && E.inCheck(cur, cur.turn)
      ? cur.board.indexOf(cur.turn === 'w' ? 'K' : 'k') : -1;
    let html = '';
    for (let i = 0; i < 64; i++) {
      const sq = flipped ? 63 - i : i;
      const r = sq >> 3, c = sq & 7, p = cur.board[sq];
      const cls = ['sq', (r + c) % 2 === 0 ? 'hell' : 'dunkel'];
      if (last && (sq === last.from || sq === last.to)) cls.push('last');
      if (sq === selected) cls.push('sel');
      if (sq === checkSq) cls.push('check');
      if (targets.includes(sq)) { cls.push('ziel'); if (p !== '' || (cur.board[selected] || '').toLowerCase() === 'p' && sq === cur.ep) cls.push('schlag'); }
      html += '<div class="' + cls.join(' ') + '" data-sq="' + sq + '">';
      const row = Math.floor(i / 8), col = i % 8;
      if (col === 0) html += '<span class="coord rang">' + (8 - (sq >> 3)) + '</span>';
      if (row === 7) html += '<span class="coord linie">' + 'abcdefgh'[sq & 7] + '</span>';
      if (p !== '') html += '<img class="piece" src="' + pieceSrc(p) + '" alt="">';
      html += '</div>';
    }
    $('board').innerHTML = html;

    // Zug-Animation: Zielfigur von ihrem Startfeld heranrutschen lassen
    if (zugAnim) {
      const a = zugAnim; zugAnim = null;
      const iFrom = flipped ? 63 - a.from : a.from, iTo = flipped ? 63 - a.to : a.to;
      const cell = $('board').clientWidth / 8;
      const dx = ((iFrom % 8) - (iTo % 8)) * cell;
      const dy = ((iFrom >> 3) - (iTo >> 3)) * cell;
      const cellEl = $('board').children[iTo];
      if (cellEl) window.Anim.slide(cellEl.querySelector('.piece'), dx, dy);
    }

    // Status
    const st = $('status');
    if (endText) { st.textContent = endText; st.className = 'ende'; }
    else {
      st.className = '';
      if (thinking) st.textContent = 'KI denkt …';
      else if (mode === 'online' && !net) st.textContent = 'Online-Modus';
      else if (net && net.aktiv) {
        const dran = cur.turn === net.myColor;
        st.textContent = (dran ? 'Du bist am Zug' : 'Gegner am Zug') + (checkSq >= 0 ? ' – Schach!' : '');
      } else {
        const who = cur.turn === 'w' ? 'Weiß' : 'Schwarz';
        st.textContent = who + ' ist am Zug' + (checkSq >= 0 ? ' – Schach!' : '');
      }
    }

    // Geschlagene Figuren
    const init = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const count = { w: {}, b: {} };
    for (const p of cur.board) if (p !== '' && p.toLowerCase() !== 'k') {
      const col = E.isWhite(p) ? 'w' : 'b', t = p.toLowerCase();
      count[col][t] = (count[col][t] || 0) + 1;
    }
    const lost = col => 'qrbnp'.split('').map(t =>
      ('<img class="mini" src="pieces/' + col + t.toUpperCase() + '.svg" alt="">').repeat(Math.max(0, init[t] - (count[col][t] || 0)))).join('');
    $('geschlagen').innerHTML =
      '<small>Weiß schlug</small><div class="reihe">' + lost('b') + '</div>' +
      '<small>Schwarz schlug</small><div class="reihe">' + lost('w') + '</div>';

    // Zugliste
    let z = '';
    for (let i = 0; i < history.length; i += 2) {
      z += '<span class="nr">' + (i / 2 + 1) + '.</span><span>' + history[i].san + '</span><span>' +
        (history[i + 1] ? history[i + 1].san : '') + '</span>';
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

  // Schnittstelle für die Online-Steuerung.
  window.SchachUI = {
    startOnline: startOnline,
    syncMoves: syncMoves,
    setHandlers: function (h) {
      if (h && h.onLocalMove) onLocalMove = h.onLocalMove;
      if (h && h.onModeChange) onModeChange = h.onModeChange;
    }
  };

  newGame();
})();
