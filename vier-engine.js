// Vier gewinnt: Regeln + KI. Zustandslos; exportiert window.Vier.
// Brett: 42 Felder, Index = Reihe*7 + Spalte, Reihe 0 ist oben. 'w' = Rot (beginnt), 'b' = Gelb.
(function (root) {
  'use strict';
  const C = 7, R = 6, N = 42;
  const LINES = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    for (const d of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const rr = r + 3 * d[0], cc = c + 3 * d[1];
      if (rr < 0 || rr >= R || cc < 0 || cc >= C) continue;
      LINES.push([0, 1, 2, 3].map(k => (r + k * d[0]) * C + (c + k * d[1])));
    }
  }
  const THROUGH = Array.from({ length: N }, () => []);
  LINES.forEach(l => l.forEach(i => THROUGH[i].push(l)));
  const opp = c => (c === 'w' ? 'b' : 'w');

  function start() { return { board: new Array(N).fill(''), turn: 'w', last: -1 }; }

  function landing(b, c) {
    for (let r = R - 1; r >= 0; r--) if (b[r * C + c] === '') return r * C + c;
    return -1;
  }

  // Alle Felder, die zu einer Viererreihe durch Feld i gehören (oder null).
  function winCells(b, i) {
    if (i < 0 || b[i] === '') return null;
    const col = b[i], out = [];
    for (const l of THROUGH[i]) {
      if (b[l[0]] === col && b[l[1]] === col && b[l[2]] === col && b[l[3]] === col) {
        for (const x of l) if (!out.includes(x)) out.push(x);
      }
    }
    return out.length ? out : null;
  }

  function status(s) {
    const line = winCells(s.board, s.last);
    if (line) return { end: 'win', winner: s.board[s.last], line: line };
    if (s.board.every(x => x !== '')) return { end: 'draw', winner: null, line: null };
    return { end: null, winner: null, line: null };
  }

  // Spielbare Spalten (leer, wenn die Partie vorbei ist).
  function legal(s) {
    if (winCells(s.board, s.last)) return [];
    const out = [];
    for (let c = 0; c < C; c++) if (s.board[c] === '') out.push(c);
    return out;
  }

  function make(s, c) {
    const i = landing(s.board, c);
    if (i < 0) return null;
    const b = s.board.slice();
    b[i] = s.turn;
    return { board: b, turn: opp(s.turn), last: i };
  }

  // ---------- KI ----------
  const W = [0, 1, 8, 60, 1000];
  const WIN = 100000, INF = 1e9;
  const ORDER = [3, 2, 4, 1, 5, 0, 6];

  function evaluate(b, col) {
    let sc = 0;
    for (const l of LINES) {
      let a = 0, o = 0;
      for (let k = 0; k < 4; k++) { const v = b[l[k]]; if (v === col) a++; else if (v !== '') o++; }
      if (a && o) continue;
      if (a) sc += W[a]; else if (o) sc -= W[o];
    }
    for (let r = 0; r < R; r++) { const v = b[r * C + 3]; if (v === col) sc += 3; else if (v !== '') sc -= 3; }
    return sc;
  }

  function wins(b, i) {
    const col = b[i];
    for (const l of THROUGH[i]) if (b[l[0]] === col && b[l[1]] === col && b[l[2]] === col && b[l[3]] === col) return true;
    return false;
  }

  function bestMove(s, level) {
    if (!legal(s).length) return null;
    const depth = [0, 2, 4, 7, 10][level] || 4;
    const noise = level === 1 ? 30 : 0;
    const b = s.board.slice();

    function nega(d, alpha, beta, col, ply) {
      let any = false, best = -INF;
      for (const c of ORDER) {
        const i = landing(b, c);
        if (i < 0) continue;
        any = true;
        b[i] = col;
        let sc;
        if (wins(b, i)) sc = WIN - ply;
        else if (d <= 1) sc = evaluate(b, col);
        else sc = -nega(d - 1, -beta, -alpha, opp(col), ply + 1);
        b[i] = '';
        if (sc > best) best = sc;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return any ? best : 0;
    }

    let bestC = null, bestSc = -INF;
    for (const c of ORDER) {
      const i = landing(b, c);
      if (i < 0) continue;
      b[i] = s.turn;
      let sc;
      if (wins(b, i)) sc = WIN;
      else if (depth <= 1) sc = evaluate(b, s.turn);
      else sc = -nega(depth - 1, -INF, noise ? INF : -bestSc, opp(s.turn), 1);
      b[i] = '';
      if (noise && sc < WIN - 50) sc += Math.random() * noise;
      if (sc > bestSc) { bestSc = sc; bestC = c; }
    }
    return bestC;
  }

  const api = { COLS: C, ROWS: R, start, legal, make, status, bestMove, landing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Vier = api;
})(typeof window !== 'undefined' ? window : this);
