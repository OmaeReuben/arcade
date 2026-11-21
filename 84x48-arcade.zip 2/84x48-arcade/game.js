(() => {
'use strict';
const W = 84, H = 48, S = 6, TPS = 30;
const canvas = document.getElementById('lcd');
const ctx = canvas.getContext('2d');
const css = getComputedStyle(document.documentElement);
const BG = css.getPropertyValue('--lcd').trim() || '#c7f0d8';
const ON = css.getPropertyValue('--lcd-ink').trim() || '#43523d';

/* ---------- framebuffer ---------- */
const fb = new Uint8Array(W * H);
const grid = document.createElement('canvas');
grid.width = W * S; grid.height = H * S;
{
  const g = grid.getContext('2d');
  g.fillStyle = BG; g.fillRect(0, 0, W * S, H * S);
  g.fillStyle = 'rgba(67,82,61,.07)';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.fillRect(x * S, y * S, S - 1, S - 1);
}
function render() {
  ctx.drawImage(grid, 0, 0);
  ctx.fillStyle = ON;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (fb[y * W + x]) ctx.fillRect(x * S, y * S, S - 1, S - 1);
}
const cls = () => fb.fill(0);
function px(x, y, v = 1) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) fb[y * W + x] = v; }
function rect(x, y, w, h, v = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, v); }
function box(x, y, w, h) { rect(x, y, w, 1); rect(x, y + h - 1, w, 1); rect(x, y, 1, h); rect(x + w - 1, y, 1, h); }
function sprite(rows, x, y, v = 1) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') px(x + i, y + j, v);
}
/* 3x5 font: five rows per glyph, each digit is a 3-bit row */
const FONT = {
  A:'25755',B:'65656',C:'34443',D:'65556',E:'74647',F:'74644',G:'34553',H:'55755',I:'72227',J:'11152',
  K:'55655',L:'44447',M:'57755',N:'65555',O:'25552',P:'65644',Q:'25573',R:'65655',S:'34216',T:'72222',
  U:'55557',V:'55552',W:'55775',X:'55255',Y:'55222',Z:'71247',
  0:'75557',1:'26227',2:'61247',3:'61216',4:'55711',5:'74616',6:'34757',7:'71222',8:'75757',9:'75716',
  '-':'00700',':':'02020','.':'00002','!':'22202','>':'42124','/':'11244'
};
function text(s, x, y, v = 1) {
  s = String(s).toUpperCase();
  for (const ch of s) {
    const g = FONT[ch];
    if (g) for (let r = 0; r < 5; r++) { const row = +g[r]; for (let c = 0; c < 3; c++) if (row & (4 >> c)) px(x + c, y + r, v); }
    x += 4;
  }
}
const tw = s => String(s).length * 4 - 1;
const textC = (s, y, v) => text(s, Math.round((W - tw(s)) / 2), y, v);
const textR = (s, x, y, v) => text(s, x - tw(s), y, v);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rnd = n => Math.floor(Math.random() * n);
function hud(label, right) { text(label, 1, 1); textR(right, W - 1, 1); rect(0, 7, W, 1); }

/* ---------- sound ---------- */
let ac = null, sound = true;
function unlock() {
  if (!sound) return;
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {}
}
function beep(f = 880, d = 0.05) {
  if (!sound || !ac || ac.state !== 'running') return;
  try {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = f; g.gain.value = 0.04;
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
  } catch (e) {}
}

/* ---------- input ---------- */
const held = { up: 0, down: 0, left: 0, right: 0, ok: 0, back: 0 };
const pressed = [];
const hit = k => pressed.includes(k);
function press(k) { if (!held[k]) { held[k] = 1; pressed.push(k); } }
function release(k) { held[k] = 0; }
const KEYMAP = {
  ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
  w:'up', s:'down', a:'left', d:'right', W:'up', S:'down', A:'left', D:'right',
  Enter:'ok', ' ':'ok', Escape:'back', Backspace:'back'
};
const soundKey = document.getElementById('key-sound');
function toggleSound() {
  sound = !sound; soundKey.setAttribute('aria-pressed', String(sound));
  soundKey.style.opacity = sound ? '1' : '.55';
  if (sound) { unlock(); }
}
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') { toggleSound(); return; }
  const k = KEYMAP[e.key];
  if (!k) return;
  e.preventDefault(); unlock(); press(k);
});
addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) release(k); });
addEventListener('blur', () => { for (const k in held) held[k] = 0; });
document.querySelectorAll('.key[data-k]').forEach(b => {
  const k = b.dataset.k;
  const up = () => { release(k); b.classList.remove('is-down'); };
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); unlock(); press(k); b.classList.add('is-down');
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
  });
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
  b.addEventListener('click', unlock);
  /* keyboard activation of a focused key */
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); press(k); } });
  b.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); release(k); } });
});
soundKey.addEventListener('click', toggleSound);

/* ---------- scores ---------- */
const STORE = 'arcade84-best';
let best = {};
try { best = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { best = {}; }
function saveBest() { try { localStorage.setItem(STORE, JSON.stringify(best)); } catch (e) {} }

/* ---------- games ---------- */
function snake(end) {
  const CW = 20, CH = 9, OX = 2, OY = 9;
  let body = [{ x: 6, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 4 }];
  let dir = { x: 1, y: 0 }, q = [], food, score = 0, t = 0;
  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const on = (x, y) => body.some(b => b.x === x && b.y === y);
  const place = () => { do { food = { x: rnd(CW), y: rnd(CH) }; } while (on(food.x, food.y)); };
  place();
  return {
    get score() { return score; },
    update() {
      for (const k of pressed) {
        const d = DIRS[k]; if (!d) continue;
        const l = q.length ? q[q.length - 1] : dir;
        if (q.length < 2 && !(d.x === -l.x && d.y === -l.y) && !(d.x === l.x && d.y === l.y)) q.push(d);
      }
      t++;
      if (t % Math.max(3, 6 - Math.floor(score / 6))) return;
      if (q.length) dir = q.shift();
      const h = { x: body[0].x + dir.x, y: body[0].y + dir.y };
      const tail = body[body.length - 1];
      const hitsBody = body.some(b => b !== tail && b.x === h.x && b.y === h.y);
      if (h.x < 0 || h.y < 0 || h.x >= CW || h.y >= CH || hitsBody) { end(score); return; }
      body.unshift(h);
      if (h.x === food.x && h.y === food.y) {
        score++; beep(1200, 0.06);
        if (body.length >= CW * CH) { end(score); return; }
        place();
      } else body.pop();
    },
    draw() {
      cls(); hud('SNAKE', score); box(1, 8, 82, 38);
      for (const b of body) rect(OX + b.x * 4, OY + b.y * 4, 3, 3);
      sprite(['.#.', '#.#', '.#.'], OX + food.x * 4, OY + food.y * 4);
    }
  };
}

function bricks(end) {
  const PW = 12;
  let pad = 36, bx = 0, by = 0, vx = 0, vy = 0, stuck = true, lives = 3, score = 0, level = 1, br = [];
  const build = () => { br = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) br.push({ x: 2 + c * 8, y: 10 + r * 4, a: 1 }); };
  build();
  return {
    get score() { return score; },
    update() {
      if (held.left) pad -= 2;
      if (held.right) pad += 2;
      pad = clamp(pad, 0, W - PW);
      if (stuck) {
        bx = pad + PW / 2 - 1; by = 42;
        if (hit('ok') || hit('up')) { stuck = false; vx = Math.random() < 0.5 ? -0.6 : 0.6; vy = -1; beep(660); }
        return;
      }
      const sp = Math.min(2.2, 1 + level * 0.2), n = 3;
      for (let i = 0; i < n; i++) {
        const oy = by;
        bx += vx * sp / n; by += vy * sp / n;
        if (bx < 0) { bx = 0; vx = Math.abs(vx); }
        if (bx > W - 2) { bx = W - 2; vx = -Math.abs(vx); }
        if (by < 8) { by = 8; vy = Math.abs(vy); }
        if (vy > 0 && by + 2 >= 44 && oy + 2 <= 45 && bx + 2 > pad && bx < pad + PW) {
          by = 42; vy = -1; vx = clamp(((bx + 1) - (pad + PW / 2)) / (PW / 2), -1, 1) * 1.2; beep(520);
        }
        for (const b of br) {
          if (b.a && bx + 2 > b.x && bx < b.x + 7 && by + 2 > b.y && by < b.y + 3) {
            b.a = 0; score++; beep(990, 0.04);
            if (oy + 2 <= b.y || oy >= b.y + 3) vy = -vy; else vx = -vx;
            break;
          }
        }
        if (by > H) {
          lives--; beep(180, 0.2);
          if (!lives) { end(score); return; }
          stuck = true; break;
        }
      }
      if (br.every(b => !b.a)) { level++; build(); stuck = true; }
    },
    draw() {
      cls(); hud('BRICKS ' + score, 'X' + lives);
      for (const b of br) if (b.a) rect(b.x, b.y, 7, 3);
      rect(pad, 44, PW, 2);
      rect(bx, by, 2, 2);
    }
  };
}

function blaster(end) {
  const SHIP = ['##....', '####..', '.#####', '####..', '##....'];
  const FOES = [
    ['..###', '.##..', '###..', '.##..', '..###'],
    ['.###.', '#.#.#', '#####', '.#.#.', '#...#']
  ];
  let x = 4, y = 21, shots = [], foes = [], t = 0, score = 0, lives = 3, inv = 0;
  const stars = Array.from({ length: 10 }, () => ({ x: rnd(W), y: 9 + rnd(38), s: 0.3 + Math.random() * 0.7 }));
  return {
    get score() { return score; },
    update() {
      t++;
      if (held.up) y -= 1.5; if (held.down) y += 1.5;
      if (held.left) x -= 1.5; if (held.right) x += 1.5;
      x = clamp(x, 0, 44); y = clamp(y, 9, 43);
      if (t % 9 === 0) shots.push({ x: x + 6, y: y + 2 });
      if (t % Math.max(10, 38 - Math.floor(score / 2)) === 0)
        foes.push({ x: W, y: 9 + rnd(34), k: rnd(2), p: Math.random() * 6 });
      for (const s of stars) { s.x -= s.s; if (s.x < 0) { s.x = W; s.y = 9 + rnd(38); } }
      for (const s of shots) s.x += 3;
      shots = shots.filter(s => s.x < W);
      const fs = 0.6 + Math.min(1.2, score / 80);
      for (const f of foes) {
        f.x -= fs;
        if (f.k === 1) f.y = clamp(f.y + Math.sin(t / 8 + f.p) * 0.8, 9, 43);
        for (const s of shots) {
          if (!f.dead && s.x + 2 >= f.x && s.x <= f.x + 5 && s.y >= f.y - 1 && s.y <= f.y + 5) {
            f.dead = 1; s.x = W + 9; score++; beep(1100, 0.04);
          }
        }
        if (!f.dead && !inv && f.x < x + 6 && f.x + 5 > x && f.y < y + 5 && f.y + 5 > y) {
          f.dead = 1; lives--; inv = 45; beep(160, 0.25);
        }
      }
      foes = foes.filter(f => !f.dead && f.x > -6);
      if (inv) inv--;
      if (!lives) end(score);
    },
    draw() {
      cls(); hud('BLASTER ' + score, 'X' + lives);
      for (const s of stars) px(s.x, s.y);
      for (const s of shots) rect(s.x, s.y, 2, 1);
      for (const f of foes) sprite(FOES[f.k], f.x, f.y);
      if (!inv || (t >> 2) & 1) sprite(SHIP, x, y);
    }
  };
}

function pairs(end) {
  const ICONS = [
    ['.#.#.', '#####', '#####', '.###.', '..#..'],
    ['..#..', '.###.', '#####', '.###.', '..#..'],
    ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    ['.###.', '#...#', '#...#', '#...#', '.###.'],
    ['..#..', '..#..', '#####', '..#..', '..#..'],
    ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
    ['#.#.#', '.#.#.', '#.#.#', '.#.#.', '#.#.#'],
    ['#####', '#####', '#####', '#####', '#####'],
    ['#####', '.....', '#####', '.....', '#####']
  ];
  const COLS = 6, ROWS = 3;
  const cards = [];
  for (let i = 0; i < 9; i++) cards.push(i, i);
  for (let i = cards.length - 1; i > 0; i--) { const j = rnd(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  const open = new Array(18).fill(false), done = new Array(18).fill(false);
  let cur = 0, a = -1, b = -1, wait = 0, moves = 0, t = 0, left = 9;
  return {
    get score() { return moves; },
    update() {
      t++;
      if (wait) {
        if (--wait === 0) {
          if (cards[a] === cards[b]) { done[a] = done[b] = true; left--; beep(1300, 0.08); if (!left) { end(moves); return; } }
          else { open[a] = open[b] = false; }
          a = b = -1;
        }
        return;
      }
      let cx = cur % COLS, cy = Math.floor(cur / COLS);
      if (hit('left')) cx = (cx + COLS - 1) % COLS;
      if (hit('right')) cx = (cx + 1) % COLS;
      if (hit('up')) cy = (cy + ROWS - 1) % ROWS;
      if (hit('down')) cy = (cy + 1) % ROWS;
      cur = cy * COLS + cx;
      if (hit('ok') && !open[cur] && !done[cur]) {
        open[cur] = true; beep(700, 0.03);
        if (a < 0) a = cur;
        else { b = cur; moves++; wait = cards[a] === cards[b] ? 8 : 22; }
      }
    },
    draw() {
      cls(); hud('PAIRS', 'MOVES ' + moves);
      for (let i = 0; i < 18; i++) {
        const x = 3 + (i % COLS) * 13, y = 9 + Math.floor(i / COLS) * 13;
        if (!done[i]) {
          box(x, y, 12, 11);
          if (open[i]) sprite(ICONS[cards[i]], x + 3, y + 3);
          else { px(x + 5, y + 5); px(x + 6, y + 5); }
        } else sprite(ICONS[cards[i]], x + 3, y + 3);
        if (i === cur && (t >> 3) & 1) box(x - 1, y - 1, 14, 13);
      }
    }
  };
}

function racer(end) {
  const CAR = ['.##..##..', '########.', '#.####.##', '#.####.##', '#.####.##', '########.', '.##..##..'];
  const TRUCK = ['..##..##.', '.########', '##.####.#', '##.####.#', '##.####.#', '.########', '..##..##.'];
  const laneY = l => 10 + l * 12;
  let lane = 1, y = laneY(1), obs = [], score = 0, t = 0, scroll = 0, gap = 40;
  return {
    get score() { return score; },
    update() {
      t++;
      if (hit('up') && lane > 0) { lane--; beep(600, 0.02); }
      if (hit('down') && lane < 2) { lane++; beep(600, 0.02); }
      const ty = laneY(lane);
      y += clamp(ty - y, -3, 3);
      const sp = Math.min(4, 1.5 + score * 0.04);
      scroll = (scroll + sp) % 8;
      const last = obs[obs.length - 1];
      if (!last || last.x < W - gap) { obs.push({ x: W, l: rnd(3) }); gap = 30 + rnd(22); }
      for (const o of obs) {
        o.x -= sp;
        const oy = laneY(o.l);
        if (o.x < 8 + 8 && o.x + 8 > 8 + 1 && oy < y + 6 && oy + 6 > y + 1) { beep(160, 0.25); end(score); return; }
        if (!o.passed && o.x + 9 < 8) { o.passed = 1; score++; beep(900, 0.02); }
      }
      obs = obs.filter(o => o.x > -10);
    },
    draw() {
      cls(); hud('RACER', score);
      rect(0, 8, W, 1); rect(0, 46, W, 1);
      for (let x = -Math.floor(scroll); x < W; x += 8) { rect(x, 20, 4, 1); rect(x, 32, 4, 1); }
      for (const o of obs) sprite(TRUCK, o.x, laneY(o.l));
      sprite(CAR, 8, y);
    }
  };
}

/* Two players over a room ID. Peer-to-peer through PeerJS (WebRTC); the host runs the simulation. */
function duel() {
  const PH = 9, LIB = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  let mode = 'pick', sel = 0, code = [1, 0, 0, 0], ci = 0, peer = null, conn = null, host = false, msg = '', ready = false, t = 0;
  let p = [20, 20], b = { x: 41, y: 26, vx: 1.2, vy: 0.4 }, sc = [0, 0], over = 0, remoteIn = 0, serve = 30;
  const close = () => { try { if (peer) peer.destroy(); } catch (e) {} peer = conn = null; };
  const fail = m => { if (mode === 'gone') return; msg = m; mode = 'error'; close(); beep(180, 0.2); };
  const serveBall = d => { b = { x: 41, y: 26, vx: d * 1.2, vy: (Math.random() - 0.5) * 1.4 }; serve = 30; };
  const reset = () => { sc = [0, 0]; over = 0; p = [20, 20]; serveBall(Math.random() < 0.5 ? -1 : 1); };
  function lib(cb) {
    if (window.Peer) { cb(); return; }
    const s = document.createElement('script');
    s.src = LIB; s.onload = () => { if (mode !== 'gone') cb(); }; s.onerror = () => fail('NO NETWORK');
    document.head.appendChild(s);
  }
  function wire(c) {
    conn = c;
    const go = () => { if (mode === 'gone') return; reset(); mode = 'play'; beep(990, 0.1); };
    if (c.open) go(); else c.on('open', go);
    c.on('data', d => {
      if (!d || typeof d !== 'object') return;
      if (host) remoteIn = d.i > 0 ? 1 : d.i < 0 ? -1 : 0;
      else if (Array.isArray(d.p) && Array.isArray(d.b) && Array.isArray(d.s)) {
        p = [+d.p[0] || 0, +d.p[1] || 0]; b.x = +d.b[0] || 0; b.y = +d.b[1] || 0; sc = [d.s[0] | 0, d.s[1] | 0]; over = d.o | 0;
      }
    });
    c.on('close', () => { if (mode === 'play') fail('PLAYER LEFT'); });
    c.on('error', () => fail('LINK LOST'));
  }
  function doHost() {
    host = true; ready = false; mode = 'wait';
    const id = String(1000 + rnd(9000)); code = id.split('').map(Number);
    lib(() => {
      try {
        peer = new Peer('arc84-' + id);
        peer.on('open', () => { ready = true; });
        peer.on('connection', c => { if (conn) { try { c.close(); } catch (e) {} return; } wire(c); });
        peer.on('error', e => fail(e && e.type === 'unavailable-id' ? 'ID IN USE' : 'NO LINK'));
      } catch (e) { fail('NO LINK'); }
    });
  }
  function doJoin() {
    host = false; mode = 'link';
    lib(() => {
      try {
        peer = new Peer();
        peer.on('open', () => wire(peer.connect('arc84-' + code.join(''))));
        peer.on('error', e => fail(e && e.type === 'peer-unavailable' ? 'ID NOT FOUND' : 'NO LINK'));
      } catch (e) { fail('NO LINK'); }
    });
  }
  function simulate() {
    const mine = held.up ? -1 : held.down ? 1 : 0;
    p[0] = clamp(p[0] + mine * 2, 8, H - PH); p[1] = clamp(p[1] + remoteIn * 2, 8, H - PH);
    if (over) { if (hit('ok')) reset(); }
    else if (serve > 0) serve--;
    else {
      b.x += b.vx; b.y += b.vy;
      if (b.y < 8) { b.y = 8; b.vy = Math.abs(b.vy); }
      if (b.y > H - 2) { b.y = H - 2; b.vy = -Math.abs(b.vy); }
      const bounce = (py, dir) => {
        b.vx = dir * Math.min(2.4, Math.abs(b.vx) * 1.06);
        b.vy = ((b.y + 1) - (py + PH / 2)) / (PH / 2) * 1.2; beep(520, 0.03);
      };
      if (b.vx < 0 && b.x <= 4 && b.x >= 1 && b.y + 2 > p[0] && b.y < p[0] + PH) { b.x = 4; bounce(p[0], 1); }
      if (b.vx > 0 && b.x + 2 >= W - 4 && b.x + 2 <= W - 1 && b.y + 2 > p[1] && b.y < p[1] + PH) { b.x = W - 6; bounce(p[1], -1); }
      if (b.x < -3) { sc[1]++; if (sc[1] >= 5) over = 2; else serveBall(-1); beep(300, 0.1); }
      else if (b.x > W + 1) { sc[0]++; if (sc[0] >= 5) over = 1; else serveBall(1); beep(300, 0.1); }
    }
    try { conn.send({ p: p, b: [b.x, b.y], s: sc, o: over }); } catch (e) {}
  }
  return {
    leave() { mode = 'gone'; close(); },
    update() {
      t++;
      if (mode === 'pick') {
        if (hit('up') || hit('down')) { sel ^= 1; beep(700, 0.02); }
        if (hit('ok')) { if (sel === 0) doHost(); else { mode = 'enter'; ci = 0; } }
      } else if (mode === 'enter') {
        if (hit('left')) ci = (ci + 3) % 4;
        if (hit('right')) ci = (ci + 1) % 4;
        if (hit('up')) code[ci] = (code[ci] + 1) % 10;
        if (hit('down')) code[ci] = (code[ci] + 9) % 10;
        if (hit('ok')) doJoin();
      } else if (mode === 'error') {
        if (hit('ok')) { mode = 'pick'; }
      } else if (mode === 'play') {
        if (host) simulate();
        else { try { conn.send({ i: held.up ? -1 : held.down ? 1 : 0 }); } catch (e) {} }
      }
    },
    draw() {
      cls();
      if (mode === 'pick') {
        rect(0, 0, W, 7); text('2P DUEL', 2, 1, 0);
        ['HOST A GAME', 'JOIN WITH ID'].forEach((s, n) => {
          const y = 12 + n * 10; if (n === sel) rect(0, y, W, 7);
          text((n === sel ? '>' : ' ') + s, 1, y + 1, n === sel ? 0 : 1);
        });
        textC('FIRST TO 5 WINS', 38);
      } else if (mode === 'wait') {
        textC('YOUR ID', 5); box(22, 13, 40, 13); textC(code.join(' '), 17);
        textC(ready ? 'WAITING FOR P2' + '.'.repeat((t >> 4) % 4) : 'OPENING...', 31);
        textC('C:CANCEL', 40);
      } else if (mode === 'enter') {
        textC('ENTER HOST ID', 5); textC(code.join(' '), 17);
        const x0 = Math.round((W - 27) / 2) + ci * 8;
        if ((t >> 3) & 1) rect(x0 - 1, 24, 5, 1);
        textC('OK:JOIN  C:BACK', 40);
      } else if (mode === 'link') {
        textC('CONNECTING' + '.'.repeat((t >> 4) % 4), 20);
      } else if (mode === 'error') {
        box(0, 0, W, H); textC(msg, 14); textC('OK:RETRY  C:MENU', 34);
      } else if (mode === 'play') {
        hud(host ? 'YOU:LEFT' : 'YOU:RIGHT', sc[0] + '-' + sc[1]);
        for (let y = 9; y < H; y += 4) px(W / 2, y);
        rect(2, p[0], 2, PH); rect(W - 4, p[1], 2, PH);
        if (!over) rect(b.x, b.y, 2, 2);
        else {
          const won = (over === 1) === host;
          rect(14, 16, 56, 19, 0); box(14, 16, 56, 19);
          textC(won ? 'YOU WIN!' : 'YOU LOSE', 19); textC(host ? 'OK:REMATCH' : 'HOST RESTARTS', 27);
        }
      }
    }
  };
}

const GAMES = [
  { id: 'snake',   name: 'Snake',   make: snake,   how: 'Eat, grow, stay off the walls and your own tail.' },
  { id: 'bricks',  name: 'Bricks',  make: bricks,  how: 'OK launches the ball. Clear the wall with three lives.' },
  { id: 'blaster', name: 'Blaster', make: blaster, how: 'The ship fires on its own. Steer through the swarm.' },
  { id: 'pairs',   name: 'Pairs',   make: pairs,   how: 'Match all nine pairs in as few moves as you can.', lower: true },
  { id: 'racer',   name: 'Racer',   make: racer,   how: 'Up and down change lanes. Traffic keeps getting faster.' },
  { id: 'duel',    name: '2P Duel', make: duel,    how: 'Two phones, one room ID. Host a game or join one. First to five.', net: true }
];

/* ---------- scenes ---------- */
let scene, tickCount = 0;
const menu = {
  i: 0,
  update() {
    if (hit('up')) { this.i = (this.i + GAMES.length - 1) % GAMES.length; beep(700, 0.02); }
    if (hit('down')) { this.i = (this.i + 1) % GAMES.length; beep(700, 0.02); }
    if (hit('ok') || hit('right')) start(GAMES[this.i]);
  },
  draw() {
    cls(); rect(0, 0, W, 7); text('GAMES', 2, 1, 0); textR('OK:PLAY', W - 2, 1, 0);
    const top = clamp(this.i - 2, 0, GAMES.length - 5);
    GAMES.forEach((g, n) => {
      if (n < top || n >= top + 5) return;
      const y = 8 + (n - top) * 8, sel = n === this.i;
      if (sel) rect(0, y, W, 7);
      text((sel ? '>' : ' ') + g.name, 1, y + 1, sel ? 0 : 1);
      textR(g.net ? '2P' : best[g.id] == null ? '-' : best[g.id], W - 2, y + 1, sel ? 0 : 1);
    });
  }
};
function start(g) {
  beep(880, 0.08);
  const play = g.make(score => finish(g, score));
  scene = { game: g, update() { play.update(); }, draw() { play.draw(); }, leave() { if (play.leave) play.leave(); } };
}
function finish(g, score) {
  const prev = best[g.id];
  const record = prev == null || (g.lower ? score < prev : score > prev);
  if (record && (g.lower || score > 0)) { best[g.id] = score; saveBest(); paintList(); }
  beep(g.lower ? 1300 : 220, 0.3);
  scene = {
    game: g,
    update() { if (hit('ok')) start(g); },
    draw() {
      cls(); box(0, 0, W, H);
      textC(g.lower ? 'ALL MATCHED!' : 'GAME OVER', 5);
      textC((g.lower ? 'MOVES ' : 'SCORE ') + score, 15);
      textC('BEST ' + (best[g.id] == null ? '-' : best[g.id]), 23);
      if (record && (g.lower || score > 0) && (tickCount >> 3) & 1) textC('NEW RECORD!', 31);
      textC('OK:AGAIN  C:MENU', 40);
    }
  };
}
function toMenu() { scene = menu; }
scene = menu;

/* ---------- page index ---------- */
const list = document.getElementById('games');
function paintList() {
  list.innerHTML = '';
  GAMES.forEach((g, n) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'game'; b.id = 'play-' + g.id; b.type = 'button';
    const v = best[g.id];
    b.innerHTML = '<b></b><span class="best"><strong></strong></span><span class="how"></span>';
    b.querySelector('b').textContent = g.name;
    b.querySelector('.how').textContent = g.how;
    b.querySelector('strong').textContent = g.net ? '2P' : v == null ? '-' : v;
    b.querySelector('.best').append(g.net ? 'room ID' : g.lower ? 'fewest moves' : 'best score');
    b.addEventListener('click', () => {
      unlock(); menu.i = n; start(g);
      document.getElementById('handset').scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      b.blur();
    });
    li.appendChild(b); list.appendChild(li);
  });
}
paintList();

/* ---------- feedback ---------- */
{
  const TO = 'reubenomae207@mail.com';
  const sel = document.getElementById('fb-game'), txt = document.getElementById('fb-text');
  const mail = document.getElementById('fb-mail'), status = document.getElementById('fb-status');
  const radios = [...document.querySelectorAll('#fb-stars input')];
  GAMES.forEach(g => { const o = document.createElement('option'); o.value = o.textContent = g.name; sel.appendChild(o); });
  const rating = () => { const r = radios.find(x => x.checked); return r ? +r.value : 0; };
  const message = () => 'Rating: ' + (rating() ? rating() + '/5' : 'not given') + '\nGame: ' + sel.value + '\n\n' + txt.value.trim();
  function sync() {
    const r = rating();
    radios.forEach(x => x.nextElementSibling.classList.toggle('lit', +x.value <= r));
    mail.href = 'mailto:' + TO + '?subject=' + encodeURIComponent('84x48 Arcade feedback' + (r ? ' (' + r + '/5)' : '')) + '&body=' + encodeURIComponent(message());
    try { localStorage.setItem('arcade84-rating', String(r)); } catch (e) {}
  }
  try { const saved = +localStorage.getItem('arcade84-rating'); if (saved >= 1 && saved <= 5) radios[saved - 1].checked = true; } catch (e) {}
  document.getElementById('fb-form').addEventListener('submit', e => e.preventDefault());
  document.getElementById('fb-form').addEventListener('input', sync);
  document.getElementById('fb-form').addEventListener('change', sync);
  document.getElementById('fb-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(message()); status.textContent = 'Copied. Paste it into an email to ' + TO + '.'; }
    catch (e) { status.textContent = 'Copy was blocked. Select your text and send it to ' + TO + '.'; }
  });
  sync();
}

/* ---------- loop ---------- */
const STEP = 1000 / TPS;
let lastT = 0, acc = 0;
function tick() {
  tickCount++;
  if (scene !== menu && hit('back')) { if (scene.leave) scene.leave(); toMenu(); beep(440, 0.04); return; }
  scene.update();
}
function frame(t) {
  acc += Math.min(100, t - lastT); lastT = t;
  while (acc >= STEP) { tick(); pressed.length = 0; acc -= STEP; }
  scene.draw(); render();
  requestAnimationFrame(frame);
}
scene.draw(); render();
requestAnimationFrame(frame);
})();
