/* Schach-Engine: Regeln + Minimax (Alpha-Beta). Brett: Index 0..63, 0 = a8, 63 = h1. */
(function (root) {
  'use strict';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const ORTH = [[-1,0],[1,0],[0,-1],[0,1]];

  const isWhite = p => p >= 'A' && p <= 'Z';
  const colorOf = p => (p === '' ? null : (isWhite(p) ? 'w' : 'b'));

  function fromFEN(fen) {
    const parts = fen.split(' ');
    const board = [];
    for (const ch of parts[0]) {
      if (ch === '/') continue;
      if (ch >= '1' && ch <= '8') for (let i = 0; i < +ch; i++) board.push('');
      else board.push(ch);
    }
    const cs = parts[2] || '-';
    const epS = parts[3] || '-';
    return {
      board, turn: parts[1] || 'w',
      castle: { K: cs.includes('K'), Q: cs.includes('Q'), k: cs.includes('k'), q: cs.includes('q') },
      ep: epS === '-' ? -1 : (8 - +epS[1]) * 8 + (epS.charCodeAt(0) - 97),
      half: +(parts[4] || 0), full: +(parts[5] || 1)
    };
  }

  function attacked(b, sq, by) {
    const r = sq >> 3, c = sq & 7, w = by === 'w';
    const pr = w ? r + 1 : r - 1, pawn = w ? 'P' : 'p';
    if (pr >= 0 && pr < 8) {
      if (c > 0 && b[pr * 8 + c - 1] === pawn) return true;
      if (c < 7 && b[pr * 8 + c + 1] === pawn) return true;
    }
    const N = w ? 'N' : 'n', K = w ? 'K' : 'k', B = w ? 'B' : 'b', R = w ? 'R' : 'r', Q = w ? 'Q' : 'q';
    for (const [dr, dc] of KN) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === N) return true;
    }
    for (const [dr, dc] of KG) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === K) return true;
    }
    for (const [dr, dc] of DIAG) {
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const p = b[rr * 8 + cc];
        if (p !== '') { if (p === B || p === Q) return true; break; }
        rr += dr; cc += dc;
      }
    }
    for (const [dr, dc] of ORTH) {
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const p = b[rr * 8 + cc];
        if (p !== '') { if (p === R || p === Q) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  }

  function gen(s, capOnly) {
    const b = s.board, w = s.turn === 'w', moves = [];
    const enemy = p => p !== '' && isWhite(p) !== w;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (p === '' || isWhite(p) !== w) continue;
      const r = i >> 3, c = i & 7, t = p.toLowerCase();
      if (t === 'p') {
        const dir = w ? -1 : 1, start = w ? 6 : 1, last = w ? 0 : 7;
        const add = (to) => {
          if ((to >> 3) === last) for (const pr of 'qrbn') moves.push({ from: i, to, promo: pr, flag: null });
          else moves.push({ from: i, to, promo: null, flag: null });
        };
        const r1 = r + dir;
        if (r1 < 0 || r1 > 7) continue;
        if (!capOnly && b[r1 * 8 + c] === '') {
          add(r1 * 8 + c);
          if (r === start && b[(r + 2 * dir) * 8 + c] === '')
            moves.push({ from: i, to: (r + 2 * dir) * 8 + c, promo: null, flag: 'double' });
        }
        for (const dc of [-1, 1]) {
          const cc = c + dc;
          if (cc < 0 || cc > 7) continue;
          const to = r1 * 8 + cc;
          if (enemy(b[to])) add(to);
          else if (to === s.ep) moves.push({ from: i, to, promo: null, flag: 'ep' });
        }
      } else if (t === 'n' || t === 'k') {
        for (const [dr, dc] of (t === 'n' ? KN : KG)) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
          const to = rr * 8 + cc, q = b[to];
          if (q !== '' && isWhite(q) === w) continue;
          if (capOnly && q === '') continue;
          moves.push({ from: i, to, promo: null, flag: null });
        }
        if (t === 'k' && !capOnly) {
          if (w && i === 60) {
            if (s.castle.K && b[63] === 'R' && b[61] === '' && b[62] === '' &&
              !attacked(b, 60, 'b') && !attacked(b, 61, 'b') && !attacked(b, 62, 'b'))
              moves.push({ from: 60, to: 62, promo: null, flag: 'castleK' });
            if (s.castle.Q && b[56] === 'R' && b[57] === '' && b[58] === '' && b[59] === '' &&
              !attacked(b, 60, 'b') && !attacked(b, 59, 'b') && !attacked(b, 58, 'b'))
              moves.push({ from: 60, to: 58, promo: null, flag: 'castleQ' });
          } else if (!w && i === 4) {
            if (s.castle.k && b[7] === 'r' && b[5] === '' && b[6] === '' &&
              !attacked(b, 4, 'w') && !attacked(b, 5, 'w') && !attacked(b, 6, 'w'))
              moves.push({ from: 4, to: 6, promo: null, flag: 'castleK' });
            if (s.castle.q && b[0] === 'r' && b[1] === '' && b[2] === '' && b[3] === '' &&
              !attacked(b, 4, 'w') && !attacked(b, 3, 'w') && !attacked(b, 2, 'w'))
              moves.push({ from: 4, to: 2, promo: null, flag: 'castleQ' });
          }
        }
      } else {
        const dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : DIAG.concat(ORTH);
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            const to = rr * 8 + cc, q = b[to];
            if (q !== '') {
              if (isWhite(q) !== w) moves.push({ from: i, to, promo: null, flag: null });
              break;
            }
            if (!capOnly) moves.push({ from: i, to, promo: null, flag: null });
            rr += dr; cc += dc;
          }
        }
      }
    }
    return moves;
  }

  function make(s, m) {
    const b = s.board.slice();
    const p = b[m.from], w = isWhite(p), cap = b[m.to];
    b[m.to] = p; b[m.from] = '';
    if (m.flag === 'ep') b[m.to + (w ? 8 : -8)] = '';
    if (m.flag === 'castleK') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ''; }
    if (m.flag === 'castleQ') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ''; }
    if (m.promo) b[m.to] = w ? m.promo.toUpperCase() : m.promo;
    const cr = { K: s.castle.K, Q: s.castle.Q, k: s.castle.k, q: s.castle.q };
    if (p === 'K') cr.K = cr.Q = false;
    if (p === 'k') cr.k = cr.q = false;
    if (m.from === 63 || m.to === 63) cr.K = false;
    if (m.from === 56 || m.to === 56) cr.Q = false;
    if (m.from === 7 || m.to === 7) cr.k = false;
    if (m.from === 0 || m.to === 0) cr.q = false;
    return {
      board: b, turn: w ? 'b' : 'w', castle: cr,
      ep: m.flag === 'double' ? (m.from + m.to) / 2 : -1,
      half: (p.toLowerCase() === 'p' || cap !== '' || m.flag === 'ep') ? 0 : s.half + 1,
      full: s.full + (w ? 0 : 1)
    };
  }

  const kingSq = (b, color) => b.indexOf(color === 'w' ? 'K' : 'k');
  const opp = c => (c === 'w' ? 'b' : 'w');
  const inCheck = (s, color) => attacked(s.board, kingSq(s.board, color), opp(color));

  function legal(s) {
    const out = [];
    for (const m of gen(s, false)) {
      const ns = make(s, m);
      if (!attacked(ns.board, kingSq(ns.board, s.turn), opp(s.turn))) out.push(m);
    }
    return out;
  }

  function insufficient(b) {
    const rest = b.filter(p => p !== '' && p.toLowerCase() !== 'k');
    if (rest.length === 0) return true;
    if (rest.length === 1 && 'nb'.includes(rest[0].toLowerCase())) return true;
    return false;
  }

  /* 'play' | 'checkmate' | 'stalemate' | 'fifty' | 'material' */
  function status(s, legalList) {
    const l = legalList || legal(s);
    if (l.length === 0) return inCheck(s, s.turn) ? 'checkmate' : 'stalemate';
    if (insufficient(s.board)) return 'material';
    if (s.half >= 100) return 'fifty';
    return 'play';
  }

  const posKey = s => s.board.join('|') + s.turn +
    (s.castle.K ? 'K' : '') + (s.castle.Q ? 'Q' : '') + (s.castle.k ? 'k' : '') + (s.castle.q ? 'q' : '');

  function san(s, m, legalList) {
    const p = s.board[m.from], t = p.toLowerCase();
    const f = sq => 'abcdefgh'[sq & 7], rk = sq => 8 - (sq >> 3);
    let out;
    if (m.flag === 'castleK') out = 'O-O';
    else if (m.flag === 'castleQ') out = 'O-O-O';
    else {
      const cap = s.board[m.to] !== '' || m.flag === 'ep';
      if (t === 'p') {
        out = (cap ? f(m.from) + 'x' : '') + f(m.to) + rk(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
      } else {
        let dis = '';
        const others = legalList.filter(o => o.from !== m.from && o.to === m.to && s.board[o.from] === p);
        if (others.length) {
          if (others.every(o => (o.from & 7) !== (m.from & 7))) dis = f(m.from);
          else if (others.every(o => (o.from >> 3) !== (m.from >> 3))) dis = '' + rk(m.from);
          else dis = f(m.from) + rk(m.from);
        }
        out = t.toUpperCase() + dis + (cap ? 'x' : '') + f(m.to) + rk(m.to);
      }
    }
    const ns = make(s, m);
    if (inCheck(ns, ns.turn)) out += legal(ns).length ? '+' : '#';
    return out;
  }

  /* ---------- KI ---------- */
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const PST = {
    p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
        0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
        -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
        -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
        0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
        20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
  };
  const MATE = 100000, INF = 1e9;

  function evaluate(s) {
    let sc = 0;
    const b = s.board;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (p === '') continue;
      const t = p.toLowerCase(), w = isWhite(p);
      const v = VAL[t] + PST[t][w ? i : (7 - (i >> 3)) * 8 + (i & 7)];
      sc += w ? v : -v;
    }
    return s.turn === 'w' ? sc : -sc;
  }

  function orderMoves(moves, b) {
    const score = m => {
      const cap = b[m.to] !== '' ? b[m.to] : (m.flag === 'ep' ? 'p' : '');
      let sc = 0;
      if (cap !== '') sc += 10 * VAL[cap.toLowerCase()] - VAL[b[m.from].toLowerCase()] + 1000;
      if (m.promo) sc += VAL[m.promo] + 900;
      return sc;
    };
    return moves.map(m => ({ m, s: score(m) })).sort((x, y) => y.s - x.s).map(x => x.m);
  }

  function quiesce(s, alpha, beta, qd) {
    const stand = evaluate(s);
    if (qd === 0 || stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    for (const m of orderMoves(gen(s, true), s.board)) {
      const ns = make(s, m);
      if (attacked(ns.board, kingSq(ns.board, s.turn), opp(s.turn))) continue;
      const sc = -quiesce(ns, -beta, -alpha, qd - 1);
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function search(s, depth, alpha, beta, ply) {
    if (depth <= 0) return quiesce(s, alpha, beta, 4);
    let legalCount = 0, best = -INF;
    for (const m of orderMoves(gen(s, false), s.board)) {
      const ns = make(s, m);
      if (attacked(ns.board, kingSq(ns.board, s.turn), opp(s.turn))) continue;
      legalCount++;
      const sc = -search(ns, depth - 1, -beta, -alpha, ply + 1);
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    if (legalCount === 0) return inCheck(s, s.turn) ? -MATE + ply : 0;
    return best;
  }

  /* level 1 = leicht (macht Fehler), 2 = mittel, 3 = schwer, 4 = sehr schwer */
  function bestMove(s, level) {
    const depth = [0, 1, 2, 3, 4][level] || 2;
    const noise = level === 1 ? 90 : 0;
    const moves = legal(s);
    if (!moves.length) return null;
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }
    let best = null, alpha = -INF;
    for (const m of orderMoves(moves, s.board)) {
      const ns = make(s, m);
      let sc = -search(ns, depth - 1, noise ? -INF : -INF, noise ? INF : -alpha, 1);
      if (noise) sc += Math.random() * noise;
      if (best === null || sc > alpha) { alpha = sc; best = m; }
    }
    return best;
  }

  const api = { START_FEN, fromFEN, legal, make, inCheck, status, san, bestMove, posKey, colorOf, isWhite, attacked };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Chess = api;
})(typeof window !== 'undefined' ? window : globalThis);
