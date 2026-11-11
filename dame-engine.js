// Dame (deutsche Regeln, 8×8): Regeln + KI. Zustandslos; exportiert window.Dame.
// Brett: 64 Felder, Index = Reihe*8 + Spalte, Reihe 0 ist oben (Schwarz), Weiß unten und beginnt.
// 'w'/'b' = Stein, 'W'/'B' = Dame. Gespielt wird auf den dunklen Feldern ((r+c) ungerade).
// Zug: { path: [start, …, ziel], caps: [geschlagene Felder] }
(function (root) {
  'use strict';
  const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const isW = p => p === 'w' || p === 'W';
  const colorOf = p => (p === '' ? null : (isW(p) ? 'w' : 'b'));
  const isKing = p => p === 'W' || p === 'B';
  const opp = c => (c === 'w' ? 'b' : 'w');
  const inB = (r, c) => r >= 0 && r <= 7 && c >= 0 && c <= 7;

  function start() {
    const b = new Array(64).fill('');
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) { if (r < 3) b[r * 8 + c] = 'b'; else if (r > 4) b[r * 8 + c] = 'w'; }
    }
    return { board: b, turn: 'w', quiet: 0 };
  }

  // Alle vollständigen Schlagfolgen des Steins auf `from`.
  function captures(b, from) {
    const p = b[from], col = colorOf(p), king = isKing(p), out = [];
    const fwd = col === 'w' ? -1 : 1;
    function rec(sq, path, caps) {
      let found = false;
      const r = sq >> 3, c = sq & 7;
      for (const d of DIRS) {
        const dr = d[0], dc = d[1];
        if (!king) {
          if (dr !== fwd) continue;
          const lr = r + 2 * dr, lc = c + 2 * dc;
          if (!inB(lr, lc)) continue;
          const mid = (r + dr) * 8 + (c + dc), land = lr * 8 + lc, q = b[mid];
          if (q === '' || colorOf(q) === col || caps.includes(mid)) continue;
          if (b[land] !== '' && land !== from) continue;
          found = true;
          rec(land, path.concat(land), caps.concat(mid));
        } else {
          let rr = r + dr, cc = c + dc, mid = -1;
          while (inB(rr, cc)) {
            const i = rr * 8 + cc, q = (i === from) ? '' : b[i];
            if (mid < 0) {
              if (q !== '') { if (colorOf(q) === col || caps.includes(i)) break; mid = i; }
            } else {
              if (q !== '') break;
              found = true;
              rec(i, path.concat(i), caps.concat(mid));
            }
            rr += dr; cc += dc;
          }
        }
      }
      if (!found && caps.length) out.push({ path: path, caps: caps });
    }
    rec(from, [from], []);
    return out;
  }

  function legal(s) {
    const b = s.board, t = s.turn;
    let caps = [];
    for (let i = 0; i < 64; i++) if (b[i] !== '' && colorOf(b[i]) === t) caps = caps.concat(captures(b, i));
    if (caps.length) return caps;          // Schlagzwang
    const out = [], fwd = t === 'w' ? -1 : 1;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (p === '' || colorOf(p) !== t) continue;
      const r = i >> 3, c = i & 7;
      for (const d of DIRS) {
        if (!isKing(p)) {
          if (d[0] !== fwd) continue;
          const rr = r + d[0], cc = c + d[1];
          if (inB(rr, cc) && b[rr * 8 + cc] === '') out.push({ path: [i, rr * 8 + cc], caps: [] });
        } else {
          let rr = r + d[0], cc = c + d[1];
          while (inB(rr, cc) && b[rr * 8 + cc] === '') { out.push({ path: [i, rr * 8 + cc], caps: [] }); rr += d[0]; cc += d[1]; }
        }
      }
    }
    return out;
  }

  function make(s, m) {
    const b = s.board.slice();
    const from = m.path[0], to = m.path[m.path.length - 1];
    let p = b[from];
    const man = !isKing(p);
    b[from] = '';
    for (const c of m.caps) b[c] = '';
    if (man && ((p === 'w' && (to >> 3) === 0) || (p === 'b' && (to >> 3) === 7))) p = p.toUpperCase();
    b[to] = p;
    return { board: b, turn: opp(s.turn), quiet: (m.caps.length || man) ? 0 : s.quiet + 1 };
  }

  // 'loss' = Spieler am Zug hat verloren, 'draw' = Remis, null = läuft.
  function status(s, legalList) {
    const l = legalList || legal(s);
    if (!l.length) return 'loss';
    if (s.quiet >= 40) return 'draw';
    return null;
  }

  const sqName = sq => 'abcdefgh'[sq & 7] + (8 - (sq >> 3));
  const moveText = m => m.path.map(sqName).join(m.caps.length ? 'x' : '-');
  const sameMove = (m, path) => m.path.length === path.length && m.path.every((x, i) => x === path[i]);

  // ---------- KI ----------
  const MATE = 100000, INF = 1e9;

  function evaluate(s) {
    let sc = 0;
    const b = s.board;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (p === '') continue;
      const r = i >> 3, c = i & 7, w = isW(p);
      let v;
      if (isKing(p)) v = 330;
      else {
        v = 100 + (w ? 7 - r : r) * 4;
        if (c === 0 || c === 7) v += 4;                       // Randsteine sind nicht schlagbar
        if ((w && r === 7) || (!w && r === 0)) v += 8;         // Grundreihe halten
      }
      sc += w ? v : -v;
    }
    return s.turn === 'w' ? sc : -sc;
  }

  function search(s, depth, alpha, beta, ply) {
    const moves = legal(s);
    if (!moves.length) return -MATE + ply;
    if (s.quiet >= 40) return 0;
    // Ruhesuche: laufende Schlagwechsel zu Ende rechnen.
    if (depth <= 0 && (!moves[0].caps.length || ply > 24)) return evaluate(s);
    moves.sort((a, b) => b.caps.length - a.caps.length);
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
    const depth = [0, 2, 4, 7, 9][level] || 4;
    const noise = level === 1 ? 60 : 0;
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = moves[i]; moves[i] = moves[j]; moves[j] = t;
    }
    let best = null, bestSc = -INF;
    for (const m of moves) {
      let sc = -search(make(s, m), depth - 1, -INF, noise ? INF : -bestSc, 1);
      if (noise) sc += Math.random() * noise;
      if (sc > bestSc) { bestSc = sc; best = m; }
    }
    return best;
  }

  const api = { start, legal, make, status, bestMove, captures, sqName, moveText, sameMove, colorOf, isKing, isW };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Dame = api;
})(typeof window !== 'undefined' ? window : this);
