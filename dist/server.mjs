#!/usr/bin/env node
// Apex GP multiplayer server — dependency-free Node 22 (node:http + a minimal RFC 6455 WebSocket, ws.mjs).
//
//   node server/server.mjs [--port 8787] [--host 0.0.0.0] [--game path/to/apex-gp.html] [--src path/to/src] [--quiet]
//
// Rooms have 6-digit join codes. The host picks the number of human places when creating the room (humanSlots, the
// room is full at that many drivers) and, in the lobby, the circuit, laps, AI racers (aiCount; humans + AI up to 20),
// weather, time of day, AI difficulty, penalty level, contact / ghosting and the mode (race or multiplayer time trial).
// Each player's car setup (front / rear wing per circuit) is sent with 'me' and stays private (never in room messages).
// Race mode: the server runs the race with the game's own logic modules (src/*.js: Race, Physics, AI, Weather — loaded
// exactly like tools/load.mjs does), i.e. lights, timing, positions, gaps, penalties, pit stops, weather and AI cars are
// authoritative here; each client drives its own car and streams it at 30 Hz (NetCore STATE), the server relays all cars
// (NetCore SNAP, 30 Hz near / 10 Hz far) and race data (RACE 5 Hz + JSON diffs + events). Time trial: every client runs
// its own solo session; the server relays the others as live ghosts, keeps the best-lap leaderboard and each player's
// best-lap ghost (download to race against it).
// Also serves the game page at / when it finds it (--game, server/public/index.html or ../apex-gp.html), plus
// /health and /status.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { acceptUpgrade } from './ws.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARG = (() => { const a = process.argv.slice(2), o = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } return o; })();
const PORT = +(ARG.port || process.env.PORT || 8787);
const HOST = ARG.host || process.env.HOST || '0.0.0.0';
const QUIET = !!ARG.quiet || process.env.AGP_QUIET === '1';
const log = (...a) => { if (!QUIET) console.log(new Date().toISOString().slice(11, 19), ...a); };
const now = () => performance.now();

// ---------------------------------------------------------------- game logic (same code as the browser)
const LOGIC = ['util.js', 'names.js', 'config.js', 'tracks_data.js', 'track.js', 'weather.js', 'physics.js', 'ai.js', 'race.js', 'ghost.js', 'netcore.js'];
function loadLogic() {
  const bundle = path.join(HERE, 'logic.js');
  let src;
  if (!ARG.src && fs.existsSync(bundle)) src = fs.readFileSync(bundle, 'utf8');
  else {
    const dir = ARG.src || process.env.AGP_SRC || path.join(HERE, '..', 'src');
    src = LOGIC.map(f => `// ===== ${f}\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n;\n');
  }
  const names = ['U', 'NAMES', 'CFG', 'SURF', 'COMPOUNDS', 'TEAMS', 'DIFFICULTY', 'POINTS', 'TRACK_DATA', 'buildTrack', 'Weather', 'Physics', 'createCar', 'AI', 'Race', 'Ghost', 'NetCore'];
  return new Function(src + '\n;return {' + names.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '};')();
}
const L = loadLogic();
const { U, NAMES, CFG, SURF, COMPOUNDS, TEAMS, DIFFICULTY, TRACK_DATA, buildTrack, Weather, Physics, AI, Race, Ghost, NetCore: N } = L;
const TRACK_IDS = Object.keys(TRACK_DATA).filter(id => !TRACK_DATA[id].draft);
const trackCache = {};
const getTrack = id => trackCache[id] || (trackCache[id] = buildTrack(TRACK_DATA[id]));
const STEP = 1 / CFG.physicsHz, STEPMS = 1000 / CFG.physicsHz;
const IDLE = { throttle: 0, brake: 1, steer: 0, boost: false, aeroPress: false, hold: true };
const MAX_ROOMS = +(process.env.AGP_MAX_ROOMS || 200), MAX_IN_ROOM = 20, RECONNECT_S = 60, LOAD_TIMEOUT = 25000, AFK_MS = 3000;
const EMOTES = ['gg', 'gl', 'nice', 'sorry', 'wait', 'go', 'ty', 'wd', 'close', 'oops', 'wow', 'lol', 'again', 'ready', 'brb', 'bye'];   // (labels: src/net.js EMOTES)
// fast relay: a human car's state goes to the drivers near it the moment it arrives (the 30 Hz snapshot carries the AI
// and far cars); --batch sends everything with the snapshots only (+0-33 ms)
const FAST = !ARG.batch;

// ---------------------------------------------------------------- game page
function findGame() {
  for (const p of [ARG.game, path.join(HERE, 'public', 'index.html'), path.join(HERE, '..', 'apex-gp.html')]) if (p && typeof p === 'string' && fs.existsSync(p)) return p;
  return null;
}
let gameCache = null;
function gamePage() {
  const p = findGame();
  if (!p) return null;
  const st = fs.statSync(p);
  if (!gameCache || gameCache.m !== st.mtimeMs || gameCache.p !== p) {
    // mark the page as served by a multiplayer server: the lobby then defaults to this server's address
    const html = fs.readFileSync(p, 'utf8').replace('<script type="module">', '<script>window.AGP_NET_SERVED = 1;</script>\n<script type="module">');
    gameCache = { p, m: st.mtimeMs, html: Buffer.from(html) };
  }
  return gameCache.html;
}

// ---------------------------------------------------------------- players & rooms
const rooms = new Map();      // code -> Room
const byToken = new Map();    // reconnect token -> Player
let nextPid = 1;
const stats = { started: Date.now(), conns: 0, races: 0 };

function send(p, o) { if (p && p.ws && p.ws.open) p.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
function sendAll(room, o, except) { const s = JSON.stringify(o); for (const p of room.players) if (p !== except) send(p, s); }
const connected = p => !!(p.ws && p.ws.open);

// names on screen (p.dname): two or more drivers in a room with the same typed name (case-insensitive) are numbered
// "Player 1", "Player 2", … in join order (NAMES.numbered); the 3-letter tower codes stay unique as before (PLA, PLX).
// Every client gets the server's names. In the lobby (no session running) the numbers follow the join order; while a
// race / time trial runs nobody is renamed: someone leaving keeps everyone else's number, and a newcomer (or a driver
// who changes their name) gets a number not used in the room or in that session.
const nameKey = n => String(n == null ? '' : n).trim().toLowerCase();
const dname = p => p.dname || p.name;
const numbered = (n, k) => (NAMES && NAMES.numbered ? NAMES.numbered(n, k) : k > 0 ? n + '\u00a0' + k : n);   // ("Player" + 2 -> "Player 2", a no-break space)
function numberNames(room) {
  const sim = room.sim && !room.sim.stopped ? room.sim : null, groups = new Map();
  for (const p of room.players) { const k = nameKey(p.name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  let changed = false;
  for (const [k, list] of groups) {
    if (!sim) list.forEach((p, i) => { p.nameNo = list.length > 1 ? i + 1 : 0; });
    else {
      const inSim = n => !!(sim.names && sim.names.has(nameKey(numbered(list[0].name, n)))), taken = new Set(), redo = [];
      let plain = false;
      for (const p of list) {   // (keeps the name it showed: same name typed, that number / the plain name not claimed by an earlier one)
        if (p.nameKey !== k || (p.nameNo ? taken.has(p.nameNo) : plain)) { redo.push(p); continue; }
        if (p.nameNo) taken.add(p.nameNo); else plain = true;
      }
      for (const p of redo) {
        if (list.length === 1 && !inSim(0)) { p.nameNo = 0; continue; }
        let n = plain || inSim(0) ? 2 : 1;
        while (taken.has(n) || inSim(n)) n++;
        p.nameNo = n; taken.add(n);
      }
    }
    for (const p of list) { p.nameKey = k; const d = numbered(p.name, p.nameNo); if (p.dname !== d) { p.dname = d; changed = true; } }
  }
  if (changed && sim && sim.mode === 'timetrial') { sim.roster(); sim.leaderboard(true); }
  return changed;
}
// online / away, for every client (room message: conn + away / lobby; urgent when it changes). awayOf: 1 = in the running
// session but not at the wheel (race: the AI drives their car — tab in the background, idle 3 s; time trial: tab in the
// background or no state for 3 s), 2 = went back to the lobby mid-race (the AI brings their car home), 0 = otherwise
function awayOf(room, p) {
  const sim = room.sim;
  if (!sim || sim.stopped || !connected(p) || !sim.has(p)) return 0;
  if (sim.mode === 'race') { const n = sim.byPid.get(p.id).net; return n && n.afk ? (n.lobby ? 2 : 1) : 0; }
  const e = sim.ent.get(p.id);
  return e && e.active && (e.away || (e.rep && now() - e.recvT > AFK_MS)) ? 1 : 0;
}

function newCode() {
  for (let k = 0; k < 1000; k++) { const c = String(100000 + crypto.randomInt(900000)); if (!rooms.has(c)) return c; }
  return null;
}
function freeTeam(room, want, self) {
  const taken = new Set(room.players.filter(p => p !== self).map(p => p.team));
  if (want >= 0 && want < TEAMS.length && !taken.has(want)) return want;
  for (let i = 0; i < TEAMS.length; i++) if (!taken.has(i)) return i;
  return -1;
}
function freeNumber(room, want, self) {
  const taken = new Set(room.players.filter(p => p !== self).map(p => p.number));
  if (want >= 1 && want <= 99 && !taken.has(want)) return want;
  for (let i = 2; i <= 99; i++) if (!taken.has(i)) return i;
  return 1;
}
function applyMe(room, p, me) {
  if (!me || typeof me !== 'object') return;
  if (me.name != null) { const n = N.cleanName(me.name); if (n !== p.name) { p.name = n; if (p.room === room) numberNames(room); } }
  if (me.team != null && room.phase === 'lobby') { const t = freeTeam(room, me.team | 0, p); if (t >= 0) p.team = t; }
  if (me.number != null) p.number = freeNumber(room, me.number | 0, p);
  if (me.compound != null && (N.COMP.includes(me.compound) || me.compound === 'A')) p.compound = me.compound;   // ('A' = AUTO: suitCompound at the start)
  if (me.setups != null) p.setups = N.cleanSetups(me.setups, TRACK_IDS);   // (private: only this player's own car uses it)
  if (me.ready != null) p.ready = !!me.ready;
}
function roomMsg(room, p) {
  const sim = room.sim;
  return {
    t: 'room', code: room.code, phase: room.phase, host: room.host ? room.host.id : null, you: p.id, settings: room.settings, tracks: TRACK_IDS,
    players: room.players.map(q => { const a = awayOf(room, q); return { id: q.id, name: dname(q), team: q.team, number: q.number, compound: q.compound, ready: q.ready, ping: q.ping | 0,
      conn: connected(q), away: a > 0, lobby: a === 2, host: q === room.host, inRace: !!(sim && sim.has(q)) }; }),   // (name: as shown, numbered when shared)
    race: sim && sim.brief ? sim.brief() : null,
  };
}
function sendRoom(room) { room.dirty = false; room.urgent = false; room.sentT = now(); for (const p of room.players) send(p, roomMsg(room, p)); }

function createRoom(host, settings, me) {
  if (rooms.size >= MAX_ROOMS) return send(host, { t: 'error', msg: 'Server is full, try again later' });
  const code = newCode();
  if (!code) return send(host, { t: 'error', msg: 'No free room code' });
  const room = { code, host, players: [], settings: N.roomSettings(settings, TRACK_IDS, 1), phase: 'lobby', sim: null, dirty: true, urgent: true, sentT: 0, created: Date.now() };
  rooms.set(code, room);
  joinRoom(room, host, me);
  log(`room ${code} created by #${host.id} ${dname(host)}`);
}
function joinRoom(room, p, me) {
  const cap = Math.min(MAX_IN_ROOM, room.settings.humanSlots || MAX_IN_ROOM);
  if (room.players.length >= cap && !room.players.includes(p)) { send(p, { t: 'error', code: 'full', msg: `Room ${N.fmtCode(room.code)} is full: ${room.players.length} of ${cap} drivers`, cap }); return false; }
  if (p.room && p.room !== room) leaveRoom(p, 'switch');
  if (!room.players.includes(p)) { room.players.push(p); p.nameKey = null; p.nameNo = 0; p.dname = null; }   // (a newcomer here: numbered afresh)
  p.room = room; p.ready = false; p.loaded = false;
  p.team = freeTeam(room, me && me.team != null ? me.team | 0 : p.team, p);
  p.number = freeNumber(room, me && me.number != null ? me.number | 0 : p.number, p);
  applyMe(room, p, Object.assign({}, me, { team: undefined, number: undefined }));
  numberNames(room);
  if (!room.host || !room.players.includes(room.host)) room.host = p;
  room.urgent = true;
  if (room.sim && room.sim.onJoin) room.sim.onJoin(p);
  return true;
}
function leaveRoom(p, why) {
  const room = p.room;
  if (!room) return;
  room.players = room.players.filter(q => q !== p);
  p.room = null; p.carId = null;
  if (room.sim && room.sim.onLeave) room.sim.onLeave(p);
  if (room.host === p) room.host = room.players.find(connected) || room.players[0] || null;
  room.urgent = true;
  numberNames(room);   // (lobby: the others' numbers follow the join order again; mid-session nobody is renamed)
  log(`#${p.id} ${dname(p)} left room ${room.code} (${why})`);
  if (!room.players.length) { if (room.sim) room.sim.stop(); rooms.delete(room.code); log(`room ${room.code} closed`); }
}

// ---------------------------------------------------------------- race session (server-authoritative)
// the typed name -> first name(s) + surname and the 3-letter code (NAMES.split / NAMES.code: a one-word name is just that word, bold)
const makeCode = (last, first) => (NAMES && NAMES.code ? NAMES.code(last, first) : (String(last || '').replace(/[^A-Za-z]/g, '').toUpperCase() + String(first || '').replace(/[^A-Za-z]/g, '').toUpperCase() + 'XXX').slice(0, 3));
function splitName(n) {
  if (NAMES && NAMES.split) { const o = NAMES.split(n); return { first: o.first, last: o.last || 'Player' }; }
  const parts = String(n).trim().split(/\s+/); return parts.length > 1 ? { first: parts[0], last: parts.slice(1).join(' ') } : { first: '', last: parts[0] || 'Player' };
}
function makeWeather(S, track, seed) {
  const mode = S.weather || 'dry', tod = S.timeOfDay || 'day';
  if (!Weather || !Weather.create) { const wet = { dry: 0, damp: 0.5, wet: 1 }[mode] || 0; return { wet, rain: wet >= 1 ? 1 : wet > 0 ? 0.35 : 0, timeOfDay: tod }; }
  return Weather.create({ mode, timeOfDay: tod, track, laps: S.mode === 'timetrial' ? 0 : S.laps, seed: (seed ^ 0x5bd1e995) >>> 0, custom: { start: 'dry', end: 'wet', when: 'mid' } });
}
const wearPerMetre = (S, track) => (S.mode === 'timetrial' || S.tyreWear === 'off' ? 0 : (S.tyreWear === 'high' ? 2 : 1) / (Math.max(S.laps, CFG.tyre.minRefLaps) * track.length));
// START TYRE AUTO ('A'): the tyre the conditions call for at the start (= Weather.startChoice: the wet / dry crossover;
// dynamic weather: Race's start call from the forecast). A picked tyre is always fitted exactly as picked.
function suitCompound(race, c) {
  const isWet = x => x === 'I' || x === 'W';
  if (race.wx && Weather.cat) return Weather.cat(c) === Weather.cat(race.wxStart) ? c : race.wxStart;
  const x = Weather && Weather.crossovers ? Weather.crossovers() : { I: 0.25, W: 0.75 }, w = race.wet || 0;
  const need = w >= x.W ? 'W' : w >= x.I ? 'I' : null;
  return need || (isWet(c) ? 'M' : c);
}

// one-car SNAP to every racer within NEAR of `car` (car: {id, x, z}; rep = its fresh state sample)
const _relay = Buffer.allocUnsafe(N.SNAP_HEAD + N.SNAP_CAR), _relayDv = new DataView(_relay.buffer, _relay.byteOffset, _relay.byteLength);
function relayNear(sim, car, rep, epoch, t, raceT) {
  let made = false;
  for (const q of sim.room.players) {
    if (!connected(q)) continue;
    const o = sim.mode === 'race' ? sim.byPid.get(q.id) : sim.ent.get(q.id);
    if (!o || o.id === car.id) continue;
    const ox = sim.mode === 'race' ? o.x : o.rep && o.rep.x, oz = sim.mode === 'race' ? o.z : o.rep && o.rep.z;
    if (ox == null) continue;
    const dx = ox - car.x, dz = oz - car.z;
    if (dx * dx + dz * dz > N.NEAR * N.NEAR) continue;
    // (whole ms: the receiver's sample time = head time - age must be exactly rep.t — a truncated head time with a
    // rounded age put half the samples 1 ms early, an 8 cm jump at 300 km/h)
    if (!made) { const T = Math.round(t); N.writeSnapHead(_relayDv, 1, 0, T, raceT); N.writeSnapCar(_relayDv, N.SNAP_HEAD, car.id, epoch, 1, T - rep.t, rep, false); made = true; }
    q.ws.sendVolatile(_relay);
  }
}

class RaceSim {
  constructor(room) {
    this.room = room; this.mode = 'race';
    const S = this.S = Object.assign({}, room.settings);
    const track = this.track = getTrack(S.trackId);
    const humans = this.humans = room.players.filter(connected);
    const n = Math.min(TEAMS.length, Math.max(humans.length, N.gridSize(S, humans.length)));   // humans + the lobby's AI racers
    // the AI fill: random teams (not the next ones in order), so all 20 liveries turn up; every client gets this list
    const field = humans.map(p => p.team), rest = [];
    for (let i = 0; i < TEAMS.length; i++) if (!field.includes(i)) rest.push(i);
    for (let i = rest.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1), t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    for (let i = 0; i < rest.length && field.length < n; i++) field.push(rest[i]);
    field.sort((a, b) => a - b);
    const seed = this.seed = crypto.randomInt(1, 2 ** 31 - 1);
    const G = this.G = { track, cars: [], player: null, race: null, world: null, events: [], weather: null, settings: { mode: 'race', penaltyLevel: S.penaltyLevel, penalties: S.penalties }, brains: new Map(), attract: false, time: 0, input: null };
    G.weather = makeWeather(S, track, seed);
    const diffId = DIFFICULTY[S.difficulty] ? S.difficulty : 'medium';
    this.diff = DIFFICULTY[diffId];
    Race.create(G, { mode: 'race', laps: S.laps, difficulty: diffId, playerTeam: humans.length ? humans[0].team : field[0], playerCompound: 'M', tyreWear: S.tyreWear, twoCompound: S.twoCompound,
      penalties: S.penalties, penaltyLevel: S.penaltyLevel, weather: S.weather, grid: 'random', seed, field, fieldSize: n });
    const race = this.race = G.race;
    G.player = null;
    const usedNum = new Set(humans.map(p => p.number)), usedCode = new Set();
    for (const car of G.cars) {
      car.isPlayer = false; car.assists = { tc: true, abs: true }; car.stability = 1;
      const p = humans.find(h => h.team === car.teamIndex);
      if (p) {
        // the names on screen from the shown name (numbered when two drivers typed the same: "Player 2" -> '' + 'Player 2'),
        // the 3-letter code from the typed one (two "Player": PLA and PLX below); fixed for the whole race
        const nm = splitName(p.name), dn = splitName(dname(p));
        car.driver = { first: dn.first, last: dn.last, code: makeCode(nm.last, nm.first), number: p.number };
        car.code = car.driver.code; car.name = dn.last; car.number = p.number; car.firstName = dn.first; car.lastName = dn.last;
        car.net = { p, dname: dname(p), typed: nm, epoch: 1, auth: 'client', why: null, rep: null, prev: null, recvT: now(), afk: false, lobby: false, brain: null, bad: 0, stale: 0, n: 0, rep0: null, ex: 0, ez: 0, eh: 0 };
        car.pitManual = true;   // (Race: the player drives the pit entry road; the autopilot takes the car at the limiter line)
        car.strategy = { auto: false, stops: [], plan: '', pending: null }; car.wantPit = false; car.pitSpeedingChance = 0;
        const c = N.COMP.includes(p.compound) ? p.compound : suitCompound(race, 'M');   // (a picked tyre exactly; AUTO 'A': the one the conditions call for)
        car.tyre.compound = c; car.tyre.wear = 0; car.compoundsUsed = [c]; car.grip = COMPOUNDS[c].grip;
        if (CFG.setup && CFG.setup.apply) CFG.setup.apply(car, (p.setups && p.setups[S.trackId]) || null);   // the player's own wings (lobby setup)
        p.carId = car.id; p.loaded = false;
      } else G.brains.set(car, AI.create(car, this.diff, seed + car.id * 7919, G));
    }
    // unique codes / numbers (humans keep theirs; two humans with the same code: the later one to join gets an alternative,
    // so "Player 1" is PLA and "Player 2" PLX)
    for (const p of humans) {
      const car = G.cars.find(c => c.net && c.net.p === p);
      if (!car) continue;
      if (usedCode.has(car.code)) {
        const L2 = (car.net.typed.last || '').replace(/[^A-Za-z]/g, '').toUpperCase() + 'XXX', F = ((car.net.typed.first || '').replace(/[^A-Za-z]/g, '').toUpperCase() || 'X');
        const alt = [L2.slice(0, 2) + F[0], L2[0] + L2.slice(2, 4), L2.slice(0, 2) + L2.slice(-4, -3), F.slice(0, 3)].find(c => c.length === 3 && !usedCode.has(c));
        if (alt) { car.code = alt; car.driver.code = alt; }
      }
      usedCode.add(car.code);
    }
    for (const car of G.cars) {
      if (car.net) continue;
      if (usedCode.has(car.code)) { const b = car.code.slice(0, 2); for (let k = 0; k < 26; k++) { const c = b + String.fromCharCode(65 + k); if (!usedCode.has(c)) { car.code = c; car.driver.code = c; break; } } }
      usedCode.add(car.code);
      if (usedNum.has(car.number)) { for (let k = 2; k < 100; k++) if (!usedNum.has(k)) { car.number = k; car.driver.number = k; break; } }
      usedNum.add(car.number);
    }
    G.world = { track, cars: G.cars, race, events: G.events, weather: G.weather, assists: { tc: true, abs: true }, wearPerMetre: wearPerMetre(S, track) };
    this.byPid = new Map(); for (const car of G.cars) if (car.net) this.byPid.set(car.net.p.id, car);
    this.names = new Set(humans.map(p => nameKey(dname(p))));   // (numberNames: names in this race are not given to a newcomer)
    this.ghost = S.contact === 'ghost';
    this.t0 = now(); this.steps = 0; this.snapSeq = 0; this.snapT = this.t0; this.raceT = this.t0; this.infoT = this.t0; this.wxT = this.t0;
    this.phase = 'loading'; this.loadT0 = this.t0; this.sched = null; this.goSent = false; this.endT = null; this.evq = [];
    this.infoKey = new Map(); this.rKey = ''; this.results = null;
    this._st = N.newState(); this._pr = {}; this._ex = {}; this._ex2 = {}; this._stN = N.newState();
    for (const p of humans) send(p, this.setupMsg(p));
    stats.races++;
    log(`room ${room.code}: race on ${track.id}, ${S.laps} laps, ${G.cars.length} cars (${humans.length} human), ${S.contact}`);
  }
  has(p) { return this.byPid.has(p.id); }
  brief() { const lead = this.race.order[0]; return { mode: 'race', phase: this.race.phase, lap: lead ? Math.min(this.race.laps, Math.max(1, lead.lap | 0)) : 0, laps: this.race.laps, track: this.track.id }; }
  setupMsg(p, resume) {
    const G = this.G, car = this.byPid.get(p.id);
    return {
      t: 'race', mode: 'race', seed: this.seed, settings: this.S, field: this.race.field.slice(), you: car ? car.id : -1, resume: !!resume,
      cars: G.cars.map(c => ({ id: c.id, team: c.teamIndex, pid: c.net ? c.net.p.id : null, name: c.net ? c.net.dname : null, first: c.firstName || '', last: c.lastName || c.name,
        code: c.code, number: c.number, compound: c._race && c.compoundsUsed ? c.compoundsUsed[0] : c.tyre.compound, grid: c.grid })),
      epoch: car && car.net ? car.net.epoch : 0, sched: this.sched, t0: this.goSent ? this.raceT0 : null,
      mySetup: car && car.setup ? { fw: car.setup.fw, rw: car.setup.rw } : null,   // (only this player's own)
    };
  }
  onJoin() {}
  onLeave(p) { const car = this.byPid.get(p.id); if (car && car.net) car.net.left = true; }
  stop() { this.stopped = true; }
  // ---- messages from a racing client
  onLoaded(p) { p.loaded = true; }
  onState(p, dv) {
    const car = this.byPid.get(p.id); if (!car) return;
    const n = car.net, s = N.readState(dv, this._st);
    if (!s) return;
    if (n.auth !== 'client' || s.epoch !== n.epoch) { n.stale++; return; }
    if (n.rep && ((s.seq - n.rep.seq) & 0xffff) >= 0x8000) return;   // older than the last one
    const t = now();
    s.t = Math.round(Math.min(t, Math.max(t - 1000, s.t)));   // a client with a bad clock estimate: keep the sample time sane (whole ms)
    const why = N.plausible(this.track, n.rep, s, n.rep ? s.t - n.rep.t : 33, this._pr);
    if (why) { n.bad++; if (n.bad % 30 === 1) log(`room ${this.room.code}: #${p.id} implausible state (${why}) x${n.bad}`); return; }
    const rep = n.rep || (n.rep = N.newState());
    if (n.n && !n.rep0) n.rep0 = { x: rep.x, z: rep.z, h: rep.h, vx: rep.vx, vz: rep.vz, r: rep.r, t: rep.t, acc: n.acc || 0 };   // (netPose: the prediction before this report)
    const dtr = n.n ? (s.t - rep.t) / 1000 : 0;   // (speed change per s between the last two reports, for the dead reckoning)
    n.acc = dtr > 0.01 && dtr < 0.25 ? U.clamp((Math.hypot(s.vx, s.vz) - Math.hypot(rep.vx, rep.vz)) / dtr, -60, 25) : 0;
    N.copyState(s, rep); rep.s = this._pr.s; rep.idx = this._pr.idx;
    n.recvT = t; n.n++;
    if (FAST) relayNear(this, car, rep, n.epoch, t, this.race.t);
    if (s.pitc >= 1 && s.pitc <= 5) { car.nextCompound = N.COMP[s.pitc - 1]; car.wxStop = true; }
    if (!car.kinematic) { car.tyre.wear = U.clamp(s.wear, 0, 1); car.battery = s.bat * (car.batteryCap || CFG.energy.cap); }
  }
  onReclaim(p) { const car = this.byPid.get(p.id); if (car && car.net && car.net.afk) { car.net.afk = false; car.net.lobby = false; car.net.recvT = now(); } }
  // the player's tab went to the background / they went back to the lobby (m.lobby): the AI drives at once (not after
  // AFK_MS of a frozen car); any key back in the race reclaims it, as after a drop
  onAway(p, m) {
    const car = this.byPid.get(p.id); if (!car || !car.net) return;
    if (m && m.lobby) car.net.lobby = true;   // (awayOf: the others see them in the lobby, their car as away)
    if (!car.net.afk && this.race.phase === 'racing') { car.net.afk = true; log(`room ${this.room.code}: #${p.id} ${dname(p)} away -> AI drives`); }
  }
  // tyre choice made in the pit lane (after the limiter line the server drives: no STATE packets carry it then)
  onPitc(p, m) { const car = this.byPid.get(p.id); if (car && N.COMP.includes(m.c)) { car.nextCompound = m.c; car.wxStop = true; } }
  // ---- control hand-over (epochs): the client ignores / the server rejects everything from an older epoch
  ctl(car, stT) {   // stT: the time of the car's state (its last physics step) when handing it back
    const n = car.net, msg = { t: 'ctl', id: car.id, epoch: n.epoch, auth: n.auth, why: n.why };
    if (stT != null) msg.st = { t: stT, x: car.x, z: car.z, h: car.h, vx: car.vx, vz: car.vz, r: car.r || 0, gear: car.gear, rpm: car.rpm, battery: car.battery, batteryCap: car.batteryCap,
      compound: car.tyre.compound, wear: car.tyre.wear, aeroLock: !!car.aeroLock, s: car.s, d: car.d };
    send(n.p, msg);
  }
  netPose(car, n, tNow, dt) {
    const race = this.race, track = this.track;
    if (n.rep) {
      const r = n.rep, pre = race.phase !== 'racing' && race.phase !== 'finished';
      // (dead reckoning as the clients do it: N.MAX_EXTRAP, the speed change between the last two reports carried on)
      const e = pre ? 0 : U.clamp((tNow - r.t) / 1000, 0, N.MAX_EXTRAP), x = N.extrap(r.x, r.z, r.h, r.vx, r.vz, r.r, e, this._ex, n.acc || 0);
      // a new report moves the extrapolated pose by the old one's prediction error: that change is blended out (~60 ms)
      // instead of a hop at every packet (AI cars alongside collide with / race against this pose; penalties judge it)
      if (n.rep0) {
        const q = n.rep0, y = N.extrap(q.x, q.z, q.h, q.vx, q.vz, q.r, pre ? 0 : U.clamp((tNow - q.t) / 1000, 0, N.MAX_EXTRAP), this._ex2, q.acc || 0);
        n.ex += y.x - x.x; n.ez += y.z - x.z; n.eh += U.wrapAngle(y.h - x.h); n.rep0 = null;
        if (n.ex * n.ex + n.ez * n.ez > 16 || Math.abs(n.eh) > 0.5 || r.reset) n.ex = n.ez = n.eh = 0;   // (a reset to the track: no blend)
      }
      const k = Math.exp(-dt / 0.06); n.ex *= k; n.ez *= k; n.eh *= k;
      car.x = x.x + n.ex; car.z = x.z + n.ez; car.h = U.wrapAngle(x.h + n.eh); car.vx = x.vx; car.vz = x.vz; car.r = r.r;
      car.throttle = r.throttle; car.brake = r.brake; car.steer = r.steer; car.gear = r.gear; car.rpm = r.rpm; car.aeroT = r.aeroT;
      car.aero = r.straight ? 'straight' : 'corner'; car.boosting = r.boosting; car.harvesting = r.harvesting; car.onKerb = r.onKerb; car.reverse = r.reverse;
      if (pre && (race.phase === 'grid' || race.phase === 'lights') && Math.hypot(car.vx, car.vz) < 0.05) { car.vx = 0; car.vz = 0; }
    } else { car.x += car.vx * dt; car.z += car.vz * dt; }   // just handed back: dead reckoning until the client's first report
    const p = track.project(car.x, car.z, car.idx, this._pr);
    car.s = p.s; car.d = p.d; car.idx = p.idx;
    const ch = Math.cos(car.h), sh = Math.sin(car.h);
    car.speed = Math.hypot(car.vx, car.vz); car.vLong = car.vx * ch + car.vz * sh; car.vLat = -car.vx * sh + car.vz * ch;
    car.surface = track.surface(car.s, car.d);
    car.offTrack = car.surface === SURF.GRASS || car.surface === SURF.GRAVEL || car.surface === SURF.RUNOFF;
    if ((race.phase === 'racing') && !n.afk && tNow - n.recvT > AFK_MS) { n.afk = true; log(`room ${this.room.code}: #${n.p.id} ${n.dname} idle -> AI drives`); }
  }
  step(tNow) {
    const G = this.G, race = this.race, dt = STEP, cars = G.cars, pre = race.phase === 'grid' || race.phase === 'lights';
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i], n = car.net;
      if (n) {
        const on = connected(n.p) && n.p.room === this.room && !n.left;
        const want = car.kinematic ? 'pit' : !on || n.afk ? 'ai' : null;
        if (want && n.auth === 'client') { n.auth = 'server'; n.why = want; n.epoch = (n.epoch % 255) + 1; this.ctl(car); }
        else if (want && n.why !== want) { n.why = want; this.ctl(car); }
        else if (!want && n.auth === 'server') { n.auth = 'client'; n.why = null; n.epoch = (n.epoch % 255) + 1; n.rep = null; n.rep0 = null; n.ex = n.ez = n.eh = 0; n.n = 0; n.recvT = tNow; this.ctl(car, tNow - STEPMS); }
        if (n.auth === 'client') { this.netPose(car, n, tNow, dt); continue; }
        if (car.kinematic) continue;
        let inp = Race.controlOverride(G, car);
        if (!inp && pre) inp = IDLE;
        if (!inp) { if (!n.brain) n.brain = AI.create(car, this.diff, this.seed + car.id * 131, G); inp = AI.drive(n.brain, car, G, dt); }
        Physics.step(car, inp, dt, G.world);
        continue;
      }
      let inp = Race.controlOverride(G, car);
      if (!inp && pre && !(race.releaseEarly && race.releaseEarly.has(car))) inp = IDLE;
      if (!inp) { const b = G.brains.get(car); inp = b ? AI.drive(b, car, G, dt) : IDLE; }
      Physics.step(car, inp, dt, G.world);
    }
    // ghosting: human cars touch nobody (AI cars still race each other); contact: everyone collides
    if (this.ghost) for (const c of cars) if (c.net && !c.kinematic) { c._gk = true; c.kinematic = true; }
    Physics.collide(cars, dt, G.events);
    if (this.ghost) for (const c of cars) if (c._gk) { c._gk = false; c.kinematic = false; }
    const wasRacing = race.phase === 'racing';
    Race.update(G, dt);
    G.time += dt;
    if (!wasRacing && race.phase === 'racing' && !this.goSent) {   // lights out: the race clock's zero on the server clock
      this.goSent = true; this.raceT0 = tNow - race.t * 1000;
      sendAll(this.room, { t: 'go', t0: this.raceT0 });
    }
    for (let i = 0; i < G.events.length; i++) {
      const ev = G.events[i];
      if (ev.type === 'raceEnd') this.onRaceEnd(tNow);
      const o = N.packEvent(ev);
      if (o) this.evq.push(o);
    }
    G.events.length = 0;
  }
  onRaceEnd(tNow) {
    if (this.results) return;
    const race = this.race, G = this.G;
    this.results = {
      t: 'res',
      rows: (race.results || []).map(r => ({ id: r.car.id, pos: r.pos, laps: r.laps, rawTime: r.rawTime, penalty: r.penalty, time: r.time, dnf: r.dnf, lapsDown: r.lapsDown, gap: r.gap, gapText: r.gapText,
        bestLap: r.bestLap, points: r.points, fastestLap: r.fastestLap, grid: r.grid, pitStops: r.pitStops, penaltyServed: r.penaltyServed, compounds: r.compounds, estimated: r.estimated })),
      cars: G.cars.map(c => ({ id: c.id, lapTimes: c.lapTimes, lapHist: c.lapHist, bestLap: c.bestLap, lastLap: c.lastLap, finishTime: c.finishTime, pitStops: c.pitStops, penalty: c.penalty,
        penaltyServed: c.penaltyServed, finished: c.finished, dnf: c.dnf, compoundsUsed: c.compoundsUsed, lapsDone: c.lapsDone })),
      fl: race.fastestLap ? [race.fastestLap.car.id, race.fastestLap.time, race.fastestLap.lap] : null,
    };
    this.flush();
    for (const q of this.room.players) send(q, this.resFor(q));
    this.endT = tNow;
    this.room.phase = 'lobby'; this.room.urgent = true;
    for (const p of this.room.players) p.ready = false;
    log(`room ${this.room.code}: race finished, winner ${race.results && race.results[0] ? race.results[0].car.code : '?'}`);
  }
  // results for player q: the other humans' wing levels are left out of their lap history (setups stay private)
  resFor(q) {
    const mine = this.byPid.get(q.id), hide = c => c.net && c !== mine;
    return Object.assign({}, this.results, { cars: this.results.cars.map((o, i) => {
      const c = this.G.cars[i];
      return c && hide(c) && Array.isArray(o.lapHist) ? Object.assign({}, o, { lapHist: o.lapHist.map(e => { const x = Object.assign({}, e); delete x.fw; delete x.rw; return x; }) }) : o;
    }) });
  }
  flush() { if (this.evq.length) { sendAll(this.room, { t: 'ev', e: this.evq }); this.evq = []; } }
  update(t) {
    if (this.stopped) return;
    const race = this.race;
    if (this.phase === 'loading') {   // wait for every racing client to build the circuit, then start the lights
      const all = this.humans.every(p => p.loaded || !connected(p) || p.room !== this.room);
      if (!all && t - this.loadT0 < LOAD_TIMEOUT) return;
      this.phase = 'run'; Race.confirmGrid(this.G);
      this.t0 = t; this.steps = 0;
      const R = CFG.race, g = t;   // step k runs at t0 + k * STEPMS, so Race's phase clock matches this schedule
      this.sched = { grid: g, lights: [0, 1, 2, 3, 4].map(k => g + (R.lightsDelay + k * R.lightsInterval) * 1000), out: g + (R.lightsDelay + 4 * R.lightsInterval + race.holdT) * 1000 };
      for (const car of this.G.cars) if (car.net) car.net.recvT = t;
      sendAll(this.room, { t: 'sched', sched: this.sched });
      this.room.phase = 'race'; this.room.urgent = true;
    }
    const want = Math.floor((t - this.t0) / STEPMS);
    let k = 0;
    while (this.steps < want && k < 24) { this.steps++; this.step(this.t0 + this.steps * STEPMS); k++; }
    if (this.steps < want) { this.lag = (this.lag || 0) + (want - this.steps); this.steps = want; }
    this.flush();
    if (t - this.snapT >= 1000 / N.HZ.snap) { this.snapT = Math.max(this.snapT + 1000 / N.HZ.snap, t - 100); this.snapshots(t); }
    if (t - this.raceT >= 1000 / N.HZ.race) { this.raceT = Math.max(this.raceT + 1000 / N.HZ.race, t - 200); this.raceBlock(); this.info(); }
    if (race.wx && t - this.wxT >= 1000) { this.wxT = t; const W = race.wx; sendAll(this.room, { t: 'wx', x: W.x, wet: W.wet, rain: W.rain, trend: W.trend }); }
    if (this.endT != null && t - this.endT > 45000) this.stop();   // cool-down laps done
  }
  snapshots(t) {
    const cars = this.G.cars, seq = ++this.snapSeq, raceT = this.race.t;
    // sample times to the ms: the head time is whole ms and each car's age makes its sample time exact — a relayed human
    // state keeps its own stamp, a car simulated here is at the last physics step (up to 8 ms before t: stamping it t
    // made the AI cars jump up to 0.7 m back and forth at 300 km/h), moved to that step's nearest whole ms
    const T = Math.round(t), tp = this.t0 + this.steps * STEPMS, tq = Math.round(tp), dq = (tq - tp) / 1000;
    for (const p of this.room.players) {
      if (!connected(p)) continue;
      const me = this.byPid.get(p.id);
      if (!me) continue;   // (waiting in the lobby: not in this race)
      const buf = Buffer.allocUnsafe(N.SNAP_HEAD + cars.length * N.SNAP_CAR), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      let o = N.SNAP_HEAD, n = 0;
      for (const car of cars) {
        const nn = car.net;
        if (car === me && nn.auth === 'client') continue;   // the client drives it itself
        if (me && car !== me) {
          const dx = car.x - me.x, dz = car.z - me.z, far = dx * dx + dz * dz > N.NEAR * N.NEAR;
          if (far && (seq + car.id) % N.FAR_EVERY) continue;
          if (!far && FAST && nn && nn.auth === 'client' && nn.rep && t - nn.recvT < 200) continue;   // (relayed on arrival)
        }
        let flags = 0, age = 0, s, stale = false;
        if (nn) { flags |= 1; if (nn.auth === 'server') flags |= 2; if (nn.why === 'ai') flags |= 8; }
        if (car.kinematic) flags |= 4;
        if (nn && nn.auth === 'client' && nn.rep) { s = nn.rep; age = T - s.t; stale = t - nn.recvT > 300; }
        else { s = N.stateFromCar(car, this._stN); age = T - tq; s.x += s.vx * dq; s.z += s.vz * dq; s.h += s.r * dq; }
        o = N.writeSnapCar(dv, o, car.id, nn ? nn.epoch : 0, flags, age, s, stale); n++;
      }
      N.writeSnapHead(dv, n, seq, T, raceT);
      p.ws.sendVolatile(buf.subarray(0, o));
    }
  }
  raceBlock() {
    const cars = this.G.cars, buf = Buffer.allocUnsafe(N.RACE_HEAD + cars.length * N.RACE_CAR);
    const len = N.writeRace(new DataView(buf.buffer, buf.byteOffset, buf.byteLength), this.snapSeq, this.race.t, cars);
    const b = buf.subarray(0, len);
    for (const p of this.room.players) if (connected(p)) p.ws.sendVolatile(b);
  }
  info(full, only) {
    const race = this.race, ch = [];
    for (const car of this.G.cars) {
      const o = N.infoOf(car), k = JSON.stringify(o);
      if (full || this.infoKey.get(car) !== k) { this.infoKey.set(car, k); ch.push(o); }
    }
    const r = { phase: race.phase, laps: race.laps, leaderLap: race.leaderLap, fl: race.fastestLap ? [race.fastestLap.car.id, race.fastestLap.time, race.fastestLap.lap] : null,
      sbs: race.sessionBestSectors, lf: !!race.leaderFinished, tca: !!race.twoCompoundActive, t: race.t };
    const rk = JSON.stringify([r.phase, r.leaderLap, r.fl, r.sbs, r.lf, r.tca]);
    const msg = { t: 'info', c: ch };
    if (full || rk !== this.rKey) { this.rKey = rk; msg.r = r; }
    if (!ch.length && !msg.r) return;
    if (only) send(only, msg); else sendAll(this.room, msg);
  }
  // a player came back (reconnect): the whole picture again
  resume(p) {
    const car = this.byPid.get(p.id);
    if (!car) return;
    car.net.left = false; car.net.afk = false; car.net.lobby = false;
    send(p, this.setupMsg(p, true));
    const k = new Map(this.infoKey); this.info(true, p); this.infoKey = k;
    if (this.results) send(p, this.resFor(p));
  }
}

// ---------------------------------------------------------------- multiplayer time trial (clients time themselves)
class TTSim {
  constructor(room) {
    this.room = room; this.mode = 'timetrial';
    this.S = Object.assign({}, room.settings);
    this.track = getTrack(this.S.trackId);
    this.seed = crypto.randomInt(1, 2 ** 31 - 1);
    this.ent = new Map();          // pid -> entry
    this.slots = [];               // car id -> entry
    this.snapSeq = 0; this.snapT = now(); this.lbKey = '';
    this._st = N.newState(); this._pr = {};
    this.minLap = this.track.length / 95;   // m/s cap of the fastest possible lap (anything quicker is not a lap)
    this.names = new Set();        // names shown in this session (numberNames: not given to a newcomer)
    for (const p of room.players.filter(connected)) this.add(p);
    log(`room ${room.code}: time trial on ${this.track.id}`);
  }
  has(p) { return this.ent.has(p.id); }
  brief() { return { mode: 'timetrial', track: this.track.id, drivers: this.ent.size }; }
  add(p) {
    let e = this.ent.get(p.id);
    if (!e) {
      let id = this.slots.findIndex(x => !x);
      if (id < 0) id = this.slots.length;
      if (id >= 40) return null;
      e = { id, p, rep: null, recvT: 0, prog: 0, lastS: null, best: null, bestS: null, laps: 0, last: null, ghost: null, ghostT: null, active: true };
      this.slots[id] = e; this.ent.set(p.id, e);
    }
    e.active = true; e.away = false;
    p.carId = e.id;
    this.names.add(nameKey(dname(p)));
    send(p, this.setupMsg(p));
    this.roster(); this.leaderboard(true);
    return e;
  }
  setupMsg(p) {
    const e = this.ent.get(p.id);
    const su = p.setups && p.setups[this.S.trackId];
    return { t: 'race', mode: 'timetrial', seed: this.seed, settings: this.S, you: e ? e.id : -1, players: this.rosterList(), mySetup: su ? { fw: su.fw, rw: su.rw } : null,
      cars: [{ id: e ? e.id : 0, team: p.team, pid: p.id, name: dname(p), number: p.number, compound: p.compound, grid: 1 }] };
  }
  rosterList() { return this.slots.filter(Boolean).map(e => ({ id: e.id, pid: e.p.id, name: dname(e.p), team: e.p.team, number: e.p.number, active: e.active && connected(e.p) })); }
  roster() { sendAll(this.room, { t: 'roster', players: this.rosterList() }); }
  onJoin() {}
  onLeave(p) { const e = this.ent.get(p.id); if (e) { e.active = false; this.roster(); } }
  onBack(p) { const e = this.ent.get(p.id); if (e) { e.active = false; e.away = false; this.roster(); } }
  stop() { this.stopped = true; }
  onLoaded() {}
  onReclaim() {}
  onAway(p) { const e = this.ent.get(p.id); if (e && e.active) e.away = true; }   // (tab in the background: away until its next state)
  onState(p, dv) {
    const e = this.ent.get(p.id); if (!e || !e.active) return;
    const s = N.readState(dv, this._st); if (!s) return;
    if (e.rep && ((s.seq - e.rep.seq) & 0xffff) >= 0x8000) return;
    const t = now();
    s.t = Math.round(Math.min(t, Math.max(t - 1000, s.t)));
    if (N.plausible(this.track, e.rep, s, e.rep ? s.t - e.rep.t : 33, this._pr)) { e.rep = null; e.lastS = null; return; }   // (a reset or teleport starts over)
    const rep = e.rep || (e.rep = N.newState());
    N.copyState(s, rep); rep.s = this._pr.s; rep.idx = this._pr.idx;
    if (e.lastS != null) { const ds = this.track.deltaS(e.lastS, rep.s); if (ds > 0 && ds < 60) e.prog += ds; }
    e.lastS = rep.s; e.recvT = t; e.away = false;
    if (FAST) relayNear(this, { id: e.id, x: rep.x, z: rep.z }, rep, 0, t, 0);
  }
  onLap(p, m) {
    const e = this.ent.get(p.id); if (!e) return;
    const time = +m.time, L = this.track.length;
    const sec = Array.isArray(m.s) ? m.s.map(Number) : null;
    const ok = m.valid !== false && isFinite(time) && time >= this.minLap && time < 1800 && e.prog >= 0.9 * L && e.prog <= 1.25 * L &&
      (!sec || (sec.length === 3 && Math.abs(sec[0] + sec[1] + sec[2] - time) < 0.08));
    e.prog = 0;
    if (!ok) return;
    e.laps++; e.last = time;
    if (e.best == null || time < e.best) { e.best = time; e.bestS = sec; e.ghost = null; e.ghostT = time; }
    this.leaderboard();
  }
  onGhost(p, m) {
    const e = this.ent.get(p.id);
    if (!e || typeof m.data !== 'string' || m.data.length > 400000 || e.best == null || Math.abs(+m.time - e.best) > 0.002) return;
    const lap = Ghost.deserialize(m.data);
    if (!lap || lap.n < 10 || Math.abs(lap.time - e.best) > 0.01) return;
    e.ghost = m.data; this.leaderboard(true);
  }
  getGhost(p, m) {
    const e = [...this.ent.values()].find(x => x.p.id === (m.pid | 0));
    if (!e || !e.ghost) return send(p, { t: 'ghost', pid: m.pid | 0, data: null });
    send(p, { t: 'ghost', pid: e.p.id, name: dname(e.p), team: e.p.team, time: e.best, data: e.ghost });
  }
  leaderboard(force) {
    const rows = [...this.ent.values()].filter(e => e.best != null).sort((a, b) => a.best - b.best)
      .map(e => ({ pid: e.p.id, id: e.id, name: dname(e.p), team: e.p.team, number: e.p.number, best: e.best, s: e.bestS, laps: e.laps, ghost: !!e.ghost }));
    const k = JSON.stringify(rows);
    if (!force && k === this.lbKey) return;
    this.lbKey = k;
    sendAll(this.room, { t: 'lb', rows });
  }
  update(t) {
    if (this.stopped) return;
    if (t - this.snapT < 1000 / N.HZ.snap) return;
    this.snapT = Math.max(this.snapT + 1000 / N.HZ.snap, t - 100);
    const seq = ++this.snapSeq, live = this.slots.filter(e => e && e.active && e.rep && t - e.recvT < 3000);
    for (const p of this.room.players) {
      if (!connected(p)) continue;
      const me = this.ent.get(p.id);
      const buf = Buffer.allocUnsafe(N.SNAP_HEAD + live.length * N.SNAP_CAR), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      let o = N.SNAP_HEAD, n = 0;
      for (const e of live) {
        if (e === me) continue;
        if (me && me.rep) {
          const dx = e.rep.x - me.rep.x, dz = e.rep.z - me.rep.z, far = dx * dx + dz * dz > N.NEAR * N.NEAR;
          if (far ? (seq + e.id) % N.FAR_EVERY : FAST && t - e.recvT < 200) continue;
        }
        o = N.writeSnapCar(dv, o, e.id, 0, 1, Math.round(t) - e.rep.t, e.rep, t - e.recvT > 300); n++;   // (whole ms: sample time = rep.t exactly)
      }
      N.writeSnapHead(dv, n, seq, Math.round(t), 0);
      p.ws.sendVolatile(buf.subarray(0, o));
    }
  }
}

// ---------------------------------------------------------------- message handling
function onText(p, raw) {
  let m;
  try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m.t !== 'string') return;
  const t = now();
  p.budget = Math.min(80, (p.budget ?? 80) + (t - (p.budgetT || t)) * 0.06); p.budgetT = t;   // ~60 messages / s sustained
  if ((p.budget -= 1) < 0) return;
  const room = p.room, host = room && room.host === p, sim = room && room.sim;
  switch (m.t) {
    case 'ping': send(p, { t: 'pong', c: m.c, s: now() }); if (m.p != null) { const v = Math.round(+m.p) || 0; if (Math.abs(v - (p.ping | 0)) >= 3 && room) room.dirty = true; p.ping = v; } break;   // (ping: non-urgent room update)
    case 'host': if (m.me && m.me.name) p.name = N.cleanName(m.me.name); createRoom(p, m.settings, m.me); break;
    case 'join': {
      const r = rooms.get(N.cleanCode(m.code));
      if (!r) return send(p, { t: 'error', msg: 'No room with code ' + N.fmtCode(N.cleanCode(m.code)), code: 'noroom' });
      if (m.me && m.me.name) p.name = N.cleanName(m.me.name);
      if (joinRoom(r, p, m.me)) log(`#${p.id} ${dname(p)} joined room ${r.code} (${r.players.length})`);
      break;
    }
    case 'me': if (room) { applyMe(room, p, m); room.urgent = true; } break;
    case 'settings': if (host && room.phase === 'lobby' && m.settings && typeof m.settings === 'object') {
      const upd = Object.assign({}, m.settings);
      if ('penalties' in upd && !('penaltyLevel' in upd)) upd.penaltyLevel = upd.penalties === false ? 'off' : room.settings.penaltyLevel !== 'off' ? room.settings.penaltyLevel : 'standard';   // (older clients: on / off)
      room.settings = N.roomSettings(Object.assign({}, room.settings, upd), TRACK_IDS, room.players.length); room.urgent = true; for (const q of room.players) if (q !== p) q.ready = false;
    } break;
    case 'start': {
      if (!host || room.phase !== 'lobby') return;
      const waiting = room.players.filter(q => q !== p && connected(q) && !q.ready);
      if (waiting.length && !m.force) return send(p, { t: 'error', msg: 'Waiting for ' + waiting.map(dname).join(', ') + ' to be ready', code: 'notready' });
      room.settings = N.roomSettings(room.settings, TRACK_IDS, room.players.filter(connected).length);
      if (room.sim) room.sim.stop();
      room.sim = null; numberNames(room);   // (a new session starts from the lobby's numbering, in join order)
      p.ready = true;
      try { room.sim = room.settings.mode === 'timetrial' ? new TTSim(room) : new RaceSim(room); }
      catch (e) { console.error(e); room.sim = null; return send(p, { t: 'error', msg: 'Could not start: ' + e.message }); }
      room.phase = room.settings.mode === 'timetrial' ? 'tt' : 'loading';
      room.urgent = true;
      break;
    }
    case 'back': {   // host: end the session for everyone (back to the lobby)
      if (!host || !sim) return;
      sim.stop(); room.sim = null; room.phase = 'lobby'; room.urgent = true; numberNames(room);
      for (const q of room.players) q.ready = false;
      sendAll(room, { t: 'end' });
      break;
    }
    case 'ttjoin': if (sim && sim.mode === 'timetrial') sim.add(p); break;
    case 'ttleave': if (sim && sim.onBack) sim.onBack(p); break;
    case 'loaded': if (sim) sim.onLoaded(p); break;
    case 'reclaim': if (sim) sim.onReclaim(p); break;
    case 'away': if (sim && sim.onAway) sim.onAway(p, m); break;   // (m.lobby: went back to the lobby)
    case 'pitc': if (sim && sim.onPitc) sim.onPitc(p, m); break;
    case 'lap': if (sim && sim.onLap) sim.onLap(p, m); break;
    case 'ghost': if (sim && sim.onGhost) sim.onGhost(p, m); break;
    case 'getghost': if (sim && sim.getGhost) sim.getGhost(p, m); break;
    case 'emote': if (room && EMOTES.includes(m.k) && t - (p.emoteT || 0) > 800) { p.emoteT = t; sendAll(room, { t: 'emote', pid: p.id, k: m.k }); } break;
    case 'leave': if (room) leaveRoom(p, 'left'); send(p, { t: 'left' }); break;
    default: break;
  }
}

function onConnection(ws) {
  stats.conns++;
  let p = null;
  const hello = setTimeout(() => { if (!p) ws.close(1008, 'no hello'); }, 10000);
  ws.onmessage = (data, bin) => {
    if (!p) {
      if (bin) return;
      let m; try { m = JSON.parse(data); } catch (e) { return; }
      if (!m || m.t !== 'hello') return;
      clearTimeout(hello);
      if (m.v !== N.VERSION) { ws.send(JSON.stringify({ t: 'error', msg: 'Game and server versions differ (' + m.v + ' vs ' + N.VERSION + '): update the game file', code: 'version' })); ws.close(1008, 'version'); return; }
      const old = m.token && byToken.get(String(m.token));
      if (old && (!old.ws || !old.ws.open || old.ws !== ws)) {   // reconnect: same player, same room / car
        if (old.ws && old.ws.open) old.ws.close(4000, 'replaced');
        p = old; p.ws = ws; p.discT = null;
        ws.send(JSON.stringify({ t: 'welcome', id: p.id, token: p.token, s: now(), resumed: !!p.room }));
        if (p.room) { p.room.urgent = true; if (p.room.sim && p.room.sim.resume) p.room.sim.resume(p); else if (p.room.sim && p.room.sim.mode === 'timetrial' && p.room.sim.has(p)) p.room.sim.add(p); }
        log(`#${p.id} ${dname(p)} reconnected`);
      } else {
        p = { id: nextPid++, token: crypto.randomBytes(12).toString('hex'), name: N.cleanName(m.name), ws, room: null, team: -1, number: 7, compound: 'A', ready: false, ping: 0, discT: null, carId: null };
        byToken.set(p.token, p);
        ws.send(JSON.stringify({ t: 'welcome', id: p.id, token: p.token, s: now(), resumed: false }));
      }
      return;
    }
    if (bin) {
      if (data.length && data[0] === N.MT.STATE && p.room && p.room.sim) p.room.sim.onState(p, new DataView(data.buffer, data.byteOffset, data.byteLength));
      return;
    }
    onText(p, data);
  };
  ws.onclose = () => {
    clearTimeout(hello);
    if (!p || p.ws !== ws) return;
    p.discT = Date.now();
    if (p.room) p.room.urgent = true;
    else byToken.delete(p.token);
  };
}

// ---------------------------------------------------------------- loop: all rooms, ~250 Hz scheduler, 120 Hz physics
setInterval(() => {
  const t = now(), wall = Date.now();
  for (const room of rooms.values()) {
    if (room.sim) { try { room.sim.update(t); } catch (e) { console.error(`room ${room.code} sim error`, e); room.sim.stop(); room.sim = null; room.phase = 'lobby'; room.urgent = true; numberNames(room); sendAll(room, { t: 'error', msg: 'The session crashed on the server: ' + e.message }); sendAll(room, { t: 'end' }); } }
    if (room.sim && room.sim.stopped) { room.sim = null; if (room.phase !== 'lobby') { room.phase = 'lobby'; room.urgent = true; } if (numberNames(room)) room.urgent = true; }
    for (const p of room.players.slice()) if (p.discT && wall - p.discT > RECONNECT_S * 1000) { leaveRoom(p, 'timeout'); byToken.delete(p.token); }
    // online / away changed (a dropped connection, the AI taking a car, a tab back): everyone's room message at once
    for (const p of room.players) { const k = (connected(p) ? 1 : 0) + 2 * awayOf(room, p); if (p.netSt !== k) { p.netSt = k; room.urgent = true; } }
    // lobby changes go out at once (<= ~7 / s); ping-only updates at most every 0.5 s in the lobby, 3 s in a session
    if (rooms.has(room.code) && (room.urgent ? t - room.sentT > 150 : room.dirty && t - room.sentT > (room.sim ? 3000 : 500))) sendRoom(room);
  }
}, 4);

// ---------------------------------------------------------------- http + upgrade
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (u === '/status') {
    let players = 0; for (const r of rooms.values()) players += r.players.length;
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    return res.end(JSON.stringify({ name: 'apex-gp', version: N.VERSION, rooms: rooms.size, players, races: stats.races, uptime: Math.round((Date.now() - stats.started) / 1000) }));
  }
  if (u === '/' || u === '/index.html' || u === '/apex-gp.html') {
    const html = gamePage();
    if (html) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); return res.end(html); }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Apex GP multiplayer server is running.\nOpen the game (apex-gp.html), choose MULTIPLAYER and use this server address:\n  ws://' + (req.headers.host || 'localhost:' + PORT) + '\n');
  }
  res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
});
server.on('upgrade', (req, socket, head) => acceptUpgrade(req, socket, head, onConnection));
server.on('clientError', (e, socket) => { try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (x) {} });
server.listen(PORT, HOST, () => {
  const g = findGame();
  console.log(`Apex GP multiplayer server on ${HOST}:${PORT}  (ws://localhost:${PORT})  circuits: ${TRACK_IDS.join(', ')}${g ? '  game page: ' + path.relative(process.cwd(), g) : ''}`);
});
