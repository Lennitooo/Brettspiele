// Mühle: Regeln + KI. Zustandslos; exportiert window.Muehle.
// 24 Punkte, nummeriert zeilenweise von oben links. XY = Position im 7×7-Raster.
// Zug: { from: null|Punkt, to: Punkt, remove: null|Punkt }  (from = null in der Setzphase)
(function (root) {
  'use strict';
  const XY = [
    [0, 0], [3, 0], [6, 0],
    [1, 1], [3, 1], [5, 1],
    [2, 2], [3, 2], [4, 2],
    [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
    [2, 4], [3, 4], [4, 4],
    [1, 5], [3, 5], [5, 5],
    [0, 6], [3, 6], [6, 6]
  ];
  const ADJ = [
    [1, 9], [0, 2, 4], [1, 14],
    [4, 10], [1, 3, 5, 7], [4, 13],
    [7, 11], [4, 6, 8], [7, 12],
    [0, 10, 21], [3, 9, 11, 18], [6, 10, 15], [8, 13, 17], [5, 12, 14, 20], [2, 13, 23],
    [11, 16], [15, 17, 19], [12, 16],
    [10, 19], [16, 18, 20, 22], [13, 19],
    [9, 22], [19, 21, 23], [14, 22]
  ];
  const MILLS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
    [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23]
  ];
  const MILLS_AT = Array.from({ length: 24 }, () => []);
  MILLS.forEach(m => m.forEach(p => MILLS_AT[p].push(m)));
  const opp = c => (c === 'w' ? 'b' : 'w');

  function start() { return { board: new Array(24).fill(''), turn: 'w', hand: { w: 9, b: 9 }, quiet: 0 }; }

  function count(b, col) { let n = 0; for (let i = 0; i < 24; i++) if (b[i] === col) n++; return n; }

  function millAt(b, p, col) {
    for (const m of MILLS_AT[p]) if (b[m[0]] === col && b[m[1]] === col && b[m[2]] === col) return true;
    return false;
  }

  // Gegnerische Steine, die entfernt werden dürfen (Steine in einer Mühle sind geschützt,
  // außer alle gegnerischen Steine stehen in Mühlen).
  function removable(b, col) {
    const all = [], frei = [];
    for (let i = 0; i < 24; i++) if (b[i] === col) { all.push(i); if (!millAt(b, i, col)) frei.push(i); }
    return frei.length ? frei : all;
  }

  // 'setzen' | 'ziehen' | 'springen' für die Farbe col.
  function phase(s, col) {
    if (s.hand[col] > 0) return 'setzen';
    return count(s.board, col) === 3 ? 'springen' : 'ziehen';
  }

  function legal(s) {
    const b = s.board, t = s.turn, o = opp(t), basics = [], out = [];
    if (s.hand[t] > 0) {
      for (let i = 0; i < 24; i++) if (b[i] === '') basics.push([null, i]);
    } else {
      const n = count(b, t);
      if (n < 3) return [];
      for (let f = 0; f < 24; f++) {
        if (b[f] !== t) continue;
        if (n === 3) { for (let i = 0; i < 24; i++) if (b[i] === '') basics.push([f, i]); }
        else for (const i of ADJ[f]) if (b[i] === '') basics.push([f, i]);
      }
    }
    let rem = null;
    for (const bm of basics) {
      const f = bm[0], to = bm[1];
      if (f !== null) b[f] = '';
      b[to] = t;
      const mill = millAt(b, to, t);
      b[to] = '';
      if (f !== null) b[f] = t;
      if (mill) {
        if (!rem) rem = removable(b, o);
        if (rem.length) { for (const r of rem) out.push({ from: f, to: to, remove: r }); continue; }
      }
      out.push({ from: f, to: to, remove: null });
    }
    return out;
  }

  function make(s, m) {
    const b = s.board.slice(), t = s.turn;
    const hand = { w: s.hand.w, b: s.hand.b };
    if (m.from === null) hand[t]--; else b[m.from] = '';
    b[m.to] = t;
    if (m.remove !== null) b[m.remove] = '';
    return { board: b, turn: opp(t), hand: hand, quiet: (m.remove !== null || m.from === null) ? 0 : s.quiet + 1 };
  }

  // 'loss' = Spieler am Zug hat verloren, 'draw' = Remis, null = läuft.
  function status(s, legalList) {
    const l = legalList || legal(s);
    if (!l.length) return 'loss';
    if (s.quiet >= 50) return 'draw';
    return null;
  }

  const posKey = s => s.board.map(x => x || '.').join('') + s.turn + s.hand.w + s.hand.b;
  const name = p => 'abcdefg'[XY[p][0]] + (7 - XY[p][1]);
  const moveText = m => (m.from === null ? name(m.to) : name(m.from) + '-' + name(m.to)) + (m.remove !== null ? ' x' + name(m.remove) : '');
  const sameMove = (a, b) => (a.from === null ? null : a.from) === (b.from === undefined || b.from === null ? null : b.from)
    && a.to === b.to && (a.remove === null ? null : a.remove) === (b.remove === undefined || b.remove === null ? null : b.remove);

  // ---------- KI ----------
  const MATE = 100000, INF = 1e9;

  function evalSide(s, col) {
    const b = s.board;
    let sc = (count(b, col) + s.hand[col]) * 100;
    for (const m of MILLS) {
      let a = 0, e = 0;
      for (let k = 0; k < 3; k++) { if (b[m[k]] === col) a++; else if (b[m[k]] === '') e++; }
      if (a === 3) sc += 25; else if (a === 2 && e === 1) sc += 12;
    }
    if (s.hand[col] === 0) {
      for (let i = 0; i < 24; i++) if (b[i] === col) for (const j of ADJ[i]) if (b[j] === '') sc += 2;
    }
    return sc;
  }
  const evaluate = s => evalSide(s, s.turn) - evalSide(s, opp(s.turn));

  function search(s, depth, alpha, beta, ply) {
    const moves = legal(s);
    if (!moves.length) return -MATE + ply;
    if (s.quiet >= 50) return 0;
    if (depth <= 0) return evaluate(s);
    moves.sort((a, b) => (b.remove !== null) - (a.remove !== null));
    let best = -INF;
    for (const m of moves) {
      const sc = -search(make(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMove(s, level) {
    const moves = legal(s);
    if (!moves.length) return null;
    let depth = [0, 1, 3, 5, 6][level] || 3;
    // Beim Springen gibt es sehr viele Züge: Suchtiefe begrenzen, damit die KI flott bleibt.
    if (phase(s, 'w') === 'springen' || phase(s, 'b') === 'springen') depth = Math.min(depth, 4);
    const noise = level === 1 ? 40 : 0;
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = moves[i]; moves[i] = moves[j]; moves[j] = t;
    }
    moves.sort((a, b) => (b.remove !== null) - (a.remove !== null));
    let best = null, bestSc = -INF;
    for (const m of moves) {
      let sc = -search(make(s, m), depth - 1, -INF, noise ? INF : -bestSc, 1);
      if (noise) sc += Math.random() * noise;
      if (sc > bestSc) { bestSc = sc; best = m; }
    }
    return best;
  }

  const api = { XY, ADJ, MILLS, start, legal, make, status, phase, count, millAt, removable, posKey, name, moveText, sameMove, bestMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Muehle = api;
})(typeof window !== 'undefined' ? window : this);
