'use strict';
/* =========================================================================
   ARISE — Mais Forte a Cada Dia
   RPG 2D evolutivo inspirado em "Solo Leveling": gates, RNG, loot, sombras.
   ========================================================================= */

// ---------------------------------------------------------------- utils
const $ = s => document.querySelector(s);
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const chance = p => Math.random() < p;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[Math.floor(Math.random() * a.length)];
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
function wpick(list, wf) {
  let t = 0; for (const x of list) t += wf(x);
  let r = Math.random() * t;
  for (const x of list) { r -= wf(x); if (r <= 0) return x; }
  return list[list.length - 1];
}
function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return '' + n;
  const u = ['K', 'M', 'B', 'T', 'Q', 'Qi', 'Sx'];
  let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + u[i];
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- audio (sintetizado)
const SND = { ac: null, master: null, on: true, budget: 0 };
function audioInit() {
  if (SND.ac) { if (SND.ac.state === 'suspended') SND.ac.resume(); return; }
  try {
    SND.ac = new (window.AudioContext || window.webkitAudioContext)();
    SND.master = SND.ac.createGain(); SND.master.gain.value = .45;
    SND.master.connect(SND.ac.destination);
  } catch (e) { SND.ac = null; }
}
function tone(f, d, type = 'square', v = .08, slide = 0, delay = 0) {
  const ac = SND.ac; if (!ac || !SND.on) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(SND.master); o.start(t); o.stop(t + d + .02);
}
let noiseBuf = null;
function noise(d, v = .1, delay = 0, hp = 800) {
  const ac = SND.ac; if (!ac || !SND.on) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const c = noiseBuf.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  s.connect(f); f.connect(g); g.connect(SND.master); s.start(t); s.stop(t + d);
}
const sfx = {
  hit() { if (SND.budget-- <= 0) return; tone(rnd(150, 200), .07, 'square', .035, -70); noise(.05, .04, 0, 2500); },
  crit() { if (SND.budget-- <= 0) return; tone(1150, .11, 'sawtooth', .045, -750); noise(.13, .08, 0, 1200); },
  kill() { if (SND.budget-- <= 0) return; tone(320, .09, 'triangle', .045, 380); },
  orb(p) { if (SND.budget-- <= 0) return; tone(600 * 2 ** (Math.min(p, 24) / 12), .07, 'sine', .05, 120); },
  coin() { if (SND.budget-- <= 0) return; tone(1320, .05, 'square', .025); tone(1760, .09, 'square', .025, 0, .05); },
  lvl() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .2, 'square', .06, 0, i * .07)); tone(2093, .5, 'triangle', .05, 0, .36); },
  drop(r) { for (let i = 0; i <= r + 1; i++) tone(440 * 2 ** ((i * 4) / 12), .18, 'triangle', .05, 0, i * .06); },
  legend() { [392, 494, 587, 784, 988, 1175, 1568].forEach((f, i) => tone(f, .5, 'triangle', .06, 0, i * .05)); noise(1.2, .05, .2, 4000); },
  arise() { tone(70, 1.4, 'sawtooth', .13, -30); tone(140, 1.1, 'square', .05, -40); tone(220, 1, 'sawtooth', .045, 1300, .25); noise(1.2, .1, 0, 150); },
  fail() { tone(220, .35, 'sawtooth', .07, -140); tone(160, .4, 'square', .05, -90, .12); },
  boss() { tone(52, 1.8, 'sawtooth', .15, -15); tone(78, 1.8, 'sawtooth', .08, -20); noise(1.4, .08, 0, 120); },
  aoe() { noise(.7, .16, 0, 90); tone(95, .7, 'sawtooth', .13, -55); tone(600, .4, 'sine', .04, -500); },
  dash() { noise(.16, .06, 0, 3200); tone(500, .12, 'sine', .03, 600); },
  tick() { tone(1900, .025, 'square', .025); },
  click() { tone(880, .04, 'square', .03); },
  hurt() { tone(130, .14, 'square', .06, -70); },
  quest() { [659, 784, 988, 1319].forEach((f, i) => tone(f, .16, 'square', .05, 0, i * .09)); },
  sys() { tone(1568, .06, 'sine', .04); tone(2093, .1, 'sine', .035, 0, .06); },
  win() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'square', .06, 0, i * .11)); },
};

// ---------------------------------------------------------------- data
const RAR = [
  { id: 0, n: 'Comum', c: '#b8c0cc', w: 600, m: 1 },
  { id: 1, n: 'Incomum', c: '#5fe07a', w: 260, m: 1.35 },
  { id: 2, n: 'Raro', c: '#56b8ff', w: 100, m: 1.8 },
  { id: 3, n: 'Épico', c: '#b57bff', w: 30, m: 2.5 },
  { id: 4, n: 'Lendário', c: '#ffb020', w: 6, m: 3.6 },
  { id: 5, n: 'Mítico', c: '#ff3b6b', w: .8, m: 5.5 },
];
const RANKS = [
  { r: 'E', min: 1, c: '#9aa4b8' }, { r: 'D', min: 10, c: '#5fe07a' }, { r: 'C', min: 20, c: '#56b8ff' },
  { r: 'B', min: 35, c: '#b57bff' }, { r: 'A', min: 50, c: '#ffb020' }, { r: 'S', min: 70, c: '#ff3b4e' },
  { r: 'SS', min: 100, c: '#ff5fd2' }, { r: 'MONARCA', min: 150, c: '#c4a5ff' },
];
const rankOf = L => { let r = RANKS[0]; for (const x of RANKS) if (L >= x.min) r = x; return r; };
const rankIdx = L => RANKS.indexOf(rankOf(L));

const SLOTS = { weapon: { ico: '†', n: 'Arma' }, armor: { ico: '▣', n: 'Armadura' }, ring: { ico: '◯', n: 'Acessório' } };
const NAMES = {
  weapon: ['Adaga Enferrujada', 'Adaga de Aço', 'Presa do Lobo', 'Presa Venenosa de Kasaka', 'Matadora de Cavaleiros', 'Adaga do Rei Demônio'],
  armor: ['Jaqueta Gasta', 'Capuz Reforçado', 'Colete do Caçador', 'Manto do Cavaleiro Rubro', 'Armadura do Monarca', 'Traje do Rei das Sombras'],
  ring: ['Anel de Cobre', 'Colar da Sorte', 'Anel do Lobo Alfa', 'Brinco da Rainha', 'Colar do Demônio', 'Anel do Monarca'],
};
const SUBS = [
  { k: 'crit', n: 'Chance Crítica', u: '%', b: 1.5 }, { k: 'cdmg', n: 'Dano Crítico', u: '%', b: 7 },
  { k: 'aspd', n: 'Vel. de Ataque', u: '%', b: 3 }, { k: 'hpp', n: 'HP', u: '%', b: 5 },
  { k: 'gold', n: 'Ouro', u: '%', b: 7 }, { k: 'expb', n: 'EXP', u: '%', b: 5 },
  { k: 'luck', n: 'Sorte', u: '', b: 2 }, { k: 'atkp', n: 'Ataque', u: '%', b: 4 },
];
const SUBN = Object.fromEntries(SUBS.map(s => [s.k, s]));

const GRADES = [
  { n: 'Normal', c: '#9aa4b8', m: 1 }, { n: 'Elite', c: '#5fe07a', m: 1.6 }, { n: 'Cavaleiro', c: '#56b8ff', m: 2.6 },
  { n: 'Cavaleiro de Elite', c: '#b57bff', m: 3.8 }, { n: 'Comandante', c: '#ffb020', m: 5.5 }, { n: 'Marechal', c: '#ff3b6b', m: 9 },
];

// Monstros: mapas de pixels 12–14 colunas
const MON = {
  goblin: {
    n: 'Goblin', boss: 'Rei Goblin', hp: 1, dmg: 1, spd: 1.1, pal: { g: '#5aa04a', e: '#ffe14a', m: '#2a1a10', b: '#6b4a2a', d: '#3a2a1a' },
    map: ['...gggggg...', 'g.gggggggg.g', 'gggeggggeggg', '.ggggmmgggg.', '..gggggggg..', '...bbbbbb...', '..gbbbbbbg..', '.g.bbbbbb.g.', '...bbbbbb...', '...gg..gg...', '...gg..gg...', '..ddd..ddd..'],
  },
  wolf: {
    n: 'Lobo de Aço', boss: 'Fang, Lobo Alfa', hp: .8, dmg: 1.1, spd: 1.65, pal: { g: '#8a93a6', e: '#ff4a4a', n: '#1a1a22', d: '#4a5060' },
    map: ['..........g.g.', '.........gggg.', 'g.......ggeggn', 'gg.gggggggggg.', '.ggggggggggg..', '..gggggggggg..', '..gg..gg.gg...', '..dd..dd.dd...'],
  },
  orc: {
    n: 'Orc Alto', boss: 'Kargalgan', hp: 2.2, dmg: 1.45, spd: .8, pal: { o: '#4f7a3a', e: '#ff3030', t: '#f2ecd8', m: '#1a1008', r: '#7a2a20', b: '#3a2a1a', d: '#2a1a10' },
    map: ['....oooooo....', '...oooooooo...', '...oeooooeo...', '...ootmmtoo...', '....oooooo....', '.oo.rrrrrr.oo.', 'oooorrrrrroooo', 'oo.rrrrrrrr.oo', '...rrrrrrrr...', '...bbbbbbbb...', '...oo....oo...', '..ddd....ddd..'],
  },
  elf: {
    n: 'Elfo de Gelo', boss: 'Baruka', hp: 1, dmg: 1.2, spd: 1, ranged: true, pal: { c: '#2f5fa8', s: '#bfe6ff', e: '#00e5ff', w: '#e8f6ff' },
    map: ['....cccc....', '...cccccc...', '...sesses...', '...ssssss...', '..cccccccc..', '.sccwwwwccs.', '..cccwwccc..', '..cccccccc..', '.cccccccccc.', 'cccccccccccc', '...ss..ss...'],
  },
  knight: {
    n: 'Cavaleiro Rubro', boss: 'Igris', hp: 1.8, dmg: 1.4, spd: .95, pal: { p: '#ff3040', k: '#23232e', e: '#ff4a4a', r: '#9a1a24' },
    map: ['.....pp.....', '....kkkk....', '...kkkkkk...', '...kkeeekk..', '...kkkkkk...', '.rrrkkkkrrr.', 'rrrrrrrrrrrr', 'rr.rrkkrr.rr', '...rrrrrr...', '...kk..kk...', '...kk..kk...', '..rrr..rrr..'],
  },
  ant: {
    n: 'Formiga Mutante', boss: 'Beru', hp: 1.4, dmg: 1.6, spd: 1.4, pal: { a: '#3a2458', e: '#ff3050', m: '#a07ad0' },
    map: ['.m........m.', '..m.aaaa.m..', '...aeaaea...', '...aaaaaa...', 'a...aaaa...a', '.a.aaaaaa.a.', '..aaaaaaaa..', '.a.aaaaaa.a.', 'a..aaaaaa..a', '...aaaaaa...', '..a..aa..a..', '.a........a.'],
  },
};
const THEMES = [
  { r: 'E', names: ['Caverna dos Goblins', 'Covil dos Lobos', 'Mina Abandonada'], mons: ['goblin', 'wolf'], floor: [38, 44, 60] },
  { r: 'D', names: ['Túnel Subterrâneo', 'Ruínas da Estação', 'Esgoto Profundo'], mons: ['goblin', 'wolf', 'orc'], floor: [48, 40, 36] },
  { r: 'C', names: ['Floresta de Gelo', 'Fortaleza dos Orcs', 'Lago Congelado'], mons: ['orc', 'elf', 'wolf'], floor: [30, 52, 64] },
  { r: 'B', names: ['Castelo do Cavaleiro', 'Templo Carmesim', 'Catedral em Ruínas'], mons: ['knight', 'elf', 'orc'], floor: [54, 30, 36] },
  { r: 'A', names: ['Torre do Demônio', 'Cidadela Sombria', 'Abismo Violeta'], mons: ['knight', 'ant', 'elf'], floor: [44, 30, 60] },
  { r: 'S', names: ['Ilha de Jeju', 'Ninho da Rainha', 'Portão do Monarca'], mons: ['ant', 'knight'], floor: [50, 24, 34] },
];

// ---------------------------------------------------------------- save
const SAVE_KEY = 'arise_save_v1';
let S = null;          // estado persistente
const P = {};          // atributos derivados
function newSave() {
  return {
    name: 'Caçador', lvl: 1, exp: 0, gold: 0, stones: 0, pts: 0,
    st: { str: 10, agi: 10, vit: 10, int: 10, per: 10 },
    inv: [], eq: { weapon: null, armor: null, ring: null }, shadows: [], boxes: 1, dboxes: 0,
    titles: ['O Jogador'], title: 'O Jogador', kills: 0, gates: 0, bosses: 0, autoEq: true, autoPts: false,
    daily: { date: '', kills: 0, dist: 0, skills: 0, gates: 0, claimed: false, streak: 0 },
    gateList: null, uid: 1, maxPower: 0,
  };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function load() {
  try { const t = localStorage.getItem(SAVE_KEY); if (t) return Object.assign(newSave(), JSON.parse(t)); } catch (e) { }
  return null;
}

// ---------------------------------------------------------------- itens
function itemMain(it) {
  const m = RAR[it.rar].m * it.roll * (1 + .12 * it.plus);
  if (it.slot === 'weapon') return 6 * 1.1 ** it.ilvl * m;
  if (it.slot === 'armor') return 4 * 1.095 ** it.ilvl * m;
  return 2.5 * 1.1 ** it.ilvl * m;
}
const mainLabel = it => it.slot === 'armor' ? 'DEF' : 'ATK';
function itemScore(it) {
  if (!it) return 0;
  let s = itemMain(it);
  for (const x of it.subs) s *= 1 + x.v * (x.k === 'luck' ? .004 : x.k === 'gold' || x.k === 'expb' ? .002 : .01);
  return s;
}
function makeItem(ilvl, rar, slot) {
  slot = slot || pick(['weapon', 'weapon', 'armor', 'ring']);
  const keys = SUBS.slice().sort(() => Math.random() - .5), subs = [];
  for (let i = 0; i < rar; i++) {
    const s = keys[i];
    subs.push({ k: s.k, v: +(s.b * rnd(.7, 1.3) * (1 + rar * .25) * (1 + ilvl * .01)).toFixed(1) });
  }
  return { id: S.uid++, slot, rar, ilvl: Math.max(1, ilvl), plus: 0, name: NAMES[slot][rar], roll: +rnd(.85, 1.15).toFixed(3), subs };
}
function rollRarity(bonus = 0, floor = 0) {
  const luck = (P.luck || 0) + bonus;
  return Math.max(floor, wpick(RAR, r => r.w * (r.id >= 2 ? 1 + luck * .025 : 1)).id);
}
const sellValue = it => Math.floor(10 * 1.08 ** it.ilvl * (it.rar + 1) ** 2 * (1 + it.plus * .25));
const enhCost = it => Math.floor(40 * 1.1 ** it.ilvl * (it.plus + 1) ** 1.6);
const enhChance = it => Math.max(.15, 1 - it.plus * .075);

// ---------------------------------------------------------------- progresso
const need = L => Math.floor(25 * L ** 1.6 + 20);
function recalc() {
  const s = S.st, L = S.lvl, sub = {};
  for (const k in S.eq) { const it = S.eq[k]; if (it) for (const x of it.subs) sub[x.k] = (sub[x.k] || 0) + x.v; }
  const g = k => sub[k] || 0;
  const w = S.eq.weapon ? itemMain(S.eq.weapon) : 0, a = S.eq.armor ? itemMain(S.eq.armor) : 0, r = S.eq.ring ? itemMain(S.eq.ring) : 0;
  P.atk = ((5 + s.str * 2) * 1.03 ** L + w + r) * (1 + g('atkp') / 100);
  P.def = a + s.vit * .5;
  P.hp = ((100 + s.vit * 12 + L * 10) * 1.025 ** L + a * 3) * (1 + g('hpp') / 100);
  P.mp = 60 + s.int * 6; P.mpReg = 3 + s.int * .15;
  P.crit = Math.min(75, 5 + s.per * .4 + g('crit'));
  P.cdmg = 150 + s.agi * .8 + g('cdmg');
  P.aspd = 1 + s.agi * .006 + g('aspd') / 100;
  P.spd = Math.min(380, 210 + s.agi * .8);
  P.luck = s.per + g('luck');
  P.goldB = 1 + g('gold') / 100; P.expB = 1 + g('expb') / 100;
  P.pickR = 120 + s.per * 2;
  P.cap = Math.min(24, 3 + Math.floor(s.int / 10) + Math.floor(L / 10));
  P.power = Math.floor(P.atk * (1 + P.crit / 100 * (P.cdmg / 100 - 1)) * P.aspd * 3 + P.hp / 4 + P.def * 2 + armyPower() * .5);
  if (P.power > S.maxPower) S.maxPower = P.power;
}
const shadowPow = sh => (P.atk || 10) * GRADES[sh.grade].m * (.25 + .035 * sh.lvl);
function deployed() {
  return S.shadows.slice().sort((a, b) => b.grade - a.grade || b.lvl - a.lvl).slice(0, P.cap || 3);
}
function armyPower() { let t = 0; for (const s of deployed()) t += GRADES[s.grade].m * (.25 + .035 * s.lvl) * 10; return t * (P.atk || 10) / 10; }

function unlockTitle(t) {
  if (S.titles.includes(t)) return;
  S.titles.push(t); S.title = t;
  sysMsg('TÍTULO', `Título adquirido: <b style="color:var(--gold)">${esc(t)}</b>`); sfx.quest();
}

// ---------------------------------------------------------------- DOM helpers
const sysq = $('#sysq');
function sysMsg(head, html, ms = 2600) {
  const d = document.createElement('div');
  d.className = 'sysmsg sysw';
  d.innerHTML = `<span class="h">[${head}]</span>${html}`;
  sysq.appendChild(d);
  while (sysq.children.length > 3) sysq.firstChild.remove();
  sfx.sys();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, ms);
}
function lootToast(txt, col) {
  const box = $('#loot'), d = document.createElement('div');
  d.className = 'lt'; d.style.color = col; d.textContent = txt;
  box.prepend(d);
  while (box.children.length > 6) box.lastChild.remove();
  setTimeout(() => d.remove(), 3500);
}
function banner(t, s, col = '#fff', glow = '#8b5cf6') {
  const b = $('#banner'); $('#bnT').textContent = t; $('#bnS').textContent = s || '';
  $('#bnT').style.color = col; $('#bnT').style.textShadow = `0 0 24px ${glow}, 4px 4px 0 #000`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function flash(o = .7, col = '#fff') {
  const f = $('#flash'); f.style.background = col; f.style.transition = 'none'; f.style.opacity = o;
  requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; });
}
let faceOverride = null, faceT = 0;
function setFace(i, t = 2) { faceOverride = i; faceT = t; }
function showModal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function hideModal() { $('#modal').classList.add('hidden'); }

// ---------------------------------------------------------------- canvas / imagens
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, CH = 0, DPR = 1, Z = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; CH = window.innerHeight;
  cv.width = Math.floor(W * DPR); cv.height = Math.floor(CH * DPR);
  Z = clamp(Math.sqrt(W * CH) / Math.sqrt(1100 * 640), .72, 1.5);
}
window.addEventListener('resize', resize); resize();

const IMG = { hero: new Image() };
IMG.hero.src = 'assets/hero_sheet.png';
const HF = window.HERO_FRAMES || {};
const ANCHOR = { atk1: .4, atk2: .45, atk3: .4, atk0: .5 };

// sprites de monstros pré-renderizados: normal / sombra / branco / ouro
const SPR = {};
function buildSprites() {
  for (const k in MON) {
    const m = MON[k], h = m.map.length, w = Math.max(...m.map.map(r => r.length));
    const mk = fn => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      m.map.forEach((row, y) => [...row].forEach((ch, i) => {
        if (ch === '.') return; const col = fn(ch); if (!col) return;
        x.fillStyle = col; x.fillRect(i, y, 1, 1);
      }));
      return c;
    };
    SPR[k] = {
      n: mk(ch => m.pal[ch]),
      s: mk(ch => ch === 'e' ? '#d4b0ff' : ch === 't' || ch === 'w' ? '#6a4aa8' : '#150b26'),
      w: mk(() => '#ffffff'),
      g: mk(ch => ch === 'e' ? '#fff' : '#e8b020'),
      w_: w, h_: h,
    };
  }
}
buildSprites();

// ---------------------------------------------------------------- input
const keys = new Set();
const joy = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (scene === 'dungeon' && G) {
    if (k === ' ') castAoe();
    if (k === 'shift') dash();
    if (k === 'e') tryArise();
    if (k === 'escape' || k === 'p') togglePause();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
const stick = $('#stick');
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (scene !== 'dungeon' || e.pointerType === 'mouse') return;
  joy.on = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
  stick.style.display = 'block'; stick.style.left = (e.clientX - 55) + 'px'; stick.style.top = (e.clientY - 55) + 'px';
});
window.addEventListener('pointermove', e => {
  if (!joy.on || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy);
  if (l > 45) { dx *= 45 / l; dy *= 45 / l; }
  joy.x = dx / 45; joy.y = dy / 45;
  stick.firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
});
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.on = false; joy.x = joy.y = 0; stick.style.display = 'none'; stick.firstElementChild.style.transform = ''; };
window.addEventListener('pointerup', joyEnd); window.addEventListener('pointercancel', joyEnd);
$('#skDash').addEventListener('pointerdown', e => { e.stopPropagation(); dash(); });
$('#skAoe').addEventListener('pointerdown', e => { e.stopPropagation(); castAoe(); });
$('#skArise').addEventListener('pointerdown', e => { e.stopPropagation(); tryArise(); });
$('#pauseBtn').addEventListener('click', () => togglePause());
document.addEventListener('click', e => { if (e.target.closest('button')) { audioInit(); sfx.click(); } }, true);

// ---------------------------------------------------------------- estado de jogo
let scene = 'title';
let G = null;            // estado da dungeon atual
let H = null;            // herói em combate
let paused = false;
let shake = 0, hitstop = 0, slowmo = 0;
const cam = { x: 0, y: 0 };
const WORLD = { w: 2400, h: 1600 };

// ---------------------------------------------------------------- gates
function genGate(offset) {
  const L = Math.max(1, S.lvl + offset);
  const ti = Math.min(THEMES.length - 1, rankIdx(L));
  const th = THEMES[ti];
  const g = {
    id: Math.random().toString(36).slice(2, 8), lvl: L, rank: rankOf(L).r, ti, name: pick(th.names),
    red: false, treasure: false, double: false, mult: 1 + Math.max(0, offset) * .08, count: 34 + ti * 7,
  };
  if (offset >= 10) g.mult *= 1.6;
  const roll = Math.random();
  if (roll < .07) { g.red = true; g.mult *= 3; g.name = 'Gate Vermelho: ' + g.name; }
  else if (roll < .13) { g.treasure = true; g.name = 'Gate do Tesouro'; }
  else if (roll < .16 && L >= 5) { g.double = true; g.mult *= 2.5; g.name = 'Dungeon Dupla'; }
  else if (roll < .17) { g.lvl += 20; g.mult *= 6; g.rank = rankOf(g.lvl).r; g.name = 'Fenda Instável'; g.ti = Math.min(5, rankIdx(g.lvl)); }
  return g;
}
function refreshGates() { S.gateList = [-3, 0, 4, 11].map(genGate); if (S.lvl < 4) S.gateList[0] = genGate(0); }

// ---------------------------------------------------------------- dungeon
function buildFloor(gate) {
  const c = document.createElement('canvas'); c.width = WORLD.w; c.height = WORLD.h;
  const x = c.getContext('2d');
  const [r, g, b] = THEMES[gate.ti].floor;
  const T = 48;
  for (let ty = 0; ty < WORLD.h / T; ty++) for (let tx = 0; tx < WORLD.w / T; tx++) {
    const v = rnd(-7, 7);
    x.fillStyle = `rgb(${r + v},${g + v},${b + v})`; x.fillRect(tx * T, ty * T, T, T);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(tx * T, ty * T + T - 2, T, 2); x.fillRect(tx * T + T - 2, ty * T, 2, T);
    x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(tx * T, ty * T, T, 2);
    if (chance(.08)) {
      x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 2; x.beginPath();
      let px = tx * T + rnd(T), py = ty * T + rnd(T); x.moveTo(px, py);
      for (let i = 0; i < 4; i++) { px += rnd(-14, 14); py += rnd(-14, 14); x.lineTo(px, py); } x.stroke();
    }
  }
  // runas de invocação
  for (let i = 0; i < 7; i++) {
    const cx = rnd(200, WORLD.w - 200), cy = rnd(200, WORLD.h - 200), rr = rnd(40, 90);
    x.strokeStyle = gate.red ? 'rgba(255,60,80,.18)' : 'rgba(139,92,246,.16)'; x.lineWidth = 3;
    x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.stroke();
    x.beginPath(); x.arc(cx, cy, rr * .7, 0, 7); x.stroke();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * rr * .7, cy + Math.sin(a) * rr * .7); x.lineTo(cx + Math.cos(a + 2.1) * rr * .7, cy + Math.sin(a + 2.1) * rr * .7); x.stroke(); }
  }
  // paredes
  x.fillStyle = '#05070d'; const B = 40;
  x.fillRect(0, 0, WORLD.w, B); x.fillRect(0, WORLD.h - B, WORLD.w, B); x.fillRect(0, 0, B, WORLD.h); x.fillRect(WORLD.w - B, 0, B, WORLD.h);
  x.fillStyle = `rgb(${r * 1.6},${g * 1.6},${b * 1.6})`;
  x.fillRect(B, B, WORLD.w - 2 * B, 4); x.fillRect(B, WORLD.h - B - 4, WORLD.w - 2 * B, 4); x.fillRect(B, B, 4, WORLD.h - 2 * B); x.fillRect(WORLD.w - B - 4, B, 4, WORLD.h - 2 * B);
  if (gate.red) { x.fillStyle = 'rgba(180,10,30,.18)'; x.fillRect(0, 0, WORLD.w, WORLD.h); }
  return c;
}

function enterGate(gate) {
  recalc();
  G = {
    gate, floor: buildFloor(gate), en: [], proj: [], drops: [], fx: [], txt: [], corpses: [], army: [], rings: [],
    kills: 0, total: gate.count, spawnT: 0, alive: 8 + gate.ti * 2, bossOut: false, boss: null, state: 'fight', t: 0,
    combo: 0, comboT: 0, bestCombo: 0, orbChain: 0, orbT: 0,
    loot: { exp: 0, gold: 0, items: [], shadows: [], lvls: 0, box: 0, stones: 0 },
    urgent: null, urgentT: rnd(18, 30), secondBoss: false, torches: [], clearT: 0,
  };
  for (let x = 160; x < WORLD.w; x += 320) G.torches.push({ x, y: 44 }, { x, y: WORLD.h - 30 });
  H = {
    x: WORLD.w / 2, y: WORLD.h / 2, dir: 'front', hp: P.hp, mp: P.mp, atkCd: .4, act: null, inv: 1, dashCd: 0, aoeCd: 0,
    walkT: 0, moving: false, dashT: 0, dvx: 0, dvy: 0, lastX: WORLD.w / 2, lastY: WORLD.h / 2, flip: false, ariseT: 0, ariseTarget: null,
  };
  cam.x = H.x; cam.y = H.y;
  for (const sh of deployed()) G.army.push({ sh, x: H.x + rnd(-80, 80), y: H.y + rnd(-80, 80), atkCd: rnd(.5), tgt: null, face: 1, bob: rnd(7) });
  scene = 'dungeon'; paused = false;
  $('#hub').classList.add('hidden'); $('#hud').classList.remove('hidden');
  $('#gateName').textContent = `[${gate.rank}] ${gate.name}`;
  banner(gate.red ? 'GATE VERMELHO' : `RANK ${gate.rank}`, gate.name.toUpperCase(), gate.red ? '#ff5a6a' : rankOf(gate.lvl).c, gate.red ? '#ff0030' : '#56b8ff');
  if (gate.red) sysMsg('AVISO', 'Você entrou em um Gate Vermelho. <b style="color:var(--blood)">Não há como fugir.</b>');
  else if (gate.treasure) sysMsg('SISTEMA', 'Goblins dourados detectados. <b style="color:var(--gold)">Ouro x5!</b>');
  else if (gate.double) sysMsg('SISTEMA', 'Algo antigo dorme nesta dungeon...');
  if (G.army.length) setTimeout(() => sysMsg('SOMBRAS', `${G.army.length} soldado(s) das sombras convocado(s).`), 900);
  sfx.boss();
}

function spawnEnemy(type, opts = {}) {
  const gate = G.gate, m = MON[type];
  let x, y, tries = 0;
  do { x = rnd(90, WORLD.w - 90); y = rnd(90, WORLD.h - 90); tries++; } while (tries < 30 && (x - H.x) ** 2 + (y - H.y) ** 2 < (opts.boss ? 380 : 480) ** 2);
  const L = opts.lvl || gate.lvl + ri(0, 2);
  const redM = gate.red ? 1.5 : 1;
  const elite = !opts.boss && chance(.07);
  const golden = gate.treasure && !opts.boss && chance(.5);
  let hp = 32 * 1.1 ** L * m.hp * redM, dmg = 8 * 1.085 ** L * m.dmg * redM;
  if (elite) { hp *= 4; dmg *= 1.5; }
  if (opts.boss) { hp *= opts.hpM || 30; dmg *= 2; }
  const e = {
    type, x, y, hp, max: hp, dmg, lvl: L, elite, golden, boss: !!opts.boss, ranged: m.ranged,
    spd: (55 + L * .4) * m.spd * (opts.boss ? .85 : 1) * rnd(.9, 1.1), px: opts.boss ? 9 : elite ? 5 : 4,
    hitT: 0, kx: 0, ky: 0, atkCd: rnd(.5, 1.5), shootCd: rnd(1, 2.5), face: 1, spawnT: .5, bob: rnd(7),
    name: opts.boss ? (opts.name || m.boss) : m.n,
  };
  e.r = SPR[type].w_ * e.px * .38;
  e.exp = 6 * 1.075 ** L * (elite ? 5 : 1) * (e.boss ? 40 : 1);
  e.gold = 3 * 1.08 ** L * (elite ? 5 : 1) * (e.boss ? 30 : 1) * (golden ? 12 : 1);
  G.en.push(e);
  for (let i = 0; i < 12; i++) G.fx.push({ x: e.x + rnd(-20, 20), y: e.y + rnd(-10, 10), vx: rnd(-30, 30), vy: rnd(-90, -20), t: 0, life: .6, col: opts.boss ? '#ff3050' : '#8b5cf6', s: rnd(2, 5) });
  return e;
}

function spawnBoss(second) {
  const th = THEMES[G.gate.ti];
  const type = second ? pick(['knight', 'ant']) : pick(th.mons);
  const name = second ? 'Estátua do Deus' : MON[type].boss;
  const lvl = G.gate.lvl + (second ? 10 : 3);
  const b = spawnEnemy(type, { boss: true, lvl, name, hpM: second ? 55 : 30 });
  if (second) b.px = 11;
  b.r = SPR[type].w_ * b.px * .38;
  G.boss = b; G.bossOut = true;
  banner(second ? 'DESPERTAR' : 'CHEFE', name.toUpperCase(), '#ff4a5a', '#ff0020');
  sysMsg('AVISO', `O chefe <b style="color:var(--blood)">${esc(name)}</b> (Lv.${lvl}) apareceu!`);
  sfx.boss(); shake = 18; setFace(5, 4);
}

// ---------------------------------------------------------------- combate
function dmgText(x, y, v, col, size = 18, crit = false) {
  G.txt.push({ x: x + rnd(-10, 10), y, v: typeof v === 'number' ? fmt(v) : v, col, size, crit, t: 0, life: crit ? 1 : .8, vx: rnd(-25, 25) });
}
function burst(x, y, col, n = 10, sp = 160, life = .5, s = 3) {
  for (let i = 0; i < n; i++) { const a = rnd(Math.PI * 2), v = rnd(sp * .3, sp); G.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: life * rnd(.6, 1.2), col, s: rnd(s * .5, s * 1.3) }); }
}
function hitEnemy(e, base, src = 'hero') {
  if (e.dead) return;
  const crit = src !== 'shadow' && chance(P.crit / 100);
  let dmg = base * rnd(.9, 1.1) * (crit ? P.cdmg / 100 : 1);
  e.hp -= dmg; e.hitT = .1;
  const a = Math.atan2(e.y - H.y, e.x - H.x), kb = e.boss ? 40 : crit ? 260 : 150;
  e.kx += Math.cos(a) * kb; e.ky += Math.sin(a) * kb;
  if (crit) { dmgText(e.x, e.y - e.r * 2.2, dmg, '#ffe14a', 30, true); sfx.crit(); hitstop = Math.max(hitstop, .045); shake = Math.max(shake, 5); burst(e.x, e.y - e.r, '#ffe14a', 8, 220, .35, 3); }
  else { dmgText(e.x, e.y - e.r * 2.2, dmg, src === 'shadow' ? '#c4a5ff' : '#ffffff', src === 'aoe' ? 22 : 17); sfx.hit(); burst(e.x, e.y - e.r, src === 'shadow' ? '#8b5cf6' : '#ffffff', 4, 140, .25, 2); }
  if (e.hp <= 0) killEnemy(e);
}

function heroAttack() {
  let best = null, bd = 1e12;
  for (const e of G.en) { if (e.dead || e.spawnT > 0) continue; const d = d2(e, H) - (e.r * e.r); if (d < bd) { bd = d; best = e; } }
  const range = 105;
  if (!best || bd > range * range) return false;
  const ang = Math.atan2(best.y - best.r - (H.y - 26), best.x - H.x);
  H.flip = best.x < H.x;
  H.act = { k: 'atk', t: 0, dur: .3, frames: pick([['atk1', 'atk2'], ['atk2', 'atk3'], ['atk1', 'atk3']]) };
  G.fx.push({ k: 'slash', x: H.x, y: H.y - 26, a: ang, t: 0, life: .22, r: 70 });
  for (const e of G.en) {
    if (e.dead || e.spawnT > 0) continue;
    const dx = e.x - H.x, dy = (e.y - e.r) - (H.y - 26), dd = Math.hypot(dx, dy);
    if (dd > range + e.r) continue;
    let da = Math.abs(((Math.atan2(dy, dx) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da < 1.1 || dd < e.r + 24) hitEnemy(e, P.atk);
  }
  return true;
}

function castAoe() {
  if (!G || G.state !== 'fight' && G.state !== 'boss' || paused || !H || H.hp <= 0) return;
  if (H.aoeCd > 0 || H.mp < 30 || (H.act && H.act.k === 'skill')) { if (H.mp < 30) dmgText(H.x, H.y - 80, 'MP insuficiente', '#56b8ff', 14); return; }
  H.mp -= 30; H.aoeCd = 3.5; H.act = { k: 'skill', t: 0, dur: .8, fired: false }; H.inv = Math.max(H.inv, .9);
  S.daily.skills++;
}
function aoeBlast() {
  const R = 270;
  G.rings.push({ x: H.x, y: H.y - 20, t: 0, life: .55, R, col: '#8b5cf6' });
  G.rings.push({ x: H.x, y: H.y - 20, t: -.08, life: .6, R: R * .8, col: '#c4a5ff' });
  burst(H.x, H.y - 20, '#8b5cf6', 60, 520, .8, 4); burst(H.x, H.y - 20, '#1a0b33', 30, 300, .9, 7);
  sfx.aoe(); shake = 16; hitstop = .06;
  for (const e of G.en) if (!e.dead && d2(e, H) < (R + e.r) ** 2) hitEnemy(e, P.atk * (3.2 + S.st.int * .02), 'aoe');
  for (const p of G.proj) p.dead = true;
}
function dash() {
  if (!G || paused || !H || H.hp <= 0 || H.dashCd > 0 || (H.act && H.act.k === 'skill')) return;
  let mx = 0, my = 0;
  if (H.moveX || H.moveY) { mx = H.moveX; my = H.moveY; } else { mx = H.flip ? -1 : 1; }
  const l = Math.hypot(mx, my) || 1;
  H.dvx = mx / l * 950; H.dvy = my / l * 950; H.dashT = .17; H.dashCd = 1.1; H.inv = Math.max(H.inv, .3);
  sfx.dash();
}
function heroHurt(raw) {
  if (H.inv > 0 || H.hp <= 0 || G.state === 'clear') return;
  const ref = 50 * 1.09 ** G.gate.lvl;
  const dmg = raw * (1 - P.def / (P.def + ref));
  H.hp -= dmg; H.inv = .45; shake = Math.max(shake, 7);
  dmgText(H.x, H.y - 70, dmg, '#ff4a5a', 20);
  sfx.hurt();
  if (!H.act || H.act.k !== 'skill') H.act = { k: 'hurt', t: 0, dur: .22 };
  G.combo = Math.max(0, Math.floor(G.combo * .5));
  if (H.hp <= 0) heroDie();
}

function killEnemy(e) {
  e.dead = true; G.kills++; S.kills++; S.daily.kills++;
  G.combo++; G.comboT = 3; if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  const cm = 1 + Math.min(G.combo, 200) * .01;
  if ([10, 25, 50, 100, 200, 300].includes(G.combo)) {
    const lab = { 10: 'MATANÇA', 25: 'FÚRIA', 50: 'IMPARÁVEL', 100: 'MASSACRE', 200: 'MONARCA', 300: 'LENDA VIVA' }[G.combo];
    banner(G.combo + 'x', lab, '#c4a5ff'); sfx.quest(); setFace(2, 1.5);
  }
  if (G.urgent && !G.urgent.done) G.urgent.got++;
  sfx.kill();
  burst(e.x, e.y - e.r, e.golden ? '#ffcf4a' : e.boss ? '#ff3050' : '#8b5cf6', e.boss ? 80 : 14, e.boss ? 500 : 220, .6, e.boss ? 6 : 3);
  // EXP em orbes
  const exp = e.exp * cm * P.expB * G.gate.mult;
  const n = e.boss ? 24 : e.elite ? 8 : ri(1, 3);
  for (let i = 0; i < n; i++) popDrop(e, { k: 'exp', v: exp / n });
  // ouro
  if (chance(e.golden || e.boss ? 1 : .55)) {
    const gold = e.gold * rnd(.7, 1.4) * P.goldB * G.gate.mult * (G.gate.treasure ? 5 : 1);
    const gn = e.boss || e.golden ? 14 : 1;
    for (let i = 0; i < gn; i++) popDrop(e, { k: 'gold', v: gold / gn });
  }
  // itens
  const itemCount = e.boss ? 3 + (G.gate.red ? 2 : 0) : e.elite ? 1 : chance(.045 + P.luck * .0004) ? 1 : 0;
  for (let i = 0; i < itemCount; i++) {
    const rar = rollRarity(e.boss ? 30 : e.elite ? 12 : 0, e.boss ? 2 : e.elite ? 1 : 0);
    popDrop(e, { k: 'item', it: makeItem(e.lvl + ri(-1, 2), G.gate.red ? Math.max(rar, 2) : rar) });
  }
  if (chance(.03)) popDrop(e, { k: 'potion' });
  if (e.boss || chance(.003)) popDrop(e, { k: 'box' });
  if (e.elite || e.boss) popDrop(e, { k: 'stone', v: e.boss ? ri(3, 6) : 1 });
  // cadáver para ARISE
  if (e.boss || e.elite || chance(.12)) {
    G.corpses.push({ x: e.x, y: e.y, type: e.type, boss: e.boss, elite: e.elite, name: e.name, lvl: e.lvl, t: e.boss ? 40 : 12, tries: 3, fails: 0, px: e.px });
    if (e.boss) setTimeout(() => sysMsg('SISTEMA', 'Extração de sombra disponível. Diga <b style="color:var(--shadow-hi)">ARISE</b> (tecla E).', 3500), 800);
  }
  if (e.boss) bossDown(e);
}

function popDrop(e, d) {
  const a = rnd(Math.PI * 2), v = rnd(80, 240) * (e.boss ? 1.6 : 1);
  d.x = e.x; d.y = e.y - 10; d.vx = Math.cos(a) * v; d.vy = Math.sin(a) * v; d.z = 0; d.vz = rnd(160, 300); d.t = 0;
  G.drops.push(d);
  if (d.k === 'item' && d.it.rar >= 3) {
    sfx.drop(d.it.rar);
    if (d.it.rar >= 4) {
      slowmo = .9; flash(.5, RAR[d.it.rar].c); shake = 14; setFace(4, 2.5);
      banner(RAR[d.it.rar].n.toUpperCase() + '!', d.it.name, RAR[d.it.rar].c, RAR[d.it.rar].c);
      sfx.legend();
    }
  }
}

function collect(d) {
  d.dead = true;
  if (d.k === 'exp') {
    G.orbChain = G.orbT > 0 ? G.orbChain + 1 : 0; G.orbT = .35; sfx.orb(G.orbChain);
    gainExp(d.v);
  } else if (d.k === 'gold') {
    const v = Math.max(1, Math.round(d.v)); S.gold += v; G.loot.gold += v; sfx.coin();
  } else if (d.k === 'item') {
    addItem(d.it, true);
  } else if (d.k === 'potion') {
    const h = P.hp * .35; H.hp = Math.min(P.hp, H.hp + h); dmgText(H.x, H.y - 80, '+' + fmt(h), '#5fe07a', 20); sfx.quest();
  } else if (d.k === 'box') {
    S.boxes++; G.loot.box++; lootToast('+1 Caixa Aleatória', '#ffcf4a'); sfx.drop(3);
  } else if (d.k === 'stone') {
    S.stones += d.v; G.loot.stones += d.v; lootToast(`+${d.v} Pedra de Mana`, '#c4a5ff'); sfx.coin();
  }
}

function addItem(it, fromDrop) {
  const r = RAR[it.rar];
  if (fromDrop) G.loot.items.push(it);
  const cur = S.eq[it.slot];
  if (S.autoEq && itemScore(it) > itemScore(cur)) {
    if (cur) S.inv.push(cur);
    S.eq[it.slot] = it; recalc();
    if (H) H.hp = Math.min(P.hp, H.hp);
    lootToast(`▲ EQUIPADO [${r.n}] ${it.name}`, r.c);
  } else {
    S.inv.push(it);
    lootToast(`[${r.n}] ${it.name}`, r.c);
  }
  // inventário cheio: vende automaticamente os piores comuns
  if (S.inv.length > 60) {
    S.inv.sort((a, b) => itemScore(b) - itemScore(a));
    const out = S.inv.splice(60); let g = 0; for (const x of out) g += sellValue(x); S.gold += g;
  }
}

function gainExp(v) {
  S.exp += v; if (G) G.loot.exp += v;
  let ups = 0; const oldRank = rankOf(S.lvl).r;
  while (S.exp >= need(S.lvl)) { S.exp -= need(S.lvl); S.lvl++; S.pts += 5; ups++; }
  if (!ups) return;
  if (S.autoPts) autoAlloc();
  recalc();
  if (G) G.loot.lvls += ups;
  if (H && G) {
    H.hp = P.hp; H.mp = P.mp;
    G.rings.push({ x: H.x, y: H.y - 26, t: 0, life: .7, R: 160, col: '#9be7ff' });
    burst(H.x, H.y - 30, '#9be7ff', 40, 300, .9, 3); burst(H.x, H.y - 30, '#ffffff', 20, 200, .7, 2);
    G.txt.push({ x: H.x, y: H.y - 90, v: 'LEVEL UP!', col: '#9be7ff', size: 34, crit: true, t: 0, life: 1.4, vx: 0 });
  }
  sfx.lvl(); setFace(2, 2);
  const xf = $('#bXpF'); xf.style.transition = 'none'; xf.style.opacity = .9; requestAnimationFrame(() => { xf.style.transition = 'opacity .6s'; xf.style.opacity = 0; });
  sysMsg('SISTEMA', `Você subiu de nível! <b style="color:var(--exp)">Lv.${S.lvl}</b> · +${5 * ups} pontos de atributo`);
  const nr = rankOf(S.lvl);
  if (nr.r !== oldRank) {
    setTimeout(() => { banner('RANK ' + nr.r, 'REAVALIAÇÃO DE CAÇADOR', nr.c, nr.c); flash(.6, nr.c); sfx.legend(); setFace(5, 3); }, 700);
    if (nr.r === 'S') unlockTitle('Caçador de Rank S');
    if (nr.r === 'MONARCA') unlockTitle('Monarca das Sombras');
  }
}

function autoAlloc() {
  const order = ['str', 'agi', 'vit', 'per', 'str', 'int', 'agi', 'str'];
  let i = S.lvl % order.length;
  while (S.pts > 0) { S.st[order[i++ % order.length]]++; S.pts--; }
}

// ---------------------------------------------------------------- ARISE
function nearCorpse() {
  if (!G || !H) return null;
  let best = null, bd = 110 * 110;
  for (const c of G.corpses) { const d = d2(c, H); if (d < bd) { bd = d; best = c; } }
  return best;
}
function tryArise() {
  if (!G || paused || !H || H.hp <= 0 || H.ariseT > 0) return;
  const c = nearCorpse(); if (!c) return;
  H.ariseT = .75; H.ariseTarget = c; H.act = { k: 'skill', t: 0, dur: .75, fired: true };
  G.txt.push({ x: H.x, y: H.y - 100, v: 'LEVANTE-SE', col: '#c4a5ff', size: 26, crit: true, t: 0, life: .9, vx: 0 });
  for (let i = 0; i < 30; i++) G.fx.push({ x: c.x + rnd(-30, 30), y: c.y + rnd(-6, 6), vx: rnd(-10, 10), vy: rnd(-160, -60), t: 0, life: rnd(.5, 1), col: pick(['#8b5cf6', '#1a0b33', '#c4a5ff']), s: rnd(3, 6) });
  tone(110, .7, 'sawtooth', .06, 220);
}
function resolveArise(c) {
  const base = c.boss ? .32 : c.elite ? .38 : .5;
  const p = Math.min(.95, base + Math.min(.3, S.st.int * .002) + c.fails * .12);
  if (chance(p)) {
    let grade;
    if (c.boss) grade = chance(.05) ? 5 : chance(.3) ? 4 : 3;
    else if (c.elite) grade = chance(.25) ? 2 : 1;
    else grade = chance(.1) ? 1 : 0;
    const sh = { id: S.uid++, type: c.type, name: c.boss ? c.name : MON[c.type].n + ' Sombrio', grade, lvl: 1 };
    S.shadows.push(sh); G.loot.shadows.push(sh);
    G.corpses.splice(G.corpses.indexOf(c), 1);
    const dep = deployed();
    if (dep.includes(sh) && G.army.length < P.cap) G.army.push({ sh, x: c.x, y: c.y, atkCd: .5, tgt: null, face: 1, bob: 0, rise: 1 });
    banner('ARISE!', `${sh.name} · ${GRADES[grade].n}`, '#e6d8ff', '#8b5cf6');
    flash(.45, '#8b5cf6'); sfx.arise(); shake = 20; hitstop = .12; setFace(5, 2.5);
    G.rings.push({ x: c.x, y: c.y, t: 0, life: .8, R: 200, col: '#8b5cf6' });
    burst(c.x, c.y - 20, '#8b5cf6', 70, 360, 1.1, 5); burst(c.x, c.y - 20, '#0a0418', 40, 200, 1.2, 8);
    sysMsg('SISTEMA', `Extração bem-sucedida. <b style="color:${GRADES[grade].c}">${esc(sh.name)}</b> [${GRADES[grade].n}] juntou-se ao seu exército.`);
    if (S.shadows.length >= 10) unlockTitle('Mestre das Sombras');
    if (c.name === 'Igris') unlockTitle('Aquele que Venceu Igris');
    recalc();
  } else {
    c.tries--; c.fails++;
    sfx.fail(); shake = 6;
    G.txt.push({ x: c.x, y: c.y - 60, v: c.tries > 0 ? `FALHOU (${c.tries} restantes)` : 'A SOMBRA SE DISSIPOU', col: '#ff6d78', size: 20, crit: true, t: 0, life: 1.2, vx: 0 });
    if (c.tries <= 0) { G.corpses.splice(G.corpses.indexOf(c), 1); burst(c.x, c.y, '#555', 20, 120, .8, 3); }
  }
}

// ---------------------------------------------------------------- fim de gate
function bossDown(b) {
  shake = 26; slowmo = 1.4; flash(.8);
  if (G.gate.double && !G.secondBoss) {
    G.secondBoss = true; G.boss = null;
    setTimeout(() => { if (G && G.state !== 'dead') spawnBoss(true); }, 2600);
    sysMsg('AVISO', 'O templo treme... <b style="color:var(--blood)">a verdadeira ameaça desperta.</b>');
    return;
  }
  G.state = 'clear'; G.clearT = 0; G.boss = null;
  for (const e of G.en) if (!e.dead) { e.dead = true; burst(e.x, e.y, '#8b5cf6', 10, 200, .6, 3); }
  S.bosses++;
  if (S.bosses === 1) unlockTitle('Caçador de Chefes');
  if (G.gate.red) unlockTitle('Aquele que Superou as Adversidades');
  setTimeout(() => { if (G) { banner('GATE LIMPO', 'MISSÃO CONCLUÍDA', '#9be7ff', '#56b8ff'); sfx.win(); setFace(2, 4); } }, 900);
}
function finishGate(fled) {
  if (!G) return;
  scene = 'result';
  const L = G.loot;
  if (!fled) {
    S.gates++; S.daily.gates++;
    for (const a of G.army) a.sh.lvl++;
  }
  refreshGates(); recalc(); save();
  const best = L.items.reduce((b, it) => !b || it.rar > b.rar ? it : b, null);
  showModal(`
    <div class="h2">${fled ? 'FUGA DO GATE' : 'RECOMPENSAS DO GATE'}</div>
    <div class="res-line"><span>Inimigos derrotados</span><b data-c="${G.kills}">0</b></div>
    <div class="res-line"><span>Maior combo</span><b data-c="${G.bestCombo}">0</b></div>
    <div class="res-line"><span>EXP obtida</span><b style="color:var(--exp)" data-c="${Math.floor(L.exp)}">0</b></div>
    <div class="res-line"><span>Ouro</span><b style="color:var(--gold)" data-c="${L.gold}">0</b></div>
    <div class="res-line"><span>Níveis ganhos</span><b style="color:var(--good)" data-c="${L.lvls}">0</b></div>
    <div class="res-line"><span>Itens</span><b data-c="${L.items.length}">0</b></div>
    <div class="res-line"><span>Sombras extraídas</span><b style="color:var(--shadow-hi)" data-c="${L.shadows.length}">0</b></div>
    ${best ? `<div class="res-line"><span>Melhor item</span><b style="color:${RAR[best.rar].c};font-size:15px">${esc(best.name)}</b></div>` : ''}
    ${!fled && G.army.length ? `<p class="muted">Suas ${G.army.length} sombras mobilizadas subiram de nível.</p>` : ''}
    <div class="row" style="margin-top:16px;display:flex;gap:10px"><button class="btn big" id="resOk">Voltar</button></div>`);
  document.querySelectorAll('#modalBody [data-c]').forEach(el => {
    const to = +el.dataset.c, t0 = performance.now(), dur = 900 + Math.min(1200, to * 2);
    let lastTick = 0;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), v = Math.floor(to * (1 - (1 - k) ** 3));
      el.textContent = fmt(v);
      if (now - lastTick > 60 && k < 1) { sfx.tick(); lastTick = now; }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  $('#resOk').onclick = () => { hideModal(); goHub('gates'); };
}
function heroDie() {
  H.hp = 0; H.act = { k: 'dead', t: 0, dur: 99 }; G.state = 'dead'; slowmo = 1.5; shake = 20; setFace(3, 99);
  sfx.fail(); tone(60, 2, 'sawtooth', .1, -20);
  const lost = Math.floor(G.loot.gold * .5); S.gold = Math.max(0, S.gold - lost);
  setTimeout(() => {
    showModal(`<div class="h2" style="color:var(--blood)">VOCÊ MORREU</div>
      <p>[SISTEMA] O Jogador sofreu dano fatal. Revivendo no ponto seguro...</p>
      <p class="muted">Você perdeu ${fmt(lost)} de ouro deste gate. EXP e itens foram mantidos.</p>
      <p class="muted">Dica: distribua seus pontos em VIT e aprimore sua armadura.</p>
      <button class="btn big" id="resOk">Reviver</button>`);
    $('#resOk').onclick = () => { hideModal(); refreshGates(); save(); goHub('status'); };
  }, 2200);
}
function togglePause() {
  if (scene !== 'dungeon' || !G || G.state === 'dead' || G.state === 'clear') return;
  paused = !paused;
  if (paused) {
    showModal(`<div class="h2">PAUSADO</div>
      <div class="kv"><span>Gate</span><span>[${G.gate.rank}] ${esc(G.gate.name)}</span></div>
      <div class="kv"><span>Progresso</span><span>${G.kills}/${G.total}</span></div>
      <div class="kv"><span>Ouro obtido</span><span>${fmt(G.loot.gold)}</span></div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <button class="btn big" id="pzGo">Continuar</button>
        <button class="btn red" id="pzFlee" ${G.gate.red ? 'disabled title="Não há fuga de um Gate Vermelho"' : ''}>Fugir do gate</button>
        <button class="btn" id="pzSnd">Som: ${SND.on ? 'ligado' : 'desligado'}</button>
      </div>`);
    $('#pzGo').onclick = togglePause;
    $('#pzFlee').onclick = () => { paused = false; hideModal(); finishGate(true); };
    $('#pzSnd').onclick = () => { SND.on = !SND.on; $('#pzSnd').textContent = 'Som: ' + (SND.on ? 'ligado' : 'desligado'); };
  } else hideModal();
}

// ---------------------------------------------------------------- update
function update(dt) {
  if (scene !== 'dungeon' || !G || paused) return;
  G.t += dt;
  const hero = H;
  // cooldowns
  hero.inv -= dt; hero.dashCd -= dt; hero.aoeCd -= dt; hero.atkCd -= dt;
  if (G.state !== 'dead') hero.mp = Math.min(P.mp, hero.mp + P.mpReg * dt);
  if (G.state !== 'dead') hero.hp = Math.min(P.hp, hero.hp + P.hp * .004 * dt);
  // movimento
  let mx = 0, my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx--; if (keys.has('d') || keys.has('arrowright')) mx++;
  if (keys.has('w') || keys.has('arrowup')) my--; if (keys.has('s') || keys.has('arrowdown')) my++;
  if (joy.on) { mx += joy.x; my += joy.y; }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  hero.moveX = mx; hero.moveY = my;
  const busy = hero.act && (hero.act.k === 'skill' || hero.act.k === 'dead');
  if (hero.dashT > 0) {
    hero.dashT -= dt; hero.x += hero.dvx * dt; hero.y += hero.dvy * dt;
    G.fx.push({ k: 'ghost', x: hero.x, y: hero.y, t: 0, life: .25, frame: curFrame(), flip: curFrame().startsWith('atk') && hero.flip });
  } else if (!busy && ml > .1) {
    hero.x += mx * P.spd * dt; hero.y += my * P.spd * dt; hero.moving = true; hero.walkT += dt;
    if (Math.abs(mx) > Math.abs(my)) { hero.dir = mx < 0 ? 'left' : 'right'; hero.flip = mx < 0; } else hero.dir = my < 0 ? 'back' : 'front';
  } else hero.moving = false;
  hero.x = clamp(hero.x, 60, WORLD.w - 60); hero.y = clamp(hero.y, 80, WORLD.h - 50);
  const md = Math.hypot(hero.x - hero.lastX, hero.y - hero.lastY); S.daily.dist += md; hero.lastX = hero.x; hero.lastY = hero.y;
  // ação
  if (hero.act) {
    hero.act.t += dt;
    if (hero.act.k === 'skill' && !hero.act.fired && hero.act.t > .5) { hero.act.fired = true; aoeBlast(); }
    if (hero.act.t >= hero.act.dur && hero.act.k !== 'dead' && hero.act.k !== 'vic') hero.act = null;
  }
  if (hero.ariseT > 0) { hero.ariseT -= dt; if (hero.ariseT <= 0 && hero.ariseTarget && G.corpses.includes(hero.ariseTarget)) resolveArise(hero.ariseTarget); }
  if (G.state === 'fight' || G.state === 'boss') {
    if (hero.atkCd <= 0 && !busy) { if (heroAttack()) hero.atkCd = .55 / P.aspd; else hero.atkCd = .08; }
  }
  // spawns
  if (G.state === 'fight') {
    const alive = G.en.filter(e => !e.dead).length;
    G.spawnT -= dt;
    const remaining = G.total - G.kills - alive;
    if (remaining > 0 && alive < G.alive && G.spawnT <= 0) {
      G.spawnT = rnd(.25, .6);
      spawnEnemy(G.gate.treasure && chance(.6) ? 'goblin' : pick(THEMES[G.gate.ti].mons));
    }
    if (G.kills >= G.total && !G.bossOut) { G.state = 'boss'; spawnBoss(false); }
  }
  // missão de urgência
  if (G.state === 'fight' || G.state === 'boss') {
    if (!G.urgent) {
      G.urgentT -= dt;
      if (G.urgentT <= 0 && G.state === 'fight') {
        const goal = ri(12, 22) + G.gate.ti * 2, time = ri(15, 22);
        G.urgent = { goal, time, t: time, got: 0, done: false };
        sysMsg('MISSÃO DE URGÊNCIA', `Derrote <b>${goal}</b> inimigos em <b>${time}s</b>.`, 3200); sfx.quest();
      }
    } else if (!G.urgent.done) {
      G.urgent.t -= dt;
      if (G.urgent.got >= G.urgent.goal) {
        G.urgent.done = true;
        const g = Math.floor(40 * 1.09 ** S.lvl * G.gate.mult);
        S.gold += g; G.loot.gold += g; gainExp(need(S.lvl) * .12);
        const bonusBox = chance(.35);
        if (bonusBox) { S.boxes++; G.loot.box++; }
        sysMsg('MISSÃO CONCLUÍDA', `+${fmt(g)} ouro · +EXP${bonusBox ? ' · <b style="color:var(--gold)">+1 Caixa Aleatória</b>' : ''}`); sfx.quest(); setFace(2, 2);
        setTimeout(() => { if (G) { G.urgent = null; G.urgentT = rnd(25, 45); } }, 1500);
      } else if (G.urgent.t <= 0) {
        G.urgent.done = true; sysMsg('MISSÃO FALHOU', 'O tempo acabou.');
        setTimeout(() => { if (G) { G.urgent = null; G.urgentT = rnd(25, 45); } }, 1500);
      }
    }
  }
  // inimigos
  const hy = hero.y - 20;
  for (const e of G.en) {
    if (e.dead) continue;
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    e.hitT -= dt; e.atkCd -= dt; e.shootCd -= dt; e.bob += dt * 8;
    // alvo: herói ou sombra mais próxima
    let tx = hero.x, ty = hero.y, td = d2(e, hero);
    for (const a of G.army) { const dd = d2(e, a); if (dd < td * .6) { td = dd; tx = a.x; ty = a.y; } }
    const dx = tx - e.x, dy = ty - e.y, dl = Math.hypot(dx, dy) || 1;
    let want = 1;
    if (e.ranged && dl < 240) want = -.6; else if (e.ranged && dl < 300) want = 0;
    if (G.state === 'clear' || G.state === 'dead') want = G.state === 'dead' ? 0 : want;
    e.x += (dx / dl * e.spd * want + e.kx) * dt; e.y += (dy / dl * e.spd * want + e.ky) * dt;
    e.kx *= Math.pow(.0005, dt); e.ky *= Math.pow(.0005, dt);
    if (Math.abs(dx) > 4) e.face = dx < 0 ? -1 : 1;
    e.x = clamp(e.x, 50, WORLD.w - 50); e.y = clamp(e.y, 70, WORLD.h - 45);
    // contato
    const hd = Math.hypot(hero.x - e.x, hy - (e.y - e.r * .6));
    if (hd < e.r + 22 && e.atkCd <= 0 && G.state !== 'dead') { heroHurt(e.dmg); e.atkCd = e.boss ? .9 : 1.1; }
    if (e.ranged && e.shootCd <= 0 && dl < 520) {
      e.shootCd = e.boss ? .9 : rnd(1.8, 2.6);
      const a = Math.atan2(hy - (e.y - e.r), hero.x - e.x), sp = 280;
      const shots = e.boss ? 5 : 1;
      for (let i = 0; i < shots; i++) { const aa = a + (i - (shots - 1) / 2) * .22; G.proj.push({ x: e.x, y: e.y - e.r, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, dmg: e.dmg * .8, t: 0, col: '#7fe8ff' }); }
    }
    if (e.boss && e.atkCd < -2.5 && chance(dt * .6)) {
      // investida do chefe
      e.kx += dx / dl * 700; e.ky += dy / dl * 700; e.atkCd = .4;
      G.txt.push({ x: e.x, y: e.y - e.r * 3, v: '!', col: '#ff3050', size: 40, crit: true, t: 0, life: .6, vx: 0 });
    }
  }
  // separação
  const act = G.en.filter(e => !e.dead);
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, dd = dx * dx + dy * dy;
    if (dd < rr * rr && dd > .01) { const d = Math.sqrt(dd), p = (rr - d) / 2 / d; const wa = a.boss ? .1 : 1, wb = b.boss ? .1 : 1; a.x -= dx * p * wa; a.y -= dy * p * wa; b.x += dx * p * wb; b.y += dy * p * wb; }
  }
  G.en = G.en.filter(e => !e.dead);
  // projéteis
  for (const p of G.proj) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.t > 3) p.dead = true;
    if (!p.dead && Math.hypot(p.x - hero.x, p.y - hy) < 22) { p.dead = true; heroHurt(p.dmg); }
  }
  G.proj = G.proj.filter(p => !p.dead);
  // exército de sombras
  G.army.forEach((a, i) => {
    a.atkCd -= dt; a.bob += dt * 6; if (a.rise) a.rise = Math.max(0, a.rise - dt * 1.2);
    if (!a.tgt || a.tgt.dead || d2(a.tgt, a) > 420 * 420) {
      a.tgt = null; let bd = 380 * 380;
      for (const e of G.en) { if (e.spawnT > 0) continue; const dd = d2(e, a); if (dd < bd) { bd = dd; a.tgt = e; } }
    }
    let tx, ty, sp = 260 + a.sh.grade * 20;
    if (a.tgt && d2(hero, a) < 600 * 600) { tx = a.tgt.x; ty = a.tgt.y; }
    else { const ang = i / Math.max(1, G.army.length) * Math.PI * 2 + G.t * .4; tx = hero.x + Math.cos(ang) * 90; ty = hero.y + Math.sin(ang) * 60; sp = 300; }
    const dx = tx - a.x, dy = ty - a.y, dl = Math.hypot(dx, dy);
    if (dl > 30) { a.x += dx / dl * Math.min(sp, dl * 4) * dt; a.y += dy / dl * Math.min(sp, dl * 4) * dt; }
    if (Math.abs(dx) > 3) a.face = dx < 0 ? -1 : 1;
    if (a.tgt && dl < a.tgt.r + 34 && a.atkCd <= 0) {
      a.atkCd = .8 - a.sh.grade * .06;
      hitEnemy(a.tgt, shadowPow(a.sh), 'shadow');
      G.fx.push({ k: 'slash', x: a.x, y: a.y - 20, a: Math.atan2(dy, dx), t: 0, life: .18, r: 40, col: '#8b5cf6' });
    }
  });
  // drops
  const clear = G.state === 'clear';
  for (const d of G.drops) {
    d.t += dt;
    d.vz -= 900 * dt; d.z = Math.max(0, d.z + d.vz * dt); if (d.z === 0) d.vz = 0;
    d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= Math.pow(.02, dt); d.vy *= Math.pow(.02, dt);
    const dist = Math.hypot(hero.x - d.x, hy - d.y);
    const delay = d.k === 'item' ? .9 : .35;
    if (d.t > delay && (dist < P.pickR || clear || (d.k !== 'item' && d.t > 3.5))) {
      const sp = clear ? 900 : 700;
      d.x += (hero.x - d.x) / dist * sp * dt; d.y += (hy - d.y) / dist * sp * dt; d.vx = d.vy = 0;
    }
    if (dist < 22 && d.t > delay) collect(d);
  }
  G.drops = G.drops.filter(d => !d.dead);
  // cadáveres
  for (const c of G.corpses) c.t -= dt;
  G.corpses = G.corpses.filter(c => c.t > 0 || c === hero.ariseTarget && hero.ariseT > 0);
  // combo
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  if (G.orbT > 0) G.orbT -= dt;
  // fx
  for (const f of G.fx) { f.t += dt; if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= Math.pow(.08, dt); f.vy *= Math.pow(.08, dt); } }
  G.fx = G.fx.filter(f => f.t < f.life);
  for (const r of G.rings) r.t += dt; G.rings = G.rings.filter(r => r.t < r.life);
  for (const t of G.txt) { t.t += dt; t.y -= (60 - t.t * 40) * dt; t.x += t.vx * dt; }
  G.txt = G.txt.filter(t => t.t < t.life);
  if (G.txt.length > 90) G.txt.splice(0, G.txt.length - 90);
  if (G.fx.length > 700) G.fx.splice(0, G.fx.length - 700);
  // vitória
  if (G.state === 'clear') {
    G.clearT += dt;
    if (G.clearT > .8 && (!hero.act || hero.act.k !== 'vic') && !G.corpses.length) hero.act = { k: 'vic', t: 0, dur: 99 };
    if (G.clearT > 3.2 && !G.drops.length && (!G.corpses.length || G.clearT > 15)) finishGate(false);
  }
  // câmera
  cam.x += (hero.x - cam.x) * Math.min(1, dt * 8); cam.y += (hero.y - 30 - cam.y) * Math.min(1, dt * 8);
}

// ---------------------------------------------------------------- render
function curFrame() {
  const h = H;
  if (h.act) {
    const a = h.act, k = a.t / a.dur;
    if (a.k === 'atk') return a.frames[k < .45 ? 0 : 1];
    if (a.k === 'skill') return 'sk' + Math.min(3, Math.floor(k * 4));
    if (a.k === 'hurt') return 'dmg0';
    if (a.k === 'dead') return a.t < .35 ? 'dmg1' : 'dmg2';
    if (a.k === 'vic') return Math.floor(a.t * 2) % 2 ? 'vic1' : 'vic0';
  }
  if (h.moving) { const seq = ['idle_', 'walk_', 'idle_', 'run_']; return seq[Math.floor(h.walkT * 9) % 4] + h.dir; }
  return 'idle_' + h.dir;
}
const HS = .64;
function drawHeroFrame(name, x, y, flip, alpha = 1, tint) {
  const f = HF[name]; if (!f || !IMG.hero.complete) return;
  const [sx, sy, sw, sh] = f, w = sw * HS, hh = sh * HS, ax = ANCHOR[name] || .5;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(IMG.hero, sx, sy, sw, sh, -w * ax, -hh, w, hh);
  if (tint) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = tint; ctx.fillRect(-w * ax, -hh, w, hh); }
  ctx.restore();
}
function drawMon(type, variant, x, y, px, face, alpha = 1) {
  const s = SPR[type], img = s[variant], w = s.w_ * px, h = s.h_ * px;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (face < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
}
function shadowEllipse(x, y, rx, a = .45) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .35, 0, 0, 7); ctx.fill(); }

function render(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (scene !== 'dungeon' && scene !== 'result' || !G) { renderAmbient(now); return; }
  ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H_());
  const sx = shake > 0 ? rnd(-shake, shake) : 0, sy = shake > 0 ? rnd(-shake, shake) : 0;
  ctx.save();
  ctx.translate(W / 2 + sx, H_() / 2 + sy); ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
  // chão (região visível)
  const vw = W / Z, vh = H_() / Z, x0 = clamp(cam.x - vw / 2, 0, WORLD.w), y0 = clamp(cam.y - vh / 2, 0, WORLD.h);
  const x1 = clamp(cam.x + vw / 2, 0, WORLD.w), y1 = clamp(cam.y + vh / 2, 0, WORLD.h);
  if (x1 > x0 && y1 > y0) ctx.drawImage(G.floor, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  // tochas
  for (const t of G.torches) {
    const fl = .8 + Math.sin(now / 90 + t.x) * .15;
    const gr = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, 110 * fl);
    gr.addColorStop(0, G.gate.red ? 'rgba(255,60,60,.35)' : 'rgba(139,92,246,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(t.x - 120, t.y - 120, 240, 240);
    ctx.fillStyle = G.gate.red ? '#ff5a5a' : '#b48cff'; ctx.fillRect(t.x - 3, t.y - 10 * fl, 6, 10 * fl);
  }
  // cadáveres
  for (const c of G.corpses) {
    const p = .5 + Math.sin(now / 150) * .3;
    ctx.save(); ctx.globalAlpha = .55; drawMon(c.type, 's', c.x, c.y + 4, c.px, 1); ctx.restore();
    ctx.fillStyle = `rgba(139,92,246,${.25 * p})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, 40, 14, 0, 0, 7); ctx.fill();
    if (chance(.3)) G.fx.push({ x: c.x + rnd(-20, 20), y: c.y, vx: 0, vy: rnd(-60, -20), t: 0, life: .8, col: '#8b5cf6', s: 3 });
  }
  // drops
  for (const d of G.drops) {
    const y = d.y - d.z;
    if (d.k === 'exp') { ctx.fillStyle = '#9be7ff'; ctx.shadowColor = '#56b8ff'; ctx.shadowBlur = 10; ctx.fillRect(d.x - 4, y - 4, 8, 8); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillRect(d.x - 2, y - 2, 3, 3); }
    else if (d.k === 'gold') { ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.arc(d.x, y, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff6c4'; ctx.fillRect(d.x - 2, y - 3, 2, 2); }
    else if (d.k === 'potion') { ctx.fillStyle = '#ff4a5a'; ctx.fillRect(d.x - 5, y - 8, 10, 12); ctx.fillStyle = '#ddd'; ctx.fillRect(d.x - 3, y - 12, 6, 4); }
    else if (d.k === 'stone') { ctx.fillStyle = '#b57bff'; ctx.save(); ctx.translate(d.x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-6, -6, 12, 12); ctx.restore(); }
    else if (d.k === 'box') { ctx.fillStyle = '#ffcf4a'; ctx.fillRect(d.x - 10, y - 16, 20, 16); ctx.fillStyle = '#7a4a10'; ctx.fillRect(d.x - 10, y - 10, 20, 3); ctx.fillRect(d.x - 2, y - 16, 4, 16); }
    else if (d.k === 'item') {
      const r = RAR[d.it.rar];
      if (d.it.rar >= 2) {
        const bh = 60 + d.it.rar * 40, g = ctx.createLinearGradient(0, y - bh, 0, y);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, r.c);
        ctx.globalAlpha = .35 + Math.sin(now / 120) * .15; ctx.fillStyle = g; ctx.fillRect(d.x - 7 - d.it.rar, y - bh, 14 + d.it.rar * 2, bh); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#0a1020'; ctx.strokeStyle = r.c; ctx.lineWidth = 2;
      ctx.fillRect(d.x - 10, y - 20, 20, 20); ctx.strokeRect(d.x - 10, y - 20, 20, 20);
      ctx.fillStyle = r.c; ctx.font = '700 15px "Pixelify Sans",monospace'; ctx.textAlign = 'center'; ctx.fillText(SLOTS[d.it.slot].ico, d.x, y - 5);
    }
  }
  // entidades por Y
  const ents = [];
  for (const e of G.en) ents.push({ y: e.y, f: () => drawEnemy(e, now) });
  for (const a of G.army) ents.push({ y: a.y, f: () => drawArmy(a, now) });
  ents.push({ y: H.y, f: () => drawHero(now) });
  ents.sort((a, b) => a.y - b.y).forEach(o => o.f());
  // projéteis
  for (const p of G.proj) { ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
  // efeitos (aditivos)
  ctx.globalCompositeOperation = 'lighter';
  for (const r of G.rings) {
    if (r.t < 0) continue; const k = r.t / r.life;
    ctx.strokeStyle = r.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 14 * (1 - k) + 2;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.R * (.2 + k * .8), r.R * (.2 + k * .8) * .55, 0, 0, 7); ctx.stroke();
  }
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.k === 'slash') {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.col || '#b48cff'; ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.7 + k * .5), f.a - 1.1 + k * .6, f.a + 1.1 + k * .6); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.7 + k * .5), f.a - .6 + k * .6, f.a + .8 + k * .6); ctx.stroke();
    } else if (f.k === 'ghost') {
      ctx.globalCompositeOperation = 'source-over'; drawHeroFrame(f.frame, f.x, f.y, f.flip, .35 * (1 - k), '#8b5cf6'); ctx.globalCompositeOperation = 'lighter';
    } else {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = f.col; ctx.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // textos
  ctx.textAlign = 'center';
  for (const t of G.txt) {
    const k = t.t / t.life, pop = t.crit ? (k < .12 ? 1 + (1 - k / .12) * .9 : 1) : (k < .1 ? 1.3 : 1);
    ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
    ctx.font = `700 ${Math.round(t.size * pop)}px "Pixelify Sans",monospace`;
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(t.v, t.x, t.y); ctx.fillStyle = t.col; ctx.fillText(t.v, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // vinheta
  const vg = ctx.createRadialGradient(W / 2, H_() / 2, Math.min(W, H_()) * .3, W / 2, H_() / 2, Math.max(W, H_()) * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H_());
  if (H.hp < P.hp * .3 && G.state !== 'clear') {
    const a = .25 + Math.sin(now / 150) * .12, rg = ctx.createRadialGradient(W / 2, H_() / 2, Math.min(W, H_()) * .35, W / 2, H_() / 2, Math.max(W, H_()) * .7);
    rg.addColorStop(0, 'rgba(255,0,30,0)'); rg.addColorStop(1, `rgba(255,0,30,${a})`); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H_());
  }
  // barra do chefe
  if (G.boss && !G.boss.dead) {
    const b = G.boss, bw = Math.min(560, W - 60), bx = (W - bw) / 2, by = H_() - (W < 760 ? 150 : 108);
    ctx.fillStyle = 'rgba(5,8,18,.85)'; ctx.fillRect(bx - 4, by - 22, bw + 8, 38);
    ctx.fillStyle = '#2a0a12'; ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = '#ff3050'; ctx.fillRect(bx, by, bw * Math.max(0, b.hp / b.max), 10);
    ctx.font = '600 14px "Pixelify Sans",monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd0d6';
    ctx.fillText(`${b.name}  ·  Lv.${b.lvl}`, W / 2, by - 6);
  }
}
const H_ = () => CH;

function drawHero(now) {
  const h = H;
  shadowEllipse(h.x, h.y, 22);
  if (h.act && h.act.k === 'skill') {
    const g = ctx.createRadialGradient(h.x, h.y - 30, 5, h.x, h.y - 30, 90);
    g.addColorStop(0, 'rgba(139,92,246,.5)'); g.addColorStop(1, 'rgba(139,92,246,0)'); ctx.fillStyle = g; ctx.fillRect(h.x - 90, h.y - 120, 180, 180);
  }
  const f = curFrame();
  let flip = false;
  if (f.startsWith('atk')) flip = h.flip;
  const blink = h.inv > 0 && h.act && h.act.k === 'hurt' && Math.floor(now / 50) % 2;
  const breathe = !h.moving && !h.act ? Math.sin(now / 400) * .6 : 0;
  drawHeroFrame(f, h.x, h.y + breathe, flip, blink ? .5 : 1, blink ? 'rgba(255,60,60,.6)' : null);
}
function drawEnemy(e, now) {
  const alpha = e.spawnT > 0 ? 1 - e.spawnT / .5 : 1;
  shadowEllipse(e.x, e.y, e.r * 1.1);
  if (e.boss || e.elite || e.golden) {
    const col = e.boss ? 'rgba(255,40,70,' : e.golden ? 'rgba(255,207,74,' : 'rgba(255,176,32,';
    const g = ctx.createRadialGradient(e.x, e.y - e.r, 2, e.x, e.y - e.r, e.r * 2.6);
    g.addColorStop(0, col + '.35)'); g.addColorStop(1, col + '0)'); ctx.fillStyle = g; ctx.fillRect(e.x - e.r * 3, e.y - e.r * 4, e.r * 6, e.r * 6);
  }
  const bob = Math.abs(Math.sin(e.bob)) * (e.boss ? 3 : 2);
  const variant = e.hitT > 0 ? 'w' : e.golden ? 'g' : 'n';
  drawMon(e.type, variant, e.x, e.y - bob, e.px, e.face, alpha);
  if (e.hp < e.max && !e.boss) {
    const w = Math.max(30, e.r * 2), y = e.y - SPR[e.type].h_ * e.px - 10;
    ctx.fillStyle = '#000'; ctx.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = e.elite ? '#ffb020' : '#ff3b4e'; ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.max), 4);
  }
  if (e.elite) { ctx.font = '700 11px "Chakra Petch",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffb020'; ctx.fillText('ELITE', e.x, e.y - SPR[e.type].h_ * e.px - 14); }
}
function drawArmy(a, now) {
  const s = MON[a.sh.type] ? a.sh.type : 'goblin';
  const px = a.sh.grade >= 3 ? 5 : 4;
  const rise = a.rise || 0;
  ctx.fillStyle = 'rgba(139,92,246,.35)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, 20, 7, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(a.x - 80, a.y - 200, 160, 200); ctx.clip();
  drawMon(s, 's', a.x, a.y + rise * SPR[s].h_ * px - Math.abs(Math.sin(a.bob)) * 2, px, a.face, .95);
  ctx.restore();
  if (chance(.25)) G.fx.push({ x: a.x + rnd(-12, 12), y: a.y - rnd(0, 40), vx: 0, vy: rnd(-50, -15), t: 0, life: .5, col: '#6a3ad0', s: 3 });
}

// fundo animado do título/hub
const amb = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(1, 3), v: rnd(.01, .04), a: rnd(.2, .8) }));
function renderAmbient(now) {
  const g = ctx.createLinearGradient(0, 0, 0, H_());
  g.addColorStop(0, '#0a0718'); g.addColorStop(1, '#05070d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H_());
  const cg = ctx.createRadialGradient(W * .25, H_() * .7, 10, W * .25, H_() * .7, Math.max(W, H_()) * .6);
  cg.addColorStop(0, 'rgba(110,60,220,.22)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H_());
  for (const p of amb) {
    p.y -= p.v * .016; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
    ctx.fillStyle = `rgba(160,120,255,${p.a * (.6 + Math.sin(now / 500 + p.x * 20) * .4)})`;
    ctx.fillRect(p.x * W, p.y * H_(), p.s, p.s);
  }
}

// ---------------------------------------------------------------- HUD
const FACE_IDX = { normal: 0, serio: 1, sorriso: 2, raiva: 3, surpreso: 4, determinado: 5 };
let lastHud = {};
function faceIndex() {
  if (faceOverride !== null && faceT > 0) return faceOverride;
  if (scene === 'dungeon' && H && G) {
    if (H.hp < P.hp * .3) return 3;
    if (G.boss) return 5;
    return 1;
  }
  return 0;
}
function setWidth(el, v) { const s = (clamp(v, 0, 1) * 100).toFixed(1) + '%'; if (el.style.width !== s) el.style.width = s; }
function updateHud(dt) {
  if (faceT > 0) { faceT -= dt; if (faceT <= 0) faceOverride = null; }
  if (scene !== 'dungeon' || !H) return;
  const fi = faceIndex();
  if (lastHud.fi !== fi) { lastHud.fi = fi; $('#hudFace').style.backgroundPosition = `${-fi * 64}px 0`; }
  $('#hudLv').textContent = 'LV. ' + S.lvl;
  const rk = rankOf(S.lvl); const re = $('#hudRank'); re.textContent = rk.r; re.style.color = rk.c;
  setWidth($('#bHp'), H.hp / P.hp); setWidth($('#bMp'), H.mp / P.mp); setWidth($('#bXp'), S.exp / need(S.lvl));
  $('#hudGold').textContent = fmt(S.gold);
  const gp = G.boss ? G.boss.hp / G.boss.max : G.state === 'clear' ? 1 : G.kills / G.total;
  setWidth($('#bGate'), gp);
  const cb = $('#combo');
  cb.style.opacity = G.combo >= 3 ? 1 : 0;
  if (G.combo >= 3) { $('#comboN').textContent = G.combo; $('#comboM').textContent = `EXP +${Math.min(G.combo, 200)}%`; $('#comboN').style.transform = `scale(${1 + Math.max(0, G.comboT - 2.7) * 1.5})`; }
  const cd = (id, v, max) => { const el = document.querySelector(id + ' .cd'); el.style.height = (clamp(v / max, 0, 1) * 100) + '%'; };
  cd('#skDash', H.dashCd, 1.1); cd('#skAoe', H.mp < 30 ? 1 : H.aoeCd, 3.5);
  $('#skArise').classList.toggle('off', !nearCorpse());
  const q = $('#quest');
  if (G.urgent) {
    q.classList.remove('hidden');
    q.innerHTML = `<b>MISSÃO DE URGÊNCIA</b><br>Derrote ${G.urgent.goal} inimigos: ${Math.min(G.urgent.got, G.urgent.goal)}/${G.urgent.goal}<br>Tempo: ${Math.max(0, G.urgent.t).toFixed(1)}s`;
  } else q.classList.add('hidden');
}

// ---------------------------------------------------------------- HUB
let hubTab = 'gates', selItem = null;
function goHub(tab) {
  scene = 'hub'; G = null; H = null; paused = false;
  $('#hud').classList.add('hidden'); $('#title').classList.add('hidden'); $('#hub').classList.remove('hidden');
  if (!S.gateList) refreshGates();
  checkDaily(); recalc();
  if (tab) hubTab = tab;
  renderHub(); save();
}
const TABS = [['status', 'STATUS'], ['gates', 'GATES'], ['inv', 'INVENTÁRIO'], ['army', 'SOMBRAS'], ['shop', 'LOJA'], ['daily', 'MISSÃO DIÁRIA']];
function today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function checkDaily() {
  const t = today();
  if (S.daily.date !== t) {
    const streak = S.daily.claimed ? S.daily.streak : 0;
    S.daily = { date: t, kills: 0, dist: 0, skills: 0, gates: 0, claimed: false, streak };
  }
}
const DAILY = () => [
  ['Derrotar inimigos', Math.floor(S.daily.kills), 100, ''],
  ['Correr', +(S.daily.dist / 4000).toFixed(2), 10, ' km'],
  ['Usar o Domínio Sombrio', S.daily.skills, 20, ''],
  ['Limpar gates', S.daily.gates, 3, ''],
];
function renderHub() {
  $('#hubName').textContent = S.name;
  $('#hubTitle').textContent = `« ${S.title} »  ·  LV.${S.lvl}  ·  RANK ${rankOf(S.lvl).r}`;
  const dailyDone = DAILY().every(q => q[1] >= q[2]) && !S.daily.claimed;
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button class="tab ${k === hubTab ? 'on' : ''}" data-tab="${k}">${n}${(k === 'status' && S.pts > 0) || (k === 'daily' && dailyDone) || (k === 'shop' && S.boxes > 0) ? '<i class="dot"></i>' : ''}</button>`).join('');
  const body = $('#hubBody');
  body.innerHTML = ({ status: hubStatus, gates: hubGates, inv: hubInv, army: hubArmy, shop: hubShop, daily: hubDaily })[hubTab]();
  if (hubTab === 'army') drawArmyCanvases();
}
function hubStatus() {
  const st = [['str', 'FOR', 'Força', 'ATK +2 por ponto'], ['agi', 'AGI', 'Agilidade', 'Vel. ataque, movimento, dano crítico'], ['vit', 'VIT', 'Vitalidade', 'HP e defesa'], ['int', 'INT', 'Inteligência', 'MP, Domínio Sombrio, limite de sombras, ARISE'], ['per', 'PER', 'Percepção', 'Crítico, sorte, raio de coleta']];
  return `<div class="grid2">
    <div>
      <div class="h2">STATUS</div>
      <div class="kv"><span>Nome</span><span>${esc(S.name)}</span></div>
      <div class="kv"><span>Nível</span><span>${S.lvl}</span></div>
      <div class="kv"><span>Rank</span><span style="color:${rankOf(S.lvl).c}">${rankOf(S.lvl).r}</span></div>
      <div class="kv"><span>EXP</span><span>${fmt(S.exp)} / ${fmt(need(S.lvl))}</span></div>
      <div class="kv"><span>Título</span><span><select id="selTitle" style="background:var(--panel);color:var(--text);border:1px solid var(--line);font-family:var(--ui)">${S.titles.map(t => `<option ${t === S.title ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></span></div>
      <div class="kv"><span>Poder de combate</span><span style="color:var(--gold);font-weight:700">${fmt(P.power)}</span></div>
      <div class="h2" style="margin-top:18px">ATRIBUTOS DERIVADOS</div>
      <div class="kv"><span>Ataque</span><span>${fmt(P.atk)}</span></div>
      <div class="kv"><span>Defesa</span><span>${fmt(P.def)}</span></div>
      <div class="kv"><span>HP / MP</span><span>${fmt(P.hp)} / ${fmt(P.mp)}</span></div>
      <div class="kv"><span>Crítico</span><span>${P.crit.toFixed(1)}% · x${(P.cdmg / 100).toFixed(2)}</span></div>
      <div class="kv"><span>Vel. de ataque</span><span>x${P.aspd.toFixed(2)}</span></div>
      <div class="kv"><span>Sorte</span><span>${P.luck.toFixed(0)}</span></div>
      <div class="kv"><span>Limite de sombras</span><span>${P.cap}</span></div>
      <div class="kv"><span>Monstros abatidos</span><span>${fmt(S.kills)}</span></div>
    </div>
    <div>
      <div class="h2">PONTOS DISPONÍVEIS: <span style="color:${S.pts ? 'var(--gold)' : 'var(--muted)'}">${S.pts}</span></div>
      ${st.map(([k, a, n, d]) => `<div class="stat"><span class="k">${a}</span><span><span class="v">${S.st[k]}</span> <span class="d">${n} · ${d}</span></span>
        <span style="display:flex;gap:4px"><button class="btn plus" data-act="pt" data-arg="${k}" ${S.pts ? '' : 'disabled'} aria-label="Adicionar 1 em ${n}">+</button><button class="btn plus" style="width:38px;font-size:12px" data-act="pt5" data-arg="${k}" ${S.pts >= 5 ? '' : 'disabled'} aria-label="Adicionar 5 em ${n}">+5</button></span></div>`).join('')}
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center">
        <button class="btn" data-act="autopts" ${S.pts ? '' : 'disabled'}>Distribuir automaticamente</button>
        <label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="chkAutoPts" ${S.autoPts ? 'checked' : ''}> Sempre automático</label>
      </div>
      <div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap;align-items:center">
        <label for="inpName" class="muted" style="font-size:13px">Nome do Caçador</label>
        <input id="inpName" maxlength="16" value="${esc(S.name)}" style="background:var(--panel);color:var(--text);border:1px solid var(--line);padding:6px 8px;font-family:var(--ui)">
        <button class="btn" data-act="snd">Som: ${SND.on ? 'ligado' : 'desligado'}</button>
      </div>
    </div></div>`;
}
function hubGates() {
  return `<div class="h2">GATES DETECTADOS</div>
    <div class="grid2">${S.gateList.map((g, i) => {
      const rk = rankOf(g.lvl), danger = g.lvl - S.lvl;
      const tags = [g.red ? '<span class="tag" style="color:var(--blood)">VERMELHO</span>' : '', g.treasure ? '<span class="tag" style="color:var(--gold)">TESOURO</span>' : '', g.double ? '<span class="tag" style="color:var(--shadow-hi)">DUPLA</span>' : '', g.name === 'Fenda Instável' ? '<span class="tag" style="color:#ff5fd2">INSTÁVEL</span>' : '', danger >= 8 ? '<span class="tag" style="color:var(--blood)">PERIGOSO</span>' : danger <= -2 ? '<span class="tag" style="color:var(--good)">FÁCIL</span>' : ''].join('');
      return `<div class="gate sysw ${g.red ? 'red' : ''}">
        <div class="tp"><div class="rk" style="color:${rk.c}">${g.rank.length > 2 ? g.rank[0] : g.rank}</div>
        <div><div class="nm">${esc(g.name)}</div><div class="meta">Nível ${g.lvl} · ${g.count} monstros + chefe</div><div style="margin-top:4px">${tags}</div></div></div>
        <div class="meta">Monstros: ${THEMES[g.ti].mons.map(m => MON[m].n).join(', ')}</div>
        <div class="meta">Recompensas <b style="color:var(--gold)">x${g.mult.toFixed(1)}</b>${g.treasure ? ' · Ouro x5' : ''}</div>
        <button class="btn ${g.red ? 'red' : ''}" data-act="enter" data-arg="${i}">Entrar no gate</button>
      </div>`;
    }).join('')}</div>
    <div style="display:flex;gap:10px;margin-top:16px;align-items:center;flex-wrap:wrap">
      <button class="btn gold" data-act="reroll" ${S.gold >= rerollCost() ? '' : 'disabled'}>Procurar novos gates · ${fmt(rerollCost())} ouro</button>
      <span class="muted" style="font-size:12px">7% de chance de Gate Vermelho (x3), 6% Tesouro, 3% Dungeon Dupla, 1% Fenda Instável (x6).</span>
    </div>`;
}
const rerollCost = () => Math.floor(30 * 1.08 ** S.lvl);
function itemTile(it, extra = '') {
  const r = RAR[it.rar], better = it && S.eq[it.slot] !== it && itemScore(it) > itemScore(S.eq[it.slot]);
  return `<button class="it ${selItem === it.id ? 'sel' : ''}" style="border-color:${r.c};color:${r.c};box-shadow:${it.rar >= 3 ? `0 0 12px ${r.c}66 inset` : 'none'}" data-act="sel" data-arg="${it.id}" ${extra} aria-label="${esc(it.name)}">${SLOTS[it.slot].ico}${it.plus ? `<span class="pl">+${it.plus}</span>` : ''}<span class="lv">${it.ilvl}</span>${better ? '<span class="up">▲</span>' : ''}</button>`;
}
function findItem(id) { for (const k in S.eq) if (S.eq[k] && S.eq[k].id === id) return S.eq[k]; return S.inv.find(i => i.id === id); }
function hubInv() {
  const inv = S.inv.slice().sort((a, b) => b.rar - a.rar || itemScore(b) - itemScore(a));
  const it = selItem ? findItem(selItem) : null;
  let det = '<div class="detail muted">Selecione um item para ver detalhes.</div>';
  if (it) {
    const r = RAR[it.rar], cur = S.eq[it.slot], isEq = cur === it;
    const diff = isEq || !cur ? 0 : itemMain(it) - itemMain(cur);
    det = `<div class="detail sysw" style="border-color:${r.c}">
      <div class="nm" style="color:${r.c}">${esc(it.name)}${it.plus ? ' +' + it.plus : ''}</div>
      <div class="muted">${r.n} · ${SLOTS[it.slot].n} · Nível ${it.ilvl}${isEq ? ' · <b style="color:var(--good)">EQUIPADO</b>' : ''}</div>
      <div style="margin-top:6px;font-size:15px">${mainLabel(it)} <b>${fmt(itemMain(it))}</b> ${!isEq && cur ? `<span class="${diff >= 0 ? 'cmp-up' : 'cmp-dn'}">(${diff >= 0 ? '+' : ''}${fmt(diff)})</span>` : ''}${it.slot === 'armor' ? ` · HP +${fmt(itemMain(it) * 3)}` : ''}</div>
      ${it.subs.map(s => `<div>+${s.v}${SUBN[s.k].u} ${SUBN[s.k].n}</div>`).join('')}
      <div class="row">
        ${isEq ? '' : `<button class="btn" data-act="equip" data-arg="${it.id}">Equipar</button>`}
        <button class="btn gold" data-act="enh" data-arg="${it.id}" ${S.gold >= enhCost(it) ? '' : 'disabled'}>Aprimorar +${it.plus + 1} · ${Math.round(enhChance(it) * 100)}% · ${fmt(enhCost(it))} ouro</button>
        ${isEq ? '' : `<button class="btn red" data-act="sell" data-arg="${it.id}">Vender · ${fmt(sellValue(it))}</button>`}
      </div>
      ${it.plus >= 7 ? '<div class="muted" style="font-size:12px;margin-top:6px">A partir de +7, uma falha reduz o nível de aprimoramento.</div>' : ''}
    </div>`;
  }
  return `<div class="grid2"><div>
      <div class="h2">EQUIPADO</div>
      <div class="eq">${['weapon', 'armor', 'ring'].map(s => `<div class="slot">${S.eq[s] ? itemTile(S.eq[s]) : `<div class="it" style="border-color:var(--line);color:var(--line)">${SLOTS[s].ico}</div>`}${SLOTS[s].n.toUpperCase()}</div>`).join('')}</div>
      ${det}
    </div><div>
      <div class="h2">INVENTÁRIO (${S.inv.length}/60)</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn" data-act="best">Equipar melhores</button>
        <button class="btn red" data-act="sellj">Vender Comuns e Incomuns</button>
        <label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="chkAutoEq" ${S.autoEq ? 'checked' : ''}> Auto-equipar melhores ao coletar</label>
      </div>
      <div class="items">${inv.map(i => itemTile(i)).join('') || '<span class="muted">Vazio. Entre em um gate para conseguir loot.</span>'}</div>
    </div></div>`;
}
function hubArmy() {
  const dep = deployed();
  const list = S.shadows.slice().sort((a, b) => b.grade - a.grade || b.lvl - a.lvl);
  return `<div class="h2">EXÉRCITO DAS SOMBRAS · MOBILIZADOS ${dep.length}/${P.cap} · TOTAL ${S.shadows.length}</div>
    <p class="muted" style="margin-top:-4px;font-size:13px">Derrote inimigos, fique perto do corpo e diga <b style="color:var(--shadow-hi)">ARISE</b> (tecla E). Chefes viram sombras nomeadas de alto grau. As sombras mais fortes são mobilizadas automaticamente e sobem de nível a cada gate limpo. INT aumenta o limite.</p>
    <div class="shlist">${list.map(s => `<div class="sh" style="${dep.includes(s) ? 'border-color:var(--shadow)' : 'opacity:.6'}">
      <canvas width="48" height="48" data-type="${s.type}" aria-hidden="true"></canvas>
      <div style="flex:1;min-width:0"><div style="font-weight:700">${esc(s.name)}</div>
      <div class="g" style="color:${GRADES[s.grade].c}">${GRADES[s.grade].n.toUpperCase()} · LV.${s.lvl}</div>
      <div class="muted" style="font-size:12px">Dano ${fmt(shadowPow(s))}${dep.includes(s) ? ' · mobilizado' : ''}</div></div>
      <button class="btn" style="padding:.4em .6em;font-size:11px" data-act="release" data-arg="${s.id}" title="Libertar por pedras de mana">Libertar</button>
    </div>`).join('') || '<span class="muted">Nenhuma sombra ainda.</span>'}</div>`;
}
function drawArmyCanvases() {
  document.querySelectorAll('.sh canvas').forEach(c => {
    const x = c.getContext('2d'), s = SPR[c.dataset.type] || SPR.goblin;
    x.imageSmoothingEnabled = false; x.fillStyle = '#1a0b33'; x.fillRect(0, 0, 48, 48);
    const sc = Math.floor(40 / Math.max(s.w_, s.h_));
    x.shadowColor = '#8b5cf6'; x.shadowBlur = 8;
    x.drawImage(s.s, (48 - s.w_ * sc) / 2, (48 - s.h_ * sc) / 2, s.w_ * sc, s.h_ * sc);
  });
}
const boxCost = () => Math.floor(150 * 1.09 ** S.lvl);
function hubShop() {
  return `<div class="h2">LOJA DO SISTEMA</div>
    <div class="grid2">
      <div class="box sysw" style="color:var(--gold)"><div class="ic">?</div>
        <div style="color:var(--text);font-weight:700;font-size:16px">Caixa Aleatória</div>
        <div class="muted" style="font-size:13px">Ouro, itens Raros ou melhores, pontos de atributo, EXP, sombras e jackpots. Você possui <b style="color:var(--gold)">${S.boxes}</b>.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn gold" data-act="open" data-arg="n" ${S.boxes ? '' : 'disabled'}>Abrir caixa</button>
        <button class="btn" data-act="buybox" ${S.gold >= boxCost() ? '' : 'disabled'}>Comprar · ${fmt(boxCost())} ouro</button></div>
      </div>
      <div class="box sysw" style="color:var(--shadow-hi)"><div class="ic">◆</div>
        <div style="color:var(--text);font-weight:700;font-size:16px">Caixa do Monarca</div>
        <div class="muted" style="font-size:13px">Itens Épicos ou melhores e sombras de alto grau. Custa 12 pedras de mana (dropam de elites e chefes). Você tem <b style="color:var(--shadow-hi)">${S.stones}</b> pedras.</div>
        <button class="btn purple" data-act="open" data-arg="m" ${S.stones >= 12 ? '' : 'disabled'}>Abrir · 12 pedras</button>
      </div>
      <div class="box sysw" style="color:var(--exp)"><div class="ic">+</div>
        <div style="color:var(--text);font-weight:700;font-size:16px">Elixir de Treino</div>
        <div class="muted" style="font-size:13px">+1 ponto de atributo. O preço sobe a cada compra no dia.</div>
        <button class="btn" data-act="elixir" ${S.gold >= elixirCost() ? '' : 'disabled'}>Comprar · ${fmt(elixirCost())} ouro</button>
      </div>
    </div>
    <p class="muted" style="margin-top:14px">Ouro: <b style="color:var(--gold)">${fmt(S.gold)}</b> · Pedras de mana: <b style="color:var(--shadow-hi)">${S.stones}</b></p>`;
}
const elixirCost = () => Math.floor(400 * 1.09 ** S.lvl * (1 + (S.daily.elix || 0) * .5));
function hubDaily() {
  const qs = DAILY(), done = qs.every(q => q[1] >= q[2]);
  return `<div class="quest sysw">
    <div class="qt">[ MISSÃO DIÁRIA ]</div>
    <div style="text-align:center;margin-bottom:12px">Treinamento para se tornar forte</div>
    ${qs.map(q => `<div class="qrow"><span>${q[0]}</span><span class="${q[1] >= q[2] ? 'ok' : ''}">[${Math.min(q[1], q[2])}/${q[2]}${q[3]}]${q[1] >= q[2] ? ' ✓' : ''}</span></div>`).join('')}
    <div style="margin-top:14px">Recompensa: recuperação total, <b style="color:var(--gold)">+3 pontos de atributo</b>, 1 Caixa Aleatória, ouro e EXP.${S.daily.streak ? ` Sequência atual: <b>${S.daily.streak} dia(s)</b>.` : ''}</div>
    <div class="warn">AVISO: não completar a missão diária não traz punição aqui, mas o Sistema está observando.</div>
    <div style="margin-top:14px"><button class="btn big gold" data-act="claim" ${done && !S.daily.claimed ? '' : 'disabled'}>${S.daily.claimed ? 'Recompensa coletada. Volte amanhã.' : 'Receber recompensa'}</button></div>
  </div>`;
}

// ações do hub
$('#hub').addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]');
  if (tb) { hubTab = tb.dataset.tab; renderHub(); return; }
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const act = b.dataset.act, arg = b.dataset.arg;
  if (act === 'pt' || act === 'pt5') { const n = Math.min(S.pts, act === 'pt5' ? 5 : 1); S.st[arg] += n; S.pts -= n; recalc(); tone(660 + S.st[arg] % 12 * 30, .06, 'square', .04); }
  else if (act === 'autopts') { autoAlloc(); recalc(); sfx.quest(); }
  else if (act === 'snd') { SND.on = !SND.on; }
  else if (act === 'enter') { enterGate(S.gateList[+arg]); return; }
  else if (act === 'reroll') { S.gold -= rerollCost(); refreshGates(); sfx.drop(2); }
  else if (act === 'sel') { selItem = +arg; }
  else if (act === 'equip') { const it = findItem(+arg); const cur = S.eq[it.slot]; S.inv.splice(S.inv.indexOf(it), 1); if (cur) S.inv.push(cur); S.eq[it.slot] = it; recalc(); sfx.drop(1); }
  else if (act === 'sell') { const it = findItem(+arg); S.inv.splice(S.inv.indexOf(it), 1); S.gold += sellValue(it); selItem = null; sfx.coin(); }
  else if (act === 'sellj') { let g = 0; S.inv = S.inv.filter(i => { if (i.rar <= 1) { g += sellValue(i); return false; } return true; }); S.gold += g; if (g) { lootToast(`+${fmt(g)} ouro`, '#ffcf4a'); sfx.coin(); } selItem = null; }
  else if (act === 'best') { equipBest(); sfx.drop(2); }
  else if (act === 'enh') { enhance(findItem(+arg)); }
  else if (act === 'release') { const i = S.shadows.findIndex(s => s.id === +arg); if (i >= 0) { const s = S.shadows[i]; S.shadows.splice(i, 1); const st = 1 + s.grade * 2; S.stones += st; lootToast(`+${st} Pedras de mana`, '#c4a5ff'); recalc(); } }
  else if (act === 'open') { openBox(arg); return; }
  else if (act === 'buybox') { S.gold -= boxCost(); S.boxes++; sfx.coin(); }
  else if (act === 'elixir') { S.gold -= elixirCost(); S.daily.elix = (S.daily.elix || 0) + 1; S.pts++; sfx.quest(); lootToast('+1 ponto de atributo', '#9be7ff'); }
  else if (act === 'claim') { claimDaily(); }
  save(); renderHub();
});
$('#hub').addEventListener('change', e => {
  if (e.target.id === 'chkAutoEq') S.autoEq = e.target.checked;
  if (e.target.id === 'chkAutoPts') { S.autoPts = e.target.checked; if (S.autoPts && S.pts) { autoAlloc(); recalc(); renderHub(); } }
  if (e.target.id === 'selTitle') { S.title = e.target.value; renderHub(); }
  if (e.target.id === 'inpName') { S.name = (e.target.value.trim() || 'Caçador').slice(0, 16); renderHub(); }
  save();
});
function equipBest() {
  for (const slot of ['weapon', 'armor', 'ring']) {
    let best = S.eq[slot];
    for (const it of S.inv) if (it.slot === slot && itemScore(it) > itemScore(best)) best = it;
    if (best && best !== S.eq[slot]) { S.inv.splice(S.inv.indexOf(best), 1); if (S.eq[slot]) S.inv.push(S.eq[slot]); S.eq[slot] = best; }
  }
  recalc();
}
function enhance(it) {
  const cost = enhCost(it); if (S.gold < cost) return;
  S.gold -= cost;
  const ok = chance(enhChance(it));
  if (ok) {
    it.plus++; sfx.drop(Math.min(5, 1 + Math.floor(it.plus / 3)));
    if (it.plus >= 10) { flash(.4, '#ffcf4a'); banner('+' + it.plus, it.name.toUpperCase(), '#ffcf4a', '#ffb020'); sfx.legend(); }
    lootToast(`SUCESSO! ${it.name} +${it.plus}`, '#5fe07a');
  } else {
    sfx.fail();
    if (it.plus >= 7) { it.plus--; lootToast(`FALHOU… ${it.name} caiu para +${it.plus}`, '#ff3b4e'); }
    else lootToast('FALHOU… o item resistiu.', '#ff3b4e');
    const bd = $('#hubBody'); bd.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 180 });
  }
  recalc();
}
function claimDaily() {
  if (S.daily.claimed) return;
  S.daily.claimed = true; S.daily.streak = (S.daily.streak || 0) + 1;
  S.pts += 3; S.boxes++;
  const g = Math.floor(200 * 1.09 ** S.lvl * (1 + S.daily.streak * .1)); S.gold += g;
  sysMsg('MISSÃO DIÁRIA CONCLUÍDA', `Recompensas: recuperação total · +3 pontos · +1 Caixa Aleatória · +${fmt(g)} ouro`, 4000);
  gainExp(need(S.lvl) * .5);
  flash(.4, '#56b8ff'); sfx.quest(); setFace(2, 3);
  if (S.daily.streak >= 7) unlockTitle('Disciplina de Ferro');
}

// ---------------------------------------------------------------- caixa aleatória (roleta)
function rollBox(kind) {
  const m = kind === 'm';
  const pool = [
    { k: 'gold', w: m ? 0 : 30, r: 0 }, { k: 'item', w: m ? 55 : 34 }, { k: 'pts', w: 12, r: 2 }, { k: 'exp', w: m ? 8 : 12, r: 2 },
    { k: 'shadow', w: m ? 16 : 6, r: 3 }, { k: 'elixir', w: m ? 6 : 4, r: 3 }, { k: 'jackpot', w: m ? 3 : 2, r: 4 },
  ];
  const o = { ...wpick(pool, x => x.w) };
  if (o.k === 'item') { o.it = makeItem(S.lvl + ri(0, 3), rollRarity(m ? 60 : 25, m ? 3 : 2)); o.r = o.it.rar; }
  if (o.k === 'shadow') { const t = pick(Object.keys(MON)); o.sh = { id: S.uid++, type: t, name: MON[t].n + ' Sombrio', grade: m ? (chance(.15) ? 4 : 3) : (chance(.2) ? 2 : 1), lvl: Math.max(1, Math.floor(S.lvl / 3)) }; o.r = o.sh.grade >= 4 ? 4 : 3; }
  if (o.k === 'gold') o.v = Math.floor(120 * 1.09 ** S.lvl * rnd(.6, 1.6));
  if (o.k === 'jackpot') o.v = Math.floor(1500 * 1.09 ** S.lvl);
  if (o.k === 'exp') o.v = need(S.lvl) * rnd(.3, .7);
  if (o.k === 'pts') o.v = ri(2, 4);
  return o;
}
const boxLabel = o => ({
  gold: ['●', 'Ouro'], item: [o.it ? SLOTS[o.it.slot].ico : '†', o.it ? RAR[o.it.rar].n : 'Item'], pts: ['+', `+${o.v || 3} Pontos`], exp: ['✦', 'EXP'],
  shadow: ['☗', 'Sombra'], elixir: ['⚗', 'Elixir'], jackpot: ['$', 'JACKPOT'],
})[o.k];
function openBox(kind) {
  if (kind === 'm') { if (S.stones < 12) return; S.stones -= 12; } else { if (S.boxes < 1) return; S.boxes--; }
  const res = rollBox(kind);
  const tiles = [];
  for (let i = 0; i < 40; i++) tiles.push(i === 32 ? res : rollBox(kind));
  const TW = 80;
  showModal(`<div class="h2">${kind === 'm' ? 'CAIXA DO MONARCA' : 'CAIXA ALEATÓRIA'}</div>
    <div class="reelWrap" id="reelWrap"><div class="reel" id="reel">${tiles.map(o => { const [i, l] = boxLabel(o), c = RAR[o.r || 0].c; return `<div class="rt" style="border-color:${c};color:${c}"><span class="i">${i}</span>${l}</div>`; }).join('')}</div></div>
    <div id="boxRes" style="min-height:70px"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn big" id="boxOk" disabled>OK</button>
    <button class="btn gold hidden" id="boxAgain">Abrir outra</button></div>`);
  const reel = $('#reel'), wrap = $('#reelWrap');
  const target = 32 * TW + 37 - wrap.clientWidth / 2 + rnd(-26, 26);
  reel.style.transform = 'translateX(0)';
  const t0 = performance.now(), dur = 4200;
  let lastIdx = -1;
  const ease = k => 1 - (1 - k) ** 4;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), x = target * ease(k);
    reel.style.transform = `translateX(${-x}px)`;
    const idx = Math.floor((x + wrap.clientWidth / 2) / TW);
    if (idx !== lastIdx) { lastIdx = idx; sfx.tick(); }
    if (k < 1) requestAnimationFrame(step); else grantBox(res, kind);
  };
  requestAnimationFrame(step);
}
function grantBox(o, kind) {
  let txt = '';
  const r = RAR[o.r || 0];
  if (o.k === 'gold' || o.k === 'jackpot') { S.gold += o.v; txt = `+${fmt(o.v)} de ouro`; }
  if (o.k === 'item') { addItem(o.it, false); txt = `<b style="color:${r.c}">[${r.n}] ${esc(o.it.name)}</b> · ${mainLabel(o.it)} ${fmt(itemMain(o.it))}`; }
  if (o.k === 'pts') { S.pts += o.v; txt = `+${o.v} pontos de atributo`; }
  if (o.k === 'exp') { txt = `+${fmt(o.v)} EXP`; gainExp(o.v); }
  if (o.k === 'shadow') { S.shadows.push(o.sh); txt = `Sombra obtida: <b style="color:${GRADES[o.sh.grade].c}">${esc(o.sh.name)}</b> [${GRADES[o.sh.grade].n}]`; }
  if (o.k === 'elixir') { for (const k in S.st) S.st[k]++; txt = 'Elixir da Vida: +1 em TODOS os atributos'; }
  recalc(); save();
  $('#boxRes').innerHTML = `<div style="font-size:18px;color:${r.c};font-family:var(--display)">${o.k === 'jackpot' ? 'JACKPOT!' : r.n.toUpperCase()}</div><div>${txt}</div>`;
  if ((o.r || 0) >= 4 || o.k === 'jackpot') { flash(.6, r.c); sfx.legend(); banner(o.k === 'jackpot' ? 'JACKPOT!' : r.n.toUpperCase() + '!', '', r.c, r.c); }
  else sfx.drop(o.r || 0);
  const ok = $('#boxOk'); ok.disabled = false; ok.onclick = () => { hideModal(); renderHub(); };
  const again = $('#boxAgain');
  if (kind === 'm' ? S.stones >= 12 : S.boxes > 0) { again.classList.remove('hidden'); again.onclick = () => openBox(kind); }
}

// ---------------------------------------------------------------- título
function startNew() {
  S = newSave();
  S.eq.weapon = makeItem(1, 0, 'weapon'); S.eq.armor = makeItem(1, 0, 'armor');
  S.daily.date = today();
  recalc(); refreshGates(); save();
  goHub('gates');
  sysMsg('SISTEMA', 'Você se tornou um <b style="color:var(--sys)">Jogador</b>.', 3000);
  setTimeout(() => sysMsg('SISTEMA', 'A Missão Diária chegou. Complete-a para ficar mais forte.', 3000), 1200);
  setTimeout(() => sysMsg('DICA', 'Entre em um gate. O ataque é automático, mova-se e sobreviva.', 3400), 2600);
}
(function initTitle() {
  const existing = load();
  if (existing) { $('#btnCont').classList.remove('hidden'); $('#btnNew').textContent = 'Novo jogo'; $('#btnNew').classList.remove('big'); }
  let armed = false;
  $('#btnNew').onclick = () => {
    audioInit();
    if (existing && !armed) { armed = true; $('#btnNew').textContent = 'Confirmar: apagar progresso'; $('#btnNew').classList.add('red'); return; }
    startNew();
  };
  $('#btnCont').onclick = () => {
    audioInit(); S = existing; recalc(); goHub('gates');
    sysMsg('SISTEMA', `Bem-vindo de volta, ${esc(S.name)}.`);
  };
})();

// ---------------------------------------------------------------- loop
let last = performance.now(), saveT = 0;
function frame(now) {
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  SND.budget = 4;
  const real = dt;
  if (hitstop > 0) { hitstop -= real; dt *= .05; }
  if (slowmo > 0) { slowmo -= real; dt *= .3; }
  if (shake > 0) shake = Math.max(0, shake - real * 60);
  try { update(dt); updateHud(real); render(now); } catch (err) { console.error(err); }
  saveT += real; if (saveT > 6 && S && scene === 'dungeon') { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
