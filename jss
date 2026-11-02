'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = {
get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
const rnd = n => Math.floor(Math.random() * n);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randCode = () => Array.from({ length: 5 }, () => CODE_CHARS[rnd(CODE_CHARS.length)]).join('');
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
let current = 'home';
function go(id) {
if (current === 'race' && id !== 'race') Race.stop();
if (!['xox', 'race'].includes(id)) Net.close();
Memory.stop(); Reflex.stop(); Cps.stop();
$$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + id));
current = id;
$('#backBtn').classList.toggle('hidden', id === 'home');
window.scrollTo(0, 0);
}
$('#backBtn').onclick = () => go('home');
let toastTimer;
function toast(msg) {
const t = $('#toast');
t.textContent = msg; t.classList.add('show');
clearTimeout(toastTimer);
toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
function modal(title, items) {
$('#mTitle').textContent = title;
const box = $('#mBtns'); box.innerHTML = '';
items.forEach(([label, fn]) => {
const b = document.createElement('button');
b.className = 'btn'; b.textContent = label;
b.onclick = () => { closeModal(); fn(); };
box.appendChild(b);
});
$('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#mClose').onclick = closeModal;
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
function setConn(on) {
const p = $('#conn');
p.classList.toggle('hidden', !on);
p.textContent = '🟢 Online';
}
const Net = {
peer: null, conn: null, host: false,
setup(c) {
this.conn = c;
c.on('data', d => onNetData(d));
c.on('close', () => { if (this.conn === c) { this.conn = null; onNetClose(); } });
c.on('error', () => {});
},
send(o) { if (this.conn && this.conn.open) this.conn.send(o); },
close() {
const c = this.conn, p = this.peer;
this.conn = null; this.peer = null;
try { c && c.close(); } catch (e) {}
try { p && p.destroy(); } catch (e) {}
setConn(false);
},
createRoom(onCode, onJoin, onErr) {
if (typeof Peer === 'undefined') { onErr('Bağlantı kütüphanesi yüklenemedi. İnternetini kontrol et.'); return; }
this.close(); this.host = true;
const attempt = n => {
const code = randCode();
const p = new Peer('oyunoyna-' + code);
this.peer = p;
p.on('open', () => onCode(code));
p.on('connection', c => {
if (this.conn) { c.close(); return; }
this.setup(c);
if (c.open) onJoin(); else c.on('open', onJoin);
});
p.on('error', e => {
if (e.type === 'unavailable-id' && n < 5) { try { p.destroy(); } catch (x) {} attempt(n + 1); }
else onErr('Oda kurulamadı (' + e.type + '). Tekrar dene.');
});
};
attempt(0);
},
joinRoom(code, onOpen, onErr) {
if (typeof Peer === 'undefined') { onErr('Bağlantı kütüphanesi yüklenemedi. İnternetini kontrol et.'); return; }
this.close(); this.host = false;
const p = new Peer();
this.peer = p;
p.on('open', () => {
const c = p.connect('oyunoyna-' + code, { reliable: true });
this.setup(c);
const to = setTimeout(() => onErr('Bağlanılamadı. Kodu kontrol et veya aynı Wi-Fi\'yi dene.'), 12000);
c.on('open', () => { clearTimeout(to); onOpen(); });
});
p.on('error', e => onErr(e.type === 'peer-unavailable' ? 'Böyle bir oda yok. Kodu kontrol et.' : 'Bağlantı hatası: ' + e.type));
}
};
function onNetClose() {
toast('Arkadaşının bağlantısı koptu');
setConn(false);
if (['xox', 'race', 'lobby'].includes(current)) go('home');
}
function onNetData(m) {
if (!m || !m.t) return;
switch (m.t) {
case 'start': startGame(m.game, m); break;
case 'mv': XOX.remote(m.i); break;
case 'xreset': XOX.reset(m.starter); break;
case 'again':
if (Net.host) { if (current === 'xox') XOX.hostReset(); else if (current === 'race') Race.hostStart(); }
break;
case 'pos': Race.remotePos(m); break;
case 'fin': Race.remoteFin(); break;
case 'res': Race.remoteRes(m); break;
}
}
function startGame(game, m) {
if (game === 'xox') { XOX.init('online'); if (current !== 'xox') go('xox'); }
else if (game === 'race') { if (current !== 'race') go('race'); Race.init('online', m.seed); }
}
let lobbyGame = 'xox';
function openLobby(g) {
lobbyGame = g;
$$('#lobbyGame button').forEach(b => b.classList.toggle('on', b.dataset.g === g));
$('#roomBox').classList.add('hidden');
$('#createRoom').disabled = false;
$('#joinState').textContent = '';
go('lobby');
}
$$('#lobbyGame button').forEach(b => b.onclick = () => {
lobbyGame = b.dataset.g;
$$('#lobbyGame button').forEach(x => x.classList.toggle('on', x === b));
});
$('#createRoom').onclick = () => {
const btn = $('#createRoom'); btn.disabled = true;
Net.createRoom(
code => {
$('#roomBox').classList.remove('hidden');
$('#roomCode').textContent = code;
$('#roomState').textContent = 'Arkadaşın bekleniyor…';
const link = location.origin + location.pathname + '#join=' + code;
$('#copyLink').onclick = () => {
(navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
.then(() => toast('Link kopyalandı'), () => toast('Kopyalanamadı. Kodu elle yaz: ' + code));
};
$('#shareBtn').onclick = () => {
if (navigator.share) navigator.share({ title: 'OYUNOYNA.COM', text: 'Gel oynayalım! Oda kodu: ' + code, url: link }).catch(() => {});
else $('#copyLink').onclick();
};
},
() => {
setConn(true);
$('#roomState').textContent = 'Bağlandı! Oyun başlıyor…';
const seed = (Math.random() * 1e9) | 0;
Net.send({ t: 'start', game: lobbyGame, seed });
startGame(lobbyGame, { seed });
},
msg => { toast(msg); btn.disabled = false; }
);
};
function joinRoom() {
const code = $('#joinCode').value.trim().toUpperCase();
if (code.length !== 5) { toast('5 haneli kodu yaz'); return; }
$('#joinState').textContent = 'Bağlanıyor…';
Net.joinRoom(code,
() => { setConn(true); $('#joinState').textContent = 'Bağlandı! Oyun başlıyor…'; },
msg => { toast(msg); $('#joinState').textContent = ''; }
);
}
$('#joinBtn').onclick = joinRoom;
$('#joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function calc(b) {
for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { w: b[l[0]], line: l };
return { w: null, line: null };
}
function minimax(b, t) {
const r = calc(b);
if (r.w) return { s: r.w === 'O' ? 10 : -10 };
if (b.every(x => x)) return { s: 0 };
let best = null;
for (let i = 0; i < 9; i++) {
if (b[i]) continue;
b[i] = t;
const s = minimax(b, t === 'O' ? 'X' : 'O').s;
b[i] = '';
if (best === null || (t === 'O' ? s > best.s : s < best.s)) best = { s, i };
}
return best;
}
const XOX = {
mode: 'local', board: Array(9).fill(''), turn: 'X', over: false, winner: null, line: null,
score: { X: 0, O: 0, D: 0 }, me: 'X', starter: 'X', aiTimer: null,
init(mode) {
this.mode = mode;
this.score = { X: 0, O: 0, D: 0 };
this.me = mode === 'online' ? (Net.host ? 'X' : 'O') : 'X';
this.starter = 'X';
const b = $('#board'); b.innerHTML = '';
for (let i = 0; i < 9; i++) {
const c = document.createElement('button');
c.className = 'cell'; c.setAttribute('aria-label', 'Kare ' + (i + 1));
c.onclick = () => this.tap(i);
b.appendChild(c);
}
this.reset('X');
},
reset(starter) {
clearTimeout(this.aiTimer);
this.starter = starter;
this.board = Array(9).fill(''); this.turn = starter;
this.over = false; this.winner = null; this.line = null;
this.render();
if (this.mode === 'ai' && this.turn === 'O') this.aiTimer = setTimeout(() => this.aiMove(), 500);
},
tap(i) {
if (this.over || this.board[i]) return;
if (this.mode === 'online') {
if (this.turn !== this.me) return;
Net.send({ t: 'mv', i });
}
if (this.mode === 'ai' && this.turn !== 'X') return;
this.place(i);
if (this.mode === 'ai' && !this.over) this.aiTimer = setTimeout(() => this.aiMove(), 450);
},
remote(i) {
if (this.over || this.board[i] || this.turn === this.me) return;
this.place(i);
},
aiMove() {
if (this.over) return;
let i;
if (Math.random() < 0.2) {
const free = this.board.map((v, k) => v ? -1 : k).filter(k => k >= 0);
i = free[rnd(free.length)];
} else i = minimax([...this.board], 'O').i;
this.place(i);
},
place(i) {
this.board[i] = this.turn;
vibrate(15);
const r = calc(this.board);
if (r.w) { this.over = true; this.winner = r.w; this.line = r.line; this.score[r.w]++; vibrate([40, 40, 80]); }
else if (this.board.every(x => x)) { this.over = true; this.winner = 'D'; this.score.D++; }
else this.turn = this.turn === 'X' ? 'O' : 'X';
this.render();
},
render() {
$$('#board .cell').forEach((c, i) => {
c.textContent = this.board[i];
c.className = 'cell' + (this.board[i] ? ' ' + this.board[i].toLowerCase() : '') + (this.line && this.line.includes(i) ? ' win' : '');
});
const online = this.mode === 'online';
$('#sX').innerHTML = `X${online && this.me === 'X' ? ' (Sen)' : ''}<b>${this.score.X}</b>`;
$('#sO').innerHTML = `O${online && this.me === 'O' ? ' (Sen)' : ''}<b>${this.score.O}</b>`;
$('#sD').innerHTML = `Berabere<b>${this.score.D}</b>`;
let s;
if (this.over) {
if (this.winner === 'D') s = '🤝 Berabere!';
else if (online) s = this.winner === this.me ? '🎉 Kazandın!' : '😔 Rakip kazandı';
else if (this.mode === 'ai') s = this.winner === 'X' ? '🎉 Kazandın!' : '🤖 Bilgisayar kazandı';
else s = `🎉 ${this.winner} kazandı!`;
} else if (online) s = this.turn === this.me ? `Sıra sende (${this.me})` : 'Rakibin sırası…';
else if (this.mode === 'ai') s = this.turn === 'X' ? 'Sıra sende (X)' : '🤖 Düşünüyor…';
else s = `Sıra: ${this.turn}`;
$('#xoxStatus').textContent = s;
},
hostReset() {
const st = this.starter === 'X' ? 'O' : 'X';
this.reset(st);
Net.send({ t: 'xreset', starter: st });
}
};
$('#xoxAgain').onclick = () => {
if (XOX.mode === 'online') { if (Net.host) XOX.hostReset(); else Net.send({ t: 'again' }); }
else XOX.reset(XOX.starter === 'X' ? 'O' : 'X');
};
function mulberry32(a) {
return function () {
a |= 0; a = a + 0x6D2B79F5 | 0;
let t = Math.imul(a ^ a >>> 15, 1 | a);
t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
}
function rr(ctx, x, y, w, h, r) {
ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.arcTo(x + w, y, x + w, y + h, r);
ctx.arcTo(x + w, y + h, x, y + h, r);
ctx.arcTo(x, y + h, x, y, r);
ctx.arcTo(x, y, x + w, y, r);
ctx.closePath();
}
const Race = {
W: 360, H: 600, PX: 8, LEN: 2500, CARY: 470, MAX: 88, ACC: 24,
COLORS: ['#ff3b5c', '#3bb4ff'],
mode: 'solo', players: [], ctxs: [], obs: [], state: 'idle',
raf: 0, last: 0, cd: 0, t0: 0, opp: null, ghost: null, result: null, lastSend: 0, myTime: 0,
laneX(l) { return 40 + (l + 0.5) * 280 / 3; },
gen(seed) {
const r = mulberry32(seed), o = [];
let d = 150;
while (d < this.LEN - 120) {
d += 32 + r() * 30;
const a = Math.floor(r() * 3);
o.push({ d, l: a });
if (r() < 0.35) o.push({ d, l: (a + 1 + Math.floor(r() * 2)) % 3 });
}
return o;
},
init(mode, seed) {
this.stop();
this.mode = mode;
this.obs = this.gen(seed == null ? (Math.random() * 1e9) | 0 : seed);
this.result = null; this.opp = null; this.ghost = null; this.myTime = 0;
const mk = i => ({ d: 0, x: 1, tl: 1, s: 0, inv: 0, shake: 0, fin: false, time: 0, color: this.COLORS[i] });
let colorIdx = mode === 'online' && !Net.host ? 1 : 0;
this.players = mode === 'local' ? [mk(0), mk(1)] : [mk(colorIdx)];
const stage = $('#raceStage'); stage.innerHTML = '';
this.ctxs = [];
this.players.forEach((p, i) => {
const w = document.createElement('div'); w.className = 'cwrap';
const cv = document.createElement('canvas');
cv.width = this.W * 2; cv.height = this.H * 2;
const ctx = cv.getContext('2d'); ctx.scale(2, 2);
cv.addEventListener('pointerdown', e => {
e.preventDefault();
const r = cv.getBoundingClientRect();
this.steer(i, (e.clientX - r.left) < r.width / 2 ? -1 : 1);
});
w.appendChild(cv);
if (mode === 'local') {
const tg = document.createElement('div'); tg.className = 'tag'; tg.textContent = 'Oyuncu ' + (i + 1); tg.style.color = p.color; w.appendChild(tg);
}
stage.appendChild(w);
this.ctxs.push(ctx);
});
const ov = document.createElement('div'); ov.id = 'raceOverlay'; ov.className = 'overlay'; stage.appendChild(ov);
this.buildCtl();
this.state = 'count'; this.cd = 3.99;
this.last = performance.now();
this.raf = requestAnimationFrame(t => this.loop(t));
},
buildCtl() {
const c = $('#raceCtl'); c.innerHTML = '';
const mk = (txt, i, d) => {
const b = document.createElement('button');
b.className = 'ctl c' + i; b.textContent = txt;
b.addEventListener('pointerdown', e => { e.preventDefault(); this.steer(i, d); });
return b;
};
if (this.mode === 'local') {
const g1 = document.createElement('div'); g1.className = 'grp'; g1.append(mk('◀', 0, -1), mk('▶', 0, 1));
const g2 = document.createElement('div'); g2.className = 'grp'; g2.append(mk('◀', 1, -1), mk('▶', 1, 1));
c.append(g1, g2);
} else c.append(mk('◀', 0, -1), mk('▶', 0, 1));
},
steer(i, dir) {
const p = this.players[i];
if (!p || this.state !== 'run' || p.fin) return;
p.tl = Math.max(0, Math.min(2, p.tl + dir));
},
key(e) {
if (current !== 'race' || this.state !== 'run') return;
const k = e.key;
if (this.mode === 'local') {
if (k === 'a' || k === 'A') this.steer(0, -1);
else if (k === 'd' || k === 'D') this.steer(0, 1);
else if (k === 'ArrowLeft') this.steer(1, -1);
else if (k === 'ArrowRight') this.steer(1, 1);
} else {
if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.steer(0, -1);
else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.steer(0, 1);
}
},
stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.state = 'idle'; },
hostStart() {
const seed = (Math.random() * 1e9) | 0;
Net.send({ t: 'start', game: 'race', seed });
this.init('online', seed);
},
loop(now) {
const dt = Math.min(0.05, (now - this.last) / 1000);
this.last = now;
const ov = $('#raceOverlay');
if (this.state === 'count') {
this.cd -= dt;
if (this.cd <= 0) {
this.state = 'run'; this.t0 = now;
ov.innerHTML = '<div class="big">GO!</div>';
setTimeout(() => { if (this.state === 'run') ov.classList.add('hidden'); }, 700);
vibrate(60);
} else { ov.classList.remove('hidden'); ov.innerHTML = `<div class="big">${Math.ceil(this.cd)}</div><div class="sub">Hazır ol!</div>`; }
}
if (this.state === 'run') {
this.players.forEach((p, i) => this.update(p, dt, i, now));
if (this.mode === 'online' && now - this.lastSend > 60) {
this.lastSend = now;
const p = this.players[0];
Net.send({ t: 'pos', d: p.d, x: p.x, s: p.s });
}
}
if (this.opp) {
const o = this.opp, ex = Math.min(0.25, (now - o.at) / 1000);
const gd = o.d + o.s * ex;
if (!this.ghost) this.ghost = { d: gd, x: o.x };
this.ghost.d += (gd - this.ghost.d) * 0.35;
this.ghost.x += (o.x - this.ghost.x) * 0.3;
}
this.players.forEach((p, i) => {
let g = null;
if (this.mode === 'local') g = this.players[1 - i];
else if (this.mode === 'online' && this.ghost) g = { d: this.ghost.d, x: this.ghost.x, color: this.COLORS[Net.host ? 1 : 0] };
this.draw(this.ctxs[i], p, g);
});
this.raf = requestAnimationFrame(t => this.loop(t));
},
update(p, dt, i, now) {
if (p.fin) return;
p.s = Math.min(this.MAX, p.s + this.ACC * dt);
p.d += p.s * dt;
p.x += (p.tl - p.x) * Math.min(1, dt * 14);
if (p.inv > 0) p.inv -= dt;
if (p.shake > 0) p.shake -= dt;
if (p.inv <= 0) {
for (const o of this.obs) {
if (Math.abs(o.d - p.d) < 6.5 && Math.abs(o.l - p.x) < 0.45) {
p.s *= 0.35; p.inv = 1.2; p.shake = 0.3; vibrate(120); break;
}
}
}
if (p.d >= this.LEN) {
p.d = this.LEN; p.fin = true; p.time = (now - this.t0) / 1000;
this.onFinish(i);
}
},
fmt(t) { return t.toFixed(2) + ' sn'; },
onFinish(i) {
const p = this.players[i];
if (this.mode === 'solo') {
const best = +ls.get('or_best') || 999;
let sub = 'Süren: ' + this.fmt(p.time);
if (p.time < best) { ls.set('or_best', p.time.toFixed(2)); sub += ' · 🏅 Yeni rekor!'; }
else sub += ' · En iyi: ' + best + ' sn';
this.end('🏁 Bitti!', sub);
} else if (this.mode === 'local') {
this.end(`🏆 Oyuncu ${i + 1} kazandı!`, this.fmt(p.time));
} else {
this.myTime = p.time;
if (Net.host) {
if (!this.result) { this.result = { w: 'host' }; Net.send({ t: 'res', w: 'host' }); this.end('🏆 Kazandın!', this.fmt(p.time)); }
} else {
Net.send({ t: 'fin' });
this.state = 'wait';
const ov = $('#raceOverlay'); ov.classList.remove('hidden');
ov.innerHTML = '<div class="big">🏁</div><div class="sub">Bitirdin! Sonuç bekleniyor…</div>';
}
}
},
end(title, sub) {
this.state = 'done';
const o = $('#raceOverlay'); o.classList.remove('hidden');
o.innerHTML = `<div class="big" style="font-size:clamp(28px,9vw,48px)">${title}</div><div class="sub">${sub || ''}</div><div class="row"><button class="btn primary" id="rAgain">🔁 Tekrar</button><button class="btn" id="rHome">🏠 Menü</button></div>`;
$('#rAgain').onclick = () => this.again();
$('#rHome').onclick = () => go('home');
},
again() {
if (this.mode === 'online') {
if (Net.host) this.hostStart();
else { Net.send({ t: 'again' }); const s = $('#raceOverlay .sub'); if (s) s.textContent = 'Arkadaşının başlatması bekleniyor…'; }
} else this.init(this.mode);
},
remotePos(m) {
this.opp = { d: m.d, x: m.x, s: m.s, at: performance.now() };
},
remoteFin() {
if (!Net.host || this.result || this.state === 'done') return;
this.result = { w: 'guest' };
Net.send({ t: 'res', w: 'guest' });
this.end('😔 Rakip önce bitirdi', '');
},
remoteRes(m) {
if (this.state === 'done') return;
this.result = m;
const win = m.w === 'guest';
this.end(win ? '🏆 Kazandın!' : '😔 Rakip önce bitirdi', this.myTime ? this.fmt(this.myTime) : '');
},
draw(ctx, p, ghost) {
const { W, H, PX, CARY } = this;
ctx.save();
ctx.clearRect(0, 0, W, H);
if (p.shake > 0) ctx.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8);
ctx.fillStyle = '#0b3d2e'; ctx.fillRect(-10, -10, W + 20, H + 20);
ctx.fillStyle = '#2a2d3e'; ctx.fillRect(40, -10, 280, H + 20);
ctx.fillStyle = '#ffd34d'; ctx.fillRect(36, -10, 4, H + 20); ctx.fillRect(320, -10, 4, H + 20);
const off = (p.d * PX) % 60;
for (let y = -60 + off; y < H; y += 60) {
ctx.fillStyle = 'rgba(255,255,255,.55)';
ctx.fillRect(40 + 280 / 3 - 2, y, 4, 30);
ctx.fillRect(40 + 560 / 3 - 2, y, 4, 30);
ctx.fillStyle = '#e8e8f0'; ctx.fillRect(26, y, 8, 30); ctx.fillRect(326, y, 8, 30);
ctx.fillStyle = '#d6243f'; ctx.fillRect(26, y + 30, 8, 30); ctx.fillRect(326, y + 30, 8, 30);
}
const fy = CARY - (this.LEN - p.d) * PX;
if (fy > -40 && fy < H + 40) {
for (let k = 0; k < 14; k++) for (let r = 0; r < 2; r++) {
ctx.fillStyle = (k + r) % 2 ? '#fff' : '#111';
ctx.fillRect(40 + k * 20, fy - 20 + r * 20, 20, 20);
}
}
for (const o of this.obs) {
const y = CARY - (o.d - p.d) * PX;
if (y < -40 || y > H + 40) continue;
const x = this.laneX(o.l);
ctx.fillStyle = '#e8e8f0'; rr(ctx, x - 24, y - 15, 48, 30, 6); ctx.fill();
ctx.fillStyle = '#e23b3b';
for (let k = -24; k < 24; k += 16) { ctx.fillRect(x + k, y - 15, 8, 30); }
ctx.strokeStyle = '#0006'; ctx.lineWidth = 2; rr(ctx, x - 24, y - 15, 48, 30, 6); ctx.stroke();
}
if (ghost) {
const gy = CARY - (ghost.d - p.d) * PX;
if (gy > -80 && gy < H + 80) this.car(ctx, this.laneX(ghost.x), gy, ghost.color, 0.55);
else {
ctx.fillStyle = ghost.color; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
const dist = Math.abs(Math.round(ghost.d - p.d));
if (gy <= -80) ctx.fillText(`▲ rakip ${dist} m önde`, W / 2, 38);
else ctx.fillText(`▼ rakip ${dist} m geride`, W / 2, H - 40);
}
}
const blink = p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0;
this.car(ctx, this.laneX(p.x), CARY, p.color, blink ? 0.35 : 1);
ctx.fillStyle = '#0008'; ctx.fillRect(0, 0, W, 8);
ctx.fillStyle = p.color; ctx.fillRect(0, 0, W * Math.min(1, p.d / this.LEN), 8);
if (ghost) { ctx.fillStyle = ghost.color; ctx.fillRect(0, 8, W * Math.min(1, ghost.d / this.LEN), 4); }
ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'left';
ctx.fillText(Math.round(p.s * 2.2) + ' km/h', 12, 34);
ctx.textAlign = 'right';
ctx.fillText(Math.max(0, Math.round(this.LEN - p.d)) + ' m', W - 12, 34);
ctx.
