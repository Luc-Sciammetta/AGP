// Apex GP logic modules (bundled by server/pack.mjs)
// ===== util.js
// Apex GP — shared math / formatting helpers. Pure JS (runs in Node too).
const U = (() => {
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const wrapAngle = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const sign = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
  // move cur towards target by at most maxDelta
  const approach = (cur, target, maxDelta) => (cur < target ? Math.min(cur + maxDelta, target) : Math.max(cur - maxDelta, target));
  // frame-rate independent exponential smoothing
  const expDecay = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
  // mulberry32 seeded RNG -> function returning [0,1)
  const rng = seed => {
    let a = (seed >>> 0) || 0x9e3779b9;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // 83.456 -> "1:23.456"; null/Infinity -> "--:--.---"
  const fmtTime = (sec, digits = 3) => {
    if (sec == null || !isFinite(sec)) return '-:--.' + '-'.repeat(digits);
    // round first, then split (9.96 s at 1 digit -> "0:10.0", not "0:010.0"; 59.9996 -> "1:00.000", not "0:60.000")
    const f = Math.pow(10, digits), t = Math.round(Math.abs(sec) * f), neg = sec < 0 && t > 0;
    const m = Math.floor(t / (60 * f)), ss = ((t - m * 60 * f) / f).toFixed(digits);
    return (neg ? '-' : '') + m + ':' + (ss.length < digits + (digits ? 3 : 2) ? '0' : '') + ss;
  };
  // gap in seconds -> "+1.234" (or "+1:02.345" over a minute)
  const fmtGap = (sec, digits = 3) => {
    if (sec == null || !isFinite(sec)) return '';
    const sgn = sec < 0 ? '-' : '+';
    sec = Math.abs(sec);
    return sgn + (sec >= 60 ? fmtTime(sec, digits) : sec.toFixed(digits));
  };
  const kmh = ms => ms * 3.6;
  const hexToInt = hex => parseInt(hex.replace('#', ''), 16);
  return { TAU, clamp, lerp, invLerp, smooth, wrapAngle, sign, approach, expDecay, rng, fmtTime, fmtGap, kmh, hexToInt };
})();

;
// ===== names.js
// Apex GP — fictional driver name pool (data) + the name helpers below. Race combines random first + last names per car (seeded).
const NAMES = {
  first: [
    'Adrian', 'Aiden', 'Akira', 'Alban', 'Aleksander', 'Alessio', 'Alexei', 'Alvaro', 'Amadou',
    'Amir', 'Anders', 'Andrei', 'Anselm', 'Anton', 'Arjun', 'Armand', 'Arne', 'Arturo', 'Aurelio', 'Axel', 'Bastian',
    'Benedikt', 'Bento', 'Bjorn', 'Bruno', 'Caio', 'Callum', 'Casimir', 'Cedric', 'Cesar', 'Cian', 'Cillian',
    'Cosmin', 'Dante', 'Darius', 'Dario', 'Declan', 'Dmitri', 'Duncan', 'Eamon', 'Edoardo', 'Elias', 'Emil', 'Emilio',
    'Enzo', 'Eero', 'Esteban', 'Ethan', 'Evander', 'Fabian', 'Faris', 'Felipe', 'Felix', 'Filip', 'Finn', 'Florian',
    'Gael', 'Gaspard', 'Gideon', 'Giorgio', 'Gustavo', 'Hamish', 'Hannes', 'Haruto', 'Hector', 'Henrik', 'Hiro',
    'Hugo', 'Ibrahim', 'Idris', 'Ignacio', 'Ilya', 'Imran', 'Ivo', 'Jacopo', 'Jakub', 'Jarno', 'Jasper', 'Javier',
    'Joaquin', 'Jonah', 'Jorge', 'Julian', 'Kaito', 'Kalani', 'Kamil', 'Kasper', 'Kenji', 'Kian', 'Kofi', 'Lars',
    'Lazlo', 'Leandro', 'Lennart', 'Leon', 'Lorenzo', 'Luca', 'Lucas', 'Luka', 'Malik', 'Marek', 'Marius', 'Mateo',
    'Mathis', 'Mikael', 'Milan', 'Milo', 'Mireille', 'Nadia', 'Naoki', 'Nikolai', 'Noah', 'Nuno', 'Oisin', 'Olek',
    'Omar', 'Orlando', 'Oskar', 'Otto', 'Pablo', 'Paolo', 'Pascal', 'Pavel', 'Pedro', 'Quentin', 'Rafa', 'Ramon',
    'Rasmus', 'Ravi', 'Remy', 'Renzo', 'Riku', 'Rodrigo', 'Ronan', 'Rory', 'Ruben', 'Rui', 'Sacha', 'Santiago',
    'Sebastien', 'Sergei', 'Silas', 'Sora', 'Soren', 'Stellan', 'Tadeo', 'Taini', 'Takumi', 'Teodor', 'Theo', 'Tiago',
    'Tobias', 'Tomas', 'Tristan', 'Ugo', 'Valentin', 'Vasco', 'Viktor', 'Vincenzo', 'Wiktor', 'Xavier', 'Yannick',
    'Yusuf', 'Zane', 'Zeno', 'Zoltan', 'Amara', 'Beatriz', 'Chiara', 'Elena', 'Freya', 'Ines', 'Isla', 'Kira',
    'Leila', 'Maya', 'Noor', 'Sofia', 'Yuki', 'Zara',
  ],
  last: [
    'Abara', 'Achterberg', 'Adeyemi', 'Albescu', 'Almeida', 'Amberg', 'Andersen', 'Arrieta', 'Asano', 'Aurel',
    'Bakker', 'Balogun', 'Barros', 'Beaumont', 'Bellandi', 'Bergstrom', 'Bianchetti', 'Blomqvist', 'Bogdan', 'Brandt',
    'Brennan', 'Caccia', 'Calloway', 'Carvalho', 'Castaneda', 'Cerny', 'Chaudhry', 'Cortese', 'Costa', 'Dalgaard',
    'Danek', 'Delacroix', 'Demir', 'Denholm', 'Desai', 'Dimitrov', 'Dragan', 'Duval', 'Eklund', 'Endo', 'Esposti',
    'Falk', 'Farago', 'Fenwick', 'Ferraz', 'Fontaine', 'Forsberg', 'Fujimoto', 'Gallardo', 'Garnier', 'Gaspari',
    'Gerhardt', 'Giordano', 'Gomes', 'Gruber', 'Guerin', 'Haddad', 'Halvorsen', 'Hartmann', 'Hayashi', 'Heikkinen',
    'Herrera', 'Holloway', 'Horvath', 'Ibarra', 'Ionescu', 'Iwata', 'Jansen', 'Jaramillo', 'Jovanovic', 'Kaczmarek',
    'Kagawa', 'Kallio', 'Karimi', 'Keane', 'Kessler', 'Kowalczyk', 'Kurtz', 'Laine', 'Lambrecht', 'Larsen', 'Lemaire',
    'Lindqvist', 'Lombardi', 'Lucero', 'Maalouf', 'Madsen', 'Makinen', 'Marchetti', 'Marquez', 'Mbeki', 'Medina',
    'Mendez', 'Mikkelsen', 'Molnar', 'Montague', 'Moreau', 'Morita', 'Mustafa', 'Nakagawa', 'Navarro', 'Nieminen',
    'Novak', 'Nyberg', 'Okonkwo', 'Olivares', 'Oyelaran', 'Pacheco', 'Pallister', 'Pereira', 'Petrov', 'Pinto',
    'Quiroga', 'Radu', 'Ramaswamy', 'Rautio', 'Ravasi', 'Reyes', 'Rinaldi', 'Rocha', 'Rosales', 'Rousseau',
    'Sabatini', 'Salo', 'Sandoval', 'Santoro', 'Schreiber', 'Sekine', 'Serrano', 'Silvestri', 'Sokolov', 'Solberg',
    'Stavros', 'Strand', 'Suarez', 'Szabo', 'Takeda', 'Tanaka', 'Tavares', 'Thorsen', 'Toledo', 'Trevisan', 'Uchida',
    'Urquhart', 'Valdez', 'Vance', 'Varela', 'Vasquez', 'Vesely', 'Villanova', 'Voss', 'Wakefield', 'Weber',
    'Whitlock', 'Wojcik', 'Yamaguchi', 'Yildiz', 'Zamora', 'Zanetti', 'Zeller', 'Zielinski', 'Ziegler',
  ],
};

// A typed driver name -> { first, last } (race.js, the multiplayer server, the menus): the last word that has a letter or
// digit is the surname (shown bold), the words before it are the first name(s); marks after it stay with it. One word =
// just a surname, never an invented first name.
NAMES.split = full => {
  const w = String(full == null ? '' : full).trim().split(/\s+/).filter(Boolean), has = x => /[\p{L}\p{N}]/u.test(x);
  let k = w.length - 1;
  while (k > 0 && !has(w[k])) k--;
  const first = w.slice(0, Math.max(0, k)).join(' ');
  return has(first) ? { first, last: w.slice(k).join(' ') } : { first: '', last: w.join(' ') };
};
NAMES.parts = (first, last) => NAMES.split((first ? first + ' ' : '') + (last == null ? '' : last));
NAMES.code = (last, first) => {
  const L = x => String(x || '').replace(/[^\p{L}]/gu, '').toUpperCase(), D = x => String(x || '').replace(/[^\p{N}]/gu, '');
  return (L(last) + L(first) + D(last) + D(first) + 'XXX').slice(0, 3);
};

;
// ===== config.js
// Apex GP — game configuration, teams, tyre compounds, difficulty. Pure data (runs in Node too).

// Surface types returned by track.surface(s, d)
const SURF = { TRACK: 0, KERB: 1, RUNOFF: 2, GRASS: 3, GRAVEL: 4, PIT: 5, WALL: 6 };

const CFG = {
  physicsHz: 120,
  g: 9.81,
  rho: 1.225,

  car: {
    mass: 800,            // kg incl. driver + fuel
    inertia: 1000,        // yaw inertia kg*m^2
    wheelbase: 3.4,
    cgToFront: 1.85,      // a
    cgToRear: 1.55,       // b
    cgHeight: 0.21,
    length: 5.6,
    width: 1.9,
    collisionRadius: 1.05, // two circles, at +/- collisionOffset along heading
    collisionOffset: 1.55,
    trackWidth: 1.6,      // axle track (visual wheel spacing) m

    enginePower: 560e3,   // W (ICE + baseline electric)
    maxDriveForce: 12500, // N, low-gear engine force cap (tyres limit before this)
    brakeForce: 42000,    // N, total at full pedal (tyre-limited at low speed)
    brakeBias: 0.63,      // front share
    cdA: 1.10,            // drag area (corner mode)
    clA: 3.6,             // downforce area (corner mode)
    aeroBalance: 0.43,    // front share of downforce (rear-biased = stable at speed)
    rollingResist: 0.012,

    tyreMu: 1.75,         // peak friction coefficient on track
    tyreLoadSens: 0.12,   // grip falloff with load (mu drops at high load)
    peakSlip: 0.105,      // slip angle (rad) at peak lateral force
    peakSlipRatio: 0.10,  // longitudinal slip at peak force

    steerMax: 0.52,       // rad at standstill
    steerSpeedRef: 20,    // m/s: steerMax / (1 + v/steerSpeedRef), also capped by grip
    steerLowBoost: 0.12,  // rad of extra lock at low speed (hairpins, recoveries), faded out by steerLowFade
    steerLowFade: 30,     // m/s
    latLow: 0.15,         // extra sideways grip at hairpin speeds (both axles), full up to latLowV0, gone by latLowV1
    latLowV0: 19.4,       // m/s (70 km/h)
    latLowV1: 30.6,       // m/s (110 km/h)
    steerRate: 3.2,       // input units per second (keyboard ramp)
    steerReturn: 5.0,

    rpmIdle: 4200,
    rpmMax: 12500,
    rpmShiftUp: 12300,
    gearTop: [0, 92, 128, 160, 192, 224, 258, 294, 345], // km/h at rpmMax per gear (index = gear)
  },

  // Active aero (2026): straight mode lowers drag and downforce inside marked zones
  aero: {
    straightCdA: 0.80,    // multiplier on cdA when fully open
    straightClA: 0.52,    // multiplier on clA when fully open
    openTime: 0.45,       // s to open fully
    closeTime: 0.25,      // s to close
  },

  // Energy store (2026 style: Boost + Recharge + Overtake Mode)
  energy: {
    cap: 4.0,             // MJ
    overtakeBonus: 1.0,   // MJ added (and cap raised) for the Overtake Mode lap
    harvestOT: 1.15,      // recharge multiplier during the Overtake Mode lap
    boostPower: 250e3,    // W extra while boosting
    deployRate: 0.26,     // MJ/s drawn while boosting
    harvestBrake: 0.225,  // MJ/s at full brake
    harvestCoast: 0.059,  // MJ/s when coasting (no throttle, no brake)
    harvestPartial: 0.01, // MJ/s at part throttle (<60%)
    taperStart: 290 / 3.6, taperEnd: 345 / 3.6,           // electric boost fades between these speeds
    taperStartOT: 344 / 3.6, taperEndOT: 371 / 3.6,       // ... and these in Overtake Mode (top speed ~+11 km/h vs boost alone)
    startCharge: 1.0,     // fraction of cap at race start (full)
  },

  slipstream: {
    range: 45,            // m behind a car where the tow works
    dirtyRange: 25,       // m behind a car where dirty air costs downforce
    halfWidth: 3.4,       // m lateral window (widens with distance)
    dragCut: 0.30,        // max drag reduction
    dirtyAir: 0.10,       // max downforce loss when very close (in corners)
  },

  tyre: {
    // grip multiplier vs wear w in [0,1]: 1 - fade*w, then an extra cliff drop past compound.cliff
    fade: 0.06,
    cliffDrop: 0.28,
    // life = fraction of race distance a compound lasts at nominal usage (scaled to race length)
    // races shorter than this wear as if they were this long (7: a mediums / hards run lasts a 3-lap sprint at normal
    // wear — no stop needed; at 5 the softest compounds could not do 3 laps and short races got 1-2 stops each)
    minRefLaps: 7,
    baseUse: 0.45,        // wear-rate factor = (baseUse + loadUse * tyreUsage^2 + lockups/spin/off-track) / usageNorm
    loadUse: 1.0,
    usageNorm: 0.8,       // calibrated so an average lap ≈ 1.0
  },

  surface: [
    // index = SURF value
    { name: 'track',  grip: 1.00, drag: 0.00, bump: 0.0 },
    { name: 'kerb',   grip: 0.93, drag: 0.00, bump: 1.0 },
    { name: 'runoff', grip: 0.88, drag: 0.02, bump: 0.1 },
    { name: 'grass',  grip: 0.64, drag: 0.30, bump: 0.35, latF: 1.00, latR: 0.78, stab: 0.45, wobble: 1.0 },   // loose rear: easy to spin
    { name: 'gravel', grip: 0.60, drag: 0.40, bump: 0.7, latF: 0.85, latFhi: 1.0, latR: 1.00, stab: 1.0, wobble: 0.35 },   // front digs in: harder to turn, still steerable (latFhi: front factor at 120+ km/h)
    { name: 'pit',    grip: 1.00, drag: 0.00, bump: 0.0 },
    { name: 'wall',   grip: 0.50, drag: 0.50, bump: 1.0 },
  ],
  kerbWidth: 1.4,         // m, painted kerb width beyond the track edge

  race: {
    lightsDelay: 2.0,     // s on the grid before the first light
    lightsInterval: 1.0,  // s between lights
    holdMin: 0.4, holdMax: 2.6,  // random hold after 5th light
    jumpStartDist: 0.6,   // m moved before lights out = jump start
    jumpPenalty: 5,       // s
    pitSpeedLimit: 100 / 3.6,   // pit-lane speed limit (km/h / 3.6)
    pitServiceMin: 1.8, pitServiceMax: 3.2,   // random tyre-change time (s)
    overtakeGap: 2.0,     // s: within this at the detection point -> Overtake Mode next lap
    gapCheckpoint: 25,    // m between timing checkpoints (gap computation)
    cooldownLaps: 0,
  },

  view: { fovBase: 64, fovMax: 82 },
};

// Tyre compounds (F1 colours)
const COMPOUNDS = {
  // wetGrip = grip multiplier at [dry, damp, wet] track (interpolated by G.weather.wet 0..1)
  // wetSlide = handling loss out of the tyre's window, knots [[wetness, slide], ...] with smoothstep between (0 = none,
  //   1 = slicks on a soaked track): understeer, hydroplaning under braking at speed, wheelspin / power oversteer, a lower
  //   slide tail (Physics WET; the AI and Weather's lap-time tables read it too). Slicks: from 7 %, full at 30 %; inters:
  //   standing water above 50 %; wets: above ~77 %, at 100 % as slicks at 25 %. Crossovers (Weather.crossovers()):
  //   slick -> inter ~0.17, inter -> wet ~0.5
  S: { id: 'S', name: 'Soft',         color: '#ff2a3a', grip: 1.027, life: 0.40, cliff: 0.72, wetGrip: [1.00, 0.74, 0.53], wetSlide: [[0.07, 0], [0.3, 1]] },
  M: { id: 'M', name: 'Medium',       color: '#ffd12e', grip: 1.000, life: 0.65, cliff: 0.76, wetGrip: [1.00, 0.73, 0.52], wetSlide: [[0.07, 0], [0.3, 1]] },
  H: { id: 'H', name: 'Hard',         color: '#f2f2f2', grip: 0.978, life: 0.95, cliff: 0.80, wetGrip: [1.00, 0.72, 0.51], wetSlide: [[0.07, 0], [0.3, 1]] },
  I: { id: 'I', name: 'Intermediate', color: '#43b02a', grip: 0.880, life: 0.60, cliff: 0.75, wetGrip: [0.95, 0.91, 0.80], wetSlide: [[0.5, 0], [1, 1]], dryWear: 2.2 },
  W: { id: 'W', name: 'Wet',          color: '#1e6fd9', grip: 0.830, life: 0.70, cliff: 0.78, wetGrip: [0.86, 0.965, 1.00], wetSlide: [[0.77, 0], [1, 0.88]], dryWear: 3.0 },
};

// 20 fictional teams (one car each). perf: small AI pace spread.
const TEAMS = [
  { id: 'aurelia',   name: 'Aurelia Racing',      short: 'AUR', primary: '#00897b', secondary: '#f4f4f4', accent: '#d4af37', perf: 1.000, driver: { first: 'Leo',     last: 'Varga',       code: 'VAR', number: 7 } },
  { id: 'vulcan',    name: 'Vulcan Corse',        short: 'VUL', primary: '#d7141a', secondary: '#141414', accent: '#ffffff', perf: 0.998, driver: { first: 'Matteo',  last: 'Ricci',       code: 'RIC', number: 16 } },
  { id: 'stratos',   name: 'Stratos GP',          short: 'STR', primary: '#1a2a6c', secondary: '#ff7a00', accent: '#ffffff', perf: 0.996, driver: { first: 'Sam',     last: 'Okafor',      code: 'OKA', number: 4 } },
  { id: 'kestrel',   name: 'Kestrel F1 Team',     short: 'KES', primary: '#7ed321', secondary: '#2b2f36', accent: '#ffffff', perf: 0.993, driver: { first: 'Jonas',   last: 'Lind',        code: 'LIN', number: 27 } },
  { id: 'meridian',  name: 'Meridian Motorsport', short: 'MER', primary: '#c9ced6', secondary: '#00c3ff', accent: '#101820', perf: 0.991, driver: { first: 'Hugo',    last: 'Laurent',     code: 'LAU', number: 10 } },
  { id: 'onyx',      name: 'Onyx Racing',         short: 'ONX', primary: '#1b1b20', secondary: '#d4af37', accent: '#ffffff', perf: 0.988, driver: { first: 'Kai',     last: 'Nakamura',    code: 'NAK', number: 22 } },
  { id: 'solstice',  name: 'Solstice Racing',     short: 'SOL', primary: '#ffc400', secondary: '#1e4bd2', accent: '#101010', perf: 0.985, driver: { first: 'Rafael',  last: 'Duarte',      code: 'DUA', number: 11 } },
  { id: 'nova',      name: 'Nova Dynamics',       short: 'NOV', primary: '#6a2bd9', secondary: '#ffffff', accent: '#ff4fa3', perf: 0.982, driver: { first: 'Ellie',   last: 'Hart',        code: 'HAR', number: 3 } },
  { id: 'ironbridge',name: 'Ironbridge GP',       short: 'IRB', primary: '#0b4d2c', secondary: '#efe6c8', accent: '#c8102e', perf: 0.979, driver: { first: 'Oliver',  last: 'Thorne',      code: 'THO', number: 19 } },
  { id: 'helix',     name: 'Helix Racing',        short: 'HLX', primary: '#ff3ea5', secondary: '#14213d', accent: '#ffffff', perf: 0.976, driver: { first: 'Aria',    last: 'Castellanos', code: 'CAS', number: 8 } },
  // 10 more teams (20-car grids; a smaller field takes the player's team + the others in this order)
  { id: 'ember',     name: 'Ember Corse',         short: 'EMB', primary: '#ff6a13', secondary: '#16161a', accent: '#ffd23f', perf: 0.997, driver: { first: 'Dario',   last: 'Fontana',     code: 'FON', number: 21 } },
  { id: 'polaris',   name: 'Polaris Racing',      short: 'POL', primary: '#8fd1ff', secondary: '#0a1a3a', accent: '#ffffff', perf: 0.992, driver: { first: 'Nils',    last: 'Arvidsson',   code: 'ARV', number: 12 } },
  { id: 'tempest',   name: 'Tempest F1 Team',     short: 'TMP', primary: '#f4f5f7', secondary: '#e3122d', accent: '#111318', perf: 0.999, driver: { first: 'Maxime',  last: 'Delacroix',   code: 'DEL', number: 5 } },
  { id: 'sirocco',   name: 'Sirocco Racing',      short: 'SIR', primary: '#cdb07a', secondary: '#4a2a14', accent: '#0fa3a0', perf: 0.981, driver: { first: 'Karim',   last: 'Haddad',      code: 'HAD', number: 28 } },
  { id: 'bastion',   name: 'Bastion GP',          short: 'BAS', primary: '#4f5963', secondary: '#d7ff2a', accent: '#0e1013', perf: 0.987, driver: { first: 'Tomasz',  last: 'Wren',        code: 'WRE', number: 14 } },
  { id: 'riviera',   name: 'Riviera Racing',      short: 'RIV', primary: '#ff8a73', secondary: '#0d3b66', accent: '#fff3e0', perf: 0.978, driver: { first: 'Camille', last: 'Roux',        code: 'ROU', number: 23 } },
  { id: 'monarch',   name: 'Monarch Motorsport',  short: 'MON', primary: '#7c1c3e', secondary: '#e0b445', accent: '#fff4d6', perf: 0.994, driver: { first: 'Edward',  last: 'Ashcombe',    code: 'ASH', number: 9 } },
  { id: 'volta',     name: 'Volta Dynamics',      short: 'VOL', primary: '#c4e000', secondary: '#111111', accent: '#1fb6ff', perf: 0.984, driver: { first: 'Yuto',    last: 'Sakai',       code: 'SAK', number: 31 } },
  { id: 'sequoia',   name: 'Sequoia Racing',      short: 'SEQ', primary: '#6e2c12', secondary: '#f1e3c6', accent: '#2f8f4e', perf: 0.975, driver: { first: 'Mateo',   last: 'Ibarra',      code: 'IBA', number: 42 } },
  { id: 'cobalt',    name: 'Cobalt GP',           short: 'COB', primary: '#2350ff', secondary: '#ffffff', accent: '#ff2d55', perf: 0.990, driver: { first: 'Finn',    last: 'Kowalczyk',   code: 'KOW', number: 17 } },
];
// field size (drivers on the grid): quick race / championship setting, 2..TEAMS.length, one car per team
CFG.field = { min: 2, max: TEAMS.length, def: 10 };

// AI difficulty. pace = fraction of the reference speed profile the AI targets.
const DIFFICULTY = {
  easy:   { id: 'easy', vScale: 0.66,   label: 'Easy',   pace: 0.905, brakeEarly: 1.18, aggression: 0.25, mistake: 0.020, reaction: 0.45, lineNoise: 0.9 },
  medium: { id: 'medium', vScale: 0.772, label: 'Medium', pace: 0.955, brakeEarly: 1.08, aggression: 0.55, mistake: 0.008, reaction: 0.30, lineNoise: 0.5 },
  hard:   { id: 'hard', vScale: 0.85,   label: 'Hard',   pace: 0.992, brakeEarly: 1.00, aggression: 0.85, mistake: 0.002, reaction: 0.18, lineNoise: 0.2, kerb: 1 },
  adaptive: { id: 'adaptive', label: 'Adaptive', pace: 0.955, brakeEarly: 1.04, aggression: 0.55, mistake: 0.006, reaction: 0.28, lineNoise: 0.4, adaptive: true },
  // extreme: at the physics limit — full braking share, more trail-braking (fcK), hairpin speeds capped by steering lock (lockV)
  // kerb: 0..1 use of the AI's kerb line (inside wheels over the kerbs in the corners where that is faster)
  // technique from the player's recorded laps (tools/telemetry_compare.mjs): lat / lowK = corner grip share (fast / slow
  // corners), vTop = straight-line target (m/s, no pace cap: Straight mode stays open to the braking point), steerI =
  // steering integral (no ~1 m drift wide on exits), kBlur = plan on the smoother arc the car really drives; perfK / formK
  // compress the team / form spread (a top car must not plan past the identical physics car's limit). The adaptive dial
  // blends the same technique in past Extreme (ai.js D_X). kerbX: 0..1 two wheels past the kerb (clean air, dry) in the
  // corners where the lap model says it pays, like the player (legal: only all four off breaks track limits). Off: measured
  // <= 0.1 s a lap (the AI can't carry the player's speed through those lines) and more track-limits strikes in traffic.
  extreme: { id: 'extreme', label: 'Extreme', pace: 1.03, brakeEarly: 0.95, aggression: 1.0, mistake: 0.0005, reaction: 0.12, lineNoise: 0.0, brk: 1.05, fcK: 0.7, lockV: 0.86, kerb: 1,
    lat: 0.95, lowK: 0.93, vTop: 104, steerI: 1, kBlur: 1, perfK: 0.5, formK: 0.5, kerbX: 0 },
};

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Performance envelope helpers — shared by physics, the track speed profile (raceSpeed) and the AI,
// so that "how fast can this corner be taken" means the same thing everywhere.
CFG.perf = {
  downforce: (v, clMul = 1) => 0.5 * CFG.rho * CFG.car.clA * clMul * v * v,
  drag: (v, cdMul = 1) => 0.5 * CFG.rho * CFG.car.cdA * cdMul * v * v,
  // tyre friction coefficient with load sensitivity (loadRatio = load / static load)
  mu: loadRatio => CFG.car.tyreMu * U.clamp(1 - CFG.car.tyreLoadSens * (loadRatio - 1), 0.6, 1.1),
  // max steady-state lateral acceleration (m/s^2) at speed v; grip = tyre/surface multiplier, clMul = aero multiplier
  // speed-scaled steering lock (rad at the front wheels) before the grip cap; shared by physics and the AI
  steerLock: v => {
    const c = CFG.car, a = Math.abs(v), x = U.clamp(a / c.steerLowFade, 0, 1);
    return c.steerMax / (1 + a / c.steerSpeedRef) + c.steerLowBoost * (1 - x * x * (3 - 2 * x));
  },
  // sideways-grip multiplier at low speed (hairpins); applied to lateral tyre force only (not braking / traction)
  latLow: v => { const c = CFG.car, x = U.clamp((Math.abs(v) - c.latLowV0) / (c.latLowV1 - c.latLowV0), 0, 1); return 1 + c.latLow * (1 - x * x * (3 - 2 * x)); },
  latAccel: (v, grip = 1, clMul = 1) => {
    const W = CFG.car.mass * CFG.g, Fz = W + CFG.perf.downforce(v, clMul);
    return CFG.perf.mu(Fz / W) * Fz * grip / CFG.car.mass;
  },
  // max braking deceleration (positive m/s^2) at speed v, incl. aero drag + rolling resistance
  brakeDecel: (v, grip = 1) => {
    const W = CFG.car.mass * CFG.g, Fz = W + CFG.perf.downforce(v);
    const tyre = Math.min(CFG.perf.mu(Fz / W) * Fz * grip, CFG.car.brakeForce);
    return (tyre + CFG.perf.drag(v) + CFG.car.rollingResist * W) / CFG.car.mass;
  },
  // max forward acceleration (m/s^2, may be negative at top speed) at speed v with engine power P (W)
  driveAccel: (v, grip = 1, power = CFG.car.enginePower, cdMul = 1) => {
    const c = CFG.car, W = c.mass * CFG.g, L = c.wheelbase;
    const FzR0 = W * c.cgToFront / L, FzR = FzR0 + CFG.perf.downforce(v) * (1 - c.aeroBalance);
    const traction = CFG.perf.mu(FzR / FzR0) * FzR * grip;
    const F = Math.min(power / Math.max(v, 1), c.maxDriveForce, traction);
    return (F - CFG.perf.drag(v, cdMul) - c.rollingResist * W) / c.mass;
  },
};

// Car setup (player and AI cars each pick their own): FRONT / REAR WING 1..11, default 6 / 6 = the car above, exactly.
// With x = (front - 6) / 5 and y = (rear - 6) / 5 in [-1, 1]:
//   downforce  clA × (1 + 0.035 x - 0.01 x² + 0.05 y - 0.025 y²)    1 / 1 = -12 %, 11 / 11 = +5 %
//   drag       cdA × (1 + 0.05 x + 0.015 x² + 0.12 y + 0.035 y²)    1 / 1 = -12 %, 11 / 11 = +22 % (≈ +16 / -23 km/h)
//   balance    aeroBalance + 0.02 (x - y)                          front share: 11 / 1 = 47 %, 1 / 11 = 39 %
// Both wings get less extra downforce and more drag per click near their maximum angle (induced drag / stall), and a
// steeper wing keeps its extra drag with Straight mode open (zoneKeep = 1: only the base car's drag drops to
// CFG.aero.straightCdA), so the best level depends on the circuit: vortex ≈ 5 / 4, mirage / leman ≈ 8-9 / 7, serrano
// and harbour ≈ 9-10 / 8, kotori ≈ 7 / 6 (tools/setup_test.mjs). Front wing: front grip + turn-in, costs drag too; rear
// wing: rear grip + stability, costs the most top speed. Physics reads car.setup = CFG.setup.aero(..); aero ∝ v².
CFG.setup = {
  min: 1, max: 11, def: 6,
  front: { df: 0.035, dfSat: 0.01, drag: 0.05, dragSat: 0.015 },
  rear: { df: 0.05, dfSat: 0.025, drag: 0.12, dragSat: 0.035 },
  bal: 0.02, zoneKeep: 1,
  presets: [
    { id: 'low', name: 'Low downforce', fw: 5, rw: 3 },
    { id: 'mid', name: 'Balanced', fw: 6, rw: 6 },
    { id: 'high', name: 'High downforce', fw: 9, rw: 9 },
  ],
  // one wing value: whole number clamped to 1..11 (missing / invalid = default)
  wing: v => { const S = CFG.setup; v = v == null || v === '' ? NaN : Math.round(+v); return isFinite(v) ? Math.max(S.min, Math.min(S.max, v)) : S.def; },
  // {fw, rw} -> { fw, rw, clK (downforce ×), cdK (drag ×), bal (front share of downforce) }
  aero(s) {
    const S = CFG.setup, F = S.front, R = S.rear, fw = S.wing(s && s.fw), rw = S.wing(s && s.rw);
    const x = (fw - S.def) / 5, y = (rw - S.def) / 5;
    const clK = 1 + F.df * x - F.dfSat * x * x + R.df * y - R.dfSat * y * y, cdK = 1 + F.drag * x + F.dragSat * x * x + R.drag * y + R.dragSat * y * y;
    // cdZ: drag × with Straight mode open (base drops to straightCdA, zoneKeep of the setup's extra drag stays)
    return { fw, rw, clK, cdK, bal: CFG.car.aeroBalance + S.bal * (x - y), cdZ: CFG.aero.straightCdA + S.zoneKeep * (cdK - 1) };
  },
  apply(car, s) { car.setup = CFG.setup.aero(s); return car.setup; },
  // quickest {fw, rw} on circuit T (lap estimate over all 121 settings at tyre grip `grip`), cached per circuit / grip
  _best: typeof Map === 'function' ? new Map() : null,
  best(T, grip = 1) {
    const S = CFG.setup, key = T.id + ':' + grip.toFixed(2);
    if (S._best && S._best.has(key)) return S._best.get(key);
    let b = { fw: S.def, rw: S.def }, bt = Infinity;
    for (let r = S.min; r <= S.max; r++) for (let f = S.min; f <= S.max; f++) { const t = S.lapTime(T, S.aero({ fw: f, rw: r }), grip); if (t < bt - 1e-6) { bt = t; b = { fw: f, rw: r }; } }
    if (S._best) S._best.set(key, b);
    return b;
  },
  bestRear(T, bias = 0, grip = 1) { return CFG.setup.best(T, grip).rw; },
  // speed plan (m/s per track sample) for setup a: the lap estimate's profile (HUD braking guide for the player)
  speeds(T, a, grip = 1) { const S = CFG.setup; S.lapTime(T, a, grip); const L = S._lap && S._lap.get(T); return L ? Float32Array.from(L.v) : null; },
  // AI wing choice for circuit T: o = { skill 0..1 (1 = finds the circuit's best), wet 0..1, bias (team taste: front
  // wing clicks vs the best), rnd }. More rear wing in the wet; misjudged by up to ±(1 - skill) × 2.5 clicks.
  choose(T, o = {}) {
    const S = CFG.setup, rnd = o.rnd || Math.random, wet = o.wet || 0, sk = o.skill != null ? o.skill : 0.7, bias = Math.round(o.bias || 0);
    const err = k => Math.round((rnd() * 2 - 1) * (1 - sk) * k), b = S.best(T, 1 - 0.2 * wet);
    return { fw: S.wing(b.fw + bias + err(1.5) + (wet >= 0.6 ? 1 : 0)), rw: S.wing(b.rw + (wet >= 0.6 ? 2 : wet >= 0.25 ? 1 : 0) + err(2.5)) };
  },
  // performance envelope of a setup a = aero(..): CFG.perf with the setup's downforce / drag / balance
  latAccel: (v, a, grip = 1) => CFG.perf.latAccel(v, grip, a.clK),
  brakeDecel: (v, a, grip = 1) => {
    const c = CFG.car, W = c.mass * CFG.g, Fz = W + CFG.perf.downforce(v, a.clK);
    return (Math.min(CFG.perf.mu(Fz / W) * Fz * grip, c.brakeForce) + CFG.perf.drag(v, a.cdK) + c.rollingResist * W) / c.mass;
  },
  driveAccel: (v, a, grip = 1, power = CFG.car.enginePower, cdMul = 1) => {
    const c = CFG.car, W = c.mass * CFG.g, FzR0 = W * c.cgToFront / c.wheelbase, FzR = FzR0 + CFG.perf.downforce(v, a.clK) * (1 - a.bal);
    const F = Math.min(power / Math.max(v, 1), c.maxDriveForce, CFG.perf.mu(FzR / FzR0) * FzR * grip);
    return (F - CFG.perf.drag(v, a.cdK * cdMul) - c.rollingResist * W) / c.mass;
  },
  // flat-out speed (m/s) with no boost, where engine power = drag + rolling; straight = Straight mode open
  topSpeed(a, straight) {
    const cd = straight ? (a.cdZ != null ? a.cdZ / a.cdK : CFG.aero.straightCdA) : 1;
    let lo = 20, hi = 150;
    for (let i = 0; i < 40; i++) { const m = 0.5 * (lo + hi); if (CFG.setup.driveAccel(m, a, 1, CFG.car.enginePower, cd) > 0) lo = m; else hi = m; }
    return lo;
  },
  // quasi-steady lap time (s) of track T's racing line for setup a: the raceSpeed model of track.js (corner limit
  // × 0.93, drive / braking passes with the friction ellipse, Straight-mode drag in the zones, grade) with the
  // setup's aero; grip = tyre / track grip factor (wet: lower speeds, so aero matters less). Line curvature is cached
  // per track; a few ms per call. 6 / 6 at grip 1 ≈ T.lapTimeEst.
  _lap: typeof WeakMap === 'function' ? new WeakMap() : null,
  lapTime(T, a, grip = 1) {
    const S = CFG.setup, c = CFG.car, g = CFG.g;
    let L = S._lap && S._lap.get(T);
    if (!L) {
      const N = T.N, qx = new Float64Array(N), qz = new Float64Array(N), ds = new Float64Array(N), k0 = new Float64Array(N), zm = new Uint8Array(N);
      for (let i = 0; i < N; i++) { const d = T.raceLine[i]; qx[i] = T.px[i] + d * T.nx[i]; qz[i] = T.pz[i] + d * T.nz[i]; zm[i] = T.zoneAt(i * T.step) >= 0 ? 1 : 0; }
      for (let i = 0; i < N; i++) {   // signed curvature through i-2, i, i+2 (circumcircle), then a 5-sample box blur
        const j = (i + 1) % N, p = (i - 2 + N) % N, q = (i + 2) % N;
        ds[i] = Math.hypot(qx[j] - qx[i], qz[j] - qz[i]);
        const x1 = qx[q] - qx[i], z1 = qz[q] - qz[i], x2 = qx[p] - qx[i], z2 = qz[p] - qz[i], x3 = qx[q] - qx[p], z3 = qz[q] - qz[p];
        const n = Math.sqrt((x1 * x1 + z1 * z1) * (x2 * x2 + z2 * z2) * (x3 * x3 + z3 * z3));
        k0[i] = n > 1e-12 ? 2 * (x1 * z2 - x2 * z1) / n : 0;
      }
      const k = new Float64Array(N);
      let acc = 0; for (let j = -2; j <= 2; j++) acc += k0[(j + N) % N];
      for (let i = 0; i < N; i++) { k[i] = Math.abs(acc / 5); acc += k0[(i + 3) % N] - k0[(i - 2 + N) % N]; }
      let gr = null; if (T.grade) for (let i = 0; i < N && !gr; i++) if (T.grade[i]) gr = T.grade;
      L = { N, ds, k, zm, gr, v: new Float64Array(N) };
      if (S._lap) S._lap.set(T, L);
    }
    const { N, ds, k, zm, gr, v } = L, VMAX = 95, BRK_LAT = 0.8, cdS = CFG.aero.straightCdA, rr = c.rollingResist * g;
    const latA = vv => S.latAccel(vv, a, grip) * 0.93;
    const dragA = (vv, mul) => 0.5 * CFG.rho * c.cdA * a.cdK * mul * vv * vv / c.mass + rr;
    const rat = (vv, i) => vv * vv * k[i] / Math.max(1e-6, latA(vv));
    let i0 = 0;
    for (let i = 0; i < N; i++) {
      let vc = VMAX;
      if (k[i] >= 1e-6 && VMAX * VMAX * k[i] > latA(VMAX)) {
        let lo = 1, hi = VMAX;
        for (let it = 0; it < 32; it++) { const m = 0.5 * (lo + hi); if (m * m * k[i] <= latA(m)) lo = m; else hi = m; }
        vc = lo;
      }
      v[i] = vc; if (vc < v[i0]) i0 = i;
    }
    for (let n = 0; n < N; n++) {   // accelerating (tyre force left after cornering), from the slowest point on
      const i = (i0 + n) % N, j = (i + 1) % N, mul = zm[i] ? (a.cdZ != null ? a.cdZ / a.cdK : cdS) : 1, r = rat(v[i], i), fc = r >= 1 ? 0 : Math.sqrt(1 - r * r);
      let ax = (S.driveAccel(v[i], a, grip, c.enginePower, mul) + dragA(v[i], mul)) * fc - dragA(v[i], mul);
      if (gr) ax -= g * 0.5 * (gr[i] + gr[j]);
      const vn = Math.sqrt(Math.max(0, v[i] * v[i] + 2 * ax * ds[i]));
      if (vn < v[j]) v[j] = vn;
    }
    for (let n = 0; n < N; n++) {   // braking backwards (the rear unloads while turning)
      const j = (i0 - n + N) % N, i = (j - 1 + N) % N, dA = dragA(v[j], 1), r = rat(v[j], j) / BRK_LAT;
      let ax = Math.max(0, S.brakeDecel(v[j], a, grip) * 0.86 - dA) * (r >= 1 ? 0 : (1 - r) * (1 + r) * (1 - 0.5 * r)) + dA;
      if (gr) ax = Math.max(0.2, ax + g * 0.5 * (gr[i] + gr[j]));
      const vp = Math.sqrt(v[j] * v[j] + 2 * ax * ds[i]);
      if (vp < v[i]) v[i] = vp;
    }
    let t = 0;
    for (let i = 0; i < N; i++) t += ds[i] / Math.max(1, 0.5 * (v[i] + v[(i + 1) % N]));
    return t;
  },
};

// Race rules strictness: settings.penaltyLevel = 'off' | 'lenient' | 'standard' | 'strict' (old saves: penalties false =
// 'off'). Race.create resolves it (Race.penaltyLevel(opts)) and copies that level into race.pen. Per level:
//   col   causing a collision (Race.collisionFault; speeds = normal closing speed at the contact, Physics.collide e.intensity,
//         m/s): never below light; rear = nose into the back of a car, side = moved across into a car alongside, dive =
//         lunge from far back into a car's rear quarter / side. share = part of the closing speed the offender's own motion
//         must account for (else: a racing incident). along = how far back (m, centre to centre) a car may be and still
//         count as alongside when the other one moves across (1.85 = its front axle level with the other's cockpit).
//         A lunge = >= back m behind (centre to centre) 1 s before the contact and still closing at >= lunge m/s; diveNA: a
//         lunge into a car that turned in on it (never alongside: it may) is the lunging car's divebomb, even though the
//         car ahead moved. lap1 = threshold factor in the race's first lap1Dist m
//         (first-lap latitude). spin: a car that lost control (spinning / sliding) is penalised too. sec (big: { imp, sec }
//         heavier hits), cool = s during which one car gets one contact penalty (one incident)
//   tl    track limits (all four wheels off): warn = warnings before the penalty strike, gain = s gained off track for a
//         strike, cut = s gained for an immediate penalty (chicane cut), sec
//   pitTol  km/h over the 100 km/h pit limit tolerated at the limiter line; jump = m moved before lights out, jumpSec
CFG.penalties = {
  def: 'standard', levels: ['off', 'lenient', 'standard', 'strict'],
  names: { off: 'OFF', lenient: 'LENIENT', standard: 'STANDARD', strict: 'STRICT' },
  help: {
    off: 'No penalties at all: contact, track limits, corner cuts, pit-lane speeding and jump starts go unpunished.',
    lenient: 'Only big hits that are clearly your fault. Five track-limits warnings, big corner cuts only, generous pit-lane and start tolerance.',
    standard: 'Clear rear-ends, divebombs and moving into a car alongside; light contact is a racing incident. Three track-limits warnings, then 5 s.',
    strict: 'Close to real F1 stewarding: smaller hits and lunges count, any track-limits gain is a strike, 1 km/h pit tolerance, 10 s jump start.',
  },
  lenient: {
    col: { light: 4, rear: 9, side: 6, dive: 8, share: 0.8, along: 1.6, back: 13, lunge: 6, diveNA: true, lap1: 1.5, lap1Dist: 1500, spin: false, sec: 5, big: null, cool: 8 },
    tl: { warn: 5, gain: 0.35, cut: 1.5, sec: 5 },
    pitTol: 10, jump: 1.2, jumpSec: 5,
  },
  standard: {
    col: { light: 3, rear: 6, side: 4, dive: 5.5, share: 0.7, along: 2.4, back: 10, lunge: 4, diveNA: true, lap1: 1.25, lap1Dist: 1200, spin: false, sec: 5, big: null, cool: 8 },
    tl: { warn: 3, gain: 0.15, cut: 0.8, sec: 5 },
    pitTol: 5, jump: 0.6, jumpSec: 5,
  },
  strict: {
    col: { light: 2.2, rear: 4, side: 3, dive: 3.5, share: 0.62, along: 2.4, back: 8, lunge: 2.5, diveNA: true, lap1: 1, lap1Dist: 0, spin: true, sec: 5, big: { imp: 11, sec: 10 }, cool: 6 },
    tl: { warn: 3, gain: 0.05, cut: 0.5, sec: 5 },
    pitTol: 1, jump: 0.3, jumpSec: 10,
  },
};

;
// ===== tracks_data.js
// Apex GP — circuit definitions (pure data). Built into Track objects by buildTrack() in track.js.
//
// Raw format (per circuit):
//   segs: turtle path in racing direction starting at the final-corner exit onto the main straight.
//         [len] = straight (m); [radius, angleDeg] = arc (+ right, - left); optional 3rd = entry transition (m).
//   heading0: initial heading (deg, 0 = +x, 90 = +z); close: [iA, iB] straights auto-adjusted to close the loop.
//   transition: default clothoid length (m) between segments. width: asphalt width (m).
//   Positions are "at-specs" [segIndex, metresIntoSeg] (or plain numbers = s along the lap).
//   start: start/finish line. zones: segment indices of straights that get a Straight-mode zone.
//   turns (optional): at-specs of every corner apex in lap order -> explicit corner numbering (track.corners);
//   without it corners are detected from the racing line (adjacent same-direction bends merge).
//   elevation (optional): [[at, metres], ...] heights along the lap (at = at-spec, s in m, or a lap fraction < 1);
//   periodic monotone cubic through the points (closes at the line), smoothed over elevSmooth m (default 80), rebased
//   so the lowest point = elevBase (default 0). Keep |grade| <= maxGrade (default 0.10; the builder warns above it).
//   banking (optional): [[at, degrees], ...] same interpolation (bankSmooth, default 40 m); + = banked for a right-hander.
//   Without them the track is flat (elev/grade/bank all 0).
//   detect: Overtake-Mode detection point. pit: {side, entry, exit, blendIn, blendOut, ...}.
//   pit.exitCap (optional): {kph, from, to} = speed cap on the exit road from `from` to `to` metres before the exit line
//   (a bend right after the limiter line): the lane autopilot slows every car to kph (world speed) by `from` and holds
//   it to `to` (in the lane: use to <= blendOut, the limiter line); full control after the limiter line as usual.
//   runoff: {straight, outside, inside (m beyond the edge/kerb), style: 'park' | 'street'}.
//   runoffZones (optional): [{from, to, side (-1 left / 1 right / 0 both), surf: 'gravel' | 'paved' | 'grass'}] overrides
//   the automatic run-off surface on that stretch (outside of fast bends = gravel, of slow ones = paved, else grass).
//
// theme (all hex strings unless noted), passed through to track.theme:
//   sky, skyTop (zenith), fog, sun, grass, ground (far terrain), runoff (paved run-off), gravel, asphalt, line (edge
//   lines), kerbA/kerbB (kerb stripes), barrier (armco/concrete), tyreWall, water, building, timeOfDay 'day'|'dusk',
//   street (bool: concrete walls + fences instead of armco/tyres, no grass verges), fogNear/fogFar (m).
// scenery (free-form hints for render3d; at-specs are resolved to s by buildTrack: at -> s, from/to -> s0/s1):
//   grandstands: [{at, side (+1 right / -1 left of racing dir), len (m), rows?}]
//   trees: 0..1 density of trees beyond the barriers; treeKinds: ['broadleaf'|'pine'|'palm'|'cypress']
//   buildings: 0..1 density of buildings beyond the barriers (city blocks for street tracks)
//   water: {side, from, to, dist} a harbour/lake surface on that side between s0..s1, starting `dist` m beyond walls
//   tunnel: {from, to} covered section (street track), bridges: [{at}] footbridges / banners over the track
//   pitBuilding: {from, to} (pit garages along the lane, on pit.side), towers/landmarks: [{kind, at, side, dist, h}]
//   hills: 0..1 distant terrain relief, ferrisWheel: {at, side, dist}, yachts: bool, lights: bool (floodlights, dusk)
//   billboards: [{at, side}], marshalPosts: bool
//   treeKinds also 'mesquite' | 'agave' | 'cactus' (dry country); buildingStyles adds 'adobe'; buildingFloors: max upper
//   floors of the scattered buildings (default 3); mesas: bool (flat-topped buttes in the distant hills, colours from
//   theme.hill / theme.hillDark); grassSeating: [{at, side, dist (m beyond the barrier), len}] spectator banks;
//   speedTrap: {at} roadside sensor post (the only start / finish line is `start`: timing, chequers, gantry)
const TRACK_DATA = {
  vortex: {
    id: 'vortex',
    name: 'Autodromo Vortex',
    country: 'Italy (fictional)',
    lapRecordHint: '1:18',
    description: 'A temple of speed in an old royal park: three long straights, two brutal chicanes, the fast Curva Grande, the double-apex Lesmo and the sweeping Parabolica onto the main straight.',
    character: 'fast',
    width: 13.5,
    heading0: -90,
    transition: 32,
    segs: [
      [1100],          // 0 main straight (pit lane on the right)
      [15, 90],        // 1 T1 Variante Rettifilo, right
      [10],            // 2
      [16, -90],       // 3 T2 left
      [170],           // 4
      [320, 85, 70],   // 5 T3 Curva Grande, long fast right
      [430],           // 6 (closure straight)
      [20, -70],       // 7 T4 Variante Roggia, left
      [10],            // 8
      [22, 70],        // 9 T5 right
      [160],           // 10
      [55, 60],        // 11 T6 Lesmo 1 (double-apex right, first apex)
      [70],            // 12
      [48, 65],        // 13 T7 Lesmo 2 (second apex)
      [750],           // 14 Serraglio straight (closure straight)
      [85, -40, 50],   // 15 T8 Ascari, left
      [55, 75],        // 16 T9 right
      [95, -35],       // 17 T10 left
      [650],           // 18 back straight
      [70, 55, 50],    // 19 T11 Parabolica: tightening entry
      [110, 50],       // 20 ... opening
      [240, 45],       // 21 ... fast exit onto the main straight
    ],
    close: [6, 14],
    start: [0, 440],
    zones: [0, 14, 18],
    sectors: [1 / 3, 2 / 3],
    detect: [19, -260],
    pit: { side: 1, entry: [0, 70], exit: [0, 730], blendIn: 130, blendOut: 130 },
    runoff: { straight: 14, outside: 34, inside: 10, style: 'park' },
    theme: {
      sky: '#9fcbf0', skyTop: '#3f86d6', fog: '#c4dcee', sun: '#fff3d1', grass: '#4c8a2e', ground: '#5e7d3a',
      runoff: '#7f858c', gravel: '#d2bd8e', asphalt: '#3b3e43', line: '#f4f4f4', kerbA: '#d7262b', kerbB: '#f5f5f5',
      barrier: '#c7cbd1', tyreWall: '#222428', water: '#3b6f96', building: '#d8cbb3', timeOfDay: 'day', street: false,
      fogNear: 500, fogFar: 3200,
    },
    scenery: {
      grandstands: [
        { at: [0, 280], side: -1, len: 300, rows: 14 },   // main straight, opposite the pits
        { at: [0, 1000], side: -1, len: 120, rows: 10 },  // T1 braking zone
        { at: [5, 80], side: -1, len: 100, rows: 8 },     // Curva Grande
        { at: [13, 30], side: -1, len: 90, rows: 8 },     // Lesmo
        { at: [16, 20], side: -1, len: 110, rows: 8 },    // Ascari
        { at: [19, 40], side: -1, len: 220, rows: 12 },   // Parabolica outside
      ],
      trees: 0.85, treeKinds: ['broadleaf', 'pine'], buildings: 0.05, hills: 0.1,
      pitBuilding: { from: [0, 200], to: [0, 560] },
      landmarks: [{ kind: 'bankingRuin', at: [4, 60], side: 1, dist: 70, h: 8 }],
      bridges: [{ at: [0, 820] }, { at: [14, 400] }],
      billboards: [{ at: [0, 950], side: 1 }, { at: [6, 250], side: -1 }, { at: [18, 400], side: 1 }],
      marshalPosts: true, lights: false,
    },
  },

  harbour: {
    id: 'harbour',
    name: 'Harbour Street Circuit',
    country: 'Riviera city state (fictional)',
    lapRecordHint: '1:08',
    description: 'Barriers inches from the kerbs: a crawling hotel hairpin, the tunnel sweep onto the harbour-front chicane, quick swimming-pool esses and a short main straight. Qualifying is everything.',
    character: 'street',
    width: 10.5,
    heading0: -90,
    transition: 18,
    segs: [
      [450],           // 0 main straight (north), pits on the left
      [16, 90],        // 1 T1 right
      [380],           // 2 uphill
      [35, -35],       // 3 left
      [110],           // 4
      [55, -55],       // 5 long left
      [30],            // 6
      [32, 110],       // 7 casino square, right
      [300],           // 8 downhill
      [18, 85],        // 9 right, tight
      [60],            // 10
      [20, -180, 14],  // 11 hotel hairpin, left (very slow)
      [25],            // 12
      [20, 90],        // 13 right
      [180],           // 14
      [18, 90],        // 15 right onto the sea front
      [60],            // 16
      [420, 75, 40],   // 17 tunnel sweep, long fast right
      [200],           // 18
      [12, -85],       // 19 harbour chicane, left
      [8],             // 20
      [13, 85],        // 21 ... right
      [260],           // 22 harbour front (closure straight)
      [50, -45],       // 23 fast left
      [40],            // 24
      [30, -40],       // 25 swimming pool, quick left
      [15],            // 26
      [30, 40],        // 27 ... right
      [30],            // 28
      [22, 60],        // 29 pool exit, right
      [10],            // 30
      [22, -60],       // 31 ... left
      [50],            // 32
      [16, 90],        // 33 tight right
      [175],           // 34 (closure straight)
      [22, 45],        // 35 final right onto the straight
    ],
    close: [34, 22],
    start: [0, 290],
    zones: [0],
    sectors: [1 / 3, 2 / 3],
    detect: [33, -80],
    // exitCap: the exit road runs round the outside of T1 (R ~24 m) right after the limiter line -> the lane autopilot
    // is down to 80 km/h 10 m before that line (to: 100 = the limiter line); the driver takes the bend from there
    pit: { side: -1, entry: [0, 20], exit: [2, 70], blendIn: 100, blendOut: 100, boxSpacing: 12, exitCap: { kph: 80, from: 110, to: 100 } },
    runoff: { straight: 1.8, outside: 3.2, inside: 1.2, style: 'street' },
    theme: {
      sky: '#f2a36b', skyTop: '#3b3f7a', fog: '#c98f78', sun: '#ffb070', grass: '#3f6b35', ground: '#6d6a66',
      runoff: '#6e7075', gravel: '#b9a383', asphalt: '#34363b', line: '#f0f0f0', kerbA: '#d3202a', kerbB: '#f2f2f2',
      barrier: '#d9d9d6', tyreWall: '#1f2024', water: '#1f4d73', building: '#e3cfb0', timeOfDay: 'dusk', street: true,
      fogNear: 250, fogFar: 1800,
    },
    scenery: {
      grandstands: [
        { at: [0, 150], side: 1, len: 200, rows: 10 },   // main straight, opposite the pits
        { at: [1, 10], side: -1, len: 60, rows: 8 },     // T1 outside
        { at: [7, 10], side: 1, len: 50, rows: 6 },      // casino square
        { at: [22, 20], side: 1, len: 80, rows: 8 },     // harbour front (water on the other side)
        { at: [28, 0], side: 1, len: 70, rows: 8 },      // swimming pool
      ],
      trees: 0.15, treeKinds: ['palm'], buildings: 0.95, hills: 0.6,
      water: { side: -1, from: [17, 200], to: [33, 0], dist: 10 },   // harbour basin south of the lower leg
      yachts: true,
      tunnel: { from: [17, 40], to: [17, 330] },
      pitBuilding: { from: [0, 130], to: [0, 400] },
      landmarks: [
        { kind: 'casino', at: [7, 20], side: -1, dist: 25, h: 22 },
        { kind: 'hotel', at: [11, 0], side: 1, dist: 30, h: 40 },   // outside the hairpin, clear of the track
        { kind: 'poolDeck', at: [27, 0], side: -1, dist: 14, h: 1 },
      ],
      bridges: [{ at: [2, 120] }, { at: [18, 120] }],
      billboards: [{ at: [0, 400], side: -1 }, { at: [8, 80], side: 1 }, { at: [22, 60], side: 1 }],
      marshalPosts: true, lights: true,
    },
  },
  kotori: {
    id: 'kotori',
    name: 'Kotori Technical Circuit',
    country: 'Japan (fictional)',
    lapRecordHint: '1:12',
    description: 'Flowing and technical in wooded hills: a fast first corner into the esses, a long left sweeper, a Degner-style pair, a tongue hairpin, a flat-out 130R-style left and a tight chicane to finish.',
    character: 'technical',
    width: 12.5,
    heading0: 0,
    transition: 30,
    segs: [
      [700],           // 0 main straight (east), anticlockwise lap, pits on the right
      [250, -40, 60],  // 1 T1 fast left
      [25],            // 2
      [60, -50],       // 3 T2 tightening left -> north
      [60],            // 4
      [70, 60],        // 5 esses: right
      [15],            // 6
      [60, -70],       // 7 left
      [15],            // 8
      [60, 70],        // 9 right
      [15],            // 10
      [70, -60],       // 11 left
      [150],           // 12
      [200, -90, 60],  // 13 long fast left sweeper -> west
      [60],            // 14
      [150, 30],       // 15 Degner-style 1, fast right kink
      [160],           // 16
      [28, 60],        // 17 Degner-style 2, right -> north
      [200],           // 18
      [15, -180],      // 19 hairpin left -> south
      [180],           // 20
      [200, 90, 60],   // 21 fast right sweeper -> west
      [250],           // 22 (closure straight)
      [600, 20, 80],   // 23 long gentle right
      [150],           // 24
      [70, -55],       // 25 spoon-style double-apex left, first apex
      [40],            // 26
      [55, -55],       // 27 ... second apex -> south
      [600],           // 28 back straight (closure straight)
      [175, -55, 60],  // 29 130R-style flat-out left
      [150],           // 30
      [12, 90],        // 31 final chicane, right
      [8],             // 32
      [12, -90],       // 33 ... left
      [80],            // 34
      [160, -35],      // 35 final curve left onto the straight
    ],
    close: [22, 28],
    start: [0, 480],
    zones: [0, 28],
    sectors: [1 / 3, 2 / 3],
    detect: [31, -120],
    pit: { side: 1, entry: [0, 80], exit: [0, 640], blendIn: 130, blendOut: 130 },
    runoff: { straight: 12, outside: 28, inside: 9, style: 'park' },
    theme: {
      sky: '#a9cde8', skyTop: '#4d86c4', fog: '#c9d9e3', sun: '#fff1d6', grass: '#4a8736', ground: '#3f6a34',
      runoff: '#80868d', gravel: '#cfbd92', asphalt: '#393c41', line: '#f4f4f4', kerbA: '#d2232a', kerbB: '#f4f4f4',
      barrier: '#c5c9cf', tyreWall: '#232427', water: '#4a7fa6', building: '#e6e1d6', timeOfDay: 'day', street: false,
      fogNear: 450, fogFar: 2800,
    },
    scenery: {
      grandstands: [
        { at: [0, 380], side: -1, len: 320, rows: 14 },  // main straight, opposite the pits
        { at: [1, 40], side: 1, len: 140, rows: 10 },    // T1 outside
        { at: [7, 10], side: 1, len: 110, rows: 8 },     // esses
        { at: [19, 0], side: 1, len: 90, rows: 8 },      // hairpin
        { at: [31, 0], side: -1, len: 120, rows: 10 },   // final chicane
      ],
      trees: 0.95, treeKinds: ['pine', 'broadleaf', 'cypress'], buildings: 0.05, hills: 0.85,
      ferrisWheel: { at: [2, 0], side: -1, dist: 170 },    // amusement park inside T1
      pitBuilding: { from: [0, 200], to: [0, 520] },
      landmarks: [{ kind: 'rollerCoaster', at: [4, 0], side: -1, dist: 230, h: 30 }],
      bridges: [{ at: [12, 70] }, { at: [28, 150] }],
      billboards: [{ at: [0, 640], side: -1 }, { at: [22, 120], side: 1 }, { at: [28, 300], side: 1 }],
      marshalPosts: true, lights: false,
    },
  },

  // Traced from the user's drawing (2000x1333 px, ~0.62 m/px; +x east, +z = down the page): the turtle was
  // least-squares fitted to the digitized centreline. Clockwise lap, main straight runs west, pits on its north side.
  // Not modelled: the drawing's link roads for alternative layouts, the separate finish line (timing uses the start
  // line) and the pit exit road that joins after T1 (the lane rejoins the straight before T1 here).
  mirage: {
    id: 'mirage',
    zoneOpts: { lead: -40, back: 15, bendK: 1 / 220 },   // longer Straight-mode zones (user request): open on the corner exit, close just before braking
    name: 'Gulf Mirage International Circuit',
    country: 'Saudi Arabia (fictional)',
    lapRecordHint: '1:47',
    description: 'A floodlit night race on the Gulf desert: a kilometre-long pit straight into a hairpin, climbing esses, three long Straight-mode blasts on the diagonals, a tight left hairpin, the stadium loop inside Stand 1 and a fast sweep back onto the straight.',
    character: 'fast',
    width: 14,
    heading0: 178.1,
    transition: 24,
    segs: [
      [60.8],               // 0 main straight (T20 exit) ...
      [908.3],              // 1 ... main straight, heading west: start line, pits on the right (closure straight)
      [12.4, 166.11, 30],   // 2 T1 hairpin, right
      [90.2, 0, 14],        // 3
      [58.8, -46.64],       // 4 T2 left
      [109.8],              // 5
      [71.5, -66.27],       // 6 T3 esses: left
      [14.2],               // 7
      [81.9, 62.31],        // 8 T4 right
      [154.4],              // 9 (closure straight)
      [35.4, 113.48, 30],   // 10 T5 right, top of the triangle
      [90.4],               // 11 run down to T6
      [194.3, 7.02],        // 12 kink right
      [14.6],               // 13
      [33.2, -79.16, 16],   // 14 T6 left onto the upper diagonal
      [36.5],               // 15 upper diagonal (Sector 2) ...
      [415.8],              // 16 ... Straight-mode zone
      [52, -163.6],         // 17 T7 long left loop
      [239.2],              // 18 inner straight, west
      [76.7, 50.79],        // 19 T8 right
      [23.7],               // 20
      [16.1, 131.87, 16],   // 21 T9 hairpin right
      [346.3],              // 22 top straight, east
      [104.9, 59.16],       // 23 T10 long right ...
      [101.2, 36.9],        // 24 ... tightening
      [26.8],               // 25
      [126.9, 55.66],       // 26 T11 fast right onto the lower diagonal
      [14.9],               // 27 lower diagonal ...
      [596.1],              // 28 ... Straight-mode zone
      [13.7, -160.37, 28],  // 29 T12 hairpin left
      [222],                // 30 (Sector 3)
      [37.3, -53.01, 10],   // 31 T13 left
      [1.5],                // 32
      [23.9, 54.94, 10],    // 33 T14 right
      [290.4],              // 34
      [12.1, 119.94, 14],   // 35 T15 right into the stadium loop
      [41.1],               // 36
      [13.6, -194.72, 12],  // 37 T16 hairpin left (inside Stand 1)
      [8],                  // 38
      [23.3, 90.97, 12],    // 39 T17 right
      [54.4],               // 40
      [63, 64.76],          // 41 T18 right
      [74.8],               // 42
      [46.3, 72.56],        // 43 T19 right
      [88.7],               // 44 overtake detection
      [87, 37.26],          // 45 T20 fast right onto the main straight
    ],
    close: [1, 9],
    start: [1, 557],
    zones: [1, 16, 28],
    turns: [[2, 18], [4, 23.9], [6, 41.3], [8, 44.5], [10, 35.1], [14, 22.9], [17, 74.2], [19, 34], [21, 18.5], [23, 54.2], [26, 61.6], [29, 19.2], [31, 17.3], [33, 11.5], [35, 12.7], [37, 23.1], [39, 18.5], [41, 35.6], [43, 29.3], [45, 28.3]],   // T1..T20 as numbered on the drawing
    sectors: [[16, 15.1], [30, 70.4]],
    detect: [44, 49.8],
    pit: { side: 1, entry: [1, 136.7], exit: [1, 806.3], blendIn: 95, blendOut: 140 },
    widths: [   // the drawing's hairpins are wider than the straights
      { from: [2, -15], to: [2, 50.9], w: 17 },   // T1
      { from: [21, -15], to: [21, 52.1], w: 17 },   // T9
      { from: [29, -15], to: [29, 53.3], w: 17 },   // T12
      { from: [35, -10], to: [35, 35.3], w: 16 },   // T15
      { from: [37, -10], to: [37, 56.2], w: 16 },   // T16
    ],
    runoff: { straight: 12, outside: 34, inside: 10, style: 'park' },
    theme: {
      sky: '#131a33', skyTop: '#02050e', fog: '#262233', sun: '#b9c6ff', grass: '#d4ba8a', ground: '#c4a574',
      runoff: '#8f9398', gravel: '#dcc089', asphalt: '#35383d', line: '#f4f4f4', kerbA: '#d3202a', kerbB: '#f4f4f4',
      barrier: '#cfd2d6', tyreWall: '#222428', water: '#1d4f73', building: '#e8d9bd', concrete: '#d6d0c4',
      timeOfDay: 'night', street: false, fogNear: 300, fogFar: 2600,
    },
    scenery: {
      grandstands: [
        { at: [1, 437.4], side: -1, len: 340, rows: 16 },   // Grandstand 1, opposite the pits
        { at: [1, 854.7], side: -1, len: 170, rows: 10 },   // Stand 3, T1 braking zone
        { at: [5, 58], side: -1, len: 110, rows: 8 },       // Stand 4, T2-T3
        { at: [9, 120], side: -1, len: 160, rows: 10 },     // Stand 5, run up to T5
        { at: [16, 20], side: 1, len: 120, rows: 8 },       // Stand 6, T6 exit
        { at: [16, 362], side: 1, len: 140, rows: 10 },     // Stand 7, T7 braking zone
        { at: [20, 10], side: -1, len: 110, rows: 8 },      // Stand 8, outside T8-T9
        { at: [22, 40], side: -1, len: 140, rows: 8 },      // Stand 9, top straight
        { at: [28, 489.7], side: 1, len: 150, rows: 10 },   // Stand 10, T12 braking zone
        { at: [34, 256.4], side: -1, len: 140, rows: 8 },   // Stand 11, T15 braking zone
        { at: [37, 20], side: 1, len: 130, rows: 12 },      // Stand 1, wraps the stadium loop
      ],
      stadium: { from: 3940, to: 4400 },   // T15–T18 "stadium" section: grandstands ringed all around it (render3d)
      trees: 0.12, treeKinds: ['palm'], buildings: 0.3, hills: 0.22,
      pitBuilding: { from: [1, 283.6], to: [1, 609.4] },
      landmarks: [
        { kind: 'tower', at: [22, 170], side: -1, dist: 160, h: 90 },
        { kind: 'tower', at: [28, 250], side: -1, dist: 220, h: 70 },
      ],
      bridges: [{ at: [22, 230] }, { at: [28, 330] }],
      billboards: [{ at: [1, 700], side: -1 }, { at: [16, 250], side: -1 }, { at: [28, 150], side: -1 }, { at: [22, 280], side: 1 }],
      marshalPosts: true, lights: true,
    },
  },
  // Serrano GP Circuit — traced from the user's drawing (1546x2000 px, ~0.69 m/px; +x east, +z = down the page): the
  // turtle was least-squares fitted to the digitized centreline. Clockwise lap, main straight runs west, pits on its
  // north side. Elevation is a plausible profile from the drawing's notes (climb on the west side, crest at the
  // top-left T9 hairpin, descent down the east side). The drawing's separate finish line is not modelled (timing uses
  // its Start line); the second "DRS detection" note before T9 has no equivalent (one detection point per lap).
  serrano: {
    id: 'serrano',
    name: 'Serrano GP Circuit',
    country: 'Austria (fictional)',
    lapRecordHint: '1:28',
    description: 'Parkland and forest outside Vienna: a long pit straight into T1, a climb up the west side through a tight hairpin, flowing esses up to the crest at the T9 hairpin, a Straight-mode blast along the top, then a winding descent through the woods back to the grandstands.',
    character: 'technical',
    width: 13,
    heading0: 176.6,
    transition: 24,
    segs: [
      [705.4],              // 0 main straight, heading west: start line, pits on the right (closure straight)
      [73, 126.26],         // 1 T1 right
      [84.6],               // 2
      [82.1, -67.16],       // 3 T2 left
      [218.8],              // 4 climb up the west side
      [18.3, 154.66, 20],   // 5 T3 hairpin right
      [350.2],              // 6 diagonal back down to the south-east
      [83, -143.94],        // 7 T4 long left
      [87.8],               // 8 (Sector 2)
      [91.9, -51.92],       // 9 T5 left
      [20.1],               // 10
      [107.9, 77.91],       // 11 T6 right
      [29.2],               // 12
      [114.3, 53],          // 13 T7 right
      [11.5],               // 14
      [123.1, -127.15],     // 15 T8 long left
      [239.8],              // 16 climb to the crest
      [36, 172.9],          // 17 T9 hairpin right (highest point)
      [561.6],              // 18 top straight (Straight-mode zone)
      [84.8, 58.48],        // 19 T10 right
      [104.6],              // 20
      [59.5, 59.94],        // 21 T11 right
      [226],                // 22 SW diagonal (Sector 3, closure straight)
      [22.7, -118.6, 14],   // 23 T12 hairpin left
      [11.6],               // 24
      [32.6, 60.33, 14],    // 25 T13 right
      [156.5],              // 26 descent down the east side
      [140, -47.77],        // 27 T14 left
      [94],                 // 28
      [83.5, 49.35],        // 29 T15 right
      [112.6],              // 30 pit entry + overtake detection
      [105.9, 49.38],       // 31 T16 right
      [5.4],                // 32
      [60.7, 54.34],        // 33 T17 right onto the main straight
    ],
    close: [0, 22],
    start: [0, 355.3],
    zones: [0, 18],
    zoneOpts: { lead: 30, back: 15 },
    turns: [[1, 80.4], [3, 48.1], [5, 24.7], [7, 104.3], [9, 41.6], [11, 73.4], [13, 52.9], [15, 136.6], [17, 54.3], [19, 43.3], [21, 31.1], [23, 23.5], [25, 17.2], [27, 58.4], [29, 36], [31, 45.6], [33, 28.8]],   // T1..T17 as numbered on the drawing
    sectors: [[8, 87.5], [22, 125.2]],
    detect: [30, 25.1],
    pit: { side: 1, entry: [30, 25.1], exit: [0, 622.1], blendIn: 110, blendOut: 110, limiterIn: 310, boxSpacing: 18, boxCentre: 0.6 },   // pit wall curves between T16 and the pit road; limiter line after T17
    widths: [   // the drawing's hairpins are wider than the rest
      { from: [5, -15], to: [6, 15], w: 16 },     // T3
      { from: [17, -15], to: [18, 15], w: 16 },   // T9
      { from: [23, -15], to: [24, 15], w: 16 },   // T12
    ],
    // heights (m) along the lap: low pit straight, climb on the west side, crest at T9 (~46 m), descent on the east side
    elevation: [
      [[0, 0], 0.5], [[0, 355.3], 1.5], [[0, 650], 2.5], [[1, 80], 3.5], [[3, 48], 8], [[5, 20], 18], [[6, 170], 16.5],
      [[7, 100], 14], [[9, 40], 20], [[11, 70], 26], [[13, 55], 31], [[15, 136], 37], [[16, 120], 41.5], [[17, 50], 46],
      [[18, 280], 44.5], [[19, 45], 42], [[21, 30], 38.5], [[22, 110], 35.5], [[23, 20], 32], [[25, 18], 30], [[26, 80], 25],
      [[27, 60], 18], [[28, 45], 13], [[29, 36], 8], [[30, 60], 4.5], [[31, 45], 2], [[33, 30], 0.5],
    ],
    banking: [   // degrees, + = banked for a right-hander: a little camber in the two long left-handers T4 and T8
      [[6, 300], 0], [[7, 40], -3], [[7, 170], -3], [[8, 50], 0], [[14, 5], 0], [[15, 70], -2.5], [[15, 210], -2.5], [[16, 60], 0],
    ],
    runoff: { straight: 12, outside: 30, inside: 9, style: 'park' },
    theme: {
      sky: '#a8cdee', skyTop: '#4a86cf', fog: '#c6dae8', sun: '#fff2d4', grass: '#4b8d31', ground: '#3d6a2c',
      runoff: '#8c9299', gravel: '#dcc79a', asphalt: '#393c41', line: '#f4f4f4', kerbA: '#d4232a', kerbB: '#f4f4f4',
      barrier: '#c5c9cf', tyreWall: '#232427', water: '#4a7fa6', building: '#e7e0d2', timeOfDay: 'day', street: false,
      fogNear: 450, fogFar: 3000,
    },
    scenery: {
      grandstands: [
        { at: [0, 291.5], side: -1, len: 400, rows: 16 },    // Grand Stand 1, opposite the pits
        { at: [1, 75.4], side: -1, len: 70, rows: 8 },      // Stand 2, outside T1
        { at: [2, 2], side: -1, len: 90, rows: 8 },      // Stand 3, T1 exit
        { at: [6, 40.2], side: -1, len: 130, rows: 10 },    // Stand 4, T3 exit
        { at: [11, 117.6], side: -1, len: 70, rows: 8 },      // Stand 5, T6
        { at: [13, 11.1], side: -1, len: 80, rows: 8 },      // Stand 6, T7
        { at: [16, 227.2], side: -1, len: 140, rows: 10 },    // Stand 7, T9 braking zone
        { at: [18, 450.3], side: -1, len: 240, rows: 12 },    // Stand 8, top straight / T10
        { at: [22, 186], side: 1, len: 150, rows: 10 },     // Stand 9, T12 braking zone
        { at: [30, 12.1], side: -1, len: 100, rows: 10 },   // Stand 10, pit entry / T16
      ],
      trees: 0.95, treeKinds: ['broadleaf', 'pine'], buildings: 0.06, hills: 0.9,
      pitBuilding: { from: [0, 91], to: [0, 463.4] },
      bridges: [{ at: [18, 150] }, { at: [6, 200] }],
      billboards: [{ at: [0, 560], side: -1 }, { at: [18, 400], side: 1 }, { at: [22, 60], side: -1 }, { at: [16, 120], side: 1 }],
      marshalPosts: true, lights: false,
    },
  },
  // Circuit du Léman — traced from the user's drawing (2000x1333 px, ~0.8 m/px; +x east, +z = down the page): the
  // turtle was least-squares fitted to the digitized centreline. Clockwise lap, main straight runs west along the
  // bottom with the pits on its north side. Main layout = the S at T1/T2 and the chord at T16/T17 (where the corner
  // numbers are); the drawing's lower loop at T1-T3 and the outer loop at T16/T17 are extra link roads (not modelled).
  // Elevation from the drawing's notes: downhill along the bottom into T1, uphill on the west side, steep climb to the
  // T8 hairpin (highest), down the SE diagonal and the middle loop, up the NE diagonal, downhill on the east side.
  leman: {
    id: 'leman',
    name: 'Circuit du Léman',
    country: 'Switzerland (fictional)',
    lapRecordHint: '1:30',
    description: 'Lakeside parkland outside Geneva, crossing the Rhône four times: a tight S at T1, a climb up the west side and a steep ascent to the T8 hairpin, a lakeshore Straight-mode blast down to T9, a downhill middle loop and a sweeping climb to the north-east hairpin before the run back to the grandstands.',
    character: 'flowing',
    width: 13,
    heading0: 171.3,
    transition: 22,
    segs: [
      [771.9],              // 0 main straight (heading west, pits on the right; closure straight)
      [41.3, 89.94],        // 1 T1 right (the S)
      [5.5],                // 2
      [35.3, -77.82],       // 3 T2 left
      [67.5],               // 4
      [158.6, 79.46],       // 5 T3 long right, over the river
      [19.1],               // 6
      [218.3, 12.33],       // 7 kink right
      [20.3],               // 8
      [107.2, 74.78],       // 9 T4 right
      [39.5],               // 10
      [109.7, -61.9],       // 11 T5 left
      [65.1],               // 12
      [105.2, 59.67],       // 13 T6 right
      [16.4],               // 14
      [86.7, -96.14],       // 15 T7 left (steep climb begins)
      [108.4],              // 16 steep climb
      [17.9, 153.51, 20],   // 17 T8 hairpin right (highest point)
      [573.3],              // 18 SE diagonal along the lake, over the river (Straight-mode zone; closure straight)
      [41.8, 110.85],       // 19 T9 right
      [36.9],               // 20
      [108.1, 40.22],       // 21 T10 right
      [182.6],              // 22
      [44.2, -101.5],       // 23 T11 hairpin left
      [82.7],               // 24
      [82.8, -55.59],       // 25 T12 left
      [62.2],               // 26
      [108.4, -71.49],      // 27 T13 left (bottom of the middle loop)
      [106.5],              // 28 (Sector 3)
      [169.1, 24.86],       // 29 T14 right
      [141.3],              // 30
      [118.1, -34.02],      // 31 T15 left
      [412.9],              // 32 NE diagonal, over the river (Straight-mode zone)
      [54.6, 110.46],       // 33 T16 right (north-east hairpin)
      [71.2],               // 34
      [78.5, 56.61],        // 35 T17 right
      [110.4],              // 36
      [1],                  // 37 kink right
      [100.4],              // 38 east side, over the river (Straight-mode zone)
      [753, 10.06],         // 39 kink right
      [42.2],               // 40 overtake detection
      [29, 82.23],          // 41 T18 right (the V)
      [1.2],                // 42
      [110.6, -46.52],      // 43 T19 left onto the main straight (pit entry)
    ],
    close: [0, 18],
    start: [0, 394.6],
    zones: [0, 18, { s0: 3297, s1: 3707 }],   // user: T15–T16 zone starts halfway between T14 and T15; 4th zone removed
    zoneOpts: { lead: 10, back: 20 },
    turns: [[1, 32.4], [3, 24], [5, 110], [9, 70], [11, 59.3], [13, 54.8], [15, 72.7], [17, 24], [19, 40.4], [21, 37.9], [23, 39.2], [25, 40.2], [27, 67.6], [29, 36.7], [31, 35.1], [33, 52.6], [35, 38.8], [41, 20.8], [43, 44.9]],   // T1..T19 in lap order
    sectors: [[15, 112.7], [28, 52.7]],
    detect: [40, 9.9],
    pit: { side: 1, entry: [43, 11], exit: [0, 702.2], blendIn: 100, blendOut: 110, boxSpacing: 18, boxCentre: 0.45 },
    widths: [   // the drawing's hairpins are wider than the rest
      { from: [17, -15], to: [18, 15], w: 16 },   // T8
      { from: [19, -15], to: [20, 15], w: 15 },   // T9
      { from: [23, -15], to: [24, 15], w: 15 },   // T11
    ],
    // heights (m): low river valley at T3, west-side climb, steep ascent to T8 (~45 m), down to the middle loop, up the
    // NE diagonal, downhill on the east side and along the main straight into T1
    elevation: [
      [[0, 0], 12.4], [[0, 394.6], 12], [[0, 650], 7], [[1, 20], 6], [[3, 18], 5], [[5, 60], 4], [[5, 162], 2.5], [[7, 22], 5],
      [[9, 50], 9.5], [[11, 55], 18], [[13, 52], 25], [[15, 0], 29], [[15, 72], 33], [[16, 0], 38], [[16, 54], 43], [[17, 24], 48],
      [[18, 100], 42], [[18, 216], 38], [[18, 500], 31], [[19, 40], 29], [[21, 38], 27], [[23, 22], 25], [[25, 41], 20], [[27, 54], 13],
      [[29, 60], 15], [[30, 70], 19.5], [[31, 59], 23.5], [[32, 100], 25], [[32, 228], 25.5], [[32, 350], 26], [[33, 52], 26], [[35, 33], 23], [[38, 60], 17],
      [[39, 60], 14], [[41, 15], 13], [[43, 55], 12.6],
    ],
    banking: [   // degrees, + = banked for a right-hander: the long T3 sweep and the north-east hairpin T16
      [[5, 20], 0], [[5, 80], 2], [[5, 140], 2], [[6, 10], 0], [[32, 380], 0], [[33, 30], 3], [[33, 80], 3], [[34, 30], 0],
    ],
    runoff: { straight: 12, outside: 30, inside: 9, style: 'park' },
    theme: {
      sky: '#b4d3ec', skyTop: '#4f8bd0', fog: '#d3dde4', sun: '#ffe3b4', grass: '#4a8d31', ground: '#44722e',
      runoff: '#8f959c', gravel: '#dccb9d', asphalt: '#393c41', line: '#f4f4f4', kerbA: '#d4232a', kerbB: '#f4f4f4',
      barrier: '#c5c9cf', tyreWall: '#232427', water: '#2c6f8c', building: '#e8e1d4', timeOfDay: 'day', street: false,
      sunElevation: 0.42, fogNear: 500, fogFar: 3400,   // afternoon race: lower, warmer sun
    },
    scenery: {
      grandstands: [
        { at: [0, 274.6], side: -1, len: 330, rows: 16 },    // main grandstand, opposite the pits
        { at: [0, 690], side: -1, len: 220, rows: 10 },   // T1 braking zone
        { at: [5, 30.1], side: -1, len: 110, rows: 8 },     // outside T2/T3
        { at: [9, 57.2], side: -1, len: 100, rows: 8 },     // outside T4
        { at: [9, 128.5], side: -1, len: 110, rows: 8 },     // T4-T5
        { at: [11, 102.4], side: 1, len: 110, rows: 8 },      // T5-T6
        { at: [18, 38.2], side: -1, len: 150, rows: 10 },    // T8 exit, lakeside
        { at: [19, 69.3], side: -1, len: 150, rows: 10 },   // outside T9
        { at: [22, 176.7], side: 1, len: 110, rows: 8 },     // T11 braking zone
        { at: [32, 44.2], side: 1, len: 130, rows: 8 },     // NE diagonal
        { at: [33, 1], side: -1, len: 110, rows: 8 },    // T16 braking zone
        { at: [33, 63.3], side: -1, len: 70, rows: 8 },     // outside T16
        { at: [34, 33.1], side: -1, len: 100, rows: 8 },    // outside T16/T17
        { at: [35, 58.2], side: -1, len: 110, rows: 8 },    // T17 exit
        { at: [40, 39.2], side: -1, len: 200, rows: 10 },    // T18 approach
        { at: [43, 86.3], side: -1, len: 100, rows: 8 },     // T19
      ],
      trees: 0.7, treeKinds: ['broadleaf', 'pine'], buildings: 0.2, hills: 0.95,
      pitBuilding: { from: [0, 130.5], to: [0, 425.2] },
      // the lake (Léman) north-east of the SE diagonal (the current renderer supports one basin)
      water: { side: -1, from: [18, 230], to: [18, 520], dist: 25 },
      // hints for the world agent: more lake shore (NW of the NE diagonal) and the four river crossings (bridges)
      waters: [{ side: -1, from: [32, 150], to: [33, 10], dist: 40 }],
      rivers: [{ at: [5, 163.1], width: 30 }, { at: [18, 217.5], width: 45 }, { at: [32, 229], width: 35 }, { at: [38, 60.8], width: 30 }],
      grassSeating: [{ at: [13, 86.3], side: -1, dist: 60, len: 120 }, { at: [22, 102.4], side: -1, dist: 60, len: 140 }],
      billboards: [{ at: [0, 560], side: -1 }, { at: [18, 400], side: 1 }, { at: [32, 250], side: 1 }, { at: [38, 120], side: 1 }],
      marshalPosts: true, lights: false,
    },
  },
  // Autódromo Cerro Dorado — traced from the user's drawing (tools/tracks_ref/mexico_layout.jpg, 2000x1333 px, 0.94 m/px;
  // +x east, +z = down the page): the asphalt band's centre was digitized from the image pixels and the turtle
  // least-squares fitted to it (tools/out/mexico/: snap.mjs, fit.mjs, overlay.mjs). Anticlockwise lap, main straight
  // driven west -> east with the pits on its north side. Deviations: the T13-T15 esses and T17 have slightly larger radii
  // than drawn (fast esses), the drawing's separate finish line is left out (timing and the one chequered line are at
  // its Start line), the speed trap is a roadside marker. Elevation is a plausible profile for the dry plateau (flat pit
  // straight, climb up the east side).
  dorado: {
    id: 'dorado',
    name: 'Autódromo Cerro Dorado',
    country: 'Mexico (fictional)',
    lapRecordHint: '1:32',
    description: 'High on the dry central plateau among golden grass, mesquite and nopal scrub: a long pit straight into a tight hairpin, a climb up the east side to the T4 hairpin under the big Stand 8, a fast downhill loop, a long run to the triple chicane, the T12 hairpin, fast esses past the grass banks and a quick flick back onto the straight.',
    character: 'flowing',
    width: 13.5,
    heading0: 7.44,
    transition: 20,
    segs: [
      [715.7],              // 0 main straight (heading east, pits on the left; closure straight)
      [21.6, -141.09, 26],  // 1 T1 hairpin left
      [138.0],              // 2
      [85.7, 129.48],       // 3 T2 long right
      [79.4],               // 4
      [144.4, -39.96],      // 5 T3 left
      [22.1],               // 6
      [176.1, -26.91],      // 7 kink left (end of Stand 5)
      [305.1],              // 8 east straight, climbing (closure straight)
      [60.0, -8.78],        // 9 kink left
      [258.5],              // 10 run up to T4 (Sector 2)
      [16.9, -104.77, 22],  // 11 T4 hairpin left (top right)
      [100.2],              // 12 under Stand 8
      [99.6, -43.80],       // 13 T5 left (crest)
      [154.7],              // 14 descent
      [223.2, -83.98],      // 15 T6 long downhill left
      [62.2],               // 16
      [15.2, 103.60, 24],   // 17 T7 right
      [340.3],              // 18 diagonal down to T8
      [128.1, 26.36],       // 19 T8 fast right kink
      [445.5],              // 20 back straight (Sector 3)
      [17.0, 114.68, 16],   // 21 T9 right: triple chicane
      [7.6],                // 22
      [24.0, -81.55, 14],   // 23 T10 left
      [8.7],                // 24
      [49.1, 66.20, 14],    // 25 T11 right
      [127.5],              // 26 climb to T12
      [19.2, -137.44, 22],  // 27 T12 hairpin left
      [118.9],              // 28 descent to the esses
      [131.0, 44.96],       // 29 T13 right: fast esses
      [26.8],               // 30
      [105.0, -68.43],      // 31 T14 left
      [21.1],               // 32
      [105.8, 49.08],       // 33 T15 right
      [103.5],              // 34
      [45.1, -170.48, 22],  // 35 T16 hairpin left (far west)
      [287.1],              // 36 lower straight
      [130.8, 43.67],       // 37 T17 fast right
      [19.3],               // 38
      [281.6, -30.88],      // 39 T18 fast left onto the main straight (pit entry)
    ],
    close: [0, 8],
    start: [0, 426.4],
    // user: main SM longer towards T1; SM2 from the kink after T3 (end of Stand 5) to mid Stand 6; SM3 a bit later
    // after T7, past the T8 kink to the east end of Stand 10 (s in m from the line)
    zones: [{ s0: 4803, s1: 100 }, { s0: 890, s1: 1307 }, { s0: 2439, s1: 2976 }],
    turns: [[1, 34], [3, 64], [5, 49], [11, 25], [13, 35], [15, 159], [17, 8], [19, 46], [21, 13], [23, 14], [25, 19], [27, 21], [29, 71], [31, 58], [33, 69], [35, 80], [37, 51], [39, 37]],   // T1..T18 as numbered on the drawing
    sectors: [[10, 153], [20, 379.9]],
    detect: [39, 109.9],   // just after T18 (the drawing's OT detection zone)
    pit: { side: -1, entry: [39, 99.4], exit: [0, 658.3], blendIn: 100, blendOut: 110, boxSpacing: 17 },
    widths: [   // the drawing's hairpins are wider than the rest; a little extra room through the esses
      { from: [1, -15], to: [2, 60], w: 16 },     // T1 (and its exit)
      { from: [11, -15], to: [12, 15], w: 15 },   // T4
      { from: [17, -12], to: [18, 12], w: 15 },   // T7
      { from: [20, 420], to: [26, 25], w: 15.5 }, // T9-T11 triple chicane
      { from: [27, -15], to: [28, 15], w: 16 },   // T12
      { from: [29, 0], to: [34, 0], w: 14.5 },    // T13-T15 esses
      { from: [35, -15], to: [36, 15], w: 15 },   // T16
    ],
    // heights (m): flat pit straight, dip to T1, a long climb up the east side to the T5 crest (~60 m above T1), a fast
    // downhill loop through T6 / T7 and down to the chicane, a short climb to the T12 hairpin, a dip through the esses
    elevation: [
      [[39, 11], 6.5], [[0, 161], 5.5], [[0, 361], 5], [[0, 504], 4.5], [[0, 644], 2.5], [[1, 24], 1], [[2, 139], 3], [[3, 194], 8], [[6, 2], 14],
      [[7, 76], 18], [[8, 299], 36], [[10, 232], 52], [[12, 5], 55.5], [[13, 7], 59.5], [[13, 67], 61], [[14, 58], 60], [[14, 154], 55], [[15, 164], 44.5],
      [[15, 326], 34], [[17, 15], 30], [[18, 147], 25], [[19, 3], 19.5], [[20, 200], 14], [[21, 0], 10], [[24, 10], 10], [[26, 4], 11], [[26, 94], 16.5],
      [[27, 21], 19], [[28, 59], 18], [[29, 15], 15], [[30, 16], 12], [[31, 67], 10.5], [[32, 15], 12], [[33, 55], 14], [[34, 51], 13], [[35, 68], 11],
      [[36, 113], 9], [[37, 0], 7.5],
    ],
    runoff: { straight: 12, outside: 30, inside: 9, style: 'park' },
    runoffZones: [   // the drawing's gravel traps at the slow corners (the automatic rule paves those), paved run-off at T2
      { from: [1, -40], to: [2, 50], side: 1, surf: 'gravel' },      // T1
      { from: [3, -10], to: [4, 30], side: -1, surf: 'paved' },      // T2
      { from: [10, 200], to: [14, 30], side: 1, surf: 'gravel' },    // T4 / T5
      { from: [16, 0], to: [18, 60], side: -1, surf: 'gravel' },     // T7
      { from: [26, 110], to: [28, 30], side: 1, surf: 'gravel' },    // T12
      { from: [34, 0], to: [34, 95], side: 1, surf: 'gravel' },      // inside T15
      { from: [34, 50], to: [36, 40], side: 1, surf: 'gravel' },     // T16
    ],
    theme: {
      sky: '#a3c9e8', skyTop: '#3f7fc8', fog: '#d8ccb0', sun: '#fff0cf', grass: '#a3a05a', ground: '#8e8a56',
      runoff: '#8f9296', gravel: '#dcc190', asphalt: '#3a3c40', line: '#f4f4f4', kerbA: '#d4232a', kerbB: '#f4f4f4',
      barrier: '#cfd1d4', tyreWall: '#232427', water: '#4a7fa6', building: '#e8cfaa', concrete: '#d9cfbf',
      hill: '#b39462', hillDark: '#7a6445', timeOfDay: 'day', street: false, sunElevation: 0.62, fogNear: 650, fogFar: 3800,
    },
    scenery: {
      grandstands: [
        { at: [0, 285.4], side: 1, len: 300, rows: 16 },   // Stand 1, main straight opposite the pits
        { at: [0, 283.3], side: -1, len: 360, rows: 14 },  // Stand 2, behind the pit building
        { at: [1, 15], side: 1, len: 50, rows: 8 },        // Stand 3, outside T1
        { at: [2, 30], side: 1, len: 90, rows: 10 },       // Stand 4, T1 exit
        { at: [6, 4.4], side: 1, len: 90, rows: 8 },       // Stand 5, outside T3
        { at: [10, 41], side: 1, len: 70, rows: 8 },       // Stand 6, east straight
        { at: [10, 205], side: 1, len: 85, rows: 8 },      // Stand 7, T4 braking zone
        { at: [12, 61], side: 1, len: 190, rows: 16 },     // Stand 8, big stand above T4 / T5
        { at: [13, 75], side: 1, len: 110, rows: 10 },     // Stand 9, outside T5
        { at: [20, 322.3], side: 1, len: 115, rows: 10 },  // Stand 10, back straight
        { at: [37, 50], side: -1, len: 85, rows: 8 },      // Stand 11, infield at T17
        { at: [26, 113.1], side: 1, len: 70, rows: 8 },    // Stand 12, climb to T12
        { at: [27, 26.3], side: 1, len: 45, rows: 8 },     // Stand 13, outside T12
        { at: [35, 82.2], side: 1, len: 55, rows: 8 },     // Stand 14, outside T16
        { at: [36, 10], side: 1, len: 150, rows: 10 },     // Stand 15, T16 exit
      ],
      // grass banks with spectators (render3d): {at, side, dist (m beyond the barrier), len}
      grassSeating: [{ at: [2, 127], side: 1, dist: 30, len: 140 }, { at: [29, 66], side: 1, dist: 35, len: 170 }, { at: [34, 56], side: 1, dist: 30, len: 150 }],
      trees: 0.85, treeKinds: ['mesquite', 'mesquite', 'mesquite', 'bush', 'agave', 'cactus', 'broadleaf'], buildings: 0.28,
      buildingStyles: ['adobe', 'adobe', 'adobe', 'concrete'], buildingFloors: 1,   // low adobe ranch houses
      hills: 0.95, mesas: true,
      pitBuilding: { from: [0, 78.8], to: [0, 495.6] },
      speedTrap: { at: [0, 592] },
      bridges: [{ at: [8, 120] }, { at: [20, 150] }],
      billboards: [{ at: [0, 560], side: 1 }, { at: [8, 250], side: -1 }, { at: [20, 60], side: -1 }, { at: [36, 200], side: -1 }],
      marshalPosts: true, lights: false,
    },
  },
};

;
// ===== track.js
// Apex GP — Track builder (CONTRACT.md §5). Pure JS: runs in Node (no THREE / window / document).
//
// buildTrack(TRACK_DATA[id]) -> Track. Results are memoised per data object (buildTrack(data, {fresh:true}) rebuilds).
//
// Geometry: the centreline is generated from "turtle" segments (straights + constant-radius arcs) joined by
// linear-curvature transitions (clothoids), integrated at 0.25 m, closed exactly (heading: arc angles scaled to
// ±360°, position: two designated straights lengthened/shortened), then resampled uniformly: step ≈ 2 m,
// N is a multiple of 64. World is centred on the origin.
//
// Everything in CONTRACT §5 is provided. Additions (all optional for callers):
//   track.outline(stepMeters = 10, s0 = 0, s1 = length) -> [[x, z], ...] centreline points (minimap / menu preview);
//        with s0/s1 only that stretch (wraps if s1 < s0), e.g. outline(5, zone.s0, zone.s1) to draw a zone.
//   track.pitOutline(stepMeters = 10) -> [[x, z], ...] pit-lane centre from entryS to exitS.
//   track.idxAt(s) -> nearest sample index.
//   track.corners -> [{num, s, s0, s1, dir: 1 right | -1 left, angle (deg), minR (m), vMin (m/s)}], numbered from the line
//        (detected from the racing line, or one per apex listed in data.turns for explicit numbering).
//   track.lapTimeEst -> estimated lap (s) from raceSpeed; track.warnings -> [strings] (builder sanity notes).
//   track.pit.laneCenterD (d of the lane centre along the wall section), pit.garageD (d of garage fronts),
//   pit.wallThick (pit wall thickness, m), pit.blendIn / pit.blendOut (m).
//   sample/toWorld/project/corridor accept an optional last `out` object to avoid allocations in hot paths.
//   wallL/wallR are barrier lines (car centre must stay inside by its own half width — physics' job).
const buildTrack = (() => {
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const cache = new Map();
  const KERB_W = (typeof CFG !== 'undefined' && CFG.kerbWidth) || 1.4;
  const S_ = (typeof SURF !== 'undefined') ? SURF : { TRACK: 0, KERB: 1, RUNOFF: 2, GRASS: 3, GRAVEL: 4, PIT: 5, WALL: 6 };

  // ---------- array filters (circular) ----------
  function blur(src, r, passes = 1) {
    const N = src.length;
    let a = Float64Array.from(src), b = new Float64Array(N);
    if (r < 1) return a;
    const w = 2 * r + 1;
    for (let p = 0; p < passes; p++) {
      let acc = 0;
      for (let j = -r; j <= r; j++) acc += a[((j % N) + N) % N];
      for (let i = 0; i < N; i++) {
        b[i] = acc / w;
        acc += a[(i + r + 1) % N] - a[((i - r) % N + N) % N];
      }
      const t = a; a = b; b = t;
    }
    return a;
  }
  // circular min (isMax=false) / max filter over window [i-r0, i+r1]
  function winFilter(src, r0, r1, isMax) {
    const N = src.length, out = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let m = isMax ? -Infinity : Infinity;
      for (let j = i - r0; j <= i + r1; j++) {
        const v = src[((j % N) + N) % N];
        if (isMax ? v > m : v < m) m = v;
      }
      out[i] = m;
    }
    return out;
  }

  // ---------- elevation / banking profiles ----------
  // pts = [[at, value], ...] -> periodic monotone cubic (Fritsch-Butland tangents: no overshoot between knots),
  // sampled per centreline sample, then box-blurred (2 passes over ~smooth m) so the grade has no kinks.
  function periodicProfile(pts, N, step, L, sOf, smooth) {
    const k = pts.map(p => [sOf(p[0]), +p[1] || 0]).sort((a, b) => a[0] - b[0])
      .filter((p, i, a) => i === 0 || p[0] - a[i - 1][0] > 1e-6);
    const n = k.length, out = new Float64Array(N);
    if (!n) return out;
    if (n === 1) return out.fill(k[0][1]);
    const d = k.map((p, i) => (i < n - 1 ? k[i + 1][0] : k[0][0] + L) - p[0]);
    const m = k.map((p, i) => (k[(i + 1) % n][1] - p[1]) / d[i]);
    const tg = k.map((p, i) => {
      const ip = (i - 1 + n) % n, m0 = m[ip], m1 = m[i];
      if (m0 * m1 <= 0) return 0;
      const w1 = 2 * d[i] + d[ip], w2 = d[i] + 2 * d[ip];
      return (w1 + w2) / (w1 / m0 + w2 / m1);
    });
    let q = n - 1;   // interval containing s (s wraps below the first knot into the last interval)
    for (let i = 0; i < N; i++) {
      const s = i * step;
      while (q > 0 && s < k[q][0]) q--;
      while (q < n - 1 && s >= k[q + 1][0]) q++;
      if (s < k[0][0]) q = n - 1;
      let u = s - k[q][0]; if (u < 0) u += L;
      const h = d[q], t = u / h, t2 = t * t, t3 = t2 * t;
      out[i] = (2 * t3 - 3 * t2 + 1) * k[q][1] + (t3 - 2 * t2 + t) * h * tg[q] + (-2 * t3 + 3 * t2) * k[(q + 1) % n][1] + (t3 - t2) * h * tg[(q + 1) % n];
    }
    const r = Math.max(1, Math.round((smooth || 60) / 2 / step));
    return blur(out, r, 2);
  }

  // ---------- centreline from turtle segments ----------
  // data.segs: [len] straight | [radius, angleDeg] arc (+ = right) | optional 3rd item = entry transition length (m)
  function genCentre(data, warn) {
    const segs = data.segs.map(g => (g.length < 2 || !g[1])
      ? { len: g[0], k: 0, t: g[2] }
      : { len: Math.abs(g[0] * g[1] * DEG), k: Math.sign(g[1]) / g[0], t: g[2] });
    const nS = segs.length;
    let turn = 0;
    for (const g of segs) turn += g.k * g.len;
    const f = (Math.sign(turn) * TAU) / turn;
    for (const g of segs) if (g.k) g.len *= f;
    if (Math.abs(f - 1) > 0.01) warn.push(`heading closure scaled arc angles by ${f.toFixed(4)}`);
    const T = data.transition || 30;
    const h0 = (data.heading0 || 0) * DEG;
    let x, z, h, k, M, dss, starts, Ltot;
    const integrate = () => {
      const tb = segs.map((g, j) => {
        const p = segs[(j - 1 + nS) % nS];
        return p.k === g.k ? 0 : Math.min(g.t != null ? g.t : T, p.len, g.len);
      });
      Ltot = 0; starts = [];
      for (const g of segs) { starts.push(Ltot); Ltot += g.len; }
      M = Math.ceil(Ltot / 0.25); dss = Ltot / M;
      k = new Float64Array(M + 1);
      let j = 0;
      for (let m = 0; m <= M; m++) {
        const s = Math.min(m * dss, Ltot - 1e-9);
        while (j < nS - 1 && s >= starts[j + 1]) j++;
        const g = segs[j], u = s - starts[j];
        const tIn = tb[j], tOut = tb[(j + 1) % nS];
        const kp = segs[(j - 1 + nS) % nS].k, kn = segs[(j + 1) % nS].k;
        let kv = g.k;
        if (tIn > 0 && u < tIn / 2) kv = kp + (g.k - kp) * (u + tIn / 2) / tIn;
        else if (tOut > 0 && u > g.len - tOut / 2) kv = g.k + (kn - g.k) * (u - (g.len - tOut / 2)) / tOut;
        k[m] = kv;
      }
      h = new Float64Array(M + 1); x = new Float64Array(M + 1); z = new Float64Array(M + 1);
      h[0] = h0;
      for (let m = 0; m < M; m++) {
        h[m + 1] = h[m] + 0.5 * (k[m] + k[m + 1]) * dss;
        const hm = 0.5 * (h[m] + h[m + 1]);
        x[m + 1] = x[m] + Math.cos(hm) * dss;
        z[m + 1] = z[m] + Math.sin(hm) * dss;
      }
    };
    // position closure: least-norm change of the listed straights' lengths (weighted by nominal length)
    const cl = data.close || [];
    const w0 = cl.map(i => segs[i].len);
    for (let it = 0; it < 8; it++) {
      integrate();
      const ex = x[M] - x[0], ez = z[M] - z[0];
      if (Math.hypot(ex, ez) < 1e-5 || cl.length < 2) break;
      const dir = cl.map(i => { const hh = h[Math.round((starts[i] + segs[i].len / 2) / dss)]; return [Math.cos(hh), Math.sin(hh)]; });
      let a = 0, b = 0, c = 0;
      cl.forEach((i, q) => { const w2 = w0[q] * w0[q], [dx, dz] = dir[q]; a += w2 * dx * dx; b += w2 * dx * dz; c += w2 * dz * dz; });
      const det = a * c - b * b;
      if (Math.abs(det) < 1e-9) { warn.push('closure straights are parallel'); break; }
      const lx = (-ex * c + ez * b) / det, lz = (-ez * a + ex * b) / det;   // (D W² Dᵀ)⁻¹ (-e)
      cl.forEach((i, q) => { segs[i].len += w0[q] * w0[q] * (dir[q][0] * lx + dir[q][1] * lz); });
      for (const i of cl) if (segs[i].len < 12) { if (it === 7) warn.push(`closure made straight #${i} short`); segs[i].len = 12; }
    }
    const err = Math.hypot(x[M] - x[0], z[M] - z[0]);
    if (err > 0.05) warn.push(`centreline closure error ${err.toFixed(2)} m`);
    return { x, z, h, k, M, dss, starts, Ltot, segLens: segs.map(g => g.len) };
  }

  // ---------- racing line (K1999-style curvature smoothing, coarse to fine) ----------
  function rinv(ax, az, bx, bz, cx, cz) {
    const x1 = cx - bx, z1 = cz - bz, x2 = ax - bx, z2 = az - bz, x3 = cx - ax, z3 = cz - az;
    const nnn = Math.sqrt((x1 * x1 + z1 * z1) * (x2 * x2 + z2 * z2) * (x3 * x3 + z3 * z3));
    return nnn > 1e-12 ? 2 * (x1 * z2 - x2 * z1) / nnn : 0; // + = right turn
  }
  function racingLine(N, px, pz, nx, nz, lo, hi, iters) {
    const d = new Float64Array(N), qx = Float64Array.from(px), qz = Float64Array.from(pz);
    const adjust = (ip, i, inx, kT, sec) => {
      const ax = qx[ip], az = qz[ip], cx = qx[inx], cz = qz[inx];
      const Cx = cx - ax, Cz = cz - az;
      const den = Cx * nz[i] - Cz * nx[i];
      let di = d[i];
      if (Math.abs(den) > 1e-9) di = -(Cx * (pz[i] - az) - Cz * (px[i] - ax)) / den;
      const l0 = lo[i], h0 = hi[i];
      di = clamp(di, l0 - 4, h0 + 4);
      const e = 0.05;
      const k0 = rinv(ax, az, px[i] + di * nx[i], pz[i] + di * nz[i], cx, cz);
      const k1 = rinv(ax, az, px[i] + (di + e) * nx[i], pz[i] + (di + e) * nz[i], cx, cz);
      const dk = (k1 - k0) / e;
      if (Math.abs(dk) > 1e-12) di += (kT - k0) / dk;
      let l = l0, hh = h0;
      if (sec > 0) {
        const mid = 0.5 * (l0 + h0);
        if (kT > 0) hh = Math.max(mid, h0 - sec); else if (kT < 0) l = Math.min(mid, l0 + sec);
      }
      di = clamp(di, l, hh);
      d[i] = di; qx[i] = px[i] + di * nx[i]; qz[i] = pz[i] + di * nz[i];
    };
    // lattice from 64 samples down to 2 samples (~4 m); odd samples are filled by the last interpolation
    for (let st = 64; st >= 2; st >>= 1) {
      const M = N / st;
      const its = Math.round(iters * Math.sqrt(st / 2));
      for (let it = 0; it < its; it++) {
        for (let m = 0; m < M; m++) {
          const i = m * st, ip = ((m + M - 1) % M) * st, ipp = ((m + M - 2) % M) * st;
          const inx = ((m + 1) % M) * st, inn = ((m + 2) % M) * st;
          const r0 = rinv(qx[ipp], qz[ipp], qx[ip], qz[ip], qx[i], qz[i]);
          const r1 = rinv(qx[i], qz[i], qx[inx], qz[inx], qx[inn], qz[inn]);
          const lp = Math.hypot(qx[i] - qx[ip], qz[i] - qz[ip]), ln = Math.hypot(qx[i] - qx[inx], qz[i] - qz[inx]);
          adjust(ip, i, inx, (ln * r0 + lp * r1) / (ln + lp), lp * ln / 800);
        }
      }
      {
        for (let m = 0; m < M; m++) {
          const i0 = m * st, i1 = ((m + 1) % M) * st, ip = ((m + M - 1) % M) * st, inx = ((m + 2) % M) * st;
          const ir0 = rinv(qx[ip], qz[ip], qx[i0], qz[i0], qx[i1], qz[i1]);
          const ir1 = rinv(qx[i0], qz[i0], qx[i1], qz[i1], qx[inx], qz[inx]);
          for (let q = 1; q < st; q++) {
            const u = q / st;
            adjust(i0, i0 + q, i1, u * ir1 + (1 - u) * ir0, 0);
          }
        }
      }
    }
    return d;
  }

  // ---------- speed profile ----------
  const PERF = () => (typeof CFG !== 'undefined' && CFG.perf && CFG.perf.latAccel) ? CFG.perf : null;
  function latA(v) {
    const P = PERF();
    if (P) return P.latAccel(v) * 0.93;
    const c = CFG.car, mu = c.tyreMu * 0.92;
    return mu * (CFG.g + 0.5 * CFG.rho * c.clA * v * v / c.mass);
  }
  function driveA(v, cdMul) {
    const P = PERF();
    if (P) return P.driveAccel(v, 1, CFG.car.enginePower, cdMul);
    const c = CFG.car, mu = c.tyreMu * 0.92;
    const a = Math.min(c.enginePower / (c.mass * Math.max(v, 1)), c.maxDriveForce / c.mass, mu * CFG.g);
    return a - 0.5 * CFG.rho * c.cdA * cdMul * v * v / c.mass - c.rollingResist * CFG.g;
  }
  function brakeA(v) {
    const P = PERF();
    if (P) return P.brakeDecel(v) * 0.86;
    const c = CFG.car, mu = c.tyreMu * 0.92;
    const q = 0.5 * CFG.rho * v * v;
    return (Math.min(mu * (CFG.g + q * c.clA / c.mass), c.brakeForce / c.mass) + q * c.cdA / c.mass) * 0.85;
  }
  const VMAX = 95;
  const BRK_LAT = 0.8;   // lateral share of grip above which no tyre braking is planned
  function cornerSpeed(k) {
    k = Math.abs(k);
    if (k < 1e-6 || VMAX * VMAX * k <= latA(VMAX)) return VMAX;
    let lo = 1, hi = VMAX;
    for (let it = 0; it < 40; it++) { const m = 0.5 * (lo + hi); if (m * m * k <= latA(m)) lo = m; else hi = m; }
    return lo;
  }
  function speedProfile(N, qx, qz, kl, zoneMask, grade) {
    const ds = new Float64Array(N), vc = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      ds[i] = Math.hypot(qx[j] - qx[i], qz[j] - qz[i]);
      vc[i] = cornerSpeed(kl[i]);
    }
    const cdS = (typeof CFG !== 'undefined' && CFG.aero && CFG.aero.straightCdA) || 1;
    let i0 = 0;
    for (let i = 1; i < N; i++) if (vc[i] < vc[i0]) i0 = i;
    const v = Float64Array.from(vc);
    // combined slip: tyre force left for accelerating / braking while cornering (friction ellipse)
    const c = CFG.car, rr = c.rollingResist * CFG.g;
    const dragA = (vv, mul) => 0.5 * CFG.rho * c.cdA * mul * vv * vv / c.mass + rr;
    const rat = (vv, i) => vv * vv * Math.abs(kl[i]) / Math.max(1e-6, latA(vv));
    const fc = (vv, i) => { const r = rat(vv, i); return r >= 1 ? 0 : Math.sqrt(1 - r * r); };            // accelerating
    const fcB = (vv, i) => { const r = rat(vv, i) / BRK_LAT; return r >= 1 ? 0 : (1 - r) * (1 + r) * (1 - 0.5 * r); };           // braking (rear unloads)
    for (let n = 0; n < N; n++) {
      const i = (i0 + n) % N, j = (i + 1) % N;
      const mul = zoneMask && zoneMask[i] ? cdS : 1;
      let a = (driveA(v[i], mul) + dragA(v[i], mul)) * fc(v[i], i) - dragA(v[i], mul);
      if (grade) a -= CFG.g * 0.5 * (grade[i] + grade[j]);
      const vn = Math.sqrt(Math.max(0, v[i] * v[i] + 2 * a * ds[i]));
      if (vn < v[j]) v[j] = vn;
    }
    for (let n = 0; n < N; n++) {
      const j = (i0 - n + N) % N, i = (j - 1 + N) % N;
      const dA = dragA(v[j], 1);
      let a = Math.max(0, brakeA(v[j]) - dA) * fcB(v[j], j) + dA;
      if (grade) a = Math.max(0.2, a + CFG.g * 0.5 * (grade[i] + grade[j]));
      const vp = Math.sqrt(v[j] * v[j] + 2 * a * ds[i]);
      if (vp < v[i]) v[i] = vp;
    }
    let t = 0;
    for (let i = 0; i < N; i++) t += ds[i] / Math.max(1, 0.5 * (v[i] + v[(i + 1) % N]));
    return { v, vc, ds, lap: t };
  }

  // ---------- main builder ----------
  function build(data) {
    const warn = [];
    const C = genCentre(data, warn);
    const L = C.Ltot;
    const N = Math.max(64, Math.round(L / 128) * 64);
    const step = L / N;
    const S0 = C.starts[data.start ? data.start[0] : 0] + (data.start ? data.start[1] : 0);
    const wrap = s => { s %= L; return s < 0 ? s + L : s; };
    const atS = a => (typeof a === 'number' ? wrap(a) : wrap(C.starts[a[0]] + a[1] - S0));

    const px = new Float32Array(N), pz = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N);
    const nx = new Float32Array(N), nz = new Float32Array(N), curv = new Float32Array(N), halfW = new Float32Array(N);
    const kRaw = new Float64Array(N);
    let cx0 = Infinity, cx1 = -Infinity, cz0 = Infinity, cz1 = -Infinity;
    const X = new Float64Array(N), Z = new Float64Array(N), H = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const f = wrap(S0 + i * step) / C.dss;
      const m = Math.min(Math.floor(f), C.M - 1), u = f - m;
      X[i] = lerp(C.x[m], C.x[m + 1], u); Z[i] = lerp(C.z[m], C.z[m + 1], u);
      H[i] = lerp(C.h[m], C.h[m + 1], u); kRaw[i] = lerp(C.k[m], C.k[m + 1], u);
      cx0 = Math.min(cx0, X[i]); cx1 = Math.max(cx1, X[i]); cz0 = Math.min(cz0, Z[i]); cz1 = Math.max(cz1, Z[i]);
    }
    const ox = Math.round((cx0 + cx1) / 2), oz = Math.round((cz0 + cz1) / 2);
    const kS = blur(kRaw, 2);
    const hw = (data.width || 12) / 2;
    for (let i = 0; i < N; i++) {
      px[i] = X[i] - ox; pz[i] = Z[i] - oz;
      tx[i] = Math.cos(H[i]); tz[i] = Math.sin(H[i]);
      nx[i] = -tz[i]; nz[i] = tx[i];
      curv[i] = kS[i];
      halfW[i] = hw;
    }
    // optional local width changes: data.widths = [{from:[seg,off], to:[seg,off], w}]
    if (data.widths) for (const wz of data.widths) {
      const a = atS(wz.from), b = atS(wz.to), len = wrap(b - a), ramp = Math.min(40, len / 3);
      for (let i = 0; i < N; i++) {
        const u = wrap(i * step - a);
        if (u > len) continue;
        const t = Math.min(sstep(u / ramp), sstep((len - u) / ramp));
        halfW[i] = lerp(halfW[i], wz.w / 2, t);
      }
    }

    // ---- elevation (m), grade (dElev/ds) and banking (rad, + = banked for a right-hander) ----
    // data.elevation / data.banking = [[at, metres | degrees], ...]; at = at-spec, s (m) or lap fraction (< 1).
    const elev = new Float32Array(N), grade = new Float32Array(N), bank = new Float32Array(N);
    let hasGrade = false;
    {
      const sOf = a => (typeof a === 'number' ? (a < 1 ? wrap(a * L) : wrap(a)) : atS(a));
      if (Array.isArray(data.elevation) && data.elevation.length) {
        const e = periodicProfile(data.elevation, N, step, L, sOf, data.elevSmooth || 80);
        let lo = Infinity; for (let i = 0; i < N; i++) lo = Math.min(lo, e[i]);
        const base = data.elevBase != null ? data.elevBase : 0;   // heights are relative: lowest point -> elevBase
        for (let i = 0; i < N; i++) elev[i] = e[i] - lo + base;
        let gMax = 0;
        for (let i = 0; i < N; i++) {
          grade[i] = (e[(i + 1) % N] - e[(i - 1 + N) % N]) / (2 * step);
          gMax = Math.max(gMax, Math.abs(grade[i]));
        }
        hasGrade = gMax > 1e-6;
        if (gMax > (data.maxGrade || 0.10) + 1e-3) warn.push(`max grade ${(gMax * 100).toFixed(1)}% > ${((data.maxGrade || 0.10) * 100).toFixed(0)}%`);
      }
      if (Array.isArray(data.banking) && data.banking.length) {
        const b = periodicProfile(data.banking, N, step, L, sOf, data.bankSmooth || 40);
        for (let i = 0; i < N; i++) bank[i] = b[i] * DEG;
      }
    }

    // ---- kerbs: both sides where |curv| is meaningful, extended before/after ----
    const kerbK = data.kerbCurv || 1 / 380;
    const absK = new Float64Array(N);
    for (let i = 0; i < N; i++) absK[i] = Math.abs(curv[i]) > kerbK ? 1 : 0;
    const kerbM = winFilter(absK, Math.round(14 / step), Math.round(8 / step), true); // extend ~8 m before, ~14 m after
    const kerbL = new Uint8Array(N), kerbR = new Uint8Array(N);
    for (let i = 0; i < N; i++) kerbL[i] = kerbR[i] = kerbM[i] > 0.5 ? 1 : 0;

    // ---- racing line ----
    const kerbUse = data.kerbUse != null ? data.kerbUse : 0.4, margin = 1.6;
    const lo = new Float64Array(N), hi = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      lo[i] = -(halfW[i] - margin) - (kerbL[i] ? kerbUse : 0);
      hi[i] = (halfW[i] - margin) + (kerbR[i] ? kerbUse : 0);
    }
    let dl = racingLine(N, px, pz, nx, nz, lo, hi, data.lineIters || 45);
    dl = blur(dl, 2, 2);
    for (let i = 0; i < N; i++) dl[i] = clamp(dl[i], lo[i], hi[i]);
    const raceLine = Float32Array.from(dl);
    const qx = new Float64Array(N), qz = new Float64Array(N);
    for (let i = 0; i < N; i++) { qx[i] = px[i] + dl[i] * nx[i]; qz[i] = pz[i] + dl[i] * nz[i]; }
    let kl = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i - 2 + N) % N, b = (i + 2) % N;
      kl[i] = rinv(qx[a], qz[a], qx[i], qz[i], qx[b], qz[b]);
    }
    kl = blur(kl, 2);
    const gradeP = hasGrade ? grade : null;
    let sp = speedProfile(N, qx, qz, kl, null, gradeP);

    // ---- straight-mode zones (on the listed straights: after the corner exit .. 100 m before braking) ----
    const straightZones = [];
    for (const zs of (data.zones || [])) {
      // explicit zone in metres: { s0, s1 } (used when the drawing puts a zone somewhere the auto rule wouldn't)
      if (zs && typeof zs === 'object' && !Array.isArray(zs) && zs.s0 != null) { straightZones.push({ s0: wrap(zs.s0), s1: wrap(zs.s1) }); continue; }
      const segI = Array.isArray(zs) ? zs[0] : zs;
      let s0 = wrap(C.starts[segI] - S0);
      let i = Math.round(s0 / step) % N;
      // move to the corner exit: curvature small AND accelerating
      const zo = data.zoneOpts || {};   // optional per-track tuning: { lead (m after exit), back (m before braking), bendK (1/m) }
      for (let n = 0; n < N / 4 && (Math.abs(curv[i]) > 1 / 1200 || Math.abs(kl[i]) > 1 / 900); n++) i = (i + 1) % N;
      i = (i + N + Math.round((zo.lead != null ? zo.lead : 15) / step)) % N;   // lead may be negative (open before the exit)
      s0 = i * step;
      // end: 100 m before the braking point, or 50 m before the next real bend if that comes first
      let j = i, n = 0, back = zo.back != null ? zo.back : 100;
      for (; n < N; n++) {
        const jn = (j + 1) % N;
        if (sp.v[jn] < sp.v[j] - 0.02 && sp.v[(j + 3) % N] < sp.v[j] - 0.2) break;
        if (Math.abs(curv[jn]) > (zo.bendK || 1 / 350)) { back = Math.min(back, 50); break; }
        j = jn;
      }
      const s1 = wrap(j * step - back);
      const zl = wrap(s1 - s0);
      if (zl < 120 || zl > L / 2) { warn.push(`zone on seg ${segI} too short/invalid (${zl.toFixed(0)} m)`); if (zl < 60 || zl > L / 2) continue; }
      straightZones.push({ s0, s1 });
    }
    const inZone = s => {
      for (let z = 0; z < straightZones.length; z++) {
        const Z0 = straightZones[z];
        if (Z0.s0 <= Z0.s1 ? (s >= Z0.s0 && s < Z0.s1) : (s >= Z0.s0 || s < Z0.s1)) return z;
      }
      return -1;
    };
    if (straightZones.length) {
      const zm = new Uint8Array(N);
      for (let i = 0; i < N; i++) zm[i] = inZone(i * step) >= 0 ? 1 : 0;
      sp = speedProfile(N, qx, qz, kl, zm, gradeP);
    }
    const raceSpeed = Float32Array.from(blur(sp.v, 1));

    // ---- run-off surfaces and base barrier offsets ----
    const ro = Object.assign({ straight: 12, outside: 28, inside: 8, style: 'park' }, data.runoff || {});
    const kAbs = new Float64Array(N);
    for (let i = 0; i < N; i++) kAbs[i] = Math.abs(curv[i]);
    const r40 = Math.round(40 / step), r90 = Math.round(90 / step);
    const kMax = blur(winFilter(kAbs, r40, r90, true), Math.round(12 / step));
    // dominant bend direction nearby (the signed curvature of largest magnitude in the run-off window)
    const kDir = blur(curv, Math.round(30 / step));
    const dirW = winFilter(kDir, r40, r90, true), dirW2 = winFilter(kDir, r40, r90, false);
    const runoffL = new Uint8Array(N), runoffR = new Uint8Array(N);
    const baseL = new Float64Array(N), baseR = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const I = clamp(kMax[i] / 0.004, 0, 1);
      const bend = Math.abs(dirW[i]) >= Math.abs(dirW2[i]) ? 1 : -1;  // +1: right-hand bend nearby -> outside = left
      const outsideSide = I > 0.05 ? -bend : 0;
      const slow = kMax[i] > 1 / 45;
      for (const side of [-1, 1]) {
        const outside = side === outsideSide;
        const w = lerp(ro.straight, outside ? ro.outside : ro.inside, I);
        const kerb = side < 0 ? kerbL[i] : kerbR[i];
        const base = halfW[i] + (kerb ? KERB_W : 0) + w;
        let surf;
        if (ro.style === 'street') surf = S_.RUNOFF;
        else if (outside && I > 0.35) surf = slow && ro.pavedSlow !== false ? S_.RUNOFF : S_.GRAVEL;
        else surf = S_.GRASS;
        if (side < 0) { baseL[i] = base; runoffL[i] = surf; } else { baseR[i] = base; runoffR[i] = surf; }
      }
    }
    // optional per-stretch run-off surface: data.runoffZones = [{from, to, side: -1 | 1 | 0 (both), surf: 'gravel' |
    // 'paved' | 'grass'}] (e.g. a drawing's gravel trap on a slow corner, which the rule above paves)
    if (Array.isArray(data.runoffZones)) for (const rz of data.runoffZones) {
      const surf = { gravel: S_.GRAVEL, paved: S_.RUNOFF, grass: S_.GRASS }[rz.surf];
      if (surf == null || ro.style === 'street') continue;
      const a = atS(rz.from), len = wrap(atS(rz.to) - a);
      for (let i = 0; i < N; i++) {
        if (wrap(i * step - a) > len) continue;
        if (rz.side !== 1) runoffL[i] = surf;
        if (rz.side !== -1) runoffR[i] = surf;
      }
    }

    // ---- pit lane ----
    const pd = data.pit || {};
    const pitSide = pd.side || 1;
    const laneHalfW = pd.laneHalfW || 5;
    const entryS = atS(pd.entry || [0, 50]);
    const exitS = atS(pd.exit || [0, 400]);
    const pitLen = wrap(exitS - entryS);
    const blendIn = Math.min(pd.blendIn || 130, pitLen * 0.3), blendOut = Math.min(pd.blendOut || 130, pitLen * 0.3);
    const hwE = halfW[Math.round(entryS / step) % N];
    const wallGap = pd.wallGap || 3.0;              // track edge -> lane inner edge (holds the pit wall)
    const laneCenterAbs = hwE + wallGap + laneHalfW;
    const laneStartAbs = hwE - 1.5;
    const wallThick = 0.8;
    const wallD = pitSide * (hwE + wallGap * 0.55);
    const wallS0 = wrap(entryS + blendIn), wallS1 = wrap(exitS - blendOut);
    const laneD = s => {
      const u = wrap(s - entryS);
      if (u > pitLen) return null;
      let t = 1;
      if (u < blendIn) t = sstep(u / blendIn);
      else if (u > pitLen - blendOut) t = sstep((pitLen - u) / blendOut);
      return pitSide * lerp(laneStartAbs, laneCenterAbs, t);
    };
    const inWallSec = s => wrap(s - wallS0) <= wrap(wallS1 - wallS0);
    const inPitRange = s => wrap(s - entryS) <= pitLen;
    // no kerb under the pit lane: where the lane asphalt (entry / exit roads incl. the blends) reaches the kerb band on the
    // pit side, that kerb sample goes (kerbs elsewhere, e.g. the rest of the corner, stay). Racing line / speeds are built.
    const kerbP = pitSide < 0 ? kerbL : kerbR, kerbCut = [];
    const laneOnKerb = (s, i) => { const ld = inPitRange(s) ? laneD(s) : null, a = ld == null ? 0 : Math.abs(ld); return ld != null && a - laneHalfW < halfW[i] + KERB_W && a + laneHalfW > halfW[i]; };
    for (let i = 0; i < N; i++) {
      if (!kerbP[i]) continue;
      const s = i * step;   // (a kerb sample is drawn to its neighbours: test the lane over +-1 sample)
      if (laneOnKerb(wrap(s - step), i) || laneOnKerb(wrap(s - step / 2), i) || laneOnKerb(s, i) || laneOnKerb(wrap(s + step / 2), i) || laneOnKerb(wrap(s + step), i)) { kerbP[i] = 0; kerbCut.push(s); }
    }
    // widen the pit-side barrier around the lane (and 25 m beyond its ends, so wall smoothing can't clip it)
    for (let i = 0; i < N; i++) {
      const s = i * step;
      let need;
      if (inPitRange(s)) need = Math.abs(laneD(s)) + laneHalfW + (inWallSec(s) ? 0.5 : 1.0);
      else if (wrap(entryS - s) < 25 || wrap(s - exitS) < 25) need = laneStartAbs + laneHalfW + 1.0;
      else continue;
      if (pitSide > 0) { baseR[i] = Math.max(baseR[i], need); } else { baseL[i] = Math.max(baseL[i], need); }
    }
    // boxes: one per team (TEAMS.length, 20), evenly along the walled section, team 0 nearest the exit. They stay 15 m
    // inside the wall ends and past the speed-limit line (pd.limiterIn), preferably >= 45 m past it (room to brake into
    // the first box); spacing = pd.boxSpacing (default 14), compressed to fit (down to 11 m for that braking room)
    const NB = Math.max(10, typeof TEAMS !== 'undefined' && TEAMS.length ? TEAMS.length : 10);
    const wallLen = wrap(wallS1 - wallS0);
    const uLim = pd.limiterIn != null ? Math.min(wallLen * 0.5, wrap(entryS + Math.max(blendIn, Math.min(pd.limiterIn, pitLen * 0.5)) - wallS0)) : 0;
    let bLo = uLim + 15, bHi = wallLen - 15;
    const pbd = data.scenery && data.scenery.pitBuilding;   // (and every box inside the pit building, half a bay from its ends)
    if (pbd && pbd.from && pbd.to) {
      const rel = s => { let u = wrap(s - wallS0); if (u > L / 2) u -= L; return u; };
      const u0 = rel(atS(pbd.from)), u1 = rel(atS(pbd.to));
      if (u1 - u0 > 60) { bLo = Math.max(bLo, u0 + 9); bHi = Math.min(bHi, u1 - 9); }
    }
    let boxSp = Math.min(pd.boxSpacing || 14, (wallLen - 30) / NB, Math.max(11, (bHi - uLim - 45) / (NB - 1)));
    if ((NB - 1) * boxSp > bHi - bLo) boxSp = (bHi - bLo) / (NB - 1);
    const boxExt = (NB - 1) * boxSp, boxLoPref = Math.max(bLo, Math.min(uLim + 45, bHi - boxExt));
    const boxMidU = Math.min(Math.max(wallLen * (pd.boxCentre != null ? pd.boxCentre : 0.5), boxLoPref + boxExt / 2), bHi - boxExt / 2);
    const boxMid = wallS0 + boxMidU;
    const boxS = [];
    for (let t = 0; t < NB; t++) boxS.push(wrap(boxMid + ((NB - 1) / 2 - t) * boxSp));
    if (boxSp < 10) warn.push(`pit boxes cramped (${boxSp.toFixed(1)} m spacing)`);

    // ---- barriers: clamp so different parts of the track never share space (Voronoi of centreline) ----
    const gap = data.wallGapMin || 2.0;
    const tL = new Float64Array(N).fill(1e9), tR = new Float64Array(N).fill(1e9);
    let maxBase = 0;
    for (let i = 0; i < N; i++) maxBase = Math.max(maxBase, baseL[i], baseR[i]);
    const reach = 2 * (maxBase + gap), reach2 = reach * reach;
    // uniform grid of centreline samples (cell = reach) -> only nearby samples are tested
    const gx0 = Math.min(...px) - 1, gz0 = Math.min(...pz) - 1;
    const gnx = Math.ceil((Math.max(...px) - gx0) / reach) + 2, gnz = Math.ceil((Math.max(...pz) - gz0) / reach) + 2;
    const cellStart = new Int32Array(gnx * gnz + 1), cellOf = new Int32Array(N), cellIdx = new Int32Array(N);
    for (let i = 0; i < N; i++) { cellOf[i] = Math.floor((px[i] - gx0) / reach) + Math.floor((pz[i] - gz0) / reach) * gnx; cellStart[cellOf[i] + 1]++; }
    for (let c = 0; c < gnx * gnz; c++) cellStart[c + 1] += cellStart[c];
    { const fill = cellStart.slice(); for (let i = 0; i < N; i++) cellIdx[fill[cellOf[i]]++] = i; }
    for (let i = 0; i < N; i++) {
      const xi = px[i], zi = pz[i], nxi = nx[i], nzi = nz[i];
      let bl = tL[i], br = tR[i];
      const cxi = cellOf[i] % gnx, czi = (cellOf[i] - cxi) / gnx;
      for (let cz = czi - 1; cz <= czi + 1; cz++) for (let cx = cxi - 1; cx <= cxi + 1; cx++) {
       if (cx < 0 || cz < 0 || cx >= gnx || cz >= gnz) continue;
       const c = cx + cz * gnx;
       for (let q = cellStart[c]; q < cellStart[c + 1]; q++) {
        const j = cellIdx[q];
        if (j === i) continue;
        const dx = px[j] - xi, dz = pz[j] - zi;
        const D2 = dx * dx + dz * dz;
        if (D2 > reach2) continue;
        const dn = dx * nxi + dz * nzi;
        if (dn > 1e-6) { const t = D2 / (2 * dn); if (t < br) br = t; }
        else if (dn < -1e-6) { const t = D2 / (-2 * dn); if (t < bl) bl = t; }
       }
      }
      tL[i] = bl; tR[i] = br;
    }
    let wl = new Float64Array(N), wr = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      wl[i] = Math.min(baseL[i], tL[i] - gap / 2);
      wr[i] = Math.min(baseR[i], tR[i] - gap / 2);
    }
    const fr = Math.max(1, Math.round(6 / step));
    wl = blur(winFilter(wl, fr, fr, false), fr);
    wr = blur(winFilter(wr, fr, fr, false), fr);
    const wallL = new Float32Array(N), wallR = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      wallL[i] = -wl[i]; wallR[i] = wr[i];
      if (wl[i] < halfW[i] + 0.8 || wr[i] < halfW[i] + 0.8) {
        if (!warn.some(w => w.startsWith('barrier squeezed'))) warn.push(`barrier squeezed onto asphalt near s=${(i * step).toFixed(0)}`);
      }
    }
    // pit lane clearance check
    for (let i = 0; i < N; i++) {
      const s = i * step;
      if (!inPitRange(s)) continue;
      const need = Math.abs(laneD(s)) + laneHalfW;
      const have = pitSide > 0 ? wallR[i] : -wallL[i];
      if (have < need - 0.05) { warn.push(`pit lane clipped by barrier near s=${s.toFixed(0)}`); break; }
    }

    // ---- sectors, overtake detection, grid ----
    const sectorS = (data.sectors || [1 / 3, 2 / 3]).map(v => (typeof v === 'number' && v < 1 ? v * L : atS(v)));
    const overtakeDetectS = data.detect != null ? atS(data.detect) : wrap(-600);
    let poleSide = data.poleSide;
    if (!poleSide) {
      for (let i = 0; i < N / 3; i++) if (Math.abs(curv[i]) > 1 / 200) { poleSide = curv[i] > 0 ? 1 : -1; break; }
      poleSide = poleSide || 1;
    }
    const gridFirst = data.gridFirst || 10;
    const gridSlots = [];   // one per team (20): staggered pairs, 8 m apart
    for (let p = 0; p < NB; p++) {
      const s = wrap(-(gridFirst + 8 * p));
      gridSlots.push({ s, d: (p % 2 === 0 ? poleSide : -poleSide) * halfW[Math.round(s / step) % N] / 2 });
    }

    // ---- corners (from racing-line curvature) ----
    const corners = [];
    if (Array.isArray(data.turns) && data.turns.length) {
      // explicit numbering (data.turns = apex at-specs): each corner owns the stretch between the midpoints to its
      // neighbouring apexes; s0..s1 = where the racing line bends its way (|k| > thr) inside that stretch
      const thr = 1 / 500;
      const kc = blur(kl, Math.round(6 / step));
      const ap = data.turns.map(atS).sort((a, b) => a - b), nT = ap.length;
      const at = n => ((n % N) + N) % N;
      for (let q = 0; q < nT; q++) {
        const a = ap[q], dPrev = nT > 1 ? wrap(a - ap[(q - 1 + nT) % nT]) : L, dNext = nT > 1 ? wrap(ap[(q + 1) % nT] - a) : L;
        const n0 = Math.round((a - dPrev / 2) / step), n1 = Math.round((a + dNext / 2) / step);
        let ang = 0;
        for (let n = n0; n < n1; n++) ang += kc[at(n)] * sp.ds[at(n)];
        const dir = ang >= 0 ? 1 : -1;
        let f0 = -1, f1 = -1, minR = 1e9;
        for (let n = n0; n < n1; n++) {
          const k = kc[at(n)];
          if (k * dir > thr) { if (f0 < 0) f0 = n; f1 = n; minR = Math.min(minR, 1 / Math.abs(k)); }
        }
        if (f0 < 0) { f0 = f1 = Math.round(a / step); minR = 1 / Math.max(1e-6, Math.abs(kc[at(f0)])); }
        let vMin = raceSpeed[at(f0)], apex = at(f0), kPk = -1;   // apex: peak curvature; vMin: slowest in the core
        for (let n = f0; n <= f1; n++) {
          const k = kc[at(n)] * dir;
          if (k > kPk) { kPk = k; apex = at(n); }
          if (k > 0.5 / minR) vMin = Math.min(vMin, raceSpeed[at(n)]);
        }
        corners.push({ num: q + 1, s: apex * step, s0: at(f0) * step, s1: at(f1 + 1) * step, dir, angle: Math.abs(ang) / DEG, minR, vMin });
      }
    } else {
      const thr = 1 / 500;
      const kc = blur(kl, Math.round(6 / step));
      let i0 = 0;
      while (i0 < N && Math.abs(kc[i0]) > thr) i0++;   // start outside a corner
      const regs = [];
      let cur = null;
      for (let n = 0; n <= N; n++) {
        const i = (i0 + n) % N, k = kc[i];
        const sg = Math.abs(k) > thr ? Math.sign(k) : 0;
        if (cur && (sg !== cur.dir || n === N)) { cur.e = n; regs.push(cur); cur = null; }
        if (!cur && sg !== 0 && n < N) cur = { b: n, dir: sg };
      }
      // merge same-direction regions separated by < 30 m
      const merged = [];
      for (const r of regs) {
        const p = merged[merged.length - 1];
        if (p && p.dir === r.dir && (r.b - p.e) * step < 30) p.e = r.e; else merged.push({ ...r });
      }
      for (const r of merged) {
        let ang = 0, minR = 1e9, vMin = 1e9, apex = r.b;
        for (let n = r.b; n < r.e; n++) {
          const i = (i0 + n) % N;
          ang += kc[i] * sp.ds[i];
          minR = Math.min(minR, 1 / Math.max(1e-6, Math.abs(kc[i])));
          if (raceSpeed[i] < vMin) { vMin = raceSpeed[i]; apex = i; }
        }
        if (Math.abs(ang) < 12 * DEG) continue;
        corners.push({ s: apex * step, s0: ((i0 + r.b) % N) * step, s1: ((i0 + r.e) % N) * step, dir: r.dir, angle: Math.abs(ang) / DEG, minR, vMin });
      }
      corners.sort((a, b) => a.s0 - b.s0);
      corners.forEach((c, n) => { c.num = n + 1; });
    }

    // ---- bounds ----
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < N; i++) {
      for (let q = 0; q < 2; q++) {
        const d = q ? wallR[i] : wallL[i], x = px[i] + d * nx[i], z = pz[i] + d * nz[i];
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
    }

    // ---- scenery hints: resolve {at:[seg,off]} -> s, {from,to} -> s0,s1 ----
    const resolve = o => {
      if (Array.isArray(o)) return o.map(resolve);
      if (!o || typeof o !== 'object') return o;
      const r = {};
      for (const key of Object.keys(o)) {
        const v = o[key];
        if (key === 'at') r.s = atS(v);
        else if (key === 'from') r.s0 = atS(v);
        else if (key === 'to') r.s1 = atS(v);
        else r[key] = resolve(v);
      }
      return r;
    };

    const theme = Object.assign({
      sky: '#8fc3ee', skyTop: '#3d7fd0', fog: '#bcd6ea', grass: '#4f8a32', ground: '#6b7a45', runoff: '#8a8f96',
      gravel: '#cdb88f', asphalt: '#3a3d42', line: '#f2f2f2', kerbA: '#d8262b', kerbB: '#f4f4f4', barrier: '#c9ccd1',
      tyreWall: '#26282c', sun: '#fff4d6', timeOfDay: 'day', street: false,
    }, data.theme || {});

    // ---- Track object ----
    const idxAt = s => { let i = Math.round(wrap(s) / step); return i >= N ? i - N : i; };
    const T = {
      id: data.id, name: data.name, country: data.country || '', lapRecordHint: data.lapRecordHint || '',
      description: data.description || '', character: data.character || '',
      length: L, N, step,
      px, pz, tx, tz, nx, nz, curv, halfW, wallL, wallR, raceLine, raceSpeed, kerbL, kerbR, runoffL, runoffR,
      elev, grade, bank, elevRange: elevRange(),
      sectorS, straightZones, overtakeDetectS,
      pit: {
        side: pitSide, entryS, exitS, laneD, laneHalfW, wallD, wallS0, wallS1,
        // optional pd.limiterIn (m after the entry): put the speed-limit line (and autopilot takeover) past any corners
        limiterS0: pd.limiterIn != null ? wrap(entryS + Math.max(blendIn, Math.min(pd.limiterIn, pitLen * 0.5))) : wallS0,
        limiterS1: wallS1, boxS, boxD: pitSide * (laneCenterAbs + laneHalfW * 0.5),
        length: pitLen, laneCenterD: pitSide * laneCenterAbs, garageD: pitSide * (laneCenterAbs + laneHalfW),
        wallThick, blendIn, blendOut, kerbCut,   // kerbCut: s of the kerb samples removed from under the lane
        // exitCap {kph, s0, s1}: speed cap on the exit road (data pit.exitCap {kph, from, to} = m before the exit line)
        exitCap: pd.exitCap && pd.exitCap.kph > 0 ? { kph: pd.exitCap.kph, s0: wrap(exitS - (pd.exitCap.from || 100)), s1: wrap(exitS - (pd.exitCap.to || 0)) } : null,
      },
      gridSlots,
      bounds: { minX, maxX, minZ, maxZ },
      theme,
      scenery: resolve(data.scenery || {}),
      corners,
      lapTimeEst: sp.lap,
      warnings: warn,
      segS: C.starts.map(s => wrap(s - S0)), segLens: C.segLens,

      wrapS: wrap,
      deltaS(a, b) { let d = wrap(b - a); if (d > L / 2) d -= L; return d; },
      idxAt,
      sample(s, out) {
        out = out || {};
        s = wrap(s);
        const f = s / step, i = Math.floor(f) % N, j = (i + 1) % N, u = f - Math.floor(f);
        let ttx = tx[i] + (tx[j] - tx[i]) * u, ttz = tz[i] + (tz[j] - tz[i]) * u;
        const m = Math.hypot(ttx, ttz) || 1; ttx /= m; ttz /= m;
        out.x = px[i] + (px[j] - px[i]) * u; out.z = pz[i] + (pz[j] - pz[i]) * u;
        out.tx = ttx; out.tz = ttz; out.nx = -ttz; out.nz = ttx;
        out.curv = curv[i] + (curv[j] - curv[i]) * u;
        out.halfW = halfW[i] + (halfW[j] - halfW[i]) * u;
        out.raceLine = raceLine[i] + (raceLine[j] - raceLine[i]) * u;
        out.raceSpeed = raceSpeed[i] + (raceSpeed[j] - raceSpeed[i]) * u;
        out.elev = elev[i] + (elev[j] - elev[i]) * u;
        out.grade = grade[i] + (grade[j] - grade[i]) * u;
        out.bank = bank[i] + (bank[j] - bank[i]) * u;
        return out;
      },
      toWorld(s, d, out) {
        out = out || {};
        s = wrap(s);
        const f = s / step, i = Math.floor(f) % N, j = (i + 1) % N, u = f - Math.floor(f);
        let nnx = nx[i] + (nx[j] - nx[i]) * u, nnz = nz[i] + (nz[j] - nz[i]) * u;
        const m = Math.hypot(nnx, nnz) || 1;
        out.x = px[i] + (px[j] - px[i]) * u + d * nnx / m;
        out.z = pz[i] + (pz[j] - pz[i]) * u + d * nnz / m;
        return out;
      },
      project(x, z, hintIdx = -1, out) {
        out = out || {};
        const d2 = i => { const dx = x - px[i], dz = z - pz[i]; return dx * dx + dz * dz; };
        let best = -1, bd = Infinity;
        if (hintIdx != null && hintIdx >= 0 && hintIdx < N) {
          let i = hintIdx | 0, di = d2(i);
          for (let n = 0; n < 400; n++) {
            const a = i + 1 < N ? i + 1 : 0, b = i > 0 ? i - 1 : N - 1;
            const da = d2(a), db = d2(b);
            if (da < di && da <= db) { i = a; di = da; } else if (db < di) { i = b; di = db; } else break;
          }
          const lim = Math.max(wallR[i], -wallL[i]) + 4;
          if (di <= lim * lim) { best = i; bd = di; }
        }
        if (best < 0) {
          for (let i = 0; i < N; i++) { const di = d2(i); if (di < bd) { bd = di; best = i; } }
        }
        // refine on the adjacent segments: solve C(u) + d N(u) = P exactly (inverse of toWorld)
        let seg = -1, u = 0;
        for (const o of [0, -1, 1, -2]) {
          const i = (best + o + N) % N;
          const r = solveSeg(i, x, z);
          if (r >= -1e-6 && r <= 1 + 1e-6) { seg = i; u = clamp(r, 0, 1); break; }
        }
        if (seg < 0) { seg = best; u = 0; }
        const j = (seg + 1) % N;
        const cxp = px[seg] + (px[j] - px[seg]) * u, czp = pz[seg] + (pz[j] - pz[seg]) * u;
        let nnx = nx[seg] + (nx[j] - nx[seg]) * u, nnz = nz[seg] + (nz[j] - nz[seg]) * u;
        const m = Math.hypot(nnx, nnz) || 1; nnx /= m; nnz /= m;
        out.s = wrap((seg + u) * step);
        out.d = (x - cxp) * nnx + (z - czp) * nnz;
        out.idx = u < 0.5 ? seg : j;
        return out;
      },
      surface(s, d) {
        s = wrap(s);
        const i = idxAt(s), a = d < 0 ? -d : d, side = d < 0 ? -1 : 1;
        const w = side > 0 ? wallR[i] : -wallL[i];
        if (a >= w) return S_.WALL;
        if (side === pitSide && inPitRange(s)) {
          if (inWallSec(s) && Math.abs(d - wallD) <= wallThick / 2) return S_.WALL;
          const ld = laneD(s);
          if (a > halfW[i] && Math.abs(d - ld) <= laneHalfW) return S_.PIT;
          if (inWallSec(s) && (d - wallD) * pitSide > 0) return S_.PIT;
        }
        if (a <= halfW[i]) return S_.TRACK;
        if (a <= halfW[i] + KERB_W && (side > 0 ? kerbR[i] : kerbL[i])) return S_.KERB;
        if (side === pitSide && inPitRange(s)) return S_.RUNOFF;
        return side > 0 ? runoffR[i] : runoffL[i];
      },
      inPitArea(s, d) {
        s = wrap(s);
        if (!inPitRange(s) || d * pitSide <= halfW[idxAt(s)]) return false;
        if (inWallSec(s) && (d - wallD) * pitSide <= wallThick / 2) return false;
        return Math.abs(d - laneD(s)) <= laneHalfW;
      },
      corridor(s, d, out) {
        out = out || {};
        s = wrap(s);
        const f = s / step, i = Math.floor(f) % N, j = (i + 1) % N, u = f - Math.floor(f);
        const wL = wallL[i] + (wallL[j] - wallL[i]) * u, wR = wallR[i] + (wallR[j] - wallR[i]) * u;
        if (inWallSec(s)) {
          const h2 = wallThick / 2;
          if ((d - wallD) * pitSide > 0) {
            if (pitSide > 0) { out.min = wallD + h2; out.max = wR; } else { out.min = wL; out.max = wallD - h2; }
            out.pit = true;
          } else {
            if (pitSide > 0) { out.min = wL; out.max = wallD - h2; } else { out.min = wallD + h2; out.max = wR; }
            out.pit = false;
          }
          return out;
        }
        out.min = wL; out.max = wR; out.pit = T.inPitArea(s, d);
        return out;
      },
      // surface height at (s, d): centreline elevation + banking (outside of a right-hander, d < 0, is higher for bank > 0)
      elevAt(s, d = 0) {
        s = wrap(s);
        const f = s / step, i = Math.floor(f) % N, j = (i + 1) % N, u = f - Math.floor(f);
        const b = bank[i] + (bank[j] - bank[i]) * u;
        return elev[i] + (elev[j] - elev[i]) * u - d * Math.tan(b);
      },
      zoneAt(s) { return inZone(wrap(s)); },
      sectorAt(s) { s = wrap(s); return s < sectorS[0] ? 0 : s < sectorS[1] ? 1 : 2; },
      outline(stepMeters = 10, s0 = 0, s1 = L) {
        const out = [];
        const len = (s0 === 0 && s1 === L) ? L : wrap(s1 - s0);
        const n = Math.max(2, Math.round(len / stepMeters));
        const closed = len === L;
        const p = {};
        for (let q = 0; q < (closed ? n : n + 1); q++) { T.toWorld(s0 + (q * len) / n, 0, p); out.push([p.x, p.z]); }
        return out;
      },
      pitOutline(stepMeters = 10) {
        const out = [], n = Math.max(2, Math.round(pitLen / stepMeters)), p = {};
        for (let q = 0; q <= n; q++) { const s = entryS + (q * pitLen) / n; T.toWorld(s, laneD(wrap(s)), p); out.push([p.x, p.z]); }
        return out;
      },
    };

    function elevRange() {
      let lo = Infinity, hi = -Infinity, climb = 0, gMax = 0;
      for (let i = 0; i < N; i++) {
        lo = Math.min(lo, elev[i]); hi = Math.max(hi, elev[i]); gMax = Math.max(gMax, Math.abs(grade[i]));
        const dz = elev[(i + 1) % N] - elev[i]; if (dz > 0) climb += dz;
      }
      return { min: lo, max: hi, climb, maxGrade: gMax };
    }
    function solveSeg(i, x, z) {
      const j = (i + 1) % N;
      const Ax = x - px[i], Az = z - pz[i], Bx = px[j] - px[i], Bz = pz[j] - pz[i];
      const n0x = nx[i], n0z = nz[i], Dx = nx[j] - n0x, Dz = nz[j] - n0z;
      const c = Ax * n0z - Az * n0x;
      const b = (Ax * Dz - Az * Dx) - (Bx * n0z - Bz * n0x);
      const a = -(Bx * Dz - Bz * Dx);
      if (Math.abs(b) < 1e-12) return -1;
      if (Math.abs(a) < 1e-12) return -c / b;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return -c / b;
      const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(disc));
      return Math.abs(q) < 1e-15 ? -c / b : c / q;
    }
    return T;
  }

  return function buildTrack(data, opts) {
    if (!data) throw new Error('buildTrack: no track data');
    if (!(opts && opts.fresh) && cache.has(data)) return cache.get(data);
    const t = build(data);
    cache.set(data, t);
    return t;
  };
})();

;
// ===== weather.js
// Apex GP — dynamic weather (CONTRACT §14). Pure logic (no THREE / DOM): runs in Node for headless sims.
// Per race: a rain-intensity timeline r(x) 0..1 and a track wetness w(t) 0..1 (physics reads G.weather.wet).
// Weather clock x = leader race distance in laps (0 at the line), so forecast windows stay "laps 8–12".
// Rain wets the track towards an equilibrium; dry spells (faster with cars running) dry it. All transitions are
// gradual: rain intensity is slew-limited (0 -> 1 takes >= ~2.4 laps / ~3 min), wetness follows with a lag.
// Forecast = ensemble of plausible scenarios drawn from the same model as the real outcome (usually right, never
// guaranteed); members are re-weighted by what already happened and blended towards the real outcome over a radar
// range of a few laps, so the forecast sharpens as changes approach. plan() is the tyre-strategy helper Race uses
// for AI weather stops, starting tyres and the player's hints.
const Weather = (() => {
  const RES = 20;                   // timeline samples per lap
  const QR = 4;                     // forecast resolution: quarter laps
  const SUB = RES / QR;             // wetness sub-steps per quarter lap
  const N_ENS = 48;                 // ensemble members
  const RAIN_T = 0.05;              // intensity counted as rain (probabilities, the NOW box, the start rule)
  const FC_N = 8;                   // pre-race forecast strip: at most 8 lap windows; the first one is NOW
  const winSize = laps => Math.max(1, Math.ceil(laps / Math.min(FC_N, Math.max(1, laps))));   // laps per window
  const GAMMA = 0.45;               // lap time ∝ grip^-GAMMA (as the AI's pace model)
  const RATE_T = 0.45 / 90;         // max rain-intensity change per second (0 -> 1 in >= 200 s)
  const IDS = ['S', 'M', 'H', 'I', 'W'];
  const MODES = ['dry', 'damp', 'wet', 'dynamic', 'custom'];
  const LV = { dry: 0, damp: 0.3, wet: 0.85 };           // custom: rain intensity per condition
  const WHEN = { early: 0.3, mid: 0.5, late: 0.72 };      // custom: change point as a fraction of the race
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const cat = c => (c === 'I' ? 1 : c === 'W' ? 2 : 0);   // 0 slick, 1 intermediate, 2 wet

  // ---------- tyres vs wetness ----------
  function gripAt(c, w) {
    const k = typeof COMPOUNDS !== 'undefined' ? COMPOUNDS[c] : null;
    if (!k) return 1;
    const g = k.wetGrip, m = g ? (w <= 0.5 ? lerp(g[0], g[1], w * 2) : lerp(g[1], g[2], w * 2 - 1)) : 1;
    return k.grip * m;
  }
  // Lap-time factor of compound c at wetness w: grip^-GAMMA, plus the drivers' extra margin on a tyre working outside
  // its window (AI wetK: slicks in the wet / wets on a dry line lose more than the raw grip says; also the risk).
  const wetMul = (c, w) => { const k = COMPOUNDS[c], g = k && k.wetGrip; return g ? (w <= 0.5 ? lerp(g[0], g[1], w * 2) : lerp(g[1], g[2], w * 2 - 1)) : 1; };
  // handling loss out of the tyre's window (COMPOUNDS wetSlide knots [[w, slide], ...], smoothstep between, as physics):
  // lap time +SLIDE_K per unit (solo AI laps: understeer, hydroplaning under braking, traction)
  const SLIDE_K = 0.11;
  function slideAt(c, w) {
    const a = COMPOUNDS[c] && COMPOUNDS[c].wetSlide;
    if (!a) return 0;
    if (!(w > a[0][0])) return a[0][1];
    let i = 0; while (i < a.length - 1 && w >= a[i + 1][0]) i++;
    if (i === a.length - 1) return a[i][1];
    const t = (w - a[i][0]) / (a[i + 1][0] - a[i][0]);
    return a[i][1] + (a[i + 1][1] - a[i][1]) * t * t * (3 - 2 * t);
  }
  let LTF = null, CROSS = null;     // lap-time factor table [5][101] (w step 0.01), crossover wetness
  function tables() {
    if (LTF) return;
    LTF = IDS.map(c => {
      const a = new Float32Array(101), mx = Math.max(wetMul(c, 0), wetMul(c, 0.5), wetMul(c, 1));
      for (let i = 0; i <= 100; i++) { const w = i / 100; a[i] = Math.pow(1 / Math.max(0.2, gripAt(c, w)), GAMMA) * (1 + 0.12 * (1 - wetMul(c, w) / mx)) * (1 + SLIDE_K * slideAt(c, w)); }
      return a;
    });
    const first = (a, b) => { const A = LTF[IDS.indexOf(a)], B = LTF[IDS.indexOf(b)]; for (let i = 0; i <= 100; i++) if (B[i] <= A[i]) return i / 100; return 1; };
    CROSS = { I: first('M', 'I'), W: first('I', 'W') };   // lap-time crossovers (≈ 0.17 slick->inter, ≈ 0.5 inter->wet)
  }
  const ltf = (ci, w) => { const f = clamp(w, 0, 1) * 100, i = f | 0; const a = LTF[ci]; return i >= 100 ? a[100] : a[i] + (a[i + 1] - a[i]) * (f - i); };
  // compound category the conditions call for at wetness w (no strategy, no forecast)
  function category(w) { tables(); return w >= CROSS.W ? 'W' : w >= CROSS.I ? 'I' : null; }

  // ---------- wetness model (per lap of racing; cars = share of the field running at speed) ----------
  const eqW = r => (r > 0.02 ? Math.min(1, 0.2 + 0.95 * r) : 0);
  function wetStep(w, r, dLap, cars) {
    const eq = eqW(r);
    if (w < eq) return Math.min(eq, w + 0.36 * (0.25 + r) * dLap * Math.min(1, (eq - w) / 0.08 + 0.25));
    if (w > eq) return Math.max(eq, w - 0.17 * (0.45 + 0.55 * cars) * (r > 0.02 ? 0.5 : 1) * dLap * Math.min(1, (w - eq) / 0.08 + 0.25));
    return w;
  }
  const gridAt = (a, x) => { const f = x * RES; if (f <= 0) return a[0]; const i = f | 0; if (i >= a.length - 1) return a[a.length - 1]; return a[i] + (a[i + 1] - a[i]) * (f - i); };

  // ---------- scenario model ----------
  const jit = (rnd, s) => (rnd() + rnd() - 1) * s;
  // forecaster's knowledge: current rain (r0, when it clears ± clearS), start wetness w0, candidate spells
  function dynamicModel(N, rnd) {
    const S = Math.max(0.8, 0.12 * N), m = { r0: 0, w0: 0, clearX: null, clearS: S, spells: [], wander: 0.12 };
    const spell = (p, x0, dur, peak, lead, toEnd) => m.spells.push({ p, x0, s: S, dur: Math.max(1.5, dur), peak, lead, toEnd: !!toEnd });
    // ~38 % of dynamic races are dry races (at most a faint threat that rarely comes); with the "threat" branch
    // below that makes about half of all dynamic races completely dry
    const pDry = 0.27 - 0.12 * clamp((N - 5) / 15, 0, 1);   // short races drier (~45 % completely dry) → long races ~35 %
    if (rnd() < pDry) {
      if (rnd() < 0.5) spell(0.05 + 0.1 * rnd(), N * (0.3 + 0.5 * rnd()), N * 0.2, 0.2 + 0.2 * rnd(), false);
      return m;
    }
    const u = rnd();
    if (u < 0.2) spell(0.15 + 0.25 * rnd(), N * (0.3 + 0.5 * rnd()), N * 0.3, 0.3 + 0.4 * rnd(), rnd() < 0.5);                  // threat, likely dry
    else if (u < 0.5) spell(0.55 + 0.4 * rnd(), N * (0.2 + 0.45 * rnd()), N * (0.25 + 0.35 * rnd()), 0.35 + 0.6 * rnd(), rnd() < 0.55);   // a shower
    else if (u < 0.62) {                                                                                                          // two showers
      spell(0.4 + 0.4 * rnd(), N * (0.15 + 0.25 * rnd()), N * (0.15 + 0.15 * rnd()), 0.3 + 0.5 * rnd(), rnd() < 0.4);
      spell(0.4 + 0.4 * rnd(), N * (0.55 + 0.3 * rnd()), N * (0.15 + 0.15 * rnd()), 0.4 + 0.6 * rnd(), rnd() < 0.4);
    } else if (u < 0.74) spell(0.6 + 0.35 * rnd(), N * (0.3 + 0.4 * rnd()), N, 0.4 + 0.6 * rnd(), rnd() < 0.6, true);           // rain arriving, staying
    else if (u < 0.9) {                                                                                                           // wet start, clearing
      m.r0 = 0.35 + 0.6 * rnd(); m.w0 = eqW(m.r0); m.clearX = N * (0.15 + 0.45 * rnd());
      if (rnd() < 0.4) spell(0.3 + 0.2 * rnd(), N * (0.7 + 0.2 * rnd()), N * 0.2, 0.3 + 0.4 * rnd(), false);
    } else {                                                                                                                      // damp start, drying
      m.w0 = 0.35 + 0.3 * rnd();
      if (rnd() < 0.5) spell(0.3 + 0.2 * rnd(), N * (0.5 + 0.3 * rnd()), N * 0.25, 0.3 + 0.5 * rnd(), rnd() < 0.5);
    }
    return m;
  }
  // custom: start -> end condition around the change point (almost certain, timing ± a lap)
  function customModel(N, c, xw) {
    const r0 = LV[c.start] != null ? LV[c.start] : 0, r1 = LV[c.end] != null ? LV[c.end] : 0.85;
    const xc = N * (WHEN[c.when] || 0.5), S = Math.max(0.4, 0.05 * N);
    const m = { r0, w0: c.start === 'wet' ? 1 : c.start === 'damp' ? 0.5 : 0, clearX: r0 !== r1 ? xc : null, clearS: S, spells: [], wander: 0.08 };
    // (heavier rain arrives after the first forecast box, so the chosen start conditions really are the start)
    if (r1 > 0 && r1 !== r0) m.spells.push({ p: 1, x0: r1 > r0 ? Math.max(xc - 0.6, (xw || 0) + S + 0.05) : xc, s: S, dur: N, peak: r1, lead: false, toEnd: true, exact: true });
    return m;
  }
  // The first forecast box shows the conditions NOW, so a scenario must not change from dry to rain inside it: rain
  // that would start there is already falling at the lights (at the level it reaches in its first lap, no ramp from
  // dry). Returns the rain at the start. (Rain falling at the start may still stop inside the box.)
  function settleStart(a, xw) {
    if (a[0] >= RAIN_T) return a[0];
    const iw = Math.min(a.length - 1, Math.round(xw * RES));
    let on = -1;
    for (let i = 0; i <= iw; i++) if (a[i] >= RAIN_T) { on = i; break; }
    if (on < 0) { for (let i = 0; i <= iw; i++) a[i] = 0; return 0; }   // dry through the box (drizzle below the threshold too)
    let im = on;
    for (let i = on, e = Math.min(a.length - 1, on + RES); i <= e; i++) if (a[i] > a[im]) im = i;
    for (let i = 0; i < im; i++) if (a[i] < a[im]) a[i] = a[im];
    return a[0];
  }
  function sample(m, rnd, out, span) {
    out.fill(0);
    const n = out.length, R = RES;
    const put = (x0, x1, lv) => { const a = Math.max(0, Math.ceil(x0 * R)), b = Math.min(n - 1, Math.floor(x1 * R)); for (let i = a; i <= b; i++) if (out[i] < lv) out[i] = lv; };
    if (m.r0 > 0) put(-1, m.clearX == null ? span + 9 : m.clearX + jit(rnd, m.clearS), m.r0);
    for (const sp of m.spells) {
      if (rnd() >= sp.p) continue;
      const xs = sp.x0 + jit(rnd, sp.s), d = sp.toEnd ? span + 9 : sp.dur * (0.7 + 0.6 * rnd());
      const pk = sp.exact ? sp.peak : clamp(sp.peak * (0.75 + 0.5 * rnd()), 0.12, 1);
      if (sp.lead && pk > 0.4) { put(xs, xs + d, Math.min(pk, 0.22 + 0.1 * rnd())); put(xs + d * (0.3 + 0.2 * rnd()), xs + d * 0.85, pk); }
      else put(xs, xs + d, pk);
    }
    const ph = rnd() * 6.283, f = 0.15 + 0.2 * rnd(), wa = m.wander;   // slow texture inside the rain
    for (let i = 0; i < n; i++) if (out[i] > 0) out[i] = clamp(out[i] * (1 + wa * Math.sin(ph + i / R * f * 6.283)), 0.04, 1);
    const up = m.kUp / R, dn = m.kDn / R;   // slew limit: gradual transitions only
    for (let i = 1; i < n; i++) out[i] = clamp(out[i], out[i - 1] - dn, out[i - 1] + up);
    return out;
  }

  // ---------- create ----------
  function create(o = {}) {
    tables();
    const mode = MODES.includes(o.mode) ? o.mode : 'dry';
    const seed = (o.seed != null ? +o.seed : Math.floor(Math.random() * 4294967296)) >>> 0;
    let lapT = +o.lapT || 0;
    if (!(lapT > 20) && o.track && o.track.raceSpeed) { let v = 0; const T = o.track; for (let i = 0; i < T.N; i++) v += T.raceSpeed[i]; lapT = T.length / Math.max(20, v / T.N * 0.92); }
    if (!(lapT > 20)) lapT = 85;
    const laps = o.laps > 0 ? +o.laps : 0, span = clamp(laps || 20, 3, 40);
    const W = {
      mode, dynamic: mode === 'dynamic' || mode === 'custom', timeOfDay: o.timeOfDay || 'day', seed,
      wet: 0, rain: 0, x: 0, t: 0, trend: 0, laps, span, lapT, radar: clamp(330 / lapT, 2.5, 6), xAdd: 0, rate: 1,   // (xAdd / rate: debug time-lapse)
      custom: mode === 'custom' ? { start: o.custom && o.custom.start || 'dry', end: o.custom && o.custom.end || 'wet', when: o.custom && o.custom.when || 'mid' } : null,
      peakWet: 0, peakRain: 0, cross: { I: CROSS.I, W: CROSS.W },
    };
    if (!W.dynamic) {   // fixed conditions (legacy values)
      const wet = { dry: 0, damp: 0.5, wet: 1 }[mode] || 0;
      W.wet = wet; W.rain = wet >= 1 ? 1 : wet > 0 ? 0.35 : 0; W.peakWet = wet; W.peakRain = W.rain;
      return W;
    }
    const rm = U.rng(seed ^ 0x9e3779b9), N = span, xw = W.firstWin = winSize(laps || span);
    const m = mode === 'custom' ? customModel(N, W.custom, xw) : dynamicModel(N, rm);
    m.kUp = Math.min(0.42, 0.42 * 95 / lapT); m.kDn = Math.min(0.5, 0.5 * 95 / lapT);
    const n = Math.ceil((span + 3) * RES) + 1;
    W.model = m;
    W.truth = sample(m, U.rng(seed ^ 0x7f4a7c15), new Float32Array(n), span);
    const r0 = settleStart(W.truth, xw);
    const re = U.rng(seed ^ 0x2c1b3c6d);
    W.ens = [];
    for (let i = 0; i < N_ENS; i++) { const a = sample(m, re, new Float32Array(n), span); settleStart(a, xw); W.ens.push(a); }
    // raining at the lights: the track is as wet as that rain makes it (it has been falling for a while)
    W.wet = W.w0 = clamp(Math.max(m.w0, r0 >= RAIN_T ? eqW(r0) : 0), 0, 1); W.rain = r0;
    // how wet this race really gets (renderers pick wet-capable materials only when needed)
    let w = W.wet, pw = w, pr = 0;
    for (let x = 0; x <= span + 1; x += 1 / RES) { const r = gridAt(W.truth, x); w = wetStep(w, r, 1 / RES, 1); if (w > pw) pw = w; if (r > pr) pr = r; }
    W.peakWet = pw; W.peakRain = pr;
    const QM = Math.ceil((span + 2) * QR) + 1;
    W.fc = { x: -1, t: -9, Q: 0, QM, sum: 1, ww: new Float32Array(N_ENS).fill(1), pR: new Float32Array(QM), eR: new Float32Array(QM),
      eW: new Float32Array(QM), mr: new Float32Array(N_ENS * QM), F: new Float32Array(IDS.length * QM), rev: 0 };
    forecast(W);
    return W;
  }
  // Race.create: align with the race's own lap-time estimate / lap count
  function bind(W, race) {
    if (!W || !W.dynamic || !race) return W;
    if (race.lapTimeEst > 20 && Math.abs(race.lapTimeEst - W.lapT) / W.lapT > 0.02) { W.lapT = race.lapTimeEst; W.radar = clamp(330 / W.lapT, 2.5, 6); forecast(W); }
    return W;
  }

  // ---------- per physics step (Race.update while racing) ----------
  function step(W, G, dt) {
    if (!W || !W.dynamic || !G || !G.track) return;
    const L = G.track.length, cars = G.cars || [];
    let d = 0, run = 0, n = 0;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (c.raceDist > d) d = c.raceDist;
      if (!c.dnf) { n++; if (c.speed > 15 && !c.kinematic) run++; }
    }
    const x = Math.max(W.x, d / L + (W.xAdd || 0));
    W.x = x; W.t += dt;
    W.rain = U.approach(W.rain, gridAt(W.truth, x), RATE_T * dt * (W.rate || 1));   // (time limit too: the leader is quicker on straights)
    const w0 = W.wet;
    W.wet = wetStep(w0, W.rain, dt / W.lapT * (W.rate || 1), n ? run / n : 1);
    W.trend = U.expDecay(W.trend, (W.wet - w0) / Math.max(dt, 1e-4) * W.lapT, 0.5, dt);   // wetness change per lap (smoothed)
    if (x - W.fc.x >= 0.08 || W.t - W.fc.t >= 3) forecast(W);
    trackLaps(W, cars);   // (records only: pit laps + wetness per lap for the lap-based outlook)
  }

  // ---------- forecast (ensemble, posterior-weighted, radar-blended) ----------
  function forecast(W) {
    const fc = W.fc, x = W.x, QM = fc.QM, R = W.radar, ens = W.ens, T = W.truth;
    const Q = Math.max(4, Math.min(QM, Math.ceil((W.span + 1.5 - x) * QR) + 1));
    const ww = fc.ww;
    let sum = 0;
    for (let i = 0; i < N_ENS; i++) {
      let wi = 1;
      if (x <= 0.05) { const e = ens[i][0] - T[0]; wi = Math.exp(-(e * e) / 0.03) + 0.002; }   // start: the conditions now are known
      else {   // how well this member matched the real rain over the last 3 laps
        let E = 0, k = 0;
        for (let xp = Math.max(0, x - 3); xp <= x; xp += 0.25) { const e = gridAt(ens[i], xp) - gridAt(T, xp); E += e * e; k++; }
        wi = Math.exp(-(E / k) / 0.03) + 0.002;
      }
      ww[i] = wi; sum += wi;
    }
    fc.pR.fill(0, 0, Q); fc.eR.fill(0, 0, Q); fc.eW.fill(0, 0, Q); fc.F.fill(0);
    const dl = 1 / RES;
    for (let i = 0; i < N_ENS; i++) {
      const a = ens[i], wi = ww[i];
      let w = W.wet;
      for (let q = 0; q < Q; q++) {
        let mx = 0;
        for (let s = 0; s < SUB; s++) {
          const xp = x + (q * SUB + s + 0.5) * dl, lead = xp - x;
          const c = lead < R ? Math.pow(1 - lead / R, 1.5) : 0;
          const r = c > 0 ? lerp(gridAt(a, xp), gridAt(T, xp), c) : gridAt(a, xp);
          if (r > mx) mx = r;
          w = wetStep(w, r, dl, 1);
        }
        fc.mr[i * QM + q] = mx;
        if (mx > RAIN_T) { fc.pR[q] += wi; fc.eR[q] += wi * mx; }
        fc.eW[q] += wi * w;
        for (let c = 0; c < IDS.length; c++) fc.F[c * QM + q] += wi * ltf(c, w);
      }
    }
    for (let q = 0; q < Q; q++) {
      fc.eR[q] = fc.pR[q] > 0 ? fc.eR[q] / fc.pR[q] : 0; fc.pR[q] /= sum; fc.eW[q] /= sum;
      for (let c = 0; c < IDS.length; c++) fc.F[c * QM + q] /= sum;
    }
    for (let c = 0; c < IDS.length; c++) for (let q = Q; q < QM; q++) fc.F[c * QM + q] = fc.F[c * QM + Q - 1];
    fc.x = x; fc.t = W.t; fc.Q = Q; fc.sum = sum; fc.rev++;
  }

  // P(rain) and expected intensity over race-lap positions [x0, x1] (past = what really happened)
  const _pr = { p: 0, r: 0, w: 0 };
  function probRain(W, x0, x1, out = _pr) {
    if (!W || !W.dynamic) { out.p = W && W.rain > 0.05 ? 1 : 0; out.r = W ? W.rain : 0; out.w = W ? W.wet : 0; return out; }
    const fc = W.fc, QM = fc.QM;
    let pastR = 0;
    for (let xp = Math.max(0, x0); xp < Math.min(x1, fc.x); xp += 0.05) { const r = gridAt(W.truth, xp); if (r > pastR) pastR = r; }
    const qb = Math.min(fc.Q - 1, Math.ceil((x1 - fc.x) * QR) - 1), qa = Math.min(qb, Math.max(0, Math.floor((x0 - fc.x) * QR)));   // (beyond the horizon: persistence)
    let p = 0, er = 0;
    if (qb >= qa && x1 > fc.x) {
      for (let i = 0; i < N_ENS; i++) {
        let m = pastR;
        for (let q = qa; q <= qb; q++) { const v = fc.mr[i * QM + q]; if (v > m) m = v; }
        if (m > RAIN_T) { p += fc.ww[i]; er += fc.ww[i] * m; }
      }
      out.r = p > 0 ? er / p : 0; out.p = p / fc.sum;
      out.w = fc.eW[clamp(qb, 0, fc.Q - 1)];
    } else { out.p = pastR > RAIN_T ? 1 : 0; out.r = pastR; out.w = W.wet; }
    return out;
  }
  const kindOf = (p, r) => (p < 0.2 ? 'sun' : p < 0.45 ? 'partly' : r < 0.35 ? 'light' : r < 0.7 ? 'rain' : 'heavy');
  // current conditions, deterministic (the first box of every forecast): DRY / DAMP / LIGHT RAIN / HEAVY RAIN
  function now(W) {
    const r = W ? clamp(+W.rain || 0, 0, 1) : 0, w = W ? clamp(+W.wet || 0, 0, 1) : 0;
    const c = r >= 0.55 ? 3 : r >= RAIN_T ? 2 : w >= 0.1 ? 1 : 0;
    return { now: true, cond: ['dry', 'damp', 'light', 'heavy'][c], label: ['DRY', 'DAMP', 'LIGHT RAIN', 'HEAVY RAIN'][c], short: ['DRY', 'DAMP', 'LIGHT', 'HEAVY'][c],
      kind: c === 3 ? 'heavy' : c === 2 ? 'light' : c === 1 ? 'cloud' : 'sun', p: c >= 2 ? 1 : 0, r, w };   // (the 4 outlook icons)
  }
  // forecast windows across the race distance (pre-race strip): laps a..b (1-based), P(rain), intensity, icon kind.
  // The first window is the NOW box (current conditions; the scenario keeps them through that window).
  function windows(W, n = FC_N) {
    const laps = W && W.laps > 0 ? W.laps : W ? W.span : 10, size = Math.max(1, Math.ceil(laps / n)), out = [];
    for (let a = 1; a <= laps; a += size) {
      const b = Math.min(laps, a + size - 1);
      if (a === 1) { out.push(Object.assign(now(W), { a, b })); continue; }
      const pr = probRain(W, a - 1, b);
      out.push({ a, b, p: pr.p, r: pr.r, w: pr.w, kind: W.dynamic ? kindOf(pr.p, pr.r) : kindOf(W.rain > 0.05 ? 1 : 0, W.rain) });
    }
    return out;
  }
  // next `secs` seconds from now in n slots (in-race widget); lapT = current lap time
  function slots(W, secs = 600, n = 5, lapT) {
    const out = [], dx = secs / n / Math.max(20, lapT || W.lapT);
    for (let k = 0; k < n; k++) {
      const pr = probRain(W, W.x + k * dx, W.x + (k + 1) * dx);
      out.push({ t: (k + 1) * secs / n, p: pr.p, r: pr.r, w: pr.w, kind: kindOf(pr.p, pr.r) });
    }
    return out;
  }
  // first lap position ahead where the rain chance reaches p (null = none within `ahead` laps)
  function rainIn(W, p = 0.55, ahead = 6) {
    if (!W || !W.dynamic) return null;
    for (let k = 0; k < ahead * 2; k++) { const pr = probRain(W, W.x + k * 0.5, W.x + (k + 1) * 0.5); if (pr.p >= p) return k * 0.5; }
    return null;
  }
  // expected track wetness `ahead` laps from now
  function wetAhead(W, ahead) {
    if (!W || !W.dynamic) return W ? W.wet : 0;
    const fc = W.fc, q = clamp(Math.round((W.x + ahead - fc.x) * QR) - 1, 0, fc.Q - 1);
    return ahead <= 0 ? W.wet : fc.eW[q];
  }

  // ---------- lap-based outlook: the player's coming laps (in-race widget, pre-race strip, team radio) ----------
  // The weather clock x is the leader's race distance, so the player's lap k starts at
  //   x(k) = x_now + (k - 1 - player distance in laps) * ratio  (+ the rest of a pit stop in progress),
  // ratio = player / leader pace. Paces: dry-equivalent medians of recent clean laps (lap 1 = standing start, in- /
  // out-laps and spin laps skipped; each lap divided by the lap-time factor of its tyre at that lap's wetness); the
  // lap-time estimate is that times the factor for his tyre in the conditions now. Player = his own laps blended with
  // the AI field's median (his weight grows with his clean laps); before he has one: the field, then qualifying, then
  // the reference lap.
  // Per lap: P(rain during it) + expected intensity / wetness -> one of 4 icons; one headline sentence.
  const OL_N = 5;                                  // laps in the in-race strip (the current one + the next 4)
  const ICON = { dry: 'sun', damp: 'cloud', light: 'light', heavy: 'heavy' };
  const TYRE_N = { S: 'SLICKS', M: 'SLICKS', H: 'SLICKS', I: 'INTERS', W: 'WETS' };
  const lapF = (c, w) => { tables(); const i = IDS.indexOf(c); return ltf(i >= 0 ? i : 1, w); };
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // per car (index in G.cars): laps that touched the pit lane (it straddles the line: in- and out-lap), wetness and
  // tyre at the end of each lap. step() keeps it up to date; nothing here feeds back into the weather.
  function trackLaps(W, cars) {
    const T = W.lt || (W.lt = []);
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i], lt = c.lapTimes;
      let r = T[i];
      if (!r || r.car !== c || r.lt !== lt) r = T[i] = { car: c, lt, n: 0, w: [], cmp: [], pit: [] };   // (new race / after qualifying)
      if (c.inPitLane && c.lap > 0) r.pit[c.lap] = 1;
      if (lt) while (r.n < lt.length) { r.w.push(W.wet); r.cmp.push(c.tyre ? c.tyre.compound : 'M'); r.n++; }
    }
  }
  // dry-equivalent pace (s / lap on mediums, dry track) of one car: median of its last <= 3 clean laps; nAll = all
  // its clean laps so far
  function basePace(W, r, out) {
    out.t = 0; out.n = 0; out.nAll = 0;
    const lt = r && r.lt;
    if (!lt) return out;
    const v = [];
    for (let k = lt.length; k >= 2; k--) {   // lap k = lt[k - 1]
      const t = lt[k - 1];
      if (r.pit[k] || !(t > 15)) continue;
      out.nAll++;
      if (v.length >= 4) continue;
      const w1 = r.w[k - 1] != null ? r.w[k - 1] : W.wet, w0 = r.w[k - 2] != null ? r.w[k - 2] : w1;
      v.push(t / lapF(r.cmp[k - 1] || (r.car.tyre && r.car.tyre.compound), (w0 + w1) / 2));
    }
    if (!v.length) return out;
    const mn = Math.min(...v), ok = v.filter(x => x <= mn * 1.08).slice(0, 3);   // (a spin / big moment is not his pace)
    out.t = median(ok); out.n = ok.length;
    return out;
  }
  // lap-time estimate (s) for the player's coming laps in the conditions now + pace ratio player / leader on equal
  // (right) tyres (how fast the weather clock runs against his laps; a tyre mismatch only lasts until the next stop).
  // src: 'laps' (own laps, blended with the field: his weight n / (n + 0.5) grows with his clean laps) | 'field' | 'quali' | 'ref'
  function lapPace(W, G, out = {}) {
    const cars = (G && G.cars) || [], P = G && G.player, race = (G && G.race) || {};
    if (!W.lt) trackLaps(W, cars);
    const recs = W.lt, field = [], bp1 = { t: 0, n: 0 };
    let rp = null, rl = null, lead = null, dl = -Infinity;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i], r = recs[i];
      if (!c || c.dnf) continue;
      if (+c.raceDist > dl) { dl = +c.raceDist; lead = c; rl = r; }
      if (c === P) { rp = r; continue; }
      if (r && basePace(W, r, bp1).n) field.push(bp1.t);
    }
    const fieldT = median(field), q = race.quali && Array.isArray(race.quali.times) ? race.quali.times : null, qf = [];
    let qp = 0, ql = 0;
    if (q) for (const e of q) if (e && e.time > 15) { if (e.car === P) qp = e.time; else qf.push(e.time); if (e.car === lead) ql = e.time; }
    const qk = lapF(race.qualiCompound || 'S', W.w0 || 0), ref = race.lapTimeEst > 20 ? race.lapTimeEst : W.lapT;
    const fallback = qMine => (fieldT > 0 ? [fieldT, 'field'] : qMine > 0 || qf.length ? [(qMine || median(qf)) / qk, 'quali'] : [ref, 'ref']);
    const own = rp ? basePace(W, rp, { t: 0, n: 0, nAll: 0 }) : null;
    let bp, src;
    if (own && own.n) { const wp = own.nAll / (own.nAll + 0.5); bp = fieldT > 0 ? own.t * wp + fieldT * (1 - wp) : own.t; src = 'laps'; }
    else [bp, src] = fallback(qp);
    let bl = bp;
    if (lead && lead !== P) { const lp = rl ? basePace(W, rl, bp1) : null; bl = lp && lp.n ? lp.t : fallback(ql)[0]; }
    const cp = P && P.tyre ? P.tyre.compound : 'M', cl = lead && lead.tyre ? lead.tyre.compound : cp;
    out.lapT = bp * lapF(cp, W.wet); out.leadT = bl * lapF(cl, W.wet);
    out.ratio = clamp(bp / Math.max(1, bl), 0.8, 1.3);
    out.src = src; out.n = own ? own.n : 0; out.field = field.length; out.leadD = lead ? +lead.raceDist || 0 : 0; out.leadIsMe = !lead || lead === P;
    return out;
  }
  // Consecutive windows b[0] < b[1] < ... of the weather clock at the model's full resolution (1/RES lap; the
  // quarter-lap forecast bins are too coarse for a lap edge), from the same ensemble and weights as forecast(). Over
  // the radar range the radar "sees" the real outcome with weight c(lead) = (1 - lead / radar)^1.5: a mixture of
  // probabilities (not of intensities, which would turn a strong shower in a member into drizzle that never falls).
  // The radar part follows the real rain as the NOW box will show it (W.rain trails the timeline at <= RATE_T per
  // second; spl = seconds per lap of the weather clock, i.e. the leader's lap time).
  // -> cells[k] = { p: P(rain in window k), r: intensity given rain, w: expected wetness at its end };
  // returns P(rain anywhere in b[0]..b[n]).
  let _pm = new Float64Array(64), _em = new Float64Array(64), _tm = new Float64Array(64), _wt = new Float64Array(64), _cw = new Float64Array(64), _mh = new Float64Array(64);
  function windowsAt(W, b, cells, spl) {
    const fc = W.fc, T = W.truth, ww = fc.ww, x0 = W.x, R = W.radar, nW = b.length - 1, dl = 1 / RES;
    if (_pm.length < nW) { const n = nW * 2; _pm = new Float64Array(n); _em = new Float64Array(n); _tm = new Float64Array(n); _wt = new Float64Array(n); _cw = new Float64Array(n); _mh = new Float64Array(n); }
    _pm.fill(0, 0, nW); _em.fill(0, 0, nW);
    // max of a (piecewise-linear) timeline in each window: grid points inside + both ends
    const maxes = (a, out) => {
      let m = gridAt(a, b[0]), g = Math.floor(b[0] * RES) + 1;
      for (let k = 0; k < nW; k++) {
        const xe = b[k + 1];
        for (; g * dl < xe; g++) { const v = gridAt(a, g * dl); if (v > m) m = v; }
        const ve = gridAt(a, xe);
        out[k] = ve > m ? ve : m; m = ve;
      }
    };
    // the real rain as it will be seen + the track wetness it makes (the radar part)
    const kR = RATE_T * Math.max(20, spl || W.lapT) * (W.rate || 1);   // max change of the seen rain per lap of the clock
    let r = W.rain, w = W.wet, xp = x0, m = r;
    for (let j = 0; j < nW; j++) {
      const xe = b[j + 1];
      while (xp < xe - 1e-9) { const xn = Math.min(xp + dl, xe), h = xn - xp; r = U.approach(r, gridAt(T, xn), kR * h); w = wetStep(w, r, h, 1); if (r > m) m = r; xp = xn; }
      _tm[j] = m; _wt[j] = w; m = r;
    }
    for (let j = 0; j < nW; j++) { const lead = (b[j] + b[j + 1]) / 2 - x0; _cw[j] = lead <= 0 ? 1 : lead >= R ? 0 : Math.pow(1 - lead / R, 1.5); }
    let any = 0;
    for (let i = 0; i < N_ENS; i++) {
      const wi = ww[i];
      maxes(W.ens[i], _mh);
      let no = 1;
      for (let j = 0; j < nW; j++) {
        const mr = _mh[j] > RAIN_T, tr = _tm[j] > RAIN_T;
        if (mr) { _pm[j] += wi; _em[j] += wi * _mh[j]; }
        no *= 1 - (_cw[j] * (tr ? 1 : 0) + (1 - _cw[j]) * (mr ? 1 : 0));
      }
      any += wi * (1 - no);
    }
    for (let j = 0; j < nW; j++) {
      const c = cells[j] || (cells[j] = {}), cw = _cw[j], tr = _tm[j] > RAIN_T ? 1 : 0, pm = _pm[j] / fc.sum;
      const q = clamp(Math.round((b[j + 1] - fc.x) * QR) - 1, 0, fc.Q - 1);
      c.p = cw * tr + (1 - cw) * pm;
      c.r = c.p > 0 ? (cw * tr * _tm[j] + (1 - cw) * _em[j] / fc.sum) / c.p : 0;
      c.w = cw * _wt[j] + (1 - cw) * (b[j + 1] <= fc.x ? W.wet : fc.eW[q]);
    }
    return any / fc.sum;
  }
  // icon of a window: rain (light / heavy) when P(rain) >= 0.5, cloud = a chance of showers (>= 0.2) or a damp track,
  // else sun. prev = the icon this lap had last time: a band around each threshold stops flicker as the forecast firms up
  function kind4(c, prev, wide) {
    const was = prev === 'light' || prev === 'heavy', band = prev == null ? 0 : wide || 0.06;
    if (c.p >= 0.5 + (was ? -band : band)) return c.r >= (prev === 'heavy' ? 0.5 : prev === 'light' ? 0.6 : 0.55) ? 'heavy' : 'light';
    return c.p >= 0.2 + (prev === 'cloud' ? -band : band) || c.w >= (prev === 'cloud' ? 0.08 : prev ? 0.12 : 0.1) ? 'cloud' : 'sun';
  }
  function finishCell(c, prev, force) {
    c.kind = force || kind4(c, prev);
    const rain = c.kind === 'light' || c.kind === 'heavy', show = rain ? c.p <= 0.8 : c.kind === 'cloud' && c.p >= 0.15;
    c.cond = c.kind === 'sun' ? 'dry' : c.kind === 'cloud' ? (c.p >= 0.15 ? 'showers' : 'damp') : c.kind;
    c.pct = show ? clamp(Math.round(c.p * 10) * 10, rain ? 40 : 20, rain ? 80 : 50) : null;   // % only while uncertain
    return c;
  }
  // one window (tests / tools)
  const cellAt = (W, xa, xb) => { const c = {}; windowsAt(W, [xa, Math.max(xb, xa + 1e-3)], [c], W.lapT); return finishCell(c, null); };
  // one plain sentence from the per-lap cells (current lap K .. the flag); near = laps shown in the strip
  function headline(nw, cells, K, flag, near, pAll) {
    const find = f => { for (let i = 0; i < cells.length; i++) if (f(cells[i])) return cells[i]; return null; };
    const H = (key, main, lap, sub) => ({ key, lap: lap || null, main, sub: sub || '', text: sub ? main + ' (' + sub + ')' : main });
    const inN = k => (k === K + 1 ? 'NEXT LAP' : 'IN ' + (k - K) + ' LAPS');
    const toFlag = what => (flag ? what + ' TO THE FLAG' : what + ' SET TO CONTINUE');
    const wet = c => c.kind === 'light' || c.kind === 'heavy';
    if (nw.cond !== 'light' && nw.cond !== 'heavy') {
      const on = find(wet);
      if (on) {
        const what = on.kind === 'heavy' ? 'HEAVY RAIN' : 'RAIN';
        if (on.lap === K) return H('rain', what + ' EXPECTED THIS LAP', K);
        return on.lap - K < near ? H('rain', what + ' EXPECTED LAP ' + on.lap, on.lap, inN(on.lap)) : H('rain', what + ' LIKELY AROUND LAP ' + on.lap, on.lap, inN(on.lap));
      }
      const may = find(c => c.cond === 'showers');
      if (may) return H('maybe', may.lap === K ? 'RAIN POSSIBLE THIS LAP' : 'RAIN POSSIBLE FROM LAP ' + may.lap, may.lap);
      if (pAll >= 0.1 || !flag) return H('dry', 'NO RAIN EXPECTED');
      return H('flag', nw.cond === 'damp' ? 'NO MORE RAIN TO THE FLAG' : 'DRY TO THE FLAG');
    }
    if (nw.cond === 'light') {
      const hv = find(c => c.kind === 'heavy'), ez = find(c => !wet(c));
      if (hv && (!ez || hv.lap < ez.lap)) return hv.lap === K ? H('heavy', 'RAIN GETTING HEAVIER', K) : H('heavy', 'HEAVY RAIN FROM LAP ' + hv.lap, hv.lap);
      if (ez) return ez.lap === K ? H('ease', 'LIGHT RAIN, EASING THIS LAP', K) : H('ease', 'LIGHT RAIN NOW, EASING BY LAP ' + ez.lap, ez.lap);
      return H('wet', toFlag('LIGHT RAIN'));
    }
    const ez = find(c => c.kind !== 'heavy');
    if (ez) return H('ease', 'HEAVY RAIN NOW, ' + (wet(ez) ? 'EASING' : 'STOPPING') + (ez.lap === K ? ' THIS LAP' : ' BY LAP ' + ez.lap), ez.lap);
    return H('wet', toFlag('HEAVY RAIN'));
  }
  // The player's outlook. o = { n: laps in the strip (default 5), group: laps per window (pre-race strip -> .windows),
  //   call: the engineer's plan (Race.weatherCall) for the tyre hint }. -> { lap, final, laps, now, cells: [{lap, cur,
  //   final, p, r, w, kind, cond, pct}], head: {key, lap, main, sub, text}, track: {w, label, trend, text}, tyre, pace }
  function outlook(W, G, o = {}) {
    if (!W || !W.dynamic || !W.fc || !G) return null;
    const cars = G.cars || [], P = G.player, race = G.race || {}, L = G.track && G.track.length > 0 ? G.track.length : 1;
    trackLaps(W, cars);
    const flag = race.laps > 0 && race.laps < 999, laps = flag ? race.laps : 0, pc = o.pace || lapPace(W, G);   // (o.pace: tests)
    const nw = now(W), n = o.n != null ? o.n : OL_N;
    nw.icon = ICON[nw.cond];
    if (nw.cond === 'damp' && W.wet >= 0.45) { nw.short = 'WET'; nw.label = 'WET TRACK'; }   // (no rain falling, track still wet)
    const tr = W.trend || 0, tl = trackLabel(W.wet), up = tr > 0.03, dn = tr < -0.03 && tl !== 'DRY';
    const res = { lap: 1, final: flag ? laps : null, laps, now: nw, cells: [], head: null, tyre: null, pace: pc, done: false,
      track: { w: W.wet, label: tl, trend: up ? 1 : dn ? -1 : 0, best: TYRE_N[category(W.wet) || 'M'], ahead: null, aheadLap: null, cross: { I: CROSS.I, W: CROSS.W } } };
    // one plain line: how wet, which tyre is quickest there (live crossovers), where it is heading
    res.track.text = 'TRACK ' + tl + ' · BEST TYRE: ' + res.track.best + (up ? ' · GETTING WETTER' : dn ? ' · DRYING' : '');
    if (P && P.finished) { res.done = true; res.lap = res.final = P.lap || laps; res.head = { key: 'done', lap: null, main: 'CHEQUERED FLAG', sub: '', text: 'CHEQUERED FLAG' }; return res; }
    const dp = P && isFinite(P.raceDist) ? P.raceDist / L : W.x - (W.xAdd || 0), K = Math.max(1, P ? P.lap | 0 : Math.floor(dp) + 1), x0 = W.x;
    // Pit lane: his projected laps are frozen as they were at the lane entry, with the whole stop (loss + any penalty
    // served) added then, so the strip does not wander while the autopilot / service moves him in odd ways.
    let pr = { x0, dp, ratio: pc.ratio, ex: 0, leadX: pc.leadD / L };
    if (P && P.inPitLane && !P.finished) {
      if (!W.olp || W.olp.car !== P) W.olp = { car: P, x0, dp, ratio: pc.ratio, leadX: pc.leadD / L, ex: ((race.pitLossEst > 0 ? race.pitLossEst : 22) + (P.penalty || 0)) / Math.max(20, pc.leadT) };
      pr = W.olp;
    } else W.olp = null;
    // his last lap: where he is when the leader takes the flag (a lapped car finishes a lap early; a near-tie at the
    // line counts as the earlier flag, so no lap past it is shown)
    let F = K + 12;
    if (flag) F = clamp(race.leaderFinished ? K : Math.floor(pr.dp + Math.max(0, laps - pr.leadX - pr.ex) / pr.ratio - 0.1) + 1, K, laps);
    const xCap = flag ? laps + (W.xAdd || 0) : Infinity;   // (the clock stops when the leader finishes)
    const xAt = k => { const u = k - 1 - pr.dp; return Math.min(xCap, u > 0 ? Math.max(x0, pr.x0 + u * pr.ratio + pr.ex) : x0); };
    const kEnd = Math.min(F, K + 39), bnd = [], all = [], prev = W.olk || (W.olk = {}), next = {};
    for (let k = K; k <= kEnd + 1; k++) bnd.push(Math.max(xAt(k), bnd.length ? bnd[bnd.length - 1] : -Infinity));
    const pAll = windowsAt(W, bnd, all, pc.leadT);
    for (let i = 0; i < all.length; i++) {
      // a borderline change of a lap's icon shows once it has held for 2 s (on top of the threshold band in kind4);
      // a clear one (still different with a 3x wider band) at once
      const k = K + i, pv = prev[k], c = finishCell(all[i], pv && pv.k), kind = c.kind;
      if (pv && pv.k !== kind && kind4(c, pv.k, 0.18) === pv.k) {
        const ct = pv.c === kind ? pv.t : W.t;
        if (W.t - ct < 2) { finishCell(c, pv.k, pv.k); next[k] = { k: pv.k, c: kind, t: ct }; } else next[k] = { k: kind, c: kind, t: W.t };
      } else next[k] = { k: kind, c: kind, t: W.t };
      c.lap = k; c.cur = k === K; c.final = flag && k === F;
    }
    W.olk = next;
    res.lap = K; res.final = flag ? F : null; res.cells = all.slice(0, n);
    const ah = all[Math.min(2, all.length - 1)];   // expected wetness at the end of lap K + 2 (or the flag)
    if (ah) { res.track.ahead = clamp(ah.w, 0, 1); res.track.aheadLap = ah.lap; }
    res.head = headline(nw, all, K, flag, o.group > 0 ? Infinity : n, pAll);   // (pre-race: every lap is on show)
    if (o.group > 0) {   // pre-race strip: windows of `group` laps
      const wb = [];
      for (let a = K; a <= F; a += o.group) wb.push(xAt(a));
      wb.push(xAt(F + 1));
      res.windows = [];
      windowsAt(W, wb, res.windows, pc.leadT);
      res.windows.forEach((c, i) => { finishCell(c, null); c.a = K + i * o.group; c.b = Math.min(F, c.a + o.group - 1); c.final = flag && c.b === F; });
    }
    // tyre hint from the engineer's plan (Race.weatherCall): first lap on the tyres it calls for
    const call = o.call, pit = G.track && G.track.pit;
    if (call && call.c1 && call.gain > 0.01 && pit && P && P.tyre && !P.inPitLane && cat(call.c1) !== cat(P.tyre.compound)) {
      const e = pit.entryS + (Math.floor(((P.raceDist || 0) - pit.entryS) / L) + 1) * L;   // next pit entry (race distance)
      let from = Math.floor(e / L) + 2 + Math.max(0, call.j | 0);
      // the plan's stop lap can see-saw between two neighbours: a one-lap move shows once it has held for 3 s
      const h = W.olt;
      if (h && h.c === call.c1 && Math.abs(from - h.lap) === 1) { if (h.cand !== from) { h.cand = from; h.candT = W.t; } if (W.t - h.candT < 3) from = h.lap; }
      else if (h) h.cand = h.lap;
      if (!h || h.c !== call.c1 || h.lap !== from) W.olt = { c: call.c1, lap: from, cand: from, candT: W.t };
      // never contradict the strip: wetter tyres only with rain on show by that lap (or falling / a wet track now),
      // drier ones only if that lap looks dry; a mere chance of showers -> WATCH FOR RAIN
      const wetter = cat(call.c1) > cat(P.tyre.compound), upTo = all.filter(c => c.lap <= from + 1), fc = all.find(c => c.lap === from);
      const rainy = c => c.kind === 'light' || c.kind === 'heavy';
      const ok = wetter ? nw.p > 0 || W.wet >= CROSS.I || upTo.some(rainy) : !(fc && rainy(fc)) && !(nw.p > 0 && from === K + 1);
      if (!flag || from <= F) {
        if (ok) res.tyre = { c: call.c1, lap: from, now: !!call.pit, text: call.pit ? 'BOX THIS LAP FOR ' + TYRE_N[call.c1] : TYRE_N[call.c1] + ' LIKELY FROM ~LAP ' + from };
        else if (wetter && upTo.some(c => c.cond === 'showers')) res.tyre = { c: call.c1, lap: null, now: false, soft: true, text: 'WATCH FOR RAIN' };
      }
    } else if (o.call !== undefined) W.olt = null;   // (callers without the plan leave the hint state alone)
    return res;
  }

  // ---------- strategy helper ----------
  // Expected lap-time cost (in laps) of tyre plans from the car's next pit entry on:
  //   o = { u: laps until that entry, rem: laps left after it, cur, wear, wpl (wear/lap of the current set), slick: dry
  //         compound to use, pit: pit-stop loss in laps, bias: + = trusts wet tyres less (gambles on slicks), maxStops }
  // -> { pit: best plan changes tyres at this entry, c1 (compound), j (stop in j laps), gain (laps vs staying out) }
  const _pl = { pit: false, c1: null, j: -1, gain: 0, stay: 0, cost: 0 };
  const S0 = new Float64Array(16), S1 = [new Float64Array(16), new Float64Array(16), new Float64Array(16)];
  function lapCost(W, ci, x0, bias) {
    const fc = W.fc, QM = fc.QM, q0 = Math.round((x0 - fc.x) * QR);
    let s = 0;
    for (let q = q0; q < q0 + QR; q++) s += fc.F[ci * QM + clamp(q, 0, QM - 1)];
    const k = IDS[ci] === 'I' ? 1 : IDS[ci] === 'W' ? 1.5 : 0;
    return s / QR * (1 + bias * k);
  }
  function plan(W, o, out = _pl) {
    out.pit = false; out.c1 = null; out.j = -1; out.gain = 0;
    if (!W || !W.dynamic || !(o.rem > 0.3)) return out;
    const bias = o.bias || 0, xe = W.x + (o.u || 0), H = Math.min(14, Math.ceil(o.rem - 1e-6));
    const cands = [o.slick || 'M', 'I', 'W'], curCat = cat(o.cur);
    const wg = typeof Physics !== 'undefined' && Physics.wearGrip ? Physics.wearGrip : null, cliff = o.cliff != null ? o.cliff : 0.76;
    const ci0 = IDS.indexOf(o.cur) >= 0 ? IDS.indexOf(o.cur) : 1;
    S0[0] = 0; for (let c = 0; c < 3; c++) S1[c][0] = 0;
    for (let k = 0; k < H; k++) {
      const wt = k === H - 1 ? o.rem - (H - 1) : 1;
      let f0 = lapCost(W, ci0, xe + k, bias);
      if (wg && o.wear != null) f0 *= Math.pow(1 / Math.max(0.3, wg(Math.min(1, o.wear + (o.wpl || 0) * (k + (o.u || 0) + 0.5)), cliff)), GAMMA);
      S0[k + 1] = S0[k] + wt * f0;
      for (let c = 0; c < 3; c++) S1[c][k + 1] = S1[c][k] + wt * lapCost(W, IDS.indexOf(cands[c]), xe + k, bias);
    }
    const stay = S0[H], P = o.pit || 0.3, two = o.maxStops !== 1, guard = o.guard !== false;
    // on slicks the baseline is the better of staying out and a fresh-slick wear stop (Race calls those): worn slicks
    // alone must never make a switch to inters / wets look worth it on a track that stays dry
    let base = stay;
    if (curCat === 0) { const A = S1[0]; for (let j = 0; j < H; j++) base = Math.min(base, S0[j] + P + A[H] - A[j]); }
    let best = base, bc = null, bj = -1;
    for (let a = 0; a < 3; a++) {   // (same wet category = a fresh set of worn inters / wets; slick wear stops are Race's)
      if (cat(cands[a]) === curCat && curCat === 0) continue;
      const A = S1[a], ok0 = !guard || allowed(W, curCat, cat(cands[a]), bias);
      for (let j = ok0 ? 0 : 1; j < H; j++) {
        const pre = S0[j] + P;
        let c1 = pre + A[H] - A[j];
        if (c1 < best) { best = c1; bc = cands[a]; bj = j; }
        if (!two) continue;
        for (let b = 0; b < 3; b++) {
          if (b === a || cat(cands[b]) === cat(cands[a])) continue;
          const B = S1[b];
          for (let m = j + 1; m < H; m++) { const c2 = pre + A[m] - A[j] + P + B[H] - B[m]; if (c2 < best) { best = c2; bc = cands[a]; bj = j; } }
        }
      }
    }
    out.stay = stay; out.cost = best; out.c1 = bc; out.j = bj; out.gain = base - best;
    out.pit = bj === 0 && out.gain > (o.margin != null ? o.margin : 0.012);
    return out;
  }
  // strategists don't gamble on the forecast alone: wetter tyres only once it rains / the track is getting damp,
  // drier ones only when no rain is due in the next ~2.5 laps and the track is near that tyre's window
  function allowed(W, from, to, bias = 0) {
    if (to === from) return true;
    tables();
    // (wets: rain heavy enough to take the track to ~0.15 below their crossover, i.e. rain > 0.4 for a crossover of 0.73)
    if (to > from) return to === 2 ? eqW(W.rain) > CROSS.W - 0.15 || W.wet > CROSS.W - 0.25 : W.rain > 0.05 || W.wet > CROSS.I - 0.1;
    // (a threat that keeps hanging around must not keep cars on wet tyres on a bone-dry track: the drier the track,
    // the more rain chance it takes to stay on them; slicks: dryness measured over the inters' window + 0.1)
    const dry = to === 0 ? clamp((CROSS.I + 0.1 - W.wet) / (CROSS.I + 0.1), 0, 1) : clamp((CROSS.W - W.wet) / (CROSS.W - CROSS.I), 0, 1);
    if (W.rain >= 0.15 || probRain(W, W.x, W.x + 2.5, {}).p >= 0.4 + 0.4 * dry) return false;
    return to === 0 ? W.wet < CROSS.I + 0.1 + 2 * bias : W.wet < CROSS.W + 0.08 + 2 * bias;
  }
  // best tyre category right now for the next `laps` laps (no pit stops considered); slick = dry compound to name
  function bestNow(W, laps = 2, bias = 0, slick = 'M', u = 0) {
    if (!W || !W.dynamic) return category(W ? W.wet : 0) || slick;
    const now = cat(category(W.wet));
    let bestC = category(W.wet) || slick, bc = Infinity;
    for (const c of [slick, 'I', 'W']) {
      if (cat(c) !== now && !allowed(W, now, cat(c), bias)) continue;   // no gambling on the forecast alone
      const ci = IDS.indexOf(c);
      let s = 0; for (let k = 0; k < laps; k++) s += Math.min(1, laps - k) * lapCost(W, ci, W.x + u + k, bias);   // (fractional last lap)
      if (s < bc - 1e-9) { bc = s; bestC = c; }
    }
    return bestC;
  }
  // starting tyre: first lap on it + the best plan from the end of lap 1
  function startChoice(W, o) {
    if (!W || !W.dynamic) return category(W ? W.wet : 0) || o.slick || 'M';
    const now = cat(category(W.wet));
    let bestC = o.slick || 'M', bc = Infinity;
    const q = Object.assign({}, o, { u: 1, rem: Math.max(0, (o.laps || W.span) - 1), wear: 0, wpl: 0 });
    for (const c of [o.slick || 'M', 'I', 'W']) {
      if (cat(c) !== now && !allowed(W, now, cat(c), o.bias || 0)) continue;
      q.cur = c;
      const first = lapCost(W, IDS.indexOf(c), W.x, o.bias || 0);
      const p = plan(W, q, {});
      const cost = first + (q.rem > 0.3 ? p.cost : 0);
      if (cost < bc - 1e-9) { bc = cost; bestC = c; }
    }
    return bestC;
  }

  // ---------- labels / icons (pure strings for HUD + menus) ----------
  const rainLabel = r => (r < 0.05 ? 'DRY' : r < 0.35 ? 'LIGHT RAIN' : r < 0.7 ? 'RAIN' : 'HEAVY RAIN');
  const trackLabel = w => (w < 0.1 ? 'DRY' : w < 0.45 ? 'DAMP' : w < 0.8 ? 'WET' : 'SOAKED');
  const nowKind = W => now(W).kind;
  const CLOUD = (c, dx = 0, dy = 0) => `<path transform="translate(${dx} ${dy})" fill="${c}" d="M7 18.5h10.2a4.3 4.3 0 0 0 .5-8.6 5.6 5.6 0 0 0-10.8-.6A4.6 4.6 0 0 0 7 18.5z"/>`;
  const drops = (n, col) => { let s = ''; for (let i = 0; i < n; i++) { const x = 7.5 + i * (9 / Math.max(1, n - 1)); s += `<path d="M${x.toFixed(1)} 19.6l-1.2 3" stroke="${col}" stroke-width="1.7" stroke-linecap="round"/>`; } return s; };
  function iconSVG(kind, night) {
    const sun = night ? '<path fill="#cfd8ee" d="M14.5 3.2a7.2 7.2 0 1 0 6.3 10.6A6 6 0 0 1 14.5 3.2z"/>'
      : '<circle cx="12" cy="12" r="4.6" fill="#ffd12e"/><g stroke="#ffd12e" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M5.1 5.1l1.7 1.7M17.2 17.2l1.7 1.7M5.1 18.9l1.7-1.7M17.2 6.8l1.7-1.7"/></g>';
    let b;
    if (kind === 'sun') b = sun;
    else if (kind === 'partly') b = `<g transform="translate(4 -3) scale(.72)">${sun}</g>` + CLOUD('#d9dee6', -1, 1);
    else if (kind === 'cloud') b = CLOUD('#b9c2ce', 0, 1);
    else if (kind === 'light') b = CLOUD('#b9c2ce', 0, -2) + drops(2, '#5fb2ff');
    else if (kind === 'rain') b = CLOUD('#8f99a8', 0, -2) + drops(3, '#4aa3ff');
    else b = CLOUD('#6c7584', 0, -2) + drops(4, '#3b8cff') + '<path d="M13.2 11.2l-2.4 3.6h2.2l-1.4 3" stroke="#ffd12e" stroke-width="1.3" fill="none" stroke-linejoin="round"/>';
    return `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">${b}</svg>`;
  }
  // tyre-window strip (HUD widget + pre-race strip): track wetness 0..1 split at the live crossovers into SLICKS /
  // INTERS / WETS zones in the compound colours (quickest tyre's zone lit), a NOW marker at the wetness now, an arrow to
  // where it is heading (by the end of lap `aheadLap`), and the one-line summary. t = outlook().track
  function tyreWindowHTML(t) {
    const cr = t.cross || crossovers(), pc = x => (clamp(x, 0, 1) * 100).toFixed(1) + '%', col = c => (COMPOUNDS[c] && COMPOUNDS[c].color) || '#888';
    const z = (c, name, a, b) => `<i class="${t.best === name ? 'on' : ''}" style="width:${pc(b - a)}"><b>${b - a >= 0.12 ? name : ''}</b></i>`;
    // one continuous gradient: yellow -> green -> blue, each fade centred on the crossover (+-4 % wetness = the switch window)
    const B = 0.04, Y = '#ffe000', grad = `linear-gradient(90deg, ${Y} 0%, ${Y} ${pc(cr.I - B)}, ${col('I')} ${pc(cr.I + B)}, ${col('I')} ${pc(cr.W - B)}, ${col('W')} ${pc(cr.W + B)}, ${col('W')} 100%)`;
    const lbl = x => pc(clamp(x, 0.07, 0.93));
    const ah = t.ahead != null && Math.abs(t.ahead - t.w) >= 0.03 ? t.ahead : null;
    const arrow = ah == null ? '' : `<u class="${ah > t.w ? 'up' : 'dn'}" style="left:${pc(Math.min(t.w, ah))};width:${pc(Math.abs(ah - t.w))}"></u><s style="left:${pc(ah)}"></s>`;
    return `<div class="agp-wx-win"><div class="agp-wx-winl"><span style="left:${lbl(t.w)}">NOW</span></div>`
      + `<div class="agp-wx-winb" style="background:${grad}">${z('M', 'SLICKS', 0, cr.I)}${z('I', 'INTERS', cr.I, cr.W)}${z('W', 'WETS', cr.W, 1)}${arrow}<em style="left:${pc(t.w)}"></em></div>`
      + `<div class="agp-wx-winl">${ah == null ? '' : `<span class="is-g" style="left:${lbl(ah)}">BY L${t.aheadLap}</span>`}</div></div>`
      + `<div class="agp-wx-wint">${t.text}</div>`;
  }
  const crossovers = () => { tables(); return { I: CROSS.I, W: CROSS.W }; };

  return {
    MODES, LV, WHEN, create, bind, step, forecast, probRain, windows, slots, rainIn, wetAhead, plan, bestNow, startChoice,
    allowed, category, gripAt, crossovers: () => { tables(); return { I: CROSS.I, W: CROSS.W }; }, wetStep, eqW,
    rainLabel, trackLabel, nowKind, kindOf, iconSVG, cat, now, winSize, RAIN_T,
    outlook, lapPace, trackLaps, cellAt, tyreWindowHTML, lapFactor: lapF,
  };
})();

;
// ===== physics.js
// Apex GP — car physics: sim-lite planar "bicycle" model with downforce, load-sensitive tyres,
// combined slip (friction circle), wheelspin / lock-up, traction control + ABS assists, surfaces,
// walls, gears, 2026 active aero (Straight / Corner mode), battery Boost + Recharge, slipstream
// and tyre wear. Pure JS (runs in Node for headless simulation).

const createCar = (opts = {}) => {
  const teamIndex = opts.teamIndex != null ? opts.teamIndex : Math.max(0, TEAMS.indexOf(opts.team));
  const team = opts.team || TEAMS[teamIndex];
  const compound = opts.compound || 'M';
  return {
    id: opts.id | 0, teamIndex, team, isPlayer: !!opts.isPlayer,
    code: team.driver.code, name: team.driver.last,
    // kinematics
    x: 0, z: 0, h: 0, vx: 0, vz: 0, r: 0,
    speed: 0, vLong: 0, vLat: 0, aLong: 0, aLat: 0,
    // controls (applied)
    throttle: 0, brake: 0, steer: 0, steerAngle: 0,
    gear: 1, rpm: CFG.car.rpmIdle, shiftT: 1, wheelRot: 0, reverse: false,
    slide: 0, lockup: 0, wheelspin: 0, slipF: 0, slipR: 0, kbCap: 1, kbDir: 0,
    surface: SURF.TRACK, onKerb: false, offTrack: false,
    s: 0, d: 0, idx: -1,
    inPitLane: false, pitLimiter: false, kinematic: false,
    // 2026 systems
    aero: 'corner', aeroT: 0, inStraightZone: false,
    battery: CFG.energy.cap * CFG.energy.startCharge, batteryCap: CFG.energy.cap,
    boosting: false, harvesting: false,
    overtake: false, overtakeNext: false,
    tow: 0, dirty: 0,
    tyre: { compound, wear: 0, laps: 0 }, grip: COMPOUNDS[compound].grip,
    collision: 0,          // max impact speed (m/s) since main last cleared it
    stability: opts.isPlayer ? 0.82 : 1.0, // yaw-stability aid (AI 1.0; player 0.7)
    _revT: 0, _kerbPhase: 0,
  };
};

const Physics = (() => {
  const C = CFG.car;
  const SUB = 2;                       // substeps per step (120 Hz -> 240 Hz)
  const L = C.wheelbase, A = C.cgToFront, B = C.cgToRear;
  const W = C.mass * CFG.g;
  const FZF0 = W * B / L, FZR0 = W * A / L;
  const MF = C.mass * B / L, MR = C.mass * A / L;   // axle masses (for low-speed force clamp)
  const WHEEL_R = 0.36;
  const HALF_TRACK = 0.8;
  const clamp = U.clamp, smooth = U.smooth;
  const _p = { s: 0, d: 0, idx: 0 }, _p2 = { s: 0, d: 0, idx: 0 }, _cor = { min: 0, max: 0, pit: false };
  // keyboard assist (world.assists.kb = 'off' | 'normal' | 'strong'; only for keyboard-driven input, input.kb = true;
  // AI / gamepad input never sets it). slip = front slip target (× peak) while a steer key is held; unwind = less front
  // slip while the rear is past its peak; brkLat = share of each axle's lateral demand ABS keeps free while braking +
  // turning; thrLat = TC ramps a floored throttle in while the tyres are loaded sideways (lap-time neutral, calmer exits)
  const KB_ASSIST = {
    normal: { slip: 1.0, unwind: 0.5, brkLat: 0.8, thrLat: 0 },
    strong: { slip: 0.96, unwind: 1.0, brkLat: 0.9, thrLat: 0.3 },
  };

  // tyre out of its window: ws = COMPOUNDS[c].wetSlide at the track wetness (0 = in its window, 1 = slicks on a soaked
  // track; hy = ws x hydroplaning, grows with speed). Gains at ws / hy = 1 (TC / ABS limit spin / lock-up, never the loss):
  const WET = {
    latF: 0.12,          // front cornering grip (ws): understeer on turn-in
    tail: 0.22,          // sliding friction past the peak 0.8 -> 0.58 of peak (both axles; slides are harder to catch) ...
    tailF: 0.03,         // ... and 0.55 at the front (more lock doesn't help)
    span: 0.5,           // the tail drops sooner (full drop at 2.3x instead of 2.8x peak slip)
    trac: 0.3,           // rear traction capacity (ws): wheelspin starts earlier, drive eats more of the rear's side grip
    tcLat: 0.25,         // TC underestimates the rear side load (ws): 0.9 -> 0.68, the rear still steps out under power
    spinK: 0.35,         // spin builds faster past the traction limit
    spinLat: 0.3,        // extra rear side-grip loss while spinning (power oversteer)
    floorR: 0.4,         // spinning rear's lateral floor 0.45 -> 0.27 of capacity
    v0: 22, v1: 75,      // hydroplaning speed range (m/s): none below v0, full at v1
    hyF: 0.12, hyR: 0.06,// axle capacity at speed (hy): the front floats more
    hyB: 0.3,            // front braking capacity (hy)
    cpl: 0.35, cplH: 1,  // braking eats the front's cornering grip: ellipse 0.72 -> 1 by ws x cpl + hy x cplH ...
    floorF: 0.6,         // ... and the braked front's lateral floor 0.42 -> 0.17 (goes straight on)
    lock: 0.12,          // fronts lock earlier (ABS off): onset 1.18 -> 1.06 x braking capacity
    lockLat: 0.15,       // a locked front steers even less
  };
  // wetSlide curve: knots [[wetness, slide], ...] (rising wetness), smoothstep between knots, flat outside; missing = 0
  function wetSlide(comp, wet) {
    const a = comp && comp.wetSlide;
    if (!a) return 0;
    let i = 0;
    if (!(wet > a[0][0])) return a[0][1];
    while (i < a.length - 1 && wet >= a[i + 1][0]) i++;
    if (i === a.length - 1) return a[i][1];
    return a[i][1] + (a[i + 1][1] - a[i][1]) * smooth((wet - a[i][0]) / (a[i + 1][0] - a[i][0]));
  }
  const hydro = v => smooth((v - WET.v0) / (WET.v1 - WET.v0));

  // normalised lateral force vs slip angle: rises to 1 at the peak, then falls off by `drop` (0.2 dry) when sliding
  function latCurve(alpha, peak, drop, span) {
    const x = Math.abs(alpha) / peak;
    const f = x <= 1 ? Math.sin(x * Math.PI * 0.5) : 1 - drop * smooth((x - 1) / span);
    return alpha > 0 ? -f : f;
  }

  function wearGrip(w, cliff) {
    let g = 1 - CFG.tyre.fade * w;
    if (w > cliff) { const t = (w - cliff) / (1 - cliff); g -= CFG.tyre.cliffDrop * t * t; }
    return g;
  }

  // grip / drag of the two wheels of an axle at track coords (s, dAxle)
  const axle = { grip: 1, drag: 0, kerb: false, off: 0, lat: 1, stab: 1, wob: 0 };
  function axleSurface(track, s, dAxle) {
    const s1 = track.surface(s, dAxle - HALF_TRACK), s2 = track.surface(s, dAxle + HALF_TRACK);
    const p1 = CFG.surface[s1] || CFG.surface[0], p2 = CFG.surface[s2] || CFG.surface[0];
    axle.grip = (p1.grip + p2.grip) * 0.5;
    axle.drag = (p1.drag + p2.drag) * 0.5;
    axle.kerb = s1 === SURF.KERB || s2 === SURF.KERB;
    axle.off = (isOff(s1) ? 0.5 : 0) + (isOff(s2) ? 0.5 : 0);
    axle.latF = ((p1.latF || 1) + (p2.latF || 1)) * 0.5;   // extra sideways-grip factors by surface (front / rear axle)
    axle.latFhi = ((p1.latFhi || p1.latF || 1) + (p2.latFhi || p2.latF || 1)) * 0.5;   // front factor at high speed
    axle.latR = ((p1.latR || 1) + (p2.latR || 1)) * 0.5;
    axle.stab = Math.min(p1.stab || 1, p2.stab || 1);
    axle.wob = ((p1.wobble || 0) + (p2.wobble || 0)) * 0.5;
    return axle;
  }
  const isOff = sf => sf === SURF.GRASS || sf === SURF.GRAVEL || sf === SURF.RUNOFF || sf === SURF.WALL;

  // ---------- driving assists (human player only) ----------
  // assists.steer / assists.brake = 'off' | 'light' | 'strong' act on a human's input (input.kb present: main / net pins and
  // the test bots set it, AI / autopilot inputs never do) once per step, before the substeps. Both follow the reference speed
  // plan assistPlan() = CFG.setup.speeds for the car's own wings at its current tyre grip along track.raceLine, the same
  // plan the HUD braking guide and the on-track racing line (assists.line) use. See lineAction() for the line colours.
  // steering: w = share of the gap to the ideal input taken, cap = most the input moves, lam = line pull (m: the target
  // path eases from the car's own offset back to the line over ~lam), cs / csCap = counter-steer blend when the rear slides
  const AST = {
    light: { w: 0.3, cap: 0.18, lam: 90, cs: 0.4, csCap: 0.4 },
    strong: { w: 0.6, cap: 0.4, lam: 38, cs: 0.8, csCap: 0.85 },
  };
  // braking: target = plan speed × kv + dv (m/s) at each slowdown ahead, reached lead s early; comes on once that takes dec ×
  // the car's braking limit, pedal = k × the share still needed. Light only catches an overshoot (late, hard); Strong
  // brakes at the plan's own braking point.
  const ABR = {
    light: { kv: 1.02, dv: 1.5, dec: 0.95, lead: 0, k: 1.15 },
    strong: { kv: 1.0, dv: 0, dec: 0.86, lead: 0.05, k: 1.05 },
  };
  const LINE = { red: 1.5, ease: 4, cue: 0 };   // line colour margins (m/s, see lineAction)
  const _plans = typeof WeakMap === 'function' ? new WeakMap() : null, _lineK = typeof WeakMap === 'function' ? new WeakMap() : null;
  let _plan1 = null;
  // reference plan for car on track: { v: Float32Array speed (m/s) per track sample, grip, key } (cached per car; a new
  // plan when the wings change or the tyre grip moves by > 0.015: new tyres, wear, rain)
  function assistPlan(track, car) {
    if (!track || !track.N || !car) return null;
    let P = _plans ? _plans.get(car) : _plan1;
    const st = car.setup, grip = car.grip > 0 ? car.grip : 1, key = track.id + ':' + (st ? st.fw + '/' + st.rw : 'base');
    const ws = car.wetSlide || 0;   // (out of the tyre's window: only the braking cue's envelope depends on it, P.vb)
    if (P && P.vb && Math.abs((P.ws || 0) - ws) > 0.03) { P.ws = ws; P.vb = null; P.pa = null; }
    if (!P || P.T !== track || P.key !== key || Math.abs(P.grip - grip) > 0.015) {
      let v = null;
      try { if (CFG.setup && CFG.setup.speeds) v = CFG.setup.speeds(track, st || CFG.setup.aero({}), grip); } catch (e) { v = null; }
      if (!v || v.length !== track.N) v = track.raceSpeed;
      P = { T: track, key, grip, clK: st ? st.clK : 1, a: st || null, ws, v, pa: null, mask: null, vb: null, rev: P ? P.rev + 1 : 1 };
      if (_plans) _plans.set(car, P); else _plan1 = P;
    }
    return P;
  }
  // signed curvature (1/m, + = turning left / h increasing) of the racing line per sample, cached per track
  function lineK(track) {
    let k = _lineK && _lineK.get(track);
    if (k) return k;
    const N = track.N, qx = new Float64Array(N), qz = new Float64Array(N), k0 = new Float64Array(N);
    for (let i = 0; i < N; i++) { const d = track.raceLine[i]; qx[i] = track.px[i] + d * track.nx[i]; qz[i] = track.pz[i] + d * track.nz[i]; }
    for (let i = 0; i < N; i++) {
      const a = (i - 2 + N) % N, b = (i + 2) % N, c = (i + 4) % N, e = (i - 4 + N) % N;
      const h1 = Math.atan2(qz[i] - qz[e], qx[i] - qx[e]), h2 = Math.atan2(qz[c] - qz[i], qx[c] - qx[i]);
      k0[i] = U.wrapAngle(h2 - h1) / Math.max(1e-3, Math.hypot(qx[b] - qx[a], qz[b] - qz[a]));   // (chord midpoints i±2)
    }
    k = new Float32Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = -2; j <= 2; j++) s += k0[(i + j + N) % N]; k[i] = s / 5; }
    if (_lineK) _lineK.set(track, k);
    return k;
  }
  // plan extras (lazy): pa[i] = the plan's own action there (2 brake, 1 at the cornering limit / lift, 0 accelerate) and
  // mask[i] 0..1 = "corners only" visibility (braking point .. exit, faded ends)
  function planInfo(P) {
    if (P.pa) return P;
    const T = P.T, N = T.N, st = T.step, v = P.v, k = lineK(T);
    const pa = new Uint8Array(N), mask = new Float32Array(N), k10 = Math.max(1, Math.round(10 / st));
    const lat = vv => CFG.perf.latAccel(vv, P.grip, P.clK) * 0.93;
    const raw = new Uint8Array(N), k5 = Math.max(1, k10 >> 1);
    for (let i = 0; i < N; i++) {   // (acceleration over 10 m centred on i: the plan's little ripples at an apex don't count)
      const a = v[(i - k5 + N) % N], b = v[(i + k5) % N], acc = (b * b - a * a) / (2 * 2 * k5 * st), u = v[i] * v[i] * Math.abs(k[i]) / Math.max(1, lat(v[i]));
      raw[i] = acc < -1.5 ? 2 : u > 0.85 && acc < 1.5 ? 1 : 0;
    }
    for (let i = 0; i < N; i++) {   // majority over ±4 samples: no single-sample colour flecks
      const c = [0, 0, 0];
      for (let j = -4; j <= 4; j++) c[raw[(i + j + N) % N]]++;
      pa[i] = c[2] >= c[1] && c[2] >= c[0] ? 2 : c[1] >= c[0] ? 1 : 0;
    }
    // corners: each braking / lifting run (plan slowing by >= 3 m/s) from its start to the exit (half the speed back, or
    // 150 m past the slowest point), 15 m fade in / 20 m fade out
    const dec = i => v[i] - v[(i + k10) % N] > 0.6;
    let i0 = 0; while (i0 < N && dec(i0)) i0++;
    const fin = Math.round(15 / st), fout = Math.round(20 / st);
    const mark = (a, b) => {   // a..b (b may be > N)
      for (let n = a - fin; n <= b + fout; n++) {
        const w = n < a ? (n - (a - fin)) / fin : n > b ? ((b + fout) - n) / fout : 1, i = ((n % N) + N) % N;
        if (w > mask[i]) mask[i] = w;
      }
    };
    for (let n = 0; n < N; n++) {
      const b = i0 + n;
      if (!dec(b % N) || dec((b - 1 + N) % N)) continue;   // start of a run
      let e = b; while (e < b + N && dec((e + 1) % N)) e++;
      let m = e; while (m < e + N && v[(m + 1) % N] <= v[m % N] + 0.02) m++;
      const drop = v[b % N] - v[m % N];
      if (drop < 3) continue;
      let x = m; const back = v[m % N] + 0.5 * drop;
      while (x < m + Math.round(150 / st) && v[x % N] < back) x++;
      mark(b, x);
    }
    P.pa = pa; P.mask = mask;
    P.vb = brakeEnv(P);
    return P;
  }
  // Braking cue (HUD) + the racing line's red, calibrated on the physics with tools/brake_cue_test.mjs (latest key press
  // by bisection, 7 circuits, dry / damp / rain / wet / worn / wings / Straight mode). K = share of CFG.setup.brakeDecel
  // flat-out braking with ABS reaches (the plan's wings + tyre grip: wet, wear); braking while cornering at r = the line's
  // lateral demand / (lat x the cornering limit): braking share sqrt((1 - r²) / cE) (+ cpl of the physics' wet coupling);
  // latCap x the cornering limit caps the envelope off the corner points; u = points at >= u of the cornering limit are the
  // plan's corner speeds to make (it corners at 0.93). Fast sweepers (latV m/s, cornering >= latNow, latPlan m/s into the
  // plan's braking zone): the line within latLook s must stay <= latT of the limit, braking share latBrk (latW less per
  // unit of slide). ramp = s lost to the keyboard brake ramp (0 -> 1 in 0.1 s) + a reaction allowance, margin (m, +
  // marginW x the tyre's slide out of its window), aero = s more per unit of open Straight mode (it closes on braking,
  // 0.25 s). lead = s the BRAKE cue builds up over; a corner that coasting (drag + rolling) makes within liftT s of lifting
  // is a LIFT (cue liftLead s before its point); drops under minDrop m/s get no cue.
  const CUE = { K: 1.02, lat: 1.2, cE: 0.5, cpl: 0.5, latCap: 1.15, latT: 0.7, latV: 80, latLook: 2.0, latNow: 0.45, latPlan: 10, latBrk: 0.55, latW: 0.3, u: 0.88, ramp: 0.09, margin: 4, marginW: 6, aero: 0.12, lead: 1.5, liftT: 1.1, liftLead: 0.7, minDrop: 2.5 };
  // latest-braking envelope (planInfo, P.vb): the fastest the car may be at each sample when the brake key goes down there
  // and still, braking flat out (CUE), be no faster than the plan's speed at every point ahead where the plan is at its
  // cornering limit. Faster than vb = past the braking point: the line turns red there and the HUD cue says BRAKE.
  function brakeEnv(P) {
    const T = P.T, N = T.N, v = P.v, a = P.a || CFG.setup.aero({}), g = P.grip, st = T.step, ws = P.ws || 0;
    const Lp = CFG.setup._lap && CFG.setup._lap.get(T), ok = x => x && x.length === N;
    const ds = Lp && ok(Lp.ds) ? Lp.ds : null, kl = Lp && ok(Lp.k) ? Lp.k : lineK(T), gr = Lp ? Lp.gr : null;
    // tyre out of its window (P.ws, Physics WET): hydroplaning costs braking (front hyF + hyB, rear hyR; ~60 / 40 under
    // braking) and cornering, the slide costs front cornering, braking eats more of the cornering grip (cpl)
    const hyF = u => ws * hydro(u), brkW = u => { const h = hyF(u); return 0.6 * (1 - WET.hyF * h) * (1 - WET.hyB * h) + 0.4 * (1 - WET.hyR * h); };
    const lat = u => CFG.perf.latAccel(u, g, a.clK) * (1 - 0.5 * WET.latF * ws) * (1 - 0.5 * (WET.hyF + WET.hyR) * hyF(u)), rr = C.rollingResist * CFG.g;
    const cE = u => CUE.cE + (1 - CUE.cE) * CUE.cpl * Math.min(1, WET.cpl * ws + WET.cplH * hyF(u));
    const dragA = u => 0.5 * CFG.rho * C.cdA * a.cdK * u * u / C.mass + rr;
    const vb = new Float32Array(N), cap = new Float32Array(N);
    let i0 = 0;
    for (let i = 0; i < N; i++) {
      const k = Math.abs(kl[i]);
      if (v[i] * v[i] * k >= CUE.u * lat(v[i])) cap[i] = v[i];   // a corner speed to make
      else {   // else no faster than the car can corner there at all (CUE.latCap x the cornering limit on the line's curvature)
        let lo = v[i], hi = 120;
        if (hi * hi * k <= lat(hi) * CUE.latCap) lo = hi;
        else for (let it = 0; it < 22; it++) { const m = 0.5 * (lo + hi); if (m * m * k <= lat(m) * CUE.latCap) lo = m; else hi = m; }
        cap[i] = Math.max(v[i], lo);
      }
      if (v[i] < v[i0]) i0 = i;
    }
    vb[i0] = v[i0];
    for (let n = 0; n < N; n++) {   // backwards from the slowest point: flat-out braking into each corner speed
      const j = (i0 - n + N) % N, i = (j - 1 + N) % N, w = vb[j], dA = dragA(w);
      const r = Math.min(1, w * w * Math.abs(kl[j]) / Math.max(1e-6, lat(w) * CUE.lat));
      let ax = Math.max(0, CFG.setup.brakeDecel(w, a, g) * CUE.K - dA) * brkW(w) * Math.min(1, Math.sqrt((1 - r * r) / cE(w))) + dA;
      if (gr) ax = Math.max(0.2, ax + CFG.g * 0.5 * (gr[i] + gr[j]));
      vb[i] = Math.min(cap[i], Math.sqrt(w * w + 2 * ax * (ds ? ds[i] : st)));
    }
    // key-press envelope: at speed w the key must go down CUE.ramp s (+ margin) before the braking itself starts
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let w = vb[i];
      for (let it = 0; it < 3; it++) { const k = (i + Math.round((w * CUE.ramp + CUE.margin + CUE.marginW * ws) / st)) % N; w = Math.min(vb[i], vb[k]); }
      out[i] = w;
    }
    return out;
  }
  // HUD braking cue for car: out = { state: 0 none | 1 lift | 2 approaching a braking point | 3 brake now, dist (m to the
  // key press: brake / lift point), lead (0..1, builds over CUE.lead s), vT (m/s: the corner's plan speed), gear (for vT),
  // late (past the point: even flat out the car won't be down to the plan speed), braking (already on the brakes) }
  const _cue = {};
  function brakeCue(track, car, out) {
    out = out || _cue;
    out.state = 0; out.dist = Infinity; out.lead = 0; out.vT = 0; out.gear = 0; out.late = false; out.braking = false;
    const P = track && track.N && car ? planInfo(assistPlan(track, car)) : null, v = car ? car.speed || 0 : 0;
    if (!P || v < 12 || car.reverse) return out;
    const T = track, N = T.N, vb = P.vb, vp = P.v, st = T.step, i0 = car.idx >= 0 ? car.idx : T.idxAt(car.s);
    const x0 = T.deltaS(car.s, i0 * st), dMax = Math.min(900, v * v / 25 + 160), kMax = Math.ceil(dMax / st);
    const aeroX = (car.aeroT || 0) * CUE.aero * v;   // (open Straight mode: less grip until it has closed)
    // braking point: where the key-press envelope drops below the car's speed (interpolated between samples)
    let xB = null, jB = -1, pw = vb[i0], px = x0;
    if (pw < v) { xB = 0; jB = i0; }
    else for (let n = 1; n <= kMax; n++) {
      const j = (i0 + n) % N, x = x0 + n * st, w = vb[j];
      if (w < v) { xB = px + (pw - v) / Math.max(1e-6, pw - w) * (x - px); jB = j; break; }
      pw = w; px = x;
    }
    // flat out through a fast sweeper (above CUE.latV m/s, already cornering at >= CUE.latNow of the limit and well into the
    // plan's own braking zone, CUE.latPlan m/s over its speed: braking there has
    // to share the tyres with cornering all the way and the car runs wide): the line just ahead (CUE.latLook s) asks for
    // more than CUE.latT of the cornering limit at the car's speed -> brake for that point (braking share CUE.latBrk)
    const Lp = CFG.setup._lap && CFG.setup._lap.get(T), kl = Lp && Lp.k && Lp.k.length === N ? Lp.k : null;
    const latV = CFG.perf.latAccel(v, P.grip, P.clK) * (1 - 0.5 * WET.latF * (P.ws || 0));
    if (kl && v > CUE.latV && v * v * Math.abs(kl[i0]) >= CUE.latNow * latV && vp[i0] < v - CUE.latPlan) {   // (already in the plan's braking zone)
      const lt = latV * CUE.latT * (1 - CUE.latW * (P.ws || 0)), nL = Math.ceil(v * CUE.latLook / st), bd = CFG.perf.brakeDecel(v, P.grip) * CUE.K * CUE.latBrk * (1 - CUE.latW * (P.ws || 0));
      for (let n = 0; n <= nL; n++) {   // (every point of the sweeper ahead: it keeps tightening)
        const j = (i0 + n) % N, k = Math.abs(kl[j]);
        if (v * v * k <= lt) continue;
        const va = Math.sqrt(lt / k), x = x0 + n * st - (v * v - va * va) / (2 * bd) - v * CUE.ramp - CUE.margin;
        if (xB == null || x < xB) { xB = Math.max(0, x); jB = j; }
      }
    }
    if (xB == null) return out;
    // the corner behind it: its first cornering-limited point (the speed to make) and the slowest plan speed of the corner
    let vS = null, xS = 0, vT = Infinity, xT = xB;
    for (let n = 0, j = jB; n <= kMax; n++, j = (j + 1) % N) {
      const x = xB + n * st;
      if (vp[j] < vT) { vT = vp[j]; xT = x; }
      if (vS == null && vb[j] >= vp[j] - 0.05 && vp[j] < v) { vS = vp[j]; xS = x; }   // (envelope meets the plan: a corner speed)
      if (vS != null && vp[j] > vT + 3) break;
    }
    if (vS == null) { vS = vT; xS = xB + 60; }
    if (!(vT < v - CUE.minDrop) && !(xB <= 0)) return out;   // (a breath of throttle, no cue)
    out.vT = vT;
    const kmh = vT * 3.6, top = C.gearTop, lo = (C.rpmShiftUp - 1700) / C.rpmMax;   // the gear the car will be in (gearbox)
    let g = 1; while (g < 8 && kmh >= top[g] * lo) g++;
    out.gear = g;
    const xRed = xB - aeroX, vHere = vb[i0] + (vb[(i0 + 1) % N] - vb[i0]) * U.clamp(x0 / st, 0, 1);
    out.braking = (car.brake || 0) > 0.25;
    // a lift: coasting from the lift point (drag + rolling) makes the corner's speeds (its first one and its slowest)
    // within CUE.liftT s
    const a = P.a || CFG.setup.aero({}), coast = u => { const vm = 0.5 * (v + u); return Math.max(0, (v * v - u * u) / (2 * (0.5 * CFG.rho * C.cdA * a.cdK * vm * vm / C.mass + C.rollingResist * CFG.g))); };
    const dLift = Math.max(coast(vS), coast(vT));
    if (xRed > 0 && dLift <= CUE.liftT * v) {
      const xL = Math.min(xS - coast(vS), xT - coast(vT));
      out.dist = Math.max(0, xL);
      if (xL <= CUE.liftLead * v) { out.state = 1; out.lead = U.clamp(1 - xL / (CUE.liftLead * v), 0, 1); }
      return out;
    }
    out.dist = Math.max(0, xRed);
    if (xRed <= 0) { out.state = 3; out.lead = 1; out.late = v > vHere + 1.5; }
    else if (xRed <= CUE.lead * v) { out.state = 2; out.lead = U.clamp(1 - xRed / (CUE.lead * v), 0, 1); }
    return out;
  }
  // colour of the racing line at a point with plan speed vp, for the car at speed v (vHere = plan speed at the car,
  // pa = the plan's action there): 2 red = brake (faster than the plan there, and the plan slows down before it),
  // 1 yellow = ease / lift (about at the plan speed where the plan is at the limit or braking), 0 green = accelerate.
  // vb (the latest-braking envelope there, P.vb): red only past the true braking point for the car's speed (where the
  // HUD cue says BRAKE); the rest of the plan's braking zone ahead is yellow
  function lineAction(v, vp, vHere, pa, vb) {
    const dv = v - vp;
    if (vb != null) {
      if (v > vb + LINE.cue && vp < vHere - 1) return 2;
      return dv > -LINE.ease && pa ? 1 : 0;
    }
    if (dv > LINE.red && vp < vHere - 1) return 2;
    if (dv > -LINE.ease) return pa;
    return pa === 2 ? 1 : 0;
  }
  const _ain = {}, _aw = {}, _asm = {}, _asm2 = {};
  // steering + braking assist: returns the input physics drives with (a copy; the caller's object is untouched).
  // car._asS = steer input added, car._asB = brake the assist asks for, car._asLim = the assist supplies the brake
  function driveAssist(car, input, dt, world, as) {
    const S = AST[as.steer], B = ABR[as.brake], track = world.track;
    const out = Object.assign(_ain, input);
    car._asS = 0; car._asLim = false;
    const speed = car.speed, v = Math.max(speed, 1);
    const pit = track.pit, inPit = car.inPitLane || car.pitLimiter || (pit && track.inPitArea && track.inPitArea(car.s, car.d));
    const smp = track.sample(car.s, _asm), rel = U.wrapAngle(car.h - Math.atan2(smp.tz, smp.tx));
    if (input.hold || car.reverse || inPit || speed < 6 || Math.cos(rel) < 0.2) { car._asB = 0; car._asOn = false; return out; }
    // near the pit entry / exit on the pit side of the line: the player is heading for (or leaving) the lane, no line pull
    let pitF = 0;
    if (pit) {
      const L = track.length, uE = track.wrapS(car.s - pit.entryS), uX = track.wrapS(pit.exitS - car.s);
      const near = (uE < (pit.blendIn || 130) + 20 || uE > L - 160) || uX < (pit.blendOut || 130) + 40 || uX > L - 20;
      if (near && pit.side * (car.d - smp.raceLine) > 1.2) pitF = 1;
    }
    if (S) {
      const p = clamp(input.steer || 0, -1, 1);
      const stp = car.setup, clK = stp ? stp.clK : 1;
      let sm = CFG.perf.steerLock(car.vLong);
      if (speed > 8) sm = Math.min(sm, L * CFG.perf.latAccel(speed, car.grip, clK) * CFG.perf.latLow(speed) * 1.12 / (speed * speed) + C.peakSlip * 0.95);
      let o = p;
      if (!pitF) {
        // ideal input: pure pursuit on a path easing from the car's own offset back to the racing line + the line's curvature.
        // It only works through the corners (braking zones .. exits, bends tighter than ~R 650 m): on a straight the car is
        // the player's alone (lane changes, overtakes).
        const e0 = car.d - smp.raceLine, look = clamp(v * 0.42, 9, 42), sT = car.s + look;
        const kl = lineK(track), i1 = track.idxAt(car.s), i2 = track.idxAt(sT), mk = planInfo(assistPlan(track, car)).mask;
        let kc = 0; for (let n = 0, nn = i2 >= i1 ? i2 - i1 : i2 + track.N - i1; n <= nn; n += 2) kc = Math.max(kc, Math.abs(kl[(i1 + n) % track.N]));
        const cw = Math.max(mk[i1], mk[i2], smooth((kc - 0.0015) / 0.003));
        const s2 = track.sample(sT, _asm2), hw = Math.max(0.5, s2.halfW - 1.2);
        const dT = clamp(s2.raceLine + e0 * Math.exp(-look / S.lam), -hw, hw);
        const P = track.toWorld(sT, dT, _aw);
        const fx = car.x + Math.cos(car.h) * 1.2, fz = car.z + Math.sin(car.h) * 1.2, dx = P.x - fx, dz = P.z - fz;
        const ang = U.wrapAngle(Math.atan2(dz, dx) - car.h);
        const kFF = kl[track.idxAt(car.s + v * 0.2)];
        const kap = 0.65 * 2 * Math.sin(ang) / Math.max(Math.hypot(dx, dz), 1) + 0.35 * kFF;
        // + the slip angle the car needs for that cornering load: understeer gradient Ku (rad per m/s²) learnt from the
        // steering it is using now vs its yaw rate (fast corners want far more than the geometric angle)
        const vl = Math.max(car.vLong, 3), aLat = car.r * vl;
        if (car._asKu == null) car._asKu = 2e-4;
        if (Math.abs(aLat) > 4 && speed > 15 && (car.slipR || 0) < 1) {
          const ku = clamp((car.steerAngle - Math.atan(L * car.r / vl)) / aLat, 0, 1.5e-3);
          car._asKu += (ku - car._asKu) * Math.min(1, dt * 1.5);
        }
        const ideal = car._asI = clamp((Math.atan(kap * L) + car._asKu * v * v * kap) / sm - 0.04 * car.r, -1, 1);
        // the player always wins: the pull is capped, and fades when steering the other way (dodging, a chosen line)
        let w = S.w * cw * smooth((speed - 6) / 8);
        if (p * ideal < 0) w *= 1 - smooth((Math.abs(p) - 0.15) / 0.35);
        o = p + clamp((ideal - p) * w, -S.cap, S.cap);
      }
      // counter-steer: the rear is past its peak and the front axle travels to the outside of the yaw -> steer into it
      const thF = Math.atan2(car.vLat + A * car.r, Math.max(car.vLong, 1));
      const os = smooth(((car.slipR || 0) - 1.0) / 0.5) * smooth(((car.slipR || 0) - (car.slipF || 0) + 0.1) / 0.4) * smooth((speed - 8) / 6);
      if (os > 0 && thF * car.r < 0 && Math.abs(car.r) > 0.1) {
        const cs = clamp(thF / CFG.perf.steerLock(car.vLong), -1, 1);
        o += clamp((cs - o) * os * S.cs, -S.csCap, S.csCap);
      }
      out.steer = clamp(o, -1, 1);
      car._asS = out.steer - p;
    }
    if (B && !pitF && speed > 12) {
      const T = track, P = assistPlan(T, car), vv = P.v, N = T.N, st = T.step;
      const i0 = car.idx >= 0 ? car.idx : T.idxAt(car.s), lead = v * B.lead;
      // the plan's highest speed from 30 m behind the car on: a point counts only if the plan slows down before it (a
      // car faster than the plan on a straight - tow, boost - is never braked)
      let top = 0; for (let n = Math.round(30 / st); n >= 0; n -= 2) top = Math.max(top, vv[(i0 - n + N) % N]);
      const aMin = CFG.perf.brakeDecel(20, car.grip) * 0.8, dMax = Math.min(450, v * v / (2 * aMin) + lead + 20);
      const mk = planInfo(P).mask, nNear = Math.round(Math.max(20, v * 0.8) / st);
      let need = 0, vNear = mk[i0] > 0.5 ? vv[i0] * B.kv + B.dv : Infinity;   // vNear: slowest target just ahead in a corner
      for (let n = 1, nMax = Math.round(dMax / st); n <= nMax; n++) {
        const j = (i0 + n) % N, vp = vv[j], vt = vp * B.kv + B.dv;
        if (n <= nNear && mk[j] > 0.5 && vt < vNear) vNear = vt;
        if (vp > top) top = vp;
        if (vp > top - 1.5 || vt >= v) continue;
        // deceleration (m/s²) it takes to be at the target speed there (no sharper than over a quarter second: the last few
        // metres into the apex are the throttle limit's job)
        const a = (v * v - vt * vt) / (2 * Math.max(1.5, n * st - lead, n * st * 0.6, v * 0.25));
        if (a > need) need = a;
      }
      // mid-corner (the plan's corner zones only, never on a straight): no more throttle than holds the target speed
      if (v > vNear - 0.5) out.throttle = Math.min(out.throttle || 0, clamp(1 - (v - vNear + 0.5) / 2, 0, 1));
      // on at dec × the car's braking limit (Strong: the plan's own braking point; Light: the last moment), then the pedal
      // tracks the deceleration still needed (eases off into the corner), off once little is needed
      const aMax = CFG.perf.brakeDecel(v, car.grip), aD = (CFG.perf.drag(v) + C.rollingResist * W) / C.mass;
      if (need >= aMax * B.dec) car._asOn = true;
      else if (need < aD + 0.15 * (aMax - aD)) car._asOn = false;
      let b = car._asOn ? clamp((need - aD) / Math.max(1, aMax - aD) * B.k, 0, 1) : 0;
      // release smoothly (never mid lock-up while still braking for the corner)
      const prev = car._asB || 0;
      if (b < prev) b = Math.max(b, prev - (car.lockup > 0.1 && car._asOn ? 0 : 10 * dt));
      car._asB = b;
      if (b > (input.brake || 0)) {
        out.brake = b; car._asLim = true;
        out.throttle = (out.throttle || 0) * (1 - smooth((b - 0.04) / 0.16));
      }
    } else { car._asB = 0; car._asOn = false; }
    return out;
  }

  function step(car, input, dt, world) {
    if (car.kinematic) return;
    const as = car.isPlayer && input && input.kb != null ? car.assists || world.assists : null;
    if (as && (AST[as.steer] || ABR[as.brake])) input = driveAssist(car, input, dt, world, as);
    else if (car._asB || car._asLim || car._asS) { car._asB = 0; car._asLim = false; car._asS = 0; }
    const h = dt / SUB;
    for (let i = 0; i < SUB; i++) substep(car, input, h, world, i === 0);
    // cosmetic smoothing of slide indicators once per step
  }

  function substep(car, inp, dt, world, first) {
    const track = world.track;
    const assists = car.assists || world.assists || {};   // per-car override (AI cars always run TC + ABS)
    const E = CFG.energy;

    // --- track relation
    const p = track.project(car.x, car.z, car.idx, _p);
    car.s = p.s; car.d = p.d; car.idx = p.idx;
    const ti = p.idx, ttx = track.tx[ti], ttz = track.tz[ti];

    const ch = Math.cos(car.h), sh = Math.sin(car.h);
    const speed = Math.hypot(car.vx, car.vz);
    const vLong = car.vx * ch + car.vz * sh;
    const vLat = -car.vx * sh + car.vz * ch;
    const cosRel = ch * ttx + sh * ttz, sinRel = sh * ttx - ch * ttz;

    // --- inputs
    let thr = clamp(inp.throttle || 0, 0, 1), brk = clamp(inp.brake || 0, 0, 1);
    car.steer = U.approach(car.steer, clamp(inp.steer || 0, -1, 1), 12 * dt);
    // steering lock: speed-scaled, and above ~30 km/h capped near what the tyres can use (full lock ≈ the limit, not a spin)
    let steerMax = CFG.perf.steerLock(vLong);
    const counter = car.steer * car.r < 0 && Math.abs(car.r) > 0.15;       // counter-steering a slide: full lock allowed
    const latLow = CFG.perf.latLow(speed);
    const stp = car.setup, clK = stp ? stp.clK : 1;   // car setup (CFG.setup, player only): its own downforce level
    if (speed > 8 && !counter) steerMax = Math.min(steerMax, L * CFG.perf.latAccel(speed, car.grip, clK) * latLow * 1.12 / (speed * speed) + C.peakSlip * 0.95);
    car.steerAngle = car.steer * steerMax;
    // keyboard assist: a held steer key asks for the front slip angle of maximum grip (not full lock). Closed form
    // on the measured front-axle velocity angle; taps below the limit and counter-steer are untouched.
    const kbA = inp.kb ? (typeof assists.kb === 'object' ? assists.kb : KB_ASSIST[assists.kb]) : null;   // (object = tuning)
    car.kbCap = 1; car.kbDir = 0;
    if (kbA && speed > 8 && vLong > 3 && !counter && car.steer !== 0 && !car.reverse) {
      const sg = car.steer > 0 ? 1 : -1;
      const thF = Math.atan2(vLat + A * car.r, vLong);
      const tgt = C.peakSlip * (kbA.slip - kbA.unwind * clamp((car.slipR || 0) - 1, 0, 0.5));
      const lim = Math.max(sg * thF + tgt, 0.25 * C.peakSlip) + (1 - smooth((speed - 8) / 6)) * steerMax;
      if (lim < steerMax) {
        car.kbCap = lim / steerMax; car.kbDir = sg;
        if (sg * car.steerAngle > lim) car.steerAngle = sg * lim;
      }
    }

    // reverse gear. Player: hold brake at a standstill (only once the race is running, never on the grid).
    // AI: explicit input.reverse = true, reverse throttle = input.throttle.
    const raceOn = !world.race || (!world.race.awaitConfirm && !inp.hold && (world.race.phase === 'racing' || world.race.phase === 'finished' || world.race.phase === 'quali'));
    let revDrive = 0;
    if (inp.reverse) {
      if (!car.reverse && Math.abs(vLong) < 1.5) { car.reverse = true; car.gear = -1; }
      if (car.reverse) { revDrive = thr; thr = 0; }
    } else if (car.isPlayer && raceOn) {
      if (!car.reverse) {
        if (brk > 0.5 && thr < 0.05 && Math.abs(vLong) < 0.6) { car._revT += dt; if (car._revT > 0.4) { car.reverse = true; car.gear = -1; } }
        else car._revT = 0;
      } else if (thr > 0.05 && vLong > -1.0) { car.reverse = false; car._revT = 0; car.gear = 1; }
      if (car.reverse) { revDrive = brk; brk = thr; thr = 0; }
    } else if (car.reverse) { car.reverse = false; car._revT = 0; car.gear = 1; }

    // --- active aero (edge-triggered request only on the first substep)
    car.inStraightZone = !car.inPitLane && !car.aeroLock && track.zoneAt(car.s) >= 0;
    if (first && inp.aeroPress) {
      if (car.aero === 'corner' && car.inStraightZone) car.aero = 'straight';
      else if (car.aero === 'straight') car.aero = 'corner';
    }
    if (car.aero === 'straight' && (brk > 0.08 || !car.inStraightZone)) car.aero = 'corner';
    car.aeroT = U.approach(car.aeroT, car.aero === 'straight' ? 1 : 0,
      dt / (car.aero === 'straight' ? CFG.aero.openTime : CFG.aero.closeTime));
    const aT = car.aeroT;
    const cdMul = U.lerp(1, CFG.aero.straightCdA, aT) * (1 - car.tow * CFG.slipstream.dragCut);
    const clMul = U.lerp(1, CFG.aero.straightClA, aT) * (1 - car.dirty * CFG.slipstream.dirtyAir);

    // --- loads
    const v2 = speed * speed;
    // wing setup: downforce ×clK, drag ×cdK, front share bal (default 6 / 6: exactly the base car)
    const bal = stp ? stp.bal : C.aeroBalance;
    const Fd = 0.5 * CFG.rho * C.clA * clK * clMul * v2;
    // (setup: the wing's extra drag, cdK - 1, keeps CFG.setup.zoneKeep of itself with Straight mode open)
    const Fdrag = stp ? 0.5 * CFG.rho * C.cdA * (cdMul + (stp.cdK - 1) * (1 - aT * (1 - CFG.setup.zoneKeep)) * (1 - car.tow * CFG.slipstream.dragCut)) * v2
      : 0.5 * CFG.rho * C.cdA * 1 * cdMul * v2;
    const wt = C.mass * car.aLong * C.cgHeight / L;
    const FzF = Math.max(FZF0 + Fd * bal - wt, 0.2 * FZF0);
    const FzR = Math.max(FZR0 + Fd * (1 - bal) + wt, 0.2 * FZR0);

    // --- surfaces under each axle
    const sF = car.s + A * cosRel, dF = car.d + A * sinRel;
    const sR = car.s - B * cosRel, dR = car.d - B * sinRel;
    const af = axleSurface(track, track.wrapS(sF), dF);
    const gF = af.grip, dragF = af.drag, kerbF = af.kerb, offF = af.off, stabF = af.stab, wobF = af.wob;
    const latFm = af.latF + (af.latFhi - af.latF) * smooth((speed - 17) / 16);   // 60 -> 120 km/h
    const ar = axleSurface(track, track.wrapS(sR), dR);
    const gR = ar.grip, dragR = ar.drag, kerbR = ar.kerb, offR = ar.off, latRm = ar.latR, stabR = ar.stab, wobR = ar.wob;
    car.onKerb = kerbF || kerbR;
    car.surface = track.surface(car.s, car.d);
    car.offTrack = offF + offR >= 1.5;
    let kerbJolt = 0;
    if (car.onKerb && speed > 5) { car._kerbPhase += speed * dt / 1.2; kerbJolt = Math.sin(car._kerbPhase * Math.PI) * 0.06; }

    // --- tyre friction limits
    const comp = COMPOUNDS[car.tyre.compound] || COMPOUNDS.M;
    const wet = world.weather ? world.weather.wet || 0 : 0;
    const wg = comp.wetGrip ? (wet <= 0.5 ? U.lerp(comp.wetGrip[0], comp.wetGrip[1], wet * 2) : U.lerp(comp.wetGrip[1], comp.wetGrip[2], wet * 2 - 1)) : 1;
    car.grip = comp.grip * wg * wearGrip(car.tyre.wear, comp.cliff);
    // out of the tyre's window (slicks in the wet): handling loss ws + hydroplaning hy (see WET)
    const ws = car.wetSlide = wetSlide(comp, wet), hy = ws * hydro(speed);
    const FmaxF = CFG.perf.mu(FzF / FZF0) * FzF * car.grip * gF * (1 - Math.abs(kerbJolt)) * (1 - WET.hyF * hy);
    // with TC + ABS on, the player's car is a touch less planted (slightly less rear bias + stability aid) so a spin is possible
    const aidsOn = car.isPlayer && assists.tc && assists.abs;
    const FmaxR = CFG.perf.mu(FzR / FZR0) * FzR * car.grip * gR * (1 - Math.abs(kerbJolt)) * (aidsOn ? 1.05 : 1.075) * (brk > 0.3 ? 1 + 0.08 * smooth((speed - 40) / 30) : 1) * (1 - WET.hyR * hy);
    const FlatF = FmaxF * (1 - WET.latF * ws);      // front cornering capacity
    const FbF = FmaxF * (1 - WET.hyB * hy);         // front braking capacity
    const FtR = FmaxR * (1 - WET.trac * ws);        // rear traction capacity
    const dropR = 0.2 + WET.tail * ws, dropF = dropR + WET.tailF * ws, span = 1.8 - WET.span * ws;

    // --- slip angles (front measured in the steered wheel frame; valid for forward and backward motion)
    const dir = vLong >= 0 ? 1 : -1;
    const cd = Math.cos(car.steerAngle), sd = Math.sin(car.steerAngle);
    const vyF = vLat + A * car.r, vyR = vLat - B * car.r;
    const vxFw = vLong * cd + vyF * sd, vyFw = -vLong * sd + vyF * cd;
    const alphaF = Math.atan2(vyFw, Math.max(Math.abs(vxFw), 3));
    const alphaR = Math.atan2(vyR, Math.max(Math.abs(vLong), 3));
    let FyF = FlatF * latCurve(alphaF, C.peakSlip, dropF, span) * latFm;          // gravel: front ploughs (hard to turn)
    let FyR = FmaxR * latCurve(alphaR, C.peakSlip * 1.15, dropR, span) * latRm;   // grass: rear lets go (easy to spin)
    // walking pace (kinematic blend below): the side forces from these slip angles fade in with speed. At full force they
    // scrubbed the car to a halt pulling away on full lock (front side force x sin(lock) against the drive, and TC cut the
    // drive for the rear's phantom side load): stuck at ~3 km/h with the wheel turned
    const wK = smooth((speed - 1.5) / 4);
    FyF *= wK; FyR *= wK;

    // --- drive (engine + boost) and brakes
    let boostW = 0;
    const wantBoost = inp.boost && thr > 0.3 && car.battery > 0.002 && !car.pitLimiter && !car.reverse && vLong > 1;
    if (wantBoost) {
      const t0 = car.overtake ? E.taperStartOT : E.taperStart, t1 = car.overtake ? E.taperEndOT : E.taperEnd;
      // near top speed the boost only adds ~25% of its power, but the battery still drains at the full rate
      const taper = 1 - 0.75 * smooth((vLong - t0) / (t1 - t0));
      boostW = E.boostPower * taper * thr;
      car.boostEff = taper;                    // 1 = full boost, ~0.25 near top speed (HUD warns)
      car.battery = Math.max(0, car.battery - E.deployRate * thr * dt);
    }
    if (!wantBoost) car.boostEff = 1;
    car.boosting = wantBoost && boostW > 2000;
    const power = C.enginePower * thr + boostW;
    let Fdrive = Math.min(power / Math.max(Math.abs(vLong), 4), (C.maxDriveForce + boostW / 25) * Math.min(1, thr * 1.2));
    if (car.reverse) Fdrive = -revDrive * 5000 * (vLong > -6 ? 1 : 0);
    if (car.pitLimiter) {
      const lim = CFG.race.pitSpeedLimit;
      Fdrive *= clamp((lim - vLong) / 1.5, 0, 1);
      if (vLong > lim + 0.5) brk = Math.max(brk, clamp((vLong - lim) / 4, 0, 1));
    }
    // brakes oppose motion; soft dead-zone around standstill so they never push backwards
    const bDir = Math.abs(vLong) > 0.4 ? dir : vLong / 0.4;
    // pedal "feel": full brake is capped a little above what the tyres can take, so flat-out braking only
    // gives a light lock-up (heavy lock-ups need rough, late braking into low grip)
    const Fb = brk * C.brakeForce;
    let FxF = -Math.min(Fb * C.brakeBias, 1.3 * FmaxF * brk + 1) * bDir;
    let FxR = Fdrive - Math.min(Fb * (1 - C.brakeBias), 1.3 * FmaxR * brk + 1) * bDir;

    // --- combined slip, lock-up, wheelspin, assists
    let lockF = 0, lockR = 0, spinR = 0;
    // front axle (braking only)
    // keyboard assist, cornering-aware ABS (trail-braking): braking while turning, trim brake pressure so each axle
    // keeps brkLat × its lateral demand (from its slip) for turning. ABS off = raw.
    const kbBrk = kbA && assists.abs && speed > 8 ? kbA.brkLat : 0;
    // friction "ellipse" (lateral semi-axis FlatF, braking FbF): braking eats a little less of the front's cornering grip
    // (easier trail-braking; out of the window it eats all of it: goes straight on); lock-ups still cost steering
    const cpl = Math.min(1, WET.cpl * ws + WET.cplH * hy), cF = 0.72 + 0.28 * cpl, rF2 = (FlatF / FbF) * (FlatF / FbF);
    // braking assist with ABS off: the assist's own pressure stops just short of a lock-up (the driver's own can still lock)
    if (car._asLim && !assists.abs && vLong > 3) {
      FxF = Math.max(FxF, -FbF * (1.16 - WET.lock * ws));
      if (FxR < 0) FxR = Math.max(FxR, -FmaxR * 1.16);
    }
    if (assists.abs) {
      FxF = clamp(FxF, -FbF * 0.97, FbF * 0.97);
      if (kbBrk) { const k = Math.min(1, Math.abs(FyF) / FlatF) * kbBrk, m = FbF * Math.sqrt((1 - k * k) / cF); FxF = clamp(FxF, -m, m); }
    } else if (Math.abs(FxF) > FbF) {
      lockF = smooth((Math.abs(FxF) / FbF - (1.18 - WET.lock * ws)) / 0.5);
      FxF = Math.sign(FxF) * FbF * (1 - 0.18 * lockF);
    }
    const remF = Math.max(Math.sqrt(Math.max(FlatF * FlatF - cF * FxF * FxF * rF2, 0)), FlatF * 0.42 * (1 - WET.floorF * cpl));
    FyF = clamp(FyF, -remF, remF) * (1 - (0.75 + WET.lockLat * ws) * lockF);
    // rear axle (drive and braking)
    if (FxR > 0) {
      if (assists.tc) {
        // (out of the tyre's window TC mostly watches wheelspin: the rear can still step out under power)
        const room = Math.sqrt(Math.max(FtR * FtR - FyR * FyR * 0.9 * (1 - WET.tcLat * ws) * (FtR / FmaxR) * (FtR / FmaxR), 0)) * 0.98;
        FxR = Math.min(FxR, Math.max(room, FtR * 0.25));
        // keyboard assist: a floored throttle key ramps the drive in while the tyres are still loaded sideways
        if (kbA && kbA.thrLat) FxR = Math.min(FxR, FtR * (1 - kbA.thrLat * smooth((Math.max(Math.abs(FyF) / FlatF, Math.abs(FyR) / FmaxR) - 0.8) / 0.2)));
      } else if (FxR > FtR) {
        spinR = smooth((FxR / FtR - 1) / (0.8 * (1 - WET.spinK * ws)));
        FxR = FtR * (1 - 0.12 * spinR) * 0.92;
      }
    } else if (FxR < 0) {
      if (assists.abs) {
        FxR = Math.max(FxR, -FmaxR * 0.97);
        if (kbBrk) { const k = Math.min(1, Math.abs(FyR) / FmaxR) * kbBrk; FxR = Math.max(FxR, -FmaxR * Math.sqrt((1 - k * k) / 0.6)); }
      } else if (-FxR > FmaxR) {
        lockR = smooth((-FxR / FmaxR - 1.18) / 0.5);
        FxR = -FmaxR * (1 - 0.18 * lockR);
      }
    }
    // sim-lite: a spinning / locked rear keeps a floor of lateral grip so throttle or braking slides are catchable
    // under braking the rear keeps more of its side grip (braking spins were too easy); locked rears still slide
    // (drive: ellipse with the traction capacity FtR as its long semi-axis -> power oversteer out of the tyre's window)
    const remR = Math.max(Math.sqrt(Math.max(FmaxR * FmaxR - (FxR < 0 ? 0.6 : (FmaxR / FtR) * (FmaxR / FtR)) * FxR * FxR, 0)), FmaxR * (FxR < 0 ? 0.6 : 0.45 * (1 - WET.floorR * ws)));
    FyR = clamp(FyR, -remR, remR) * (1 - (0.45 + WET.spinLat * ws) * spinR - 0.3 * lockR);
    // hairpin grip: extra sideways grip at low speed on both axles (balance unchanged), faded out by ~110 km/h
    FyF *= latLow; FyR *= latLow;

    // low-speed stability: a tyre can't push harder than what stops the axle sliding this substep
    const capF = Math.abs(vyFw) * MF / dt, capR = Math.abs(vyR) * MR / dt;
    FyF = clamp(FyF, -capF, capF);
    FyR = clamp(FyR, -capR, capR);

    // --- sum forces in the car frame
    const FxFc = FxF * cd - FyF * sd;
    const FyFc = FxF * sd + FyF * cd;
    const moving = Math.min(1, speed / 0.5);
    const resist = (C.rollingResist * W + (dragF + dragR) * 0.5 * W) * moving;
    const invSp = speed > 0.01 ? 1 / speed : 0;
    let FxL = FxFc + FxR - (Fdrag + resist) * vLong * invSp;
    // elevation: gravity along the slope (grade = dElev/ds in the racing direction; flat tracks have none)
    if (track.grade) {
      const gr = track.grade[ti] || 0;
      if (gr) FxL -= C.mass * CFG.g * gr * cosRel;
    }
    let FyL = FyFc + FyR - (Fdrag + resist) * vLat * invSp;
    let tau = A * FyFc - B * FyR;
    // rough ground (grass / gravel): small random yaw twitches that grow with speed
    const wob = (wobF + wobR) * 0.5;
    if (wob > 0 && speed > 5) {
      car._wobP = (car._wobP || car.id * 1.7) + speed * dt * 0.35;
      const n = Math.sin(car._wobP * 2.3) * Math.sin(car._wobP * 0.97 + 1.3) + 0.35 * Math.sin(car._wobP * 5.1);
      tau += n * wob * C.inertia * 1.6 * smooth((speed - 5) / 25);
    }

    // yaw stability aid (strong for AI, light for the player): damps yaw beyond what the tyres can hold
    // extra help while braking, most of all at high speed (heavy braking from 250+ km/h must stay straight)
    const hiBrake = brk > 0.3 ? 1.35 + 0.9 * smooth((speed - 40) / 30) : 1;
    const stab = (aidsOn ? car.stability * 0.75 : car.stability) * hiBrake * Math.min(stabF, stabR);   // less help on grass
    if (stab > 0 && speed > 8) {
      const rKin = vLong * Math.tan(car.steerAngle) / L;
      const rMax = CFG.perf.latAccel(speed, car.grip * Math.min(gF, gR), clK) * latLow / speed;
      const rT = clamp(rKin, -rMax, rMax);
      const over = Math.abs(alphaR) / (C.peakSlip * 1.15) - 0.7;
      if (over > 0 && Math.abs(car.r) > Math.abs(rT)) tau -= (car.r - rT) * C.inertia * 16 * stab * Math.min(1, over * 2 + 0.3);
    }

    // low-speed blend to a kinematic model (slip angles are meaningless near standstill; the tyre forces above already
    // fade by w): the velocity turns with the car and the rear axle rolls without sideslip (vLat -> B x r, not 0, which
    // left both axles slipping in a walking-pace turn)
    const w = wK, rKin = vLong * Math.tan(car.steerAngle) / L;
    if (w < 1) {
      FyL += (1 - w) * C.mass * (vLong * car.r - (vLat - B * rKin) * 8);
      FxL -= (1 - w) * C.mass * vLat * car.r;   // (the matching longitudinal term: no free speed gain coasting on lock)
    }

    // --- integrate (semi-implicit Euler, world frame)
    const Fwx = FxL * ch - FyL * sh, Fwz = FxL * sh + FyL * ch;
    car.vx += Fwx / C.mass * dt;
    car.vz += Fwz / C.mass * dt;
    car.r += tau / C.inertia * dt;
    if (w < 1) car.r = U.lerp(rKin, car.r, w);
    car.h += car.r * dt;
    car.h = U.wrapAngle(car.h);
    if (speed < 0.08 && thr < 0.02 && !car.reverse) { car.vx *= 0.8; car.vz *= 0.8; }
    car.x += car.vx * dt;
    car.z += car.vz * dt;

    // --- walls
    const p2 = track.project(car.x, car.z, car.idx, _p2);
    const cor = track.corridor(p2.s, p2.d, _cor);
    const t2 = p2.idx;
    const c2 = Math.abs(Math.cos(car.h) * track.tx[t2] + Math.sin(car.h) * track.tz[t2]);
    const s2 = Math.sqrt(Math.max(0, 1 - c2 * c2));
    const half = Math.min(C.width * 0.5 * c2 + C.length * 0.5 * s2, C.length * 0.5);
    if (p2.d > cor.max - half) hitWall(car, p2.d - (cor.max - half), track.nx[t2], track.nz[t2], 1, track, t2);
    else if (p2.d < cor.min + half) hitWall(car, (cor.min + half) - p2.d, track.nx[t2], track.nz[t2], -1, track, t2);

    // --- derived outputs
    const nch = Math.cos(car.h), nsh = Math.sin(car.h);
    car.speed = Math.hypot(car.vx, car.vz);
    car.vLong = car.vx * nch + car.vz * nsh;
    car.vLat = -car.vx * nsh + car.vz * nch;
    car.aLong = U.expDecay(car.aLong, FxL / C.mass, 25, dt);
    car.aLat = U.expDecay(car.aLat, FyL / C.mass, 25, dt);
    car.throttle = car.reverse ? revDrive : thr;
    car.brake = brk;
    car.wheelRot += car.vLong / WHEEL_R * dt;
    // slip / slip-at-peak-grip per axle. slide (smoke + squeal) only when genuinely past the peak (> 115 %), scaled by
    // the excess — running AT the peak is the fastest way round and stays quiet
    car.slipF = Math.abs(alphaF) / C.peakSlip; car.slipR = Math.abs(alphaR) / (C.peakSlip * 1.15);
    const latSlide = clamp((Math.max(car.slipF, car.slipR) - 1.15) / 0.75, 0, 1) * smooth((speed - 4) / 10);
    car.slide = U.expDecay(car.slide, latSlide, 12, dt);
    car.lockup = U.expDecay(car.lockup, Math.max(lockF, lockR) * smooth(speed / 6), 12, dt);
    car.wheelspin = U.expDecay(car.wheelspin, spinR, 12, dt);

    // --- energy: recharge under braking / lift-off, boost drains (above)
    let harvest = 0;
    if (brk > 0.05 && vLong > 8) harvest = E.harvestBrake * brk;
    else if (thr < 0.05 && vLong > 15) harvest = E.harvestCoast;
    else if (thr < 0.6 && vLong > 15) harvest = E.harvestPartial;
    if (car.overtake) harvest *= E.harvestOT || 1;
    car.harvesting = !car.boosting && harvest > 0 && car.battery < car.batteryCap - 1e-4;
    if (car.harvesting) car.battery = Math.min(car.batteryCap, car.battery + harvest * dt);
    if (car.battery > car.batteryCap) car.battery = car.batteryCap;

    // --- tyre wear (per metre, scaled by how hard the tyres work)
    const wpm = world.wearPerMetre || 0;
    if (wpm > 0 && speed > 1) {
      const uF = FmaxF > 1 ? Math.hypot(FxF, FyF) / FmaxF : 0, uR = FmaxR > 1 ? Math.hypot(FxR, FyR) / FmaxR : 0;
      const use = 0.5 * (uF * uF + uR * uR);
      const dryK = comp.dryWear ? U.lerp(comp.dryWear, 1, Math.min(1, wet * 2)) : 1;
      const k = dryK * (CFG.tyre.baseUse + CFG.tyre.loadUse * use + 2.0 * (lockF + lockR + spinR) + 0.5 * (offF + offR)) / CFG.tyre.usageNorm;
      car.tyre.wear = Math.min(1, car.tyre.wear + wpm / comp.life * k * speed * dt);
    }

    // --- gearbox / revs
    gearbox(car, thr, dt, world.events);
  }

  function hitWall(car, pen, nx, nz, side, track, ti) {
    car.x -= side * nx * pen;
    car.z -= side * nz * pen;
    const vn = (car.vx * nx + car.vz * nz) * side;      // speed into the wall
    if (vn > 0) {
      const e = 0.22;
      car.vx -= (1 + e) * vn * side * nx;
      car.vz -= (1 + e) * vn * side * nz;
      // scrape friction along the wall
      const tx = track.tx[ti], tz = track.tz[ti];
      const vt = car.vx * tx + car.vz * tz;
      const dv = Math.min(Math.abs(vt), 0.45 * (1 + e) * vn);
      car.vx -= Math.sign(vt) * dv * tx;
      car.vz -= Math.sign(vt) * dv * tz;
      // align with the wall a little, kill yaw
      const wallH = Math.atan2(tz, tx) + (vt < 0 ? Math.PI : 0);
      car.h += U.wrapAngle(wallH - car.h) * Math.min(0.35, vn * 0.025);
      car.r *= 0.6;
      car.collision = Math.max(car.collision, vn);
    }
  }

  function gearbox(car, thr, dt, events) {
    car.shiftT += dt;
    const kmh = Math.abs(car.vLong) * 3.6;
    if (car.reverse) { car.gear = -1; car.rpm = U.expDecay(car.rpm, C.rpmIdle + 2500 * thr + kmh * 120, 15, dt); return; }
    if (car.gear < 1) car.gear = 1;
    const top = C.gearTop;
    if (car.gear < 8 && C.rpmMax * kmh / top[car.gear] > C.rpmShiftUp && car.shiftT > 0.45) {
      car.gear++; car.shiftT = 0;
      if (events) events.push({ type: 'shift', car, up: true });
    } else if (car.gear > 1 && C.rpmMax * kmh / top[car.gear - 1] < C.rpmShiftUp - 1700 && car.shiftT > 0.2) {
      car.gear--; car.shiftT = 0;
      if (events) events.push({ type: 'shift', car, up: false });
    }
    let rpm = C.rpmMax * kmh / top[car.gear];
    if (car.gear === 1) rpm = Math.max(rpm, C.rpmIdle + thr * (10500 - C.rpmIdle) * (1 - smooth(kmh / 70)));
    rpm += car.wheelspin * 2000;
    rpm = clamp(rpm, C.rpmIdle, C.rpmMax + 150);
    car.rpm = U.expDecay(car.rpm, rpm, 30, dt);
  }

  // Slipstream / dirty air + car-to-car collisions. Call once per physics step after stepping all cars.
  function collide(cars, dt, events) {
    const SS = CFG.slipstream, n = cars.length;
    for (let i = 0; i < n; i++) {
      const a = cars[i];
      if (a.kinematic) { a.tow = 0; a.dirty = 0; continue; }
      const ch = Math.cos(a.h), sh = Math.sin(a.h);
      let tow = 0, dirty = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const b = cars[j];
        if (b.kinematic) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        if (dx > SS.range || dx < -SS.range || dz > SS.range || dz < -SS.range) continue;
        const along = dx * ch + dz * sh;
        if (along < 3 || along > SS.range) continue;
        const lat = Math.abs(-dx * sh + dz * ch);
        const wHalf = SS.halfWidth * (0.7 + 0.6 * along / SS.range);
        if (lat > wHalf) continue;
        const lr = lat / wHalf, k = Math.pow(1 - along / SS.range, 0.6) * (1 - lr * lr);   // soft edges: easier to find and hold
        if (k > tow) tow = k;
        const DR = SS.dirtyRange || 30;
        if (along < DR) { const dk = (1 - along / DR) * (1 - lat / wHalf); if (dk > dirty) dirty = dk; }
      }
      a.tow = U.expDecay(a.tow, tow * smooth((a.speed - 25) / 20), 5, dt);
      a.dirty = U.expDecay(a.dirty, dirty * smooth((a.speed - 20) / 20), 5, dt);
    }
    // collisions: two circles per car
    const R = C.collisionRadius, OFF = C.collisionOffset, I = C.inertia, m = C.mass;
    for (let i = 0; i < n; i++) {
      const a = cars[i];
      if (a.kinematic) continue;
      for (let j = i + 1; j < n; j++) {
        const b = cars[j];
        if (b.kinematic) continue;
        const ddx = b.x - a.x, ddz = b.z - a.z;
        if (ddx * ddx + ddz * ddz > 49) continue;
        const ach = Math.cos(a.h), ash = Math.sin(a.h), bch = Math.cos(b.h), bsh = Math.sin(b.h);
        let best = null, bestPen = 0;
        for (let ca = -1; ca <= 1; ca += 2) {
          const ax = a.x + ach * OFF * ca, az = a.z + ash * OFF * ca;
          for (let cb = -1; cb <= 1; cb += 2) {
            const bx = b.x + bch * OFF * cb, bz = b.z + bsh * OFF * cb;
            const dx = bx - ax, dz = bz - az, dist = Math.hypot(dx, dz);
            const pen = 2 * R - dist;
            if (pen > bestPen) { bestPen = pen; best = { ax, az, bx, bz, dx, dz, dist }; }
          }
        }
        if (!best) continue;
        const nx = best.dist > 1e-4 ? best.dx / best.dist : 1, nz = best.dist > 1e-4 ? best.dz / best.dist : 0;
        // separate
        a.x -= nx * bestPen * 0.5; a.z -= nz * bestPen * 0.5;
        b.x += nx * bestPen * 0.5; b.z += nz * bestPen * 0.5;
        // contact point = midpoint between circle surfaces
        const cx = (best.ax + best.bx) * 0.5, cz = (best.az + best.bz) * 0.5;
        const oax = cx - a.x, oaz = cz - a.z, obx = cx - b.x, obz = cz - b.z;
        const vax = a.vx + a.r * -oaz, vaz = a.vz + a.r * oax;
        const vbx = b.vx + b.r * -obz, vbz = b.vz + b.r * obx;
        const rvx = vbx - vax, rvz = vbz - vaz;
        const vn = rvx * nx + rvz * nz;
        if (vn >= 0) continue;
        const raN = oax * nz - oaz * nx, rbN = obx * nz - obz * nx;
        const kN = 2 / m + (raN * raN) / I + (rbN * rbN) / I;
        const e = 0.15;
        const jn = -(1 + e) * vn / kN;
        // friction impulse along the tangent
        const tx = -nz, tz = nx;
        const vt = rvx * tx + rvz * tz;
        const raT = oax * tz - oaz * tx, rbT = obx * tz - obz * tx;
        const kT = 2 / m + (raT * raT) / I + (rbT * rbT) / I;
        const jt = clamp(-vt / kT, -0.25 * jn, 0.25 * jn);
        const Jx = nx * jn + tx * jt, Jz = nz * jn + tz * jt;
        a.vx -= Jx / m; a.vz -= Jz / m; b.vx += Jx / m; b.vz += Jz / m;
        // yaw response (softened: open-wheel contact rarely spins cars on light touches)
        const ya = (oax * Jz - oaz * Jx) / I, yb = (obx * Jz - obz * Jx) / I;
        a.r -= ya * 0.6; b.r += yb * 0.6;
        const imp = -vn;
        a.collision = Math.max(a.collision, imp);
        b.collision = Math.max(b.collision, imp);
        // (+ the contact normal a -> b and both velocities before this impulse: Race judges who caused it from those)
        if (events && imp > 1.5) events.push({ type: 'collision', car: a, other: b, intensity: imp, nx, nz, avx: a.vx + Jx / m, avz: a.vz + Jz / m, bvx: b.vx - Jx / m, bvz: b.vz - Jz / m });
      }
    }
  }

  // put a car at rest on the track at (s, d), facing the racing direction
  function place(car, track, s, d) {
    s = track.wrapS(s);
    const w = track.toWorld(s, d), smp = track.sample(s);
    car.x = w.x; car.z = w.z; car.h = Math.atan2(smp.tz, smp.tx);
    car.vx = car.vz = car.r = 0;
    car.speed = car.vLong = car.vLat = car.aLong = car.aLat = 0;
    car.steer = car.steerAngle = 0; car.throttle = car.brake = 0;
    car.gear = 1; car.rpm = C.rpmIdle; car.reverse = false; car._revT = 0;
    car.aero = 'corner'; car.aeroT = 0; car.slide = car.lockup = car.wheelspin = 0;
    const p = track.project(car.x, car.z, -1);
    car.s = p.s; car.d = p.d; car.idx = p.idx;
  }

  // recovery: put the car back on the racing line at its current track position, at rest
  function resetToTrack(car, track) {
    const p = track.project(car.x, car.z, car.idx);
    const smp = track.sample(p.s);
    place(car, track, p.s, smp.raceLine != null ? smp.raceLine * 0.5 : 0);
  }

  return { step, collide, place, resetToTrack, wearGrip, wetSlide, hydro, WET,
    // driving assists: plan(track, car) -> { v, grip, rev }, info(plan) adds pa / mask, action(v, vp, vHere, pa) line colour
    assist: { plan: assistPlan, info: planInfo, action: lineAction, lineK, LINE, STEER: AST, BRAKE: ABR,
      cue: brakeCue, CUE } };   // cue(track, car, out?) -> the HUD braking cue (P.vb: latest-braking envelope, planInfo)
})();

;
// ===== ai.js
// Apex GP — AI drivers (CONTRACT §6b). Pure logic (no THREE / window / document): runs in Node.
//
//   AI.create(car, difficulty, seed, G) -> brain      AI.drive(brain, car, G, dt) -> input (one reused object per brain)
//
// Path planner: lateral target d(s) = clamp(lerp(raceLine + noise, abs, w) + off, limits). `abs` = optional absolute
// target (pit side, inside line when defending, blue-flag side, off-track rejoin), `off` = offset relative to the
// racing line (overtaking / slipstream), limits = asphalt edges minus a margin plus "leave a car's width" constraints
// from cars alongside. w / off / abs move at limited lateral rates; the look-ahead evaluates the path as it will be.
// Speed: short backward pass along the planned path (~6 m samples, 50–340 m) with the exact inverse of
// CFG.perf.latAccel for corner speeds and friction-circle braking from CFG.perf.brakeDecel; feed-forward throttle /
// brake controller. Steering: Stanley-style (path heading + cross-track at the front axle) + curvature feed-forward +
// yaw damping. Start: hold the grid lane, at most one proportional covering move in the first ~150 m, then merge.
// Extreme: DIFFICULTY.extreme.{brk, fcK} (limit braking / trail-braking, dry clean air only) + lockV (hairpin speeds
// capped by steering lock). Kerbs: DIFFICULTY.x.kerb (hard, extreme, fast adaptive) blends toward a kerb line (inside wheels
// over the kerbs in the corners where that is faster; the speed plan accounts for the kerb's grip). Adaptive: see the
// 'adaptive difficulty' section (pace dial k, player timing, skill profile, battle band).
// Strategy: Race plans stops (car.strategy.auto); the AI covers the player's stops, steers to the pit side
// when car.wantPit and never pits on the final lap. Per-track data is cached in track._ai.
const AI = (() => {
  const C = CFG.car;
  const clamp = U.clamp, lerp = U.lerp, wrapA = U.wrapAngle, approach = U.approach;
  const TAU = Math.PI * 2;
  const VTOP = 96;            // m/s cap for speed targets
  const EDGE = 1.3;           // planned paths keep the car centre this far inside the asphalt edge
  const SEP = 2.7;            // lateral centre-to-centre spacing when side by side
  const LEN = C.length;
  const WB = C.wheelbase, MASS = C.mass, W0 = C.mass * CFG.g;
  const STRIDE = 3, MAXK = 80;

  // tunables (exported as AI.P for headless tests)
  const P = {
    lat: 0.93,        // share of latAccel used for corner speeds at pace 1
    brk: 0.95,        // share of brakeDecel used for braking at pace 1
    paceK: 0.62,      // corner speed multiplier = 1 - (1 - difficulty.pace) * paceK
    powK: 0.03,       // throttle cap = 1 - (1 - difficulty.pace) * powK (slower drivers are less committed on exits)
    base: 0.965,      // global corner-speed scale (absolute AI level)
    brkK: 0.3,        // exponent on difficulty.brakeEarly
    perfK: 1.0,       // team.perf exponent
    lag: 0.05,        // s
    kT: 2.5, kB: 2.0,
    kFF: 1.0, kH: 1.0, kE: 1.4, vE: 6, kR: 0.08, tFF: 0.1,
    mistK: 1.0,
    form: 0.024,     // per-race driver form spread (± half)
    wallM: 2.1,      // min planned distance of the car centre from a barrier
    lowK: 0.95,      // grip share for slow corners (< 30 m/s) relative to fast ones
    wetK: 0.3,       // extra corner/braking margin per unit of lost grip (wet, worn)
    fcK: 1.0,        // friction-circle weight for braking while cornering
    kSmooth: 1, clrNew: 0, consPlan: 1, holdLane: 1,      // smooth the planned path's curvature over 3 samples
    ctlFC: 0.7,      // controller: braking cap while cornering = 1 - ctlFC * (lateral use)^2 (0.9 fell behind the plan into hairpins)
    course: 0.5,     // share of the velocity direction (vs body heading) in the steering heading error
    holdOff: 1,      // 1: keep an off-line offset from the braking point to the apex (no drifting back mid-corner)
    defApex: 1,      // 1: a defensive inside line is held to the apex
    kBlK: 0.02,      // technique curvature blur (b.kBl): samples tighter than this (1/m) keep their peak
    sIT: 2, sIM: 1,  // technique steering integral (b.sI): leak time constant (s), clamp (m·s)
    kxM: -0.5,       // two-wheels-off line: car centre up to this far past the kerb's outer edge (-0.5: the outer wheels ~0.3 m
                     // onto the grass / run-off; all four off, the track-limits breach, needs ~+1.0 m)
    kxGain: 0.02,    // ... only in corners where the lap model gains more than this (s) over the kerb line
    kxV: 99,         // ... and whose apex (reference profile) is slower than this (m/s; 99 = any)
    kxG: 0,          // (tuning) grip assumed for a wheel past the kerb, if higher than the surface's (0 = the surface's)
  };

  // scratch for the look-ahead (drive() is synchronous)
  const kX = new Float64Array(MAXK), kV = new Float64Array(MAXK), kVc = new Float64Array(MAXK), kA = new Float64Array(MAXK);
  const kK = new Float64Array(MAXK), kPX = new Float64Array(MAXK), kPZ = new Float64Array(MAXK), kL = new Float64Array(MAXK), kG = new Float64Array(MAXK), kDv = new Float64Array(MAXK);

  // exact inverse of CFG.perf.latAccel (load-sensitive mu): steady-state speed on curvature k (capped at `cap`: the
  // brain's straight-line target b.vTop, VTOP unless the difficulty lifts it)
  function vCorner(k, grip, cl, cap = VTOP) {
    if (k < 0) k = -k;
    const K0 = C.tyreMu * grip * CFG.g, q = 0.5 * CFG.rho * C.clA * cl / W0, ls = C.tyreLoadSens;
    const a2 = ls * K0 * q * q, b1 = k - K0 * q * (1 - ls), sq = Math.sqrt(b1 * b1 + 4 * a2 * K0);
    const u = b1 > 0 ? 2 * K0 / (b1 + sq) : (sq - b1) / (2 * a2);
    return u >= cap * cap ? cap : Math.sqrt(u);
  }
  // tyre out of its window (car.wetSlide, Physics.WET), set per drive() call: wLat = share of the cornering grip left,
  // wHy / wBr = cornering / braking grip lost to hydroplaning at full Physics.hydro(v), wDrv = share of the traction left
  let wLat = 1, wHy = 0, wBr = 0, wDrv = 1;
  function wetSet(car) {
    const ws = car.wetSlide || 0, E = ws > 0 && typeof Physics !== 'undefined' && Physics.WET;
    wLat = E ? 1 - E.latF * ws : 1; wHy = E ? E.hyF * ws : 0; wBr = E ? (0.6 * (E.hyF + E.hyB) + 0.4 * E.hyR) * ws : 0; wDrv = E ? 1 - E.trac * ws : 1;
  }
  const brkW = v => (wBr > 0 ? 1 - wBr * Physics.hydro(v) : 1);
  // the car's own wing setup (car.setup = CFG.setup.aero(..); none = the baseline car, identical to CFG.perf)
  const sCl = car => (car.setup ? car.setup.clK : 1), sCd = car => (car.setup ? car.setup.cdK : 1);
  // setup calibration exponent per difficulty (slower drivers gain less from aero): AI lap with its setup ≈ baseline lap
  const AERO_G = { easy: 2.4, medium: 2.4, adaptive: 2.4, hard: 2.4, extreme: 2.4 };
  const bDec = (car, v, g) => (car.setup ? CFG.setup.brakeDecel(v, car.setup, g) : CFG.perf.brakeDecel(v, g));
  const dAcc = (car, v, g, p) => (car.setup ? CFG.setup.driveAccel(v, car.setup, g, p) : CFG.perf.driveAccel(v, g, p));
  // vCorner incl. the low-speed sideways-grip bonus (CFG.perf.latLow depends on v: fixed-point, converges in a few steps)
  // and the grip a tyre out of its window loses to hydroplaning at speed
  function vCornerL(k, grip, cl, cap = VTOP) {
    let v = vCorner(k, grip, cl, cap);
    for (let i = 0; i < 3; i++) v = vCorner(k, grip * CFG.perf.latLow(v) * (wHy > 0 ? 1 - wHy * Physics.hydro(v) : 1), cl, cap);
    return v;
  }
  // speed at which curvature k needs `share` of the (speed-scaled) steering lock, incl. ~0.065 rad of understeer
  function vLock(k, share) {
    const need = Math.atan(WB * (k < 0 ? -k : k)) + 0.065;
    const v = C.steerSpeedRef * (C.steerMax * share / need - 1);   // base lock only: the AI doesn't use the low-speed boost
    return v > 5 ? v : 5;
  }
  function menger(ax, az, bx, bz, cx, cz) {
    const x1 = bx - ax, z1 = bz - az, x2 = cx - bx, z2 = cz - bz, x3 = cx - ax, z3 = cz - az;
    const den = Math.sqrt((x1 * x1 + z1 * z1) * (x2 * x2 + z2 * z2) * (x3 * x3 + z3 * z3));
    return den > 1e-9 ? 2 * (x1 * z2 - z1 * x2) / den : 0;    // + = right turn
  }
  function blur(a, r) {
    const N = a.length, o = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = -r; j <= r; j++) s += a[(i + j + N) % N]; o[i] = s / (2 * r + 1); }
    return o;
  }

  // ---------- kerb line (hard / extreme / fast adaptive) ----------
  // Same K1999-style min-curvature smoother as track.js, run with bounds that let the car put its inside wheels
  // over the kerbs (the outer wheels stay on the 1.4 m kerb with a margin, never on the grass) — only in the corners where a quasi-static lap model, incl. the kerb's grip loss, says it pays.
  const HT = 0.8, KERB_M = 0.35, KERB_WALL = 2.3;
  const KERB_G1 = 0.925, KERB_G2 = 0.89;    // axle grip with one / both wheels on a kerb (surface 0.93 x kerb jolt)
  function optLine(N, px, pz, nx, nz, lo, hi, iters) {
    const d = new Float64Array(N), qx = Float64Array.from(px), qz = Float64Array.from(pz);
    const adjust = (ip, i, inx, kT, sec) => {
      const ax = qx[ip], az = qz[ip], cx = qx[inx], cz = qz[inx];
      const Cx = cx - ax, Cz = cz - az, den = Cx * nz[i] - Cz * nx[i];
      let di = d[i];
      if (Math.abs(den) > 1e-9) di = -(Cx * (pz[i] - az) - Cz * (px[i] - ax)) / den;
      const l0 = lo[i], h0 = hi[i];
      di = clamp(di, l0 - 4, h0 + 4);
      const k0 = menger(ax, az, px[i] + di * nx[i], pz[i] + di * nz[i], cx, cz);
      const k1 = menger(ax, az, px[i] + (di + 0.05) * nx[i], pz[i] + (di + 0.05) * nz[i], cx, cz);
      const dk = (k1 - k0) / 0.05;
      if (Math.abs(dk) > 1e-12) di += (kT - k0) / dk;
      let l = l0, hh = h0;
      if (sec > 0) { const mid = 0.5 * (l0 + h0); if (kT > 0) hh = Math.max(mid, h0 - sec); else if (kT < 0) l = Math.min(mid, l0 + sec); }
      di = clamp(di, l, hh);
      d[i] = di; qx[i] = px[i] + di * nx[i]; qz[i] = pz[i] + di * nz[i];
    };
    for (let st = 64; st >= 2; st >>= 1) {
      const M = N / st, its = Math.round(iters * Math.sqrt(st / 2));
      for (let it = 0; it < its; it++) for (let m = 0; m < M; m++) {
        const i = m * st, ip = ((m + M - 1) % M) * st, ipp = ((m + M - 2) % M) * st, inx = ((m + 1) % M) * st, inn = ((m + 2) % M) * st;
        const r0 = menger(qx[ipp], qz[ipp], qx[ip], qz[ip], qx[i], qz[i]), r1 = menger(qx[i], qz[i], qx[inx], qz[inx], qx[inn], qz[inn]);
        const lp = Math.hypot(qx[i] - qx[ip], qz[i] - qz[ip]), ln = Math.hypot(qx[i] - qx[inx], qz[i] - qz[inx]);
        adjust(ip, i, inx, (ln * r0 + lp * r1) / (ln + lp), lp * ln / 800);
      }
      for (let m = 0; m < M; m++) {
        const i0 = m * st, i1 = ((m + 1) % M) * st, ip = ((m + M - 1) % M) * st, inx = ((m + 2) % M) * st;
        const ir0 = menger(qx[ip], qz[ip], qx[i0], qz[i0], qx[i1], qz[i1]), ir1 = menger(qx[i0], qz[i0], qx[i1], qz[i1], qx[inx], qz[inx]);
        for (let q = 1; q < st; q++) { const u = q / st; adjust(i0, i0 + q, i1, u * ir1 + (1 - u) * ir0, 0); }
      }
    }
    return d;
  }
  // grip multiplier of the car at lateral offset d (kerb under the inside / outside wheels)
  function kerbGrip(hw, d, kL, kR) {
    const ad = d < 0 ? -d : d;
    if (ad + HT <= hw) return 1;
    if (!(d < 0 ? kL : kR)) return 1;               // no kerb: planned paths never leave the asphalt there
    return ad - HT > hw ? KERB_G2 : KERB_G1;
  }
  // two-wheels-off line (Extreme): the axle's mean grip incl. a wheel past the kerb on the run-off / grass beyond it
  // (per wheel: track 1, kerb KERB_W1, else the surface's grip); same as kerbGrip while no wheel is past the kerb.
  // sfDrag = that axle's surface drag (share of the car's weight, as Physics' resist)
  const KERB_W1 = 0.87;
  let sfDrag = 0;
  function surfGrip(hw, d, kL, kR, roL, roR) {
    const ad = d < 0 ? -d : d, kb = d < 0 ? kL : kR;
    sfDrag = 0;
    if (!kb || ad + HT <= hw + CFG.kerbWidth) return kerbGrip(hw, d, kL, kR);
    const S = CFG.surface[d < 0 ? roL : roR] || CFG.surface[3], wi = ad - HT, gO = P.kxG > 0 ? Math.max(S.grip, P.kxG) : S.grip;
    sfDrag = 0.5 * (S.drag || 0);
    return 0.5 * (gO + (wi <= hw ? 1 : wi <= hw + CFG.kerbWidth ? KERB_W1 : gO));
  }
  // quasi-static lap model on line d: per-sample segment times (s) (sg: surfGrip + surface drag, the two-wheels-off line)
  function lineTimes(track, d, sg) {
    const N = track.N, qx = new Float64Array(N), qz = new Float64Array(N), g = new Float64Array(N), v = new Float64Array(N), dr = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      qx[i] = track.px[i] + track.nx[i] * d[i]; qz[i] = track.pz[i] + track.nz[i] * d[i];
      g[i] = sg ? surfGrip(track.halfW[i], d[i], track.kerbL[i], track.kerbR[i], track.runoffL[i], track.runoffR[i]) : kerbGrip(track.halfW[i], d[i], track.kerbL[i], track.kerbR[i]);
      dr[i] = sg ? sfDrag * CFG.g : 0;
    }
    let k = new Float64Array(N);
    for (let i = 0; i < N; i++) { const a = (i + N - 2) % N, b = (i + 2) % N; k[i] = menger(qx[a], qz[a], qx[i], qz[i], qx[b], qz[b]); }
    k = blur(k, 2);
    const ds = new Float64Array(N);
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; ds[i] = Math.hypot(qx[j] - qx[i], qz[j] - qz[i]); v[i] = vCorner(k[i], P.lat * g[i], 1); }
    for (let pass = 0; pass < 2; pass++) for (let n = N - 1; n >= 0; n--) {
      const j = (n + 1) % N, vb = Math.sqrt(v[j] * v[j] + 2 * (CFG.perf.brakeDecel(v[j], g[j]) * P.brk + dr[j]) * ds[n]);
      if (vb < v[n]) v[n] = vb;
    }
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < N; n++) {
      const j = (n + 1) % N, va = Math.sqrt(Math.max(0, v[n] * v[n] + 2 * Math.max(0.3, CFG.perf.driveAccel(v[n], g[n]) - dr[n]) * ds[n]));
      if (va < v[j]) v[j] = va;
    }    const t = new Float64Array(N);
    for (let i = 0; i < N; i++) t[i] = 2 * ds[i] / (v[i] + v[(i + 1) % N]);
    return t;
  }
  // X (two-wheels-off line, Extreme / top of adaptive): {xm, ref} — starts from `ref` (the kerb line) and, in the corners
  // where the model says it pays (> P.kxGain s), lets the car centre go to xm past the kerb's outer edge: the wheels on
  // that side over the grass / run-off beyond, the other two still on the kerb (track limits: only all four off counts);
  // never beside gravel or a wall. The lap model then counts that surface's grip and drag.
  function kerbLine(track, corners, X) {
    const N = track.N, step = track.step, hw = track.halfW, kL = track.kerbL, kR = track.kerbR;
    if (!kL || !kR || N % 64 !== 0 || !track.raceLine) return null;
    const base = Float64Array.from(X ? X.ref : track.raceLine);
    const lo = new Float64Array(N), hi = new Float64Array(N);
    const roOK = ro => ro === SURF.GRASS || ro === SURF.RUNOFF;
    const bounds = (use) => {
      for (let i = 0; i < N; i++) {
        const wl = track.wallL[i] + KERB_WALL, wr = track.wallR[i] - KERB_WALL;
        // over a used kerb: outer wheels >= KERB_M inside the kerb's far edge, incl. the rear axle's off-tracking (wb^2 / 2R)
        // (hairpins: the car tracks less precisely at low speed on full lock -> extra margin)
        const ak = Math.abs(track.curv[i]), ot = WB * WB / 2 * ak + 12 * Math.max(0, ak - 0.025), kx = hw[i] + CFG.kerbWidth - HT - KERB_M - ot;
        let eL = kL[i] ? (use[i] || X ? kx : hw[i] - 1.2) : hw[i] - 1.6, eR = kR[i] ? (use[i] || X ? kx : hw[i] - 1.2) : hw[i] - 1.6;
        if (X && use[i]) { const xx = hw[i] + CFG.kerbWidth + X.xm - ot; if (kL[i] && roOK(track.runoffL[i])) eL = xx; if (kR[i] && roOK(track.runoffR[i])) eR = xx; }
        lo[i] = Math.min(Math.max(-eL, wl), -(hw[i] - 1.6)); hi[i] = Math.max(Math.min(eR, wr), hw[i] - 1.6);
      }
    };
    const smooth = d => { const o = blur(d, 2); for (let i = 0; i < N; i++) o[i] = clamp(o[i], lo[i], hi[i]); return o; };
    // 1) every kerb usable -> which corners gain?
    const all = new Uint8Array(N).fill(1);
    bounds(all);
    const wide = smooth(optLine(N, track.px, track.pz, track.nx, track.nz, lo, hi, 45));
    const tB = lineTimes(track, base, !!X), tW = lineTimes(track, wide, !!X), minG = X ? P.kxGain : 0.004;
    const use = new Uint8Array(N), win = [];
    for (const c of corners) {
      const i0 = Math.round((c.sB - 80) / step), i1 = Math.round((c.s1 + 90) / step);
      let n = i1 - i0; if (n < 0) n += N;
      let gain = 0;
      for (let m = 0; m <= n; m++) { const i = ((i0 + m) % N + N) % N; gain += tB[i] - tW[i]; }
      // (X: slow corners only, apex below P.kxV on the reference profile — at speed a line past the kerb costs more
      // grip in the transitions than the lap model sees: the car ran out of front grip in fast S-bends)
      if (gain > minG && !(X && c.vMin > P.kxV)) { win.push([i0, n]); for (let m = 0; m <= n; m++) use[((i0 + m) % N + N) % N] = 1; }
    }
    if (!win.length) return null;
    // 2) final line: kerbs only in those corners
    bounds(use);
    const opt = smooth(optLine(N, track.px, track.pz, track.nx, track.nz, lo, hi, 45));
    // keep the track's line away from the kerbs actually used (fast sections elsewhere stay exactly as they were):
    // blend weight 1 within 30 m of a sample where the line is over the normal limit, fading out over the next 60 m
    // (X: over the kerb line's own limit, in the corners that go past the kerb)
    const R0 = Math.round(30 / step), R1 = Math.round(90 / step), dist = new Float64Array(N).fill(1e9);
    for (let i = 0; i < N; i++) if (X ? use[i] && Math.abs(opt[i]) > hw[i] + CFG.kerbWidth - HT - KERB_M : Math.abs(opt[i]) > hw[i] - 1.15) dist[i] = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 2 * N; i++) { const a = i % N, p = (a + N - 1) % N; if (dist[p] + 1 < dist[a]) dist[a] = dist[p] + 1; }
      for (let i = 2 * N - 1; i >= 0; i--) { const a = i % N, p = (a + 1) % N; if (dist[p] + 1 < dist[a]) dist[a] = dist[p] + 1; }
    }
    const fin = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const u = clamp((dist[i] - R0) / (R1 - R0), 0, 1), w = 1 - u * u * (3 - 2 * u);
      fin[i] = base[i] + (opt[i] - base[i]) * w;
    }
    const tF = lineTimes(track, fin, !!X);
    let sB = 0, sF = 0;
    for (let i = 0; i < N; i++) { sB += tB[i]; sF += tF[i]; }
    if (sF > sB - 0.02) return null;
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) out[i] = fin[i];
    out.gain = sB - sF; out.corners = win.length;
    return out;
  }

  // ---------- pit exit road ----------
  // Race hands a car back at the pit-limiter end line (as it does for the player). From there the AI drives the exit
  // road itself: Race's fast-lane path (continuous at the handback) until the lane's white line ends (render3d draws it
  // on the lane's inner edge while that is off the track or >= 1.4 m clear of the racing line), then it merges.
  function exitRoad(track, pit) {
    if (!pit || typeof pit.laneD !== 'function' || pit.limiterS1 == null) return null;
    const L = track.length, wrap = s => ((s % L) + L) % L, P = pit.length || wrap(pit.exitS - pit.entryS);
    const sd = pit.side || 1, lhw = pit.laneHalfW || 5, st = track.step, N = track.N, KW = CFG.kerbWidth || 1.4;
    const a0 = Math.abs(pit.laneD(wrap(pit.entryS + 0.05)) || 0);
    const a1 = Math.max(pit.laneCenterD != null ? Math.abs(pit.laneCenterD) : Math.abs(pit.laneD(wrap(pit.entryS + P / 2)) || 0), a0 + 0.1);
    const E = { side: sd, s0: pit.limiterS1, len: wrap(pit.exitS - pit.limiterS1), wl: 0, lhw, a0, a1, laneD: pit.laneD, dEnd: 0 };
    E.dEnd = roadD(E, wrap(pit.exitS - 0.05));
    E.cap = pit.exitCap ? { s0: pit.exitCap.s0, len: wrap(pit.exitCap.s1 - pit.exitCap.s0), v: pit.exitCap.kph / 3.6 } : null;   // exit-road speed cap (bend)
    E.wl = E.len;
    for (let u = 0; u <= E.len; u += st) {
      const s = wrap(E.s0 + u), i = Math.round(s / st) % N, ld = pit.laneD(s);
      if (ld == null) { E.wl = u; break; }
      const inn = Math.abs(ld) - lhw, m = (sd < 0 ? track.kerbL[i] : track.kerbR[i]) ? track.halfW[i] + KW : track.halfW[i] - 0.24;
      if (!(inn >= m || inn >= Math.max(0.15, sd * track.raceLine[i] + 1.4))) { E.wl = u; break; }
    }
    return E;
  }
  // lateral d of the exit road at s (Race's fast lane: beside the dashed line, easing into the lane centre as it merges)
  function roadD(E, s) {
    const ld = E.laneD(s);
    if (ld == null) return E.dEnd;
    return ld - E.side * E.lhw * 0.5 * clamp(((ld < 0 ? -ld : ld) - E.a0) / (E.a1 - E.a0), 0, 1);
  }
  // signed distance of s past the limiter-end line (the start of the exit road)
  const exitU = (A, s) => { let u = s - A.exit.s0; u -= Math.floor(u / A.L) * A.L; return u > A.L / 2 ? u - A.L : u; };
  // (s, d) on the exit road, on the lane side of its white line: that car cannot come across into the track yet
  function behindLine(A, s, d) {
    const E = A.exit;
    if (!E) return false;
    const u = exitU(A, s);
    if (u < -30 || u >= E.wl) return false;
    const ld = E.laneD(((s % A.L) + A.L) % A.L);
    return ld != null && E.side * d > Math.abs(ld) - E.lhw + 0.5;
  }

  // ---------- per-track cache ----------
  function prep(track) {
    const c0 = track._ai;
    if (c0 && c0.N === track.N && c0.src === track.raceLine) return c0;
    const N = track.N, step = track.step, L = track.length;
    const line = new Float32Array(N), th = new Float32Array(N), lx = new Float64Array(N), lz = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      line[i] = track.raceLine ? track.raceLine[i] : 0;
      th[i] = Math.atan2(track.tz[i], track.tx[i]);
      lx[i] = track.px[i] + track.nx[i] * line[i]; lz[i] = track.pz[i] + track.nz[i] * line[i];
    }
    let lk = new Float64Array(N);
    for (let i = 0; i < N; i++) { const a = (i + N - 2) % N, b = (i + 2) % N; lk[i] = menger(lx[a], lz[a], lx[i], lz[i], lx[b], lz[b]); }
    lk = blur(lk, 2);
    // noise allowance: 1 on straights, 0 in corners
    const nzf = new Float32Array(N), kw = blur(lk.map(Math.abs), 12);
    for (let i = 0; i < N; i++) nzf[i] = 0.15 + 0.85 * clamp(1 - kw[i] * 250, 0, 1);
    // reference speed profile on the line (for braking points)
    const vr = new Float64Array(N);
    for (let i = 0; i < N; i++) vr[i] = vCorner(lk[i], P.lat, 1);
    for (let pass = 0; pass < 2; pass++) for (let n = N - 1; n >= 0; n--) {
      const j = (n + 1) % N, vb = Math.sqrt(vr[j] * vr[j] + 2 * CFG.perf.brakeDecel(vr[j]) * P.brk * step);
      if (vb < vr[n]) vr[n] = vb;
    }
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < N; n++) {
      const j = (n + 1) % N, va = Math.sqrt(Math.max(0, vr[n] * vr[n] + 2 * Math.max(0.5, CFG.perf.driveAccel(vr[n])) * step));
      if (va < vr[j]) vr[j] = va;
    }
    // corners: regions of |k| > 1/350 merged, with braking points from the reference profile
    // split: an S-bend with no straight between its halves is split where the curvature changes sign (merged, the two
    // halves cancel out and the chicane is dropped, e.g. Vortex T1/T2). Only the kerb line uses the split list: racecraft
    // (braking points, late-braking moves) keeps the merged one (attacks into the chicane made lap-1 contacts there)
    const cornerList = split => {
    const corners = [];
    let i0 = 0;
    while (i0 < N && Math.abs(lk[i0]) > 1 / 350) i0++;
    let cur = null;
    for (let n = 1; n <= N; n++) {
      const i = (i0 + n) % N;
      let on = Math.abs(lk[i]) > 1 / 350;
      if (split && on && cur && Math.sign(lk[i]) !== Math.sign(cur.ang) && Math.abs(cur.ang) > 0.05) { on = false; n--; }   // (sample redone as a new region)
      if (on && !cur) cur = { b: n, e: n, ang: 0 };
      if (cur && on) { cur.e = n; cur.ang += lk[i] * step; }
      if (cur && (!on || n === N)) {
        const p = corners[corners.length - 1];
        if (p && (cur.b - p.e) * step < 25 && Math.sign(p.ang) === Math.sign(cur.ang)) { p.e = cur.e; p.ang += cur.ang; } else corners.push(cur);
        cur = null;
      }
    }
    const cs = [];
    for (const r of corners) {
      if (Math.abs(r.ang) < 0.25) continue;
      let apex = (i0 + r.b) % N;
      for (let n = r.b; n <= r.e; n++) { const i = (i0 + n) % N; if (vr[i] < vr[apex]) apex = i; }
      let sb = apex;
      for (let n = 0; n < N / 3; n++) { const p = (sb + N - 1) % N; if (vr[p] >= vr[sb] - 1e-6) sb = p; else break; }
      cs.push({ s0: ((i0 + r.b) % N) * step, s1: ((i0 + r.e) % N) * step, apex: apex * step, sB: sb * step, dir: r.ang > 0 ? 1 : -1, vMin: vr[apex], vB: vr[sb] });
    }
    if (!cs.length) cs.push({ s0: 0, s1: step, apex: 0, sB: 0, dir: 1, vMin: VTOP, vB: VTOP });
    cs.sort((a, b) => a.s1 - b.s1);
    return cs;
    };
    const cs = cornerList(false);
    const nextC = new Int16Array(N), toBrk = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const s = i * step;
      let ci = 0;
      while (ci < cs.length && cs[ci].s1 < s) ci++;
      if (ci >= cs.length) ci = 0;
      nextC[i] = ci;
      let dB = cs[ci].sB - s; dB = ((dB % L) + L) % L; if (dB > L * 0.75) dB -= L;
      toBrk[i] = dB;
    }
    const pit = track.pit || null;
    let lineK = null, lineX = null, exit = null;
    const csK = cornerList(true);
    try { lineK = kerbLine(track, csK); } catch (e) { lineK = null; }
    // (only built while a difficulty uses it: DIFFICULTY.extreme.kerbX, also the top of the adaptive dial)
    const useX = typeof DIFFICULTY !== 'undefined' && DIFFICULTY.extreme && DIFFICULTY.extreme.kerbX > 0;
    try { lineX = useX ? kerbLine(track, csK, { xm: P.kxM, ref: lineK || line }) : null; } catch (e) { lineX = null; }
    try { exit = exitRoad(track, pit); } catch (e) { exit = null; }
    const A = {
      src: track.raceLine, N, step, L, line, lineK: lineK || line, kerbGain: lineK ? lineK.gain : 0, th, lk, nzf, vr, corners: cs, nextC, toBrk,
      lineX: lineX || lineK || line, xGain: lineX ? lineX.gain : 0,   // two-wheels-off line (b.kw > 1: Extreme's technique)
      kL: track.kerbL, kR: track.kerbR, roL: track.runoffL, roR: track.runoffR,
      wl: track.wallL, wr: track.wallR, px: track.px, pz: track.pz, nx: track.nx, nz: track.nz, hw: track.halfW, kc: track.curv,
      pit: pit ? { side: pit.side || 1, entryS: pit.entryS, exitS: pit.exitS } : null, exit,
    };
    track._ai = A;
    return A;
  }

  // racing line of a brain: normal line blended toward the kerb line by kw (0..1), then toward the two-wheels-off line
  // by kw - 1 (1..2: Extreme's technique)
  const lnI = (A, i, j, u, kw) => {
    const a = A.line[i] + (A.line[j] - A.line[i]) * u;
    if (!(kw > 0)) return a;
    const k = A.lineK[i] + (A.lineK[j] - A.lineK[i]) * u;
    if (kw <= 1) return a + (k - a) * kw;
    return k + (A.lineX[i] + (A.lineX[j] - A.lineX[i]) * u - k) * (kw - 1);
  };
  const lineAt = (A, s, kw) => {
    const f = s / A.step; let i = Math.floor(f); const u = f - i; i %= A.N; if (i < 0) i += A.N;
    return lnI(A, i, i + 1 === A.N ? 0 : i + 1, u, kw);
  };
  const wrapDS = (A, d) => (d > A.L / 2 ? d - A.L : d < -A.L / 2 ? d + A.L : d);

  // planned lateral position at s, x metres ahead of the car
  // line-variation waves must repeat a whole number of times per lap, otherwise the path has a sideways
  // step where s wraps at the start/finish line (the AI braked for that phantom kink)
  function periodic(k, track) { const L = track.length; return Math.max(1, Math.round(k * L / TAU)) * TAU / L; }
  function pathD(b, A, s, x, v) {
    const f = s / A.step; let i = Math.floor(f); const u = f - i; i %= A.N; if (i < 0) i += A.N;
    const j = i + 1 === A.N ? 0 : i + 1;
    const ln = lnI(A, i, j, u, b.kw);
    const hw = A.hw[i] + (A.hw[j] - A.hw[i]) * u;
    const tt = holdTrans ? 0 : x / (v > 6 ? v : 6);   // speed plan: lateral moves by choice are not corners
    const base = b.nA > 0 ? ln + b.nA * A.nzf[i] * (0.6 * Math.sin(s * b.nK1 + b.nP1) + 0.4 * Math.sin(s * b.nK2 + b.nP2)) : ln;
    let w = approach(b.w, b.wT, b.wRate * tt);
    let abs = b.absSide ? b.absSide * (hw - b.absM) : approach(b.absD, b.absDT, b.absRate * tt), pa = null;
    if (b.pitIn) {
      const P0 = A.pit;
      let dd = P0.entryS - s; dd = ((dd % A.L) + A.L) % A.L; if (dd > A.L / 2) dd -= A.L;
      const wp = dd < -10 ? 0 : clamp((420 - dd) / 300, 0, 1);
      if (wp > w) { w = wp; abs = P0.side * (hw - 1.4); }
    } else if (b.pitOut && A.exit) {
      // pit exit: the exit road until its white line ends (nothing moves the car across it), then the pit side until
      // the merge starts (b.poM, set once the way over to the line is clear): one smooth s-based blend the speed plan sees
      const E = A.exit, ue = exitU(A, s), road = ue < E.len && !b.poFix ? roadD(E, s) : b.poD;
      const wp = ue < E.wl || ue < b.poM ? 1 : 1 - U.smooth((ue - b.poM) / b.poLen);
      // on the road / holding the pit side: exactly that lane (a car alongside means dropping back, not a kink in the plan)
      if (wp >= 1 && ue > -30) return ue < E.len ? road : clamp(road, -(hw - EDGE), hw - EDGE);
      if (wp > w) { w = wp; abs = road; }
      if (wp > 0) pa = road;
    }
    const d = base + (abs - base) * w + approach(b.off, b.offT, b.offRate * tt);
    let lo = -(hw - EDGE), hi = hw - EDGE;
    if (ln < lo) lo = ln; if (ln > hi) hi = ln;
    const wlo = A.wl[i] + P.wallM, whi = A.wr[i] - P.wallM;        // street circuits: keep off barriers hugging the kerbs
    if (lo < wlo) lo = wlo; if (hi > whi) hi = whi;
    if (b.free) { const a = abs; if (a < lo) lo = a; if (a > hi) hi = a; }
    if (pa != null) { if (pa < lo) lo = pa; if (pa > hi) hi = pa; }   // pit exit: the lane may still be beyond the track edge
    if (b.nCons > 0) {
      const lo0 = lo, hi0 = hi;
      for (let c = 0; c < b.nCons; c++) {
        const k = b.cons[c];
        // speed plan: a car alongside is assumed to stay alongside (a constraint that just ends ahead would be a
        // phantom kink in the planned path -> braking on the straight)
        if (x > k.xMax && !(holdTrans && P.consPlan)) continue;
        let dO = ln + k.rel;
        if (dO > hw - 1) dO = hw - 1; else if (dO < 1 - hw) dO = 1 - hw;
        if (k.side > 0) { if (dO - SEP < hi) hi = dO - SEP; } else if (dO + SEP > lo) lo = dO + SEP;
      }
      if (lo > hi) {
        // no room: split the difference as with the normal line's envelope (the kerb line must not push a car further
        // out than before), but never into the barrier margin (street circuits)
        if (b.kw > 0) {
          const lnN = A.line[i] + (A.line[j] - A.line[i]) * u;
          const eL = Math.min(-(hw - EDGE), lnN), eH = Math.max(hw - EDGE, lnN);
          if (lo0 < eL && lo < eL) lo = eL; if (hi0 > eH && hi > eH) hi = eH;
        }
        const m = (lo + hi) * 0.5;
        return m < wlo ? wlo : m > whi ? whi : m;
      }
    }
    if (lo > hi) return (lo + hi) * 0.5;
    return d < lo ? lo : d > hi ? hi : d;
  }
  function worldX(A, s, d, out) {
    const f = s / A.step; let i = Math.floor(f); const u = f - i; i %= A.N; if (i < 0) i += A.N;
    const j = i + 1 === A.N ? 0 : i + 1;
    out.x = A.px[i] + (A.px[j] - A.px[i]) * u + d * (A.nx[i] + (A.nx[j] - A.nx[i]) * u);
    out.z = A.pz[i] + (A.pz[j] - A.pz[i]) * u + d * (A.nz[i] + (A.nz[j] - A.nz[i]) * u);
  }
  let holdTrans = false;
  const _p0 = { x: 0, z: 0 }, _p1 = { x: 0, z: 0 }, _p2 = { x: 0, z: 0 };
  function pathCurv(b, A, s, x, v, h) {
    worldX(A, s - h, pathD(b, A, s - h, Math.max(0, x - h), v), _p0);
    worldX(A, s, pathD(b, A, s, x, v), _p1);
    worldX(A, s + h, pathD(b, A, s + h, x + h, v), _p2);
    return menger(_p0.x, _p0.z, _p1.x, _p1.z, _p2.x, _p2.z);
  }

  // ---------- brain ----------
  function create(car, diff, seed, G) {
    diff = diff || DIFFICULTY.medium;
    const rnd = U.rng(((seed | 0) ^ 0x68e31da4) >>> 0);
    const cons = [];
    for (let i = 0; i < 5; i++) cons.push({ rel: 0, relMe: 0, dd: 0, side: 0, xMax: 0, ds: 0, v: 0 });
    const perf = (car.team && car.team.perf) || 1;
    const b = {
      diff, rnd,
      inp: { throttle: 0, brake: 0, steer: 0, boost: false, aeroPress: false, reverse: false },
      // adaptive: compressed field; Extreme (diff.perfK / formK): compressed too — it drives near the limit, a top car with
      // top form would otherwise plan corners the (identical) physics car can't take
      paceFix: Math.pow(perf, P.perfK * (diff.adaptive ? 0.45 : diff.perfK || 1)) * (1 + (rnd() - 0.5) * P.form * (diff.adaptive ? 0.5 : diff.formK || 1)),
      pace: P.base * (1 - (1 - diff.pace) * P.paceK) * Math.pow(perf, P.perfK),
      aggr: diff.aggression, adaptive: !!diff.adaptive, kw: diff.kerb || 0, kwBase: diff.kerb || 0, lead: 0,
      fixedK: diff.fixedK || 0, band: 0, rb: 0, kc: 0, S: null, bandE: null, e: 0,
      stat: { atk: 0, def: 0, dep: 0, atkPl: 0, defPl: 0, depPl: 0 },
      pow: 1 - (1 - diff.pace) * P.powK,
      // optional per-difficulty envelope overrides (extreme drives at the physics limit)
      latP: diff.lat || P.lat, brkP: diff.brk || P.brk, fcKd: diff.fcK || P.fcK, fcK: P.fcK, lim: 0, lockV: diff.lockV || 0, lowK: diff.lowK || P.lowK,
      // technique (Extreme, top of adaptive; from the player's recorded laps): straight-line target (m/s), steering
      // integral gain (the offset a loaded front leaves on exits), curvature blur weight of the speed plan
      vTop: diff.vTop || VTOP, sI: diff.steerI || 0, eI: 0, kBl: diff.kBlur || 0, kX: diff.kerbX || 0, kxE: 0,
      t1Brk: 0.86 + 0.1 * rnd(),
      reactT: rnd() * 0.22 * diff.reaction / 0.3,                     // added to Race's 0.12-0.3 s launch delay
      bogT: rnd() < 0.06 + diff.mistake * 4 ? 0.6 + rnd() * 0.8 : 0,    // slow getaway: throttle capped for a moment
      startMove: false, smN: 0, smWill: false,   // start: at most one move (smWill: willing to cover this start, rolled below)
      nA: Math.max(0.3, diff.lineNoise), nK1: periodic(TAU / (260 + rnd() * 240), G.track), nP1: rnd() * TAU, nK2: periodic(TAU / (110 + rnd() * 80), G.track), nP2: rnd() * TAU,
      atkGap: 0.35 + diff.aggression * 0.8, defGap: 0.25 + diff.aggression * 0.45,
      w: 0, wT: 0, wRate: 1, absSide: 0, absM: 2, absD: 0, absDT: 0, absRate: 2, free: false,
      off: 0, offT: 0, offRate: 1.5, cons, nCons: 0,
      pitIn: false, pitOut: false, pitOutS: 0, poM: Infinity, poLen: 1, poD: 0, poFix: false,   // pit exit: merge start (m past the limiter end) / length, held d
      atk: null, atkSide: 0, atkPh: 0, atkCool: 0, defC: -1, defOn: false, yieldOn: false,
      behindT: 0, behindCar: null,
      lastC: -1, mistX: 0, mistMul: 1, mistBrk: 1,
      rec: 0, recT: 0, stuckT: 0, offTrackT: 0, recFwd: 0,
      vScale: diff.vScale || 1,
      launch: !!(G && G.race && G.race.phase !== 'racing'), t: 0, wasKin: !!car.kinematic, aeroCD: 0, startT: -1, vT: 0, vLim: VTOP, planBrk: Infinity, plPit: null, lastLap: -1,
    };
    b.pace = P.base * (1 - (1 - diff.pace) * P.paceK) * b.paceFix;
    // per-circuit cap on the limit envelope's braking share (BRK_CAP: Extreme / top of the adaptive dial)
    b.brkCap = (G && G.track && BRK_CAP[G.track.id]) || 0;
    if (b.brkCap) b.brkP = Math.min(b.brkP, b.brkCap);
    // wing setup (car.setup): the car drives on its own aero; corner speeds are rescaled by aeroK so a better setup doesn't
    // shift the difficulty calibration (lap estimate ratio ^ AERO_G; exactly 1 without a setup)
    b.aeroK = 1;
    if (car.setup && G && G.track && CFG.setup && CFG.setup.lapTime) {
      // (the gain estimated at this driver's pace: slower corners = less from downforce, the same from drag)
      try { const g = clamp(b.pace * b.pace, 0.6, 1); b.aeroK = clamp(Math.pow(CFG.setup.lapTime(G.track, car.setup, g) / CFG.setup.lapTime(G.track, CFG.setup.aero(null), g), AERO_G[diff.id] || 2.1), 0.9, 1.1); } catch (e) { b.aeroK = 1; }
    }
    if (b.adaptive) {                    // adaptive: dial (warm start), band / pull added in drive; fixedK / fixedE = scripted
      const cal = calOf(G && G.track ? G.track.id : null);
      b.kc = b.fixedK || (diff.fixedE != null ? kOfE(diff.fixedE, cal) : warmK(G));
      if (diff.fixedE != null) b.fixedK = b.kc;
      dialSet(b, diff.fixedE != null ? diff.fixedE : eOfK(b.kc, cal));
    }
    if (G && G.track) { const A = prep(G.track); b.off = b.offT = car.d - lineAt(A, car.s, b.kw); }
    if (G && G.race && !G.attract && !car.isPlayer && G.race.phase !== 'racing') {
      const pA = { easy: 0.035, medium: 0.02, hard: 0.01, extreme: 0.005 }[diff.id] || 0.02;
      car.aiAnticipate = rnd() < pA;
    }
    b.smR = U.rng(((seed | 0) ^ 0x2c1b3c6d) >>> 0);                    // own stream for start craft (leaves mistakes etc. untouched)
    b.smWill = b.smR() < 0.35 + 0.6 * diff.aggression;
    return b;
  }

  // ---------- main entry ----------
  function drive(b, car, G, dt) {
    const inp = b.inp;
    inp.aeroPress = false; inp.boost = false; inp.reverse = false;
    const track = G.track, race = G.race;
    if (!track || car.kinematic) { b.wasKin = !!car.kinematic; inp.throttle = 0; inp.brake = 0; inp.steer = 0; return inp; }
    const phase = race ? race.phase : 'racing';
    if (phase === 'grid' || phase === 'lights') {
      // rare anticipation: Race releases flagged cars in the last moments of the 5th light -> they creep (jump start)
      const creep = car.aiAnticipate && phase === 'lights' && race.lights && race.lights.on >= 5;
      inp.throttle = creep ? 1 : 0; inp.brake = creep ? 0 : car.isPlayer ? 0.45 : 1; inp.steer = 0; return inp;
    }
    // human getaway: extra reaction on top of Race's launch delay, occasional bogged start (TC-limited wheelspin)
    if (b.launch && race && phase === 'racing' && race.t < b.reactT) { inp.throttle = 0; inp.brake = car.isPlayer ? 0.45 : 1; inp.steer = 0; return inp; }
    const A = prep(track);
    b.t += dt;
    if (b.startT < 0) b.startT = race ? race.t : 0;
    if (b.wasKin) {   // just released from the pit lane (Race hands back at the limiter-end line)
      b.wasKin = false;
      // pit-exit mode only for a real release onto the exit road (not for cars put on the grid after qualifying)
      const E = A.exit, ue = E ? exitU(A, car.s) : 0;
      b.pitOut = !!E && ue > -10 && ue < E.len + 30 && E.side * car.d > 0;
      if (b.pitOut) { b.pitOutS = car.s; b.poM = Infinity; b.poD = E.dEnd; b.poFix = false; }
      b.off = b.offT = 0; b.w = b.wT = 0; b.atk = null;
    }
    const v = car.speed;
    const idx = car.idx >= 0 ? car.idx : Math.round(car.s / A.step) % A.N;
    const rel = wrapA(car.h - A.th[idx]);
    const cosRel = Math.cos(rel);
    b.aeroCD -= dt; b.atkCool -= dt;

    strategy(b, car, G, race, track, A);
    const finished = !!car.finished || phase === 'finished';
    if (b.launch && (race && race.t - b.startT > 25 || (car.lap || 0) > 1)) b.launch = false;
    const startPh = !!b.launch && !finished;

    // ----- recovery state machine -----
    if (b.rec === 0) {
      if (v > 5 && cosRel < 0.2) b.rec = 2;                          // spinning / going backwards fast
      else if (v < 4 && (cosRel < 0.35 || b.stuckT > 1.3)) { b.rec = 3; b.recT = 0; b.recFwd = b.stuckT > 1.3 ? 0 : 1; }
    }
    if (b.rec === 2) {
      inp.throttle = 0; inp.brake = 1; inp.steer = 0;
      if (v < 4) { b.rec = cosRel < 0.5 ? 3 : 0; b.recT = 0; b.recFwd = 1; }
      return inp;
    }
    // beached (gravel) or otherwise going nowhere for a long time: put the car back on track (like the player's R)
    if (v < 1.5 && !startPh && !finished && phase === 'racing') b.beachT = (b.beachT || 0) + dt; else if (v > 5) b.beachT = 0;
    if (b.beachT > 8 && typeof Physics !== 'undefined' && Physics.resetToTrack) {
      Physics.resetToTrack(car, track);
      b.beachT = 0; b.rec = 0; b.recTot = 0; b.stuckT = 0; b.recSg = 0; b.off = b.offT = car.d - lineAt(A, car.s, b.kw); b.w = b.wT = 0;
    }
    if (b.rec === 3) return recover(b, car, G, A, rel, dt);

    if (b.adaptive) adaptDrive(b, car, G, dt);
    wetSet(car);
    // ----- racecraft: perception + lateral decisions + speed limits -----
    racecraft(b, car, G, A, track, v, idx, startPh, finished, dt);

    // advance the planner state
    b.w = approach(b.w, b.wT, b.wRate * dt);
    b.off = approach(b.off, b.offT, b.offRate * dt);
    b.absD = approach(b.absD, b.absDT, b.absRate * dt);

    // ----- speed plan -----
    const cl = (1 - 0.1 * (car.dirty || 0)) * sCl(car);
    // safety margin grows as grip drops (wet / worn): relative to a fresh dry tyre of this compound
    const comp = (car.tyre && COMPOUNDS[car.tyre.compound]) || COMPOUNDS.M;
    // (a tyre out of its window: the cornering grip it really has left, wLat)
    const gRel = clamp(car.grip * wLat / comp.grip, 0.3, 1);
    b.gMargin = 1 - P.wetK * (1 - gRel);
    // corner grip share (technique: Extreme / top of adaptive) like brk / fcK: the higher share in clean air only (b.lim,
    // last step's), the standard one in traffic (offsets / cars alongside: the car ran wide out of chicanes with it)
    const gripL = car.grip * wLat * lerp(P.lat, b.latP, b.lim) * b.gMargin;
    b.lowKe = lerp(P.lowK, b.lowK, b.lim);
    // kerb line only with real grip (slicks on a wet track track too loosely at hairpin speeds)
    b.kw = b.kwBase > 0 ? b.kwBase * clamp((car.grip - 0.6) / 0.15, 0, 1) : 0;
    // technique (b.kX): the two-wheels-off line on top of a full kerb line, in clean air only (b.lim, last step's), faded
    // in / out over ~1.5 s so a car appearing alongside never snaps the path sideways
    b.kxE = approach(b.kxE, b.kw >= 0.999 ? b.kX * b.lim : 0, dt * 0.7);
    if (b.kxE > 0 && b.kw >= 0.999) b.kw = 1 + b.kxE;
    let pace = b.pace * (finished ? 0.62 : 1) * (startPh ? 0.985 : 1);
    // a lane / offset change still under way near a braking zone (traffic): the path the car will steer is tighter than the
    // speed plan's (it freezes those transitions) -> a 5 % corner-speed margin until it is back on its path
    if (!startPh && A.toBrk[idx] < 150 && !(b.atk && b.atkPh >= 2) && (Math.abs(b.w - b.wT) > 0.05 || Math.abs(b.off - b.offT) > 0.4)) pace *= 0.95;   // (not in a committed pass)
    // limit envelope (extreme's brk / fcK) only on a dry track, on the line, in clean air; standard margins in any fight / traffic
    const clean = !(G.weather && G.weather.wet > 0) && gRel > 0.9 && !startPh && !finished && !b.atk && !b.defOn && !b.yieldOn && !b.pitIn && !b.pitOut && b.nCons === 0 && b.vLim >= b.vTop && Math.abs(b.off) < 0.6 && b.w < 0.2 && !car.offTrack;
    b.lim = approach(b.lim, clean ? 1 : 0, dt * (clean ? 0.5 : 5));
    b.fcK = lerp(P.fcK, b.fcKd, b.lim);
    // adaptive: the dial sets the braking share directly (clean air / slightly earlier in traffic)
    let brkMul = (b.adaptive ? lerp(b.brkF, b.brkP, b.lim) : lerp(P.brk, b.brkP, b.lim) * Math.min(1, pace * pace) / Math.pow(b.diff.brakeEarly, P.brkK))
      * (startPh ? b.t1Brk : 1) * (b.lateBrk > 1 && b.lateCap ? 1 : b.lateBrk || 1);
    // late-braking move (racecraft sets lateBrk + lateCap): the braking share may rise by lateBrk, but only up to lateCap
    // (ATK table below: Extreme up to the car's physical limit); corner speeds stay those of the plan
    if (b.lateBrk > 1 && b.lateCap) brkMul = Math.min(brkMul * b.lateBrk, Math.max(brkMul, b.lateCap));
    // mistakes: rolled once per corner
    const ci = A.nextC[idx];
    if (ci !== b.lastC) {
      b.lastC = ci; b.mistMul = 1; b.mistBrk = 1;
      if (!startPh && !finished && b.rnd() < b.diff.mistake * P.mistK) {
        if (b.rnd() < 0.5) b.mistBrk = 1.08 + 0.08 * b.rnd(); else b.mistMul = 1.03 + 0.03 * b.rnd();
      }
    }
    const cc = A.corners[ci];
    b.mistX = wrapDS(A, cc.s1 - car.s);
    const K = speedPlan(b, car, A, v, gripL, cl, pace, brkMul);
    // where the plan first wants the car slower than it is now: the braking point for the speed actually carried
    // (racecraft's toBrk, next step; Infinity = nothing within the plan's horizon)
    b.planBrk = Infinity;
    for (let q = 0; q < K; q++) if (kV[q] < v - 0.5) { b.planBrk = Math.max(0, kX[q]); break; }
    const xl = v * P.lag;
    let k = 0;
    while (k < K - 2 && kX[k + 1] <= xl) k++;
    const t = clamp((xl - kX[k]) / Math.max(1e-3, kX[k + 1] - kX[k]), 0, 1);
    let vT = kV[k] + (kV[k + 1] - kV[k]) * t, aFF = kA[k];
    if (car.offTrack) vT = Math.min(vT, Math.max(18, v - 2));
    let followFF = 0, trafficLim = false;
    // held by the car ahead: its speed / braking set the target; the plan's own braking still applies while this car is
    // at (or above) the plan's speed — following into a braking zone on a car's tow (faster than it, tow / boost / Straight
    // mode) it braked only as hard as the leader and reached the corner ~25 km/h too fast (Vortex T1, then a cut T2)
    if (b.vLim < vT) { const vTp = vT; vT = b.vLim; aFF = v > vTp - 1 ? aFF : 0; followFF = b.vLimA; trafficLim = true; }
    // attacking out of the tow: aim for the defender's speed + the attack margin even above the difficulty's straight-line
    // cap (tow + boost + Straight mode do the rest), still braking in time for every slower point of the plan ahead
    b.capS = b.vTop * b.vScale * Math.min(1, pace) - 0.5;   // the plan's straight-line speed (difficulty-scaled)
    if (b.atkBoost > 0 && b.atk && !trafficLim && aFF <= 0 && !car.offTrack) {
      const capS = b.capS, aB = 0.8 * CFG.perf.brakeDecel(v, car.grip) * brkMul;
      let vA = Math.min(b.vTop, b.atk.speed + b.atkBoost);
      for (let q = 0; q < K; q++) if (kV[q] < capS) { const va = Math.sqrt(kV[q] * kV[q] + 2 * aB * Math.max(0, kX[q])); if (va < vA) vA = va; }
      if (vA > vT && vA <= b.vLim) vT = vA;
    }
    b.vT = vT;
    if (P.dbg) { let km = 0; for (let q = 1; q < K; q++) if (kV[q] < kV[km]) km = q; b.dbgPlan = { aFF, x: kX[km], v: kV[km], vc: kVc[km], kk: kK[km], trafficLim, K };
      if (P.dbgCar === car.code) { const out = []; for (let q = 0; q < K; q += 2) { const i = (Math.floor(car.s / A.step) + q * STRIDE) % A.N; out.push(`${kX[q].toFixed(0)}:${(kPX[q] - A.px[i]) * A.nx[i] + (kPZ[q] - A.pz[i]) * A.nz[i] > 0 ? '+' : ''}${((kPX[q] - A.px[i]) * A.nx[i] + (kPZ[q] - A.pz[i]) * A.nz[i]).toFixed(1)}/L${A.line[i].toFixed(1)}/v${(kVc[q] * 3.6) | 0}`); } b.dbgPath = out.join(' '); } }
    // adaptive: throttle aimed at the planned speed a little further on when it is rising (earlier, fuller throttle out of corners)
    let vThr = vT;
    if (b.lead > 0 && !car.offTrack && !startPh) {
      const xl2 = v * (P.lag + b.lead);
      let k2 = k;
      while (k2 < K - 2 && kX[k2 + 1] <= xl2) k2++;
      const t2 = clamp((xl2 - kX[k2]) / Math.max(1e-3, kX[k2 + 1] - kX[k2]), 0, 1), v2 = kV[k2] + (kV[k2 + 1] - kV[k2]) * t2;
      if (v2 > vThr) vThr = Math.min(v2, b.vLim);
    }

    // ----- steering -----
    inp.steer = steer(b, car, A, v, rel, idx, dt);

    // ----- throttle / brake -----
    const cdMul = lerp(1, CFG.aero.straightCdA, car.aeroT || 0) * (1 - (car.tow || 0) * CFG.slipstream.dragCut);
    const drag = CFG.perf.drag(v, car.setup ? cdMul + (car.setup.cdK - 1) * (1 - (car.aeroT || 0) * (1 - CFG.setup.zoneKeep)) * (1 - (car.tow || 0) * CFG.slipstream.dragCut) : cdMul) + C.rollingResist * W0;
    const ev = v - vT;
    // held up by a car ahead that is not braking (e.g. the pack off the grid): lift and coast, don't touch the brakes
    // (on a straight before the braking zone, a car in the next lane that is merely lifting: lift, never brake)
    const coastOnly = trafficLim && followFF <= 0 && aFF <= 0 && !car.offTrack && (ev < 4 || (b.strOpen && b.vLimAdd > 1.6 && ev < 10));
    if (coastOnly && ev > 0.3) { inp.throttle = 0; inp.brake = 0; }
    else if ((aFF > 0 && ev > -1) || (followFF > 0 && ev > -0.5) || ev > 0.3) {
      let aCmd = Math.max(aFF, followFF) + (followFF > 0 ? 3 : P.kB) * ev;
      // friction circle: never stamp on the brakes while loaded up in a corner (spins the car)
      const lu = Math.min(1, Math.abs(car.aLat) / CFG.perf.latAccel(Math.max(v, 5), car.grip * wLat, sCl(car)));
      const aMax = bDec(car, v, car.grip * brkW(v)) * Math.max(0.22, 1 - P.ctlFC * lu * lu);
      if (aCmd > aMax) aCmd = aMax;
      // pedal -> force: physics caps each axle at pedal * min(share * brakeForce, 1.3 * tyre capacity)
      const tyreF = Math.max(1000, bDec(car, v, car.grip * brkW(v)) * MASS - drag);
      inp.brake = clamp((aCmd * MASS - drag) / Math.min(C.brakeForce, 1.3 * tyreF), 0, 1);
      inp.throttle = 0;
    } else {
      const F = P.kT * (vThr - v) * MASS + drag;
      inp.throttle = clamp(Math.max(F * Math.max(v, 1) / C.enginePower, F / (C.maxDriveForce * 1.2)), 0, b.pow);
      // tyre out of its window: drive only what the rear can take while it is loaded sideways, as a TC that sees the side
      // load would allow (the real one lets the rear step out; x1.05: physics' rear grip share)
      if (wDrv < 1) {
        const lu = Math.min(1, Math.abs(car.aLat) / (CFG.perf.latAccel(Math.max(v, 5), car.grip * wLat, sCl(car)) * CFG.perf.latLow(v)));
        const Fc = 1.05 * (dAcc(car, v, car.grip * wDrv, 1e12) * MASS + CFG.perf.drag(v, sCd(car)) + C.rollingResist * W0) * Math.sqrt(Math.max(0.1, 1 - 0.9 * lu * lu));
        inp.throttle = Math.min(inp.throttle, Math.max(Fc * Math.max(v, 4) / C.enginePower, Fc / (C.maxDriveForce * 1.2)));
      }
      inp.brake = 0;
    }
    if (b.launch && b.bogT > 0 && race && race.t - b.reactT < b.bogT && v < 25) inp.throttle = Math.min(inp.throttle, 0.55);
    // player car driven by the AI: never hold the brake at a standstill (that engages the player's reverse)
    if (car.isPlayer && v < 0.8 && inp.brake > 0.45) inp.brake = 0.45;
    // cool-down after the flag: lift and coast down gently on straights instead of braking hard at the line
    if (finished && inp.brake > 0.15 && A.toBrk[idx] > 40) inp.brake = 0.15;   // unless a braking zone is close
    if (car.reverse && !inp.reverse) inp.throttle = Math.max(inp.throttle, 0.1);

    // ----- stuck detection (wants to go, doesn't move) -----
    if (v < 1.5 && vT > 5 && !startPh) b.stuckT += dt; else b.stuckT = Math.max(0, b.stuckT - dt);

    b.G = G;
    energy(b, car, A, v, K, gripL, cl, finished, startPh);
    return inp;
  }

  // backward pass along the planned path; fills kX/kV/kA, returns sample count
  function speedPlan(b, car, A, v, grip, cl, pace, brkMul) {
    const N = A.N, step = A.step, dS = STRIDE * step;
    const X = Math.min(340, 50 + v * 0.8 + v * v / 30);
    const K = Math.min(MAXK, Math.ceil(X / dS) + 3);
    const i0 = Math.floor(car.s / step), x0 = i0 * step - car.s;
    holdTrans = !b.free;
    for (let k = 0; k < K; k++) {
      const i = (i0 + k * STRIDE) % N, x = x0 + k * dS;
      const d = pathD(b, A, i * step, x > 0 ? x : 0, v);
      kX[k] = x; kPX[k] = A.px[i] + A.nx[i] * d; kPZ[k] = A.pz[i] + A.nz[i] * d;
      kG[k] = b.kw > 1 ? surfGrip(A.hw[i], d, A.kL[i], A.kR[i], A.roL[i], A.roR[i]) : kerbGrip(A.hw[i], d, A.kL[i], A.kR[i]);   // wheels over a kerb (/ past it): less grip there
      const dv = d - lnI(A, i, i, 0, b.kw); kDv[k] = dv < 0 ? -dv : dv;
    }
    holdTrans = false;
    for (let k = 1; k < K - 1; k++) kK[k] = menger(kPX[k - 1], kPZ[k - 1], kPX[k], kPZ[k], kPX[k + 1], kPZ[k + 1]);
    kK[0] = kK[1]; kK[K - 1] = kK[K - 2];
    // [1 2 1] smoothing: a kink where the planned path meets a limit (edge / car alongside) is rounded off by the car
    // over ~10-20 m, it is not a hairpin (unsmoothed it made the AI brake early on straights)
    // (only where the path is off the racing line: on the line the curvature is the real corner's)
    if (P.kSmooth) {
      let p0 = kK[0];
      for (let k = 1; k < K - 1; k++) {
        const c0 = kK[k];
        if (kDv[k - 1] > 0.4 || kDv[k] > 0.4 || kDv[k + 1] > 0.4) kK[k] = (p0 + 2 * c0 + kK[k + 1]) * 0.25;
        p0 = c0;
      }
    }
    // technique (b.kBl): the car rounds its planned path off over ~25-35 m (it drives a wider arc than the 12 m samples
    // say), so plan on 2 more [1 2 1] passes everywhere; tight corners (R < 1 / P.kBlK) keep their peak curvature.
    // Clean air only (b.lim): in traffic the path moves (offsets, cars alongside) and the car ran wide out of chicanes
    const kBl = b.kBl * b.lim;
    for (let r = 0; r < 2 && kBl > 0; r++) {
      let p0 = kK[0];
      for (let k = 1; k < K - 1; k++) {
        const c0 = kK[k], nb = (p0 + 2 * c0 + kK[k + 1]) * 0.25;
        if (!(Math.abs(c0) > P.kBlK && Math.abs(nb) < Math.abs(c0))) kK[k] = c0 + (nb - c0) * kBl;
        p0 = c0;
      }
    }
    for (let k = 0; k < K - 1; k++) kL[k] = Math.hypot(kPX[k + 1] - kPX[k], kPZ[k + 1] - kPZ[k]);
    for (let k = 0; k < K; k++) {
      const m = kX[k] < b.mistX ? b.mistMul : 1, gk = grip * kG[k];
      let vc = vCornerL(kK[k], gk * b.lowKe, cl, b.vTop);                       // slow corners: extra margin (little aero, traffic)
      if (vc > 30) vc = Math.min(vCornerL(kK[k], gk, cl, b.vTop), vc * (1 + (1 / b.lowKe - 1) * Math.min(1, (vc - 30) / 20)));
      if (b.lockV > 0 && vc < 40) {                                   // near full lock (hairpins): smoothed curvature, modest cut only
        const km = (Math.abs(kK[k > 0 ? k - 1 : k]) + Math.abs(kK[k]) + Math.abs(kK[k < K - 1 ? k + 1 : k])) / 3;
        const vl = Math.max(vLock(km, b.lockV), vc * 0.85); if (vl < vc) vc = vl;
      }
      kVc[k] = Math.min(b.vTop * b.vScale, vc * pace * m * b.vScale * b.aeroK);   // vScale: whole speed plan (fixed difficulties); aeroK: setup
    }
    kV[K - 1] = kVc[K - 1]; kA[K - 1] = 0;
    for (let k = K - 2; k >= 0; k--) {
      const vn = kV[k + 1], ak = kK[k] < 0 ? -kK[k] : kK[k];
      const lu = vn * vn * ak / CFG.perf.latAccel(vn, grip * kG[k], cl);
      // trail-braking (fcK < 1) only into open corners: hairpins are braked for in a straight line
      const fk = b.fcK < 1 && ak > 0.03 ? b.fcK + (1 - b.fcK) * Math.min(1, (ak - 0.03) / 0.03) : b.fcK;
      const fr = Math.max(0.06, 1 - lu * lu * fk);
      const mb = kX[k] < b.mistX ? b.mistBrk : 1;
      const ab = brkMul * mb * bDec(car, vn, car.grip * kG[k] * brkW(vn)) * fr * b.gMargin * Math.sqrt(b.vScale);   // slower levels brake a little earlier, still firmly
      const vb = Math.sqrt(vn * vn + 2 * ab * kL[k]);
      if (vb < kVc[k]) { kV[k] = vb; kA[k] = ab / mb; } else { kV[k] = kVc[k]; kA[k] = 0; }
    }
    return K;
  }

  function steer(b, car, A, v, rel, idx, dt) {
    const cr = Math.cos(rel), sr = Math.sin(rel);
    const xF = C.cgToFront * cr, sF = car.s + xF, dF = car.d + C.cgToFront * sr;
    const dP = pathD(b, A, sF, xF, v), dP2 = pathD(b, A, sF + 2, xF + 2, v);
    const f = sF / A.step; let i = Math.floor(f); const u = f - i; i %= A.N; if (i < 0) i += A.N;
    const j = i + 1 === A.N ? 0 : i + 1;
    const thF = A.th[i] + wrapA(A.th[j] - A.th[i]) * u;
    const kc = A.kc[i];
    const beta = car.speed > 3 ? Math.atan2(car.vLat, Math.max(1, car.vLong)) * P.course : 0;
    const psiE = wrapA(thF + Math.atan2(dP2 - dP, 2 * (1 - kc * dP)) - car.h - beta);
    let e = dF - dP;
    // technique (b.sI): integral of the cross-track error (leaky, P.sIT s; clamped) — a loaded front leaves a steady ~1 m
    // offset to the outside on fast exits that the proportional term alone never removes (the AI ran wide there)
    if (b.sI > 0 && dt > 0) {
      b.eI = v < 8 ? 0 : clamp(b.eI * (1 - dt / P.sIT) + e * dt, -P.sIM, P.sIM);
      e += b.sI * b.eI;
    }
    const xL = xF + v * P.tFF;
    const kap = pathCurv(b, A, car.s + xL, xL, v, 4 + v * 0.05);
    const delta = Math.atan(WB * kap) * P.kFF + P.kH * psiE - Math.atan2(P.kE * e, v + P.vE) - P.kR * (car.r - v * kap);
    // the AI steers with the base lock only (in hairpins it is already past the front's peak slip, extra lock just scrubs):
    // scale + clamp the input so the wheel angle is exactly what the base lock (and the physics grip cap) would give
    const va = Math.abs(car.vLong), sp = car.speed, base = C.steerMax / (1 + va / C.steerSpeedRef), lock = CFG.perf.steerLock(va);
    // (two-wheels-off line: the grip of the surface under the front axle too, or the lock past the kerb over-slips the front)
    const gS = b.kw > 1 ? surfGrip(A.hw[i], dF, A.kL[i], A.kR[i], A.roL[i], A.roR[i]) : 1;
    const capG = sp > 8 ? WB * CFG.perf.latAccel(sp, (car.grip || 1) * gS, sCl(car)) * CFG.perf.latLow(sp) * 1.12 / (sp * sp) + C.peakSlip * 0.95 : Infinity;
    const smax = clamp(capG, base, lock);
    const lim = Math.min(car.offTrack && v < 14 ? 0.35 + v * 0.03 : 1,   // full lock on grass kills traction (TC)
      Math.min(base, capG) / Math.min(lock, capG));
    return clamp(delta / smax, -lim, lim);
  }

  // ---------- racecraft ----------
  function racecraft(b, car, G, A, track, v, idx, startPh, finished, dt) {
    b.nCons = 0; b.vLim = b.vTop; b.vLimA = 0; b.free = false; b.lateBrk = 1; b.lateCap = 0; b.atkBoost = 0;
    const cars = G.cars, L = A.L, hw = A.hw[idx];
    // distance to the braking point: the corner list's, or the speed plan's own (last step: where the plan first brakes for
    // the speed actually carried) when that comes first — a chicane merged out of the list (Vortex T1/T2) otherwise looked
    // like 300 m more straight: attacks swung across it and cut T2. No late-braking move into such an unlisted braking zone
    const toBrk0 = A.toBrk[idx], toBrk = Math.min(toBrk0, b.planBrk), unlisted = b.planBrk < toBrk0 - 40;
    const ci = A.nextC[idx], cn = A.corners[ci];
    const onStr = toBrk > 0 && Math.abs(A.lk[idx]) < 1 / 450;
    b.strOpen = onStr && toBrk > 40; b.vLimAdd = 0;
    let ah = null, ahDs = 1e9, bh = null, bhDs = -1e9, lapper = null, lapDs = -1e9;
    const myRD = car.raceDist || 0;
    for (let n = 0; n < cars.length; n++) {
      const o = cars[n];
      if (o === car || o.kinematic || o.dnf) continue;
      let ds = o.s - car.s; if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      if (ds > 220 || ds < -90) continue;
      const dd = o.d - car.d, ads = ds < 0 ? -ds : ds, add = dd < 0 ? -dd : dd;
      const closing = v - o.speed;
      // alongside (or about to be): leave a car's width
      if (b.nCons < 5 && add > 1.2 && add < 6 && (ads < LEN + 1.5 || (ds < 0 && ds > -30 && -closing * 1.2 > ads - LEN))) {
        const k = b.cons[b.nCons++];
        k.rel = o.d - lineAt(A, o.s, b.kw); k.relMe = car.d - lineAt(A, car.s, b.kw); k.dd = dd;
        k.side = dd > 0 ? 1 : -1; k.xMax = 40 + v * 1.2; k.ds = ds; k.v = o.speed;
      }
      // (an AI car still on the pit exit road behind its white line is nobody to attack, defend against or yield to)
      const inLane = o.aiPitRoad && behindLine(A, o.s, o.d);
      if (ds > 0 && ds < ahDs && !inLane) { ah = o; ahDs = ds; }
      if (ds < 0 && ds > bhDs && !inLane) { bh = o; bhDs = ds; }
      if (ds < 0 && ds > -80 && o.raceDist != null && o.raceDist > myRD + L * 0.5 && ds > lapDs && !inLane) { lapper = o; lapDs = ds; }
      // collision avoidance: car ahead in my path
      // (the car I'm passing, once I'm out beside its line: judged on where it is, not on its predicted drift - the racing
      // line swinging across would otherwise keep a faster car stuck behind it)
      const passOut = b.atk === o && b.atkPh >= 2 && Math.abs(o.d - car.d) > 2.3;
      if (ds > 0 && ds < 160) {
        const gap = ds - LEN - 0.6;
        const tC = closing > 0.1 ? Math.max(0, gap) / closing : 99, tt = Math.min(tC, 2.5);
        const sC = o.s + o.speed * tt;
        const dMe = pathD(b, A, sC, Math.max(0, ds + o.speed * tt), v);
        const dO = lineAt(A, sC, b.kw) + (o.d - lineAt(A, o.s, b.kw));
        // o's lateral drift (none for an AI car on the pit exit road behind its white line: it stays in its lane)
        const vdO = passOut || (o.aiPitRoad && behindLine(A, o.s, o.d)) ? 0 : o.speed * Math.sin(wrapA(o.h - A.th[o.idx >= 0 ? o.idx : 0]));
        const dO2 = o.d + vdO * Math.min(tt, 1.2);
        let clr = Math.min(Math.abs(dMe - dO), Math.abs(dMe - dO2), Math.abs(pathD(b, A, o.s, ds, v) - o.d) + (gap > 8 ? 1.5 : 0));
        if (P.clrNew ? gap < 12 + closing * 0.8 : gap < 12 + closing * 0.8 && add < 2.3) clr = P.clrNew ? Math.min(add, Math.abs(car.d - (o.d + vdO * 0.3))) : add;   // close: trust the present lateral positions (a car beside me is for the alongside logic)
        if (clr < 2.35) {
          const buf = (startPh ? 2.5 : 1.6) + (1 - b.aggr) * 1.2;
          const aMe = 0.75 * bDec(car, Math.max(v, 20), car.grip * brkW(v)) * P.brk;
          const ao = o.aLong < -1 ? Math.max(aMe, -o.aLong) : aMe;
          const gapE = gap - buf - v * 0.12;
          const vo = Math.max(0, o.speed + (o.aLong > 0 ? Math.min(o.aLong, 12) * 0.6 : 0));
          const lim = Math.sqrt(Math.max(0, aMe * (vo * vo / ao + 2 * gapE)));
          // only a car that is really braking hands its deceleration on (one merely lifting = follow by coasting)
          if (lim < b.vLim) { b.vLim = lim; b.vLimA = o.aLong < -6 || (o.brake || 0) >= 0.15 ? -o.aLong : 0; b.vLimCar = o; b.vLimAdd = add; }
        }
      }
    }

    // default targets
    b.offRate = startPh ? 1.2 : 1.5;
    let offT = 0, wT = 0;
    b.absSide = 0;
    b.pitIn = false;
    const onRoad = b.pitOut && pitOutStep(b, car, G, A, v);   // on the pit exit road: off the track by design

    // off-track rejoin: absolute target moving back onto the asphalt
    // (past the edge by more than its own line goes: the two-wheels-off line runs up to the kerb's outer edge by design)
    const ad = Math.abs(car.d), adX = b.kw > 1 ? Math.max(hw, Math.abs(lineAt(A, car.s, b.kw))) + 0.6 : hw + 0.6;
    if (!onRoad && (ad > adX || b.offTrackT > 0)) {
      if (ad > adX) b.offTrackT = 0.6; else b.offTrackT -= dt;
      if (b.w < 0.5) { b.absD = car.d; b.w = 1; }
      const sd = car.d > 0 ? 1 : -1;
      let traffic = false;
      if (bh && bhDs > -70 && Math.abs(bh.d - sd * (hw - 2)) < 4 && bh.speed > v + 3) traffic = true;
      b.absDT = traffic ? sd * (hw + 0.8) : sd * (hw - 2);
      b.absRate = 1.6; b.free = true; wT = 1; b.wRate = 3;
      // (all four wheels past the kerb: ease off while crossing back — a rejoin that cuts across the inside of the next
      // corner must not gain time, Race's track-limits rule counts that as a strike)
      b.vLim = Math.min(b.vLim, ad > hw + CFG.kerbWidth + 0.8 ? Math.max(20, v - 3) : Math.max(25, v));
      b.atk = null;
      b.wT = wT; b.offT = b.off * 0.98;
      return;
    }

    // pit approach
    const race = G.race;
    if (car.wantPit && A.pit && (!race || !race.laps || (car.lap || 0) < race.laps)) {
      const dd = wrapDS(A, A.pit.entryS - car.s);
      if (dd > -15 && dd < 520) { b.pitIn = true; b.atk = null; }
    }

    // blue flags: move off the line on straights and lift a little for a car lapping us
    b.yieldOn = false;
    if (lapper && !finished && (-lapDs - LEN) / Math.max(v, 10) < 1.2 && !b.pitIn && !b.pitOut) {
      b.yieldOn = true;
      if (onStr) {
        const ln = lineAt(A, car.s, b.kw);
        b.absSide = ln > 0 ? -1 : 1; b.absM = 1.6; wT = 1; b.wRate = 1.2;
        if (lapDs > -35) b.vLim = Math.min(b.vLim, v * 0.985);
      }
    }

    // attack / slipstream
    if (ah && !finished && !b.pitIn && !b.pitOut && !b.yieldOn && !(startPh && !b.merge)) {
      const gap = ahDs - LEN, gapT = gap / Math.max(v, 10), closing = v - ah.speed;
      const oRel = ah.d - lineAt(A, ah.s, b.kw);
      if (b.atk && b.atk !== ah) { b.atk = null; }
      const lappedAhead = ah.raceDist != null && myRD > ah.raceDist + L * 0.5;
      if (!b.atk && b.atkCool <= 0 && gapT < b.atkGap && (closing > 0.3 || lappedAhead || gapT < 0.3) && (onStr || toBrk > -5)) {
        b.atk = ah; b.atkPh = 1; b.atkSide = 0; b.stat.atk++; if (ah === G.player) b.stat.atkPl++;
      }
      if (b.atk === ah) {
        // hunger (Easy 0.25 .. Extreme 1; Adaptive: its effort dial): the closing speed an attack aims for with tow + boost
        // (+ Overtake Mode), and how early on a straight it pulls out to use it
        const hg = b.adaptive ? clamp(0.3 + 0.6 * (b.e != null ? b.e : 0.75), 0.25, 1) : b.aggr;
        const lbA = atkCraft(b), dvA = lbA.dv + (car.overtake ? 2 : 0);
        if (b.atkPh === 1) {
          offT = oRel;                                          // tuck into the tow
          if (onStr && toBrk > 120) b.atkBoost = dvA;           // hunt it down the straight (tow + boost, above the usual cap)
          // early-to-mid straight: pull out once in the tow if that speed gets me level before the braking point
          const need = (gap + LEN) * Math.max(v, 20) / Math.max(1, Math.max(0, closing) + dvA);
          const early = onStr && toBrk > 60 && gapT < 0.45 + 0.4 * hg && toBrk > need * (1.35 - 0.45 * hg);
          const pull = early || gap < 5 + Math.max(0, closing) * 1.3 || (toBrk < 90 && gap < 30) || (!onStr && gap < 4);
          if (pull) {
            const side = chooseSide(A, ah, cn.dir, idx, ah.d + ah.speed * Math.sin(wrapA(ah.h - A.th[ah.idx >= 0 ? ah.idx : 0])) * 0.8);
            if (side) { b.atkSide = side; b.atkPh = 2; b.atkMin = ahDs; b.atkT = 0; }
          }
          if (gapT > b.atkGap * 1.6) { b.atk = null; }
        }
        if (b.atkPh >= 2) {
          offT = oRel + b.atkSide * (SEP + 0.5 + 0.4 * hg);
          b.offRate = 3.2 + 1.5 * hg;                         // (hungrier: a quicker, decisive move out of the tow)
          if (toBrk > 0 && ahDs > -LEN) b.atkBoost = dvA;       // out of the tow: go for it (drive() lifts the straight cap, boost)
          // not gaining for ~1.5 s on the straight: back into the tow (no hanging out alongside for nothing)
          if (b.atkPh === 2 && toBrk > 0) { b.atkT += dt; if (ahDs < b.atkMin - 0.4) { b.atkMin = ahDs; b.atkT = 0; } else if (b.atkT > 3) { b.atk = null; b.atkCool = 1.5 + b.rnd() * 1.5; offT = oRel; b.atkBoost = 0; } }
          // late-braking move: on the inside (or already level) into the braking zone, brake later than the plan (ATK[..].late,
          // up to ATK[..].cap of the braking limit) to be level / ahead at the apex; never when the defender has the inside
          const lb = atkCraft(b), defInside = Math.sign(ah.d - car.d) === cn.dir && ahDs > 0 && Math.abs(ah.d - car.d) > 1.2;
          if (toBrk < 160 && !unlisted && ahDs < LEN * lb.reach && (b.atkSide === cn.dir || ahDs < LEN * 0.5) && !defInside) { b.lateBrk = 1 + lb.late * clamp((cn.vMin - 18) / 22, 0.35, 1); b.lateCap = lb.cap; }   // (hairpins / chicanes: a third)
          const odp = ah.d + ah.speed * Math.sin(wrapA(ah.h - A.th[ah.idx >= 0 ? ah.idx : 0])) * 0.6;
          const room = b.atkSide > 0 ? (hw - EDGE) - (odp + SEP) : (odp - SEP) + (hw - EDGE);
          // its space: still behind its middle and it is coming across (defending / turning in) -> back out, tuck in behind
          const across = b.atkSide * ah.speed * Math.sin(wrapA(ah.h - A.th[ah.idx >= 0 ? ah.idx : 0]));
          // (also squeezed: no room left between it and the edge / wall while not yet ahead)
          if (ahDs > LEN * 0.3 && ahDs < LEN * 2.2 && ((across > (ah.aiDefending ? 0.5 : 1.5) && Math.abs(ah.d - car.d) < SEP + 0.8) || (room < -0.6 && Math.abs(ah.d - car.d) < SEP + 0.2))) { b.atk = null; b.atkCool = 2 + b.rnd() * 2; offT = oRel; b.atkBoost = 0; b.vLim = Math.min(b.vLim, Math.max(6, ah.speed - 2)); }
          if (ahDs < (cn.vMin < 28 ? LEN * 0.6 : LEN + 0.8) && Math.abs(ah.d - car.d) > 2.1) b.atkPh = 3;                    // alongside: committed
          if (b.atkPh === 2 && ((toBrk < 0 && ahDs > LEN * Math.max(0.8, b.lateCap ? lbA.reach - 2 : 0) && closing < 3) || room < -0.8 || gapT > b.atkGap * 1.5)) {
            b.atk = null; b.atkCool = 2 + b.rnd() * 2; offT = oRel;
          }
        }
      }
    } else if (!ah || ahDs > 150) b.atk = null;
    if (b.atk && b.atkPh === 3 && ahDs < 0) b.atk = null;

    b.threatT = bh && !finished && bh !== lapper && (-bhDs - LEN) / Math.max(v, 10) < (bh.aero === 'straight' || bh.boosting ? 1.0 : 0.8) ? 1 : 0;
    b.threatCar = b.threatT ? bh : null;
    // defend: one move to the inside before a braking zone
    b.defOn = b.defOn && b.defC === ci;
    car.aiDefending = b.defOn;   // (read by an attacking AI: a defensive move means backing out unless already level)
    if (bh && !finished && !b.pitIn && !b.pitOut && !b.yieldOn && !startPh && b.defC !== ci && onStr && toBrk > 30 && toBrk < 260) {
      const gapB = (-bhDs - LEN) / Math.max(v, 10), lapping = bh === lapper;
      if (!lapping && gapB < b.defGap && bh.speed > v - 1 && bh.speed < v + 7 && -bhDs > LEN + 1.5 && Math.abs(bh.d - car.d) < 1.6 && toBrk > 70 && b.rnd() < b.aggr * 0.08) {
        b.defC = ci; b.defOn = true; b.defCar = bh; b.stat.def++; if (bh === G.player) b.stat.defPl++;
      }
    }
    if (b.defOn && !b.atk && wT === 0) {
      // hold the inside through the corner (to the apex): swinging back out under braking overshoots the turn
      // (not in hairpins: a full-lock inside line there just parks the car in front of the pack)
      if (toBrk > -15 || (P.defApex && cn.vMin > 18 && wrapDS(A, cn.apex - car.s) > 0)) { b.absSide = cn.dir; b.absM = 2.3; wT = 1; b.wRate = 2.4 / Math.max(1, hw); if (toBrk < 120 && toBrk > -15) b.lateBrk = 1 + 0.03 * b.aggr; }
      else b.defOn = false;
    }

    // start: hold the grid lane for a while, then merge onto the line
    if (startPh && !b.atk) {
      if (b.gridD == null) { b.gridD = b.absD = b.absDT = car.d; b.off = b.offT = 0; b.w = 1; b.gridS = car.s; }
      if (toBrk > 200 && !b.merge) {                                   // launch straight ahead in the grid lane
        let trav = car.s - b.gridS; if (trav < -L / 2) trav += L;
        // one decisive move inside the first ~150 m (started by 110 m), then hold that lane until the merge
        if (!b.startMove) { if (trav > 110) b.startMove = true; else if (v > 8 && b.smWill) startMove(b, car, G, A, idx, v); }
        else if (b.smMoving) {
          if (Math.abs(b.absD - b.gridD) < 0.02) b.smMoving = false;
          else if (!laneClear(b, car, G, A, v, b.gridD, b.smThreat, idx)) { b.gridD = b.absD; b.smMoving = false; }   // someone got there first: stop, don't swerve back
        }
        b.absDT = b.gridD; b.absRate = b.smMoving ? b.smRate : 1.6; wT = 1; b.wRate = 1; offT = 0;
      }
      else { b.merge = true; wT = 0; b.wRate = 1.2 / Math.max(1, Math.abs(b.gridD - lineAt(A, car.s, b.kw))); }
    }
    // from the braking point (or turn-in of a flat corner) to the apex, a car off the line (aborted pass, avoidance) keeps its offset:
    // drifting back to the line mid-corner tightens the path beyond the planned speed (understeer into the wall)
    if (P.holdOff && !b.atk && !startPh && (toBrk < 0 || Math.abs(A.lk[idx]) > 1 / 300) && wrapDS(A, cn.apex - car.s) > 0 && Math.abs(offT) < Math.abs(b.off)) offT = b.off;    // straights: never cut across into an occupied lane (merging after the start, tucking into a tow, going back to the
    // line, pulling out) - hold the present lane until there is a real gap or the braking zone is close
    b.holdLane = false;
    if (P.holdLane && onStr && toBrk > 70 && !finished && !b.pitIn && !b.pitOut && !b.yieldOn && !b.defOn && !b.free) {
      const o0 = b.offT, w0 = b.wT;
      b.offT = offT; b.wT = wT;
      const x = 30 + v * 0.8, dTgt = pathD(b, A, car.s + x, x, v);
      b.offT = o0; b.wT = w0;
      // (only if the car can still rejoin its line, ~2.5 m/s sideways, before the braking point: a hold released too late
      // put it into the corner metres off line, on a tighter path than planned -> overspeed, front slide, wide exit)
      if (Math.abs(dTgt - car.d) > 0.8 && toBrk > 70 + v * Math.abs(car.d - lineAt(A, car.s + v, b.kw)) / 2.5 && !laneFree(car, G, A, v, car.d, dTgt)) {
        // hold the present lane in absolute terms (the racing line may swing across ahead of the next corner)
        b.absSide = 0; b.absD = b.absDT = car.d - b.off; b.w = 1; wT = 1; offT = b.off; b.holdLane = true;
        b.wRate = Math.min(b.wRate, 2.0 / Math.max(1, Math.abs(car.d - lineAt(A, car.s, b.kw))));   // release gently (<= 2 m/s)
      }
    }
    b.offT = offT; b.wT = wT;
    if (b.w > b.wT && b.wRate < 0.8) b.wRate = 0.8;

    // squeezed between cars / wall: drop back
    if (b.nCons > 0) {
      const d0 = pathD(b, A, car.s, 0, v);
      for (let c = 0; c < b.nCons; c++) {
        const k = b.cons[c], dO = lineAt(A, car.s, b.kw) + k.rel;
        // the car behind yields (never both: that would deadlock)
        if (k.ds > 0.5 && Math.abs(dO - d0) < SEP - 0.6) { b.vLim = Math.min(b.vLim, Math.max(v - 1.5, k.v - 2, 6)); break; }
      }
    }
  }

  // Start craft (called each step in the first ~110 m until it acts once).
  // Cover: a car in the neighbouring lane that is alongside, or gaining with overlap, gets squeezed by half to one car
  //   width (more when it is further alongside / closing faster), always leaving it a car's width plus air on the asphalt.
  // Dive: launching clearly better than the car directly ahead -> up to one car width into a clear lane.
  // The target lane must be clear of every car that will be around during the move; afterwards the lane is held.
  const SM_SEP = SEP + 0.35;          // centre-to-centre spacing kept to the car being covered (≈ 1.15 m of air)
  function startMove(b, car, G, A, idx, v) {
    const L = A.L, hw = A.hw[idx], lim = hw - EDGE;
    let thr = null, thrK = 0, thrDD = 0, ahead = null, aheadDs = 1e9;
    for (const o of G.cars) {
      if (o === car || o.kinematic || o.dnf) continue;
      let ds = o.s - car.s; if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      const dd = o.d - car.d, add = dd < 0 ? -dd : dd, gain = o.speed - v;
      if (add < 1.6 && ds > 0 && ds < aheadDs) { ahead = o; aheadDs = ds; }
      if (add < SEP - 0.2 || add > 7.5) continue;
      // overlap: its nose is past my rear axle, and it is level or still coming
      if (ds <= -LEN + 0.3 || ds > LEN * 0.5) continue;
      if (!(gain > 0.3 || (ds > -LEN * 0.5 && gain > -0.5))) continue;
      const k = clamp((ds + LEN) / (LEN * 1.5), 0, 1) * clamp(0.4 + gain / 2.5, 0.4, 1);
      if (k > thrK) { thr = o; thrK = k; thrDD = dd; }
    }
    let target = null;
    if (thr) {
      const sd = thrDD > 0 ? 1 : -1;
      let m = 0.95 + 0.95 * clamp(thrK * 1.3, 0, 1);                      // half .. one car width
      const room = Math.abs(thrDD) - SM_SEP;                               // never closer than SM_SEP to it
      // leave it a lane: at SM_SEP from my target its centre must still be >= 1.1 m inside the white line (no grass)
      const lane = (hw - 1.1) - SM_SEP - sd * car.d;
      m = Math.min(m, room, lim - sd * car.d, lane);
      if (m >= 0.95) target = car.d + sd * m;
    } else if (ahead && aheadDs - LEN < 12 && v > ahead.speed + 1.5 && b.smR() < 0.02) {
      // dive for the gap beside a slow starter (rolled per step so it is not instant); only if one car width clears it
      for (const sd of b.smR() < 0.5 ? [1, -1] : [-1, 1]) {
        const need = SEP - sd * (car.d - ahead.d);
        if (need > 1.9 || need < 0.5) continue;
        const tg = car.d + sd * Math.max(need, 0.95);
        if (Math.abs(tg) > lim) continue;
        if (laneClear(b, car, G, A, v, tg, null, idx)) { target = tg; break; }
      }
    }
    if (target == null) return;
    if (thr && !laneClear(b, car, G, A, v, target, thr, idx)) return;
    b.gridD = target; b.startMove = true; b.smMoving = true; b.smThreat = thr; b.smN++;
    b.smRate = 1.3 + 0.6 * b.aggr;                                        // m/s sideways: decisive, ~1 s for a car width
    if (thr) b.stat.def++;
  }
  // is lateral target dT (and the way there) free of other cars that will be near me during the move?
  function laneClear(b, car, G, A, v, dT, thr, idx) {
    const L = A.L, lo = Math.min(car.d, dT), hi = Math.max(car.d, dT);
    for (const o of G.cars) {
      if (o === car || o.kinematic || o.dnf) continue;
      let ds = o.s - car.s; if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      const rel = v - o.speed;                                               // + = I'm catching it
      if (ds < -LEN * 1.6 + Math.min(0, rel) * 1.5 || ds > LEN * 1.5 + Math.max(0, rel) * 1.5) continue;
      const oi = o.idx >= 0 ? o.idx : idx;
      const dO = o.d + o.speed * Math.sin(wrapA(o.h - A.th[oi])) * 0.8;      // where it will be shortly
      const sep = o === thr ? SM_SEP : SEP + 0.25;
      for (const x of [o.d, dO]) {
        if (x > lo - sep && x < hi + sep) return false;                       // in the way or too close to the target
      }
    }
    return true;
  }

  // is the way from lateral d0 over to d1 free? (cars beside my own lane .. a car width beyond the target, from alongside
  // / a faster car coming up behind to the next ~2-3 s ahead)
  function laneFree(car, G, A, v, d0, d1) {
    const L = A.L, sg = d1 > d0 ? 1 : -1, e0 = d0 + sg * 1.3, e1 = d1 + sg * 2.3, lo = Math.min(e0, e1), hi = Math.max(e0, e1);
    const cars = G.cars;
    for (let n = 0; n < cars.length; n++) {
      const o = cars[n];
      if (o === car || o.kinematic || o.dnf) continue;
      let ds = o.s - car.s; if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      const rel = v - o.speed;
      if (ds > 20 + v * 0.8 + Math.max(0, rel) * 3 || ds < -(LEN + 1 + Math.max(0, -rel) * 2.5)) continue;
      if (o.d > lo && o.d < hi) return false;
    }
    return true;
  }

  // Pit exit (b.pitOut, from the handback at the limiter-end line): flat out along the exit road while its white line
  // runs beside the car, then the pit side is held only until the way over to the racing line is clear of cars alongside
  // or about to be (closing from behind within ~2 s); then one smooth merge (PO_RATE sideways), paused where it is if a
  // car comes up alongside in the way. Returns true while the car is still on the exit road.
  // Attack craft per difficulty (hungrier at the top). late: braking-share bonus of a late-braking move on the inside /
  // alongside; cap: the braking share it may reach doing so (1 = the car's physical limit); reach: how far behind (car
  // lengths) the move may start. Adaptive interpolates Medium .. Extreme with its effort dial.
  const ATK = {
    // dv: speed margin (m/s) over the defender an attack aims for with tow + boost (above the difficulty's straight cap)
    easy: { late: 0.03, cap: 0.85, reach: 2.5, dv: 3.3 }, medium: { late: 0.06, cap: 0.9, reach: 2.5, dv: 4.8 },
    hard: { late: 0.3, cap: 0.96, reach: 6, dv: 9 }, extreme: { late: 0.35, cap: 0.98, reach: 7, dv: 10 },
  };
  const _atkA = { late: 0, cap: 0, reach: 0, dv: 0 };
  function atkCraft(b) {
    if (!b.adaptive) return ATK[b.diff.id] || ATK.medium;
    const k = clamp(b.e != null ? b.e : 0.75, 0, 1), m = ATK.medium, x = ATK.extreme;
    _atkA.late = lerp(m.late, x.late, k); _atkA.cap = lerp(m.cap, x.cap, k); _atkA.dv = lerp(m.dv, x.dv, k); _atkA.reach = lerp(m.reach, x.reach, k);
    return _atkA;
  }
  const PO_RATE = 3.2;
  function pitOutStep(b, car, G, A, v) {
    const E = A.exit, ue = E ? exitU(A, car.s) : 0;
    car.aiPitRoad = false;   // (read by the other AI cars: this one stays behind the white line)
    if (!E || ue < -30 || ue > E.len + 900 || b.rec) { b.pitOut = false; return false; }
    const onRoad = ue < E.len + 5;
    if (ue < E.len) laneYield(b, car, G, A, E, v);
    if (E.cap) { const uc = ((car.s - E.cap.s0) % A.L + A.L) % A.L; if (uc < E.cap.len && E.cap.v < b.vLim) { b.vLim = E.cap.v; b.vLimA = 0; } }   // (Race's autopilot normally covers it)
    if (ue < E.wl) {   // on the exit road beside the white line (unless reset / pushed onto the track: drive on normally)
      if (behindLine(A, car.s, car.d)) { car.aiPitRoad = true; return true; }
      b.pitOut = false; return false;
    }
    const dL = lineAt(A, car.s + Math.max(30, v), b.kw);
    if (b.poM === Infinity) {
      if (mergeClear(car, G, A, v, car.d, dL)) { b.poM = ue; b.poLen = clamp(Math.abs(dL - car.d) * Math.max(v, 25) / PO_RATE, 30, 240); }
    } else {
      const k = (ue - b.poM) / b.poLen;
      if (k >= 1) { b.pitOut = false; return false; }
      if (k < 0.75 && !mergeClear(car, G, A, v, car.d, dL)) { b.poD = pathD(b, A, car.s, 0, v); b.poFix = true; b.poM = Infinity; }
    }
    return onRoad;
  }
  // The lane runs into the track: a car on the track that is alongside (or will be within ~1 s) where my lane goes next
  // has the right of way -> lift / brake and tuck in behind it (the path stays the lane; a car clearly behind will pass).
  function laneYield(b, car, G, A, E, v) {
    const L = A.L, sM = car.s + Math.max(v, 15) * 0.9, dM = exitU(A, sM) < E.len ? roadD(E, ((sM % L) + L) % L) : E.dEnd;
    for (const o of G.cars) {
      if (o === car || o.kinematic || o.dnf || (o.aiPitRoad && behindLine(A, o.s, o.d))) continue;
      let ds = o.s - car.s; if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      if (ds > LEN + 3 || ds < -(LEN * 0.6 + Math.max(0, o.speed - v))) continue;   // clear ahead / behind and not closing
      const dO = o.d + o.speed * Math.sin(wrapA(o.h - A.th[o.idx >= 0 ? o.idx : 0])) * 0.6;
      const inWay = x => E.side * (x - dM) < 0.5 && Math.abs(x - dM) < SEP + 0.4;   // on the track side of where my lane goes
      if (!inWay(o.d) && !inWay(dO)) continue;
      let lim = Math.min(o.speed - 3, v - 2);
      if (ds > -LEN - 1 && ds < LEN + 1 && Math.abs(o.d - car.d) < SEP + 0.2) lim = Math.min(lim, v - 6);   // side by side: brake
      if (lim < b.vLim) { b.vLim = Math.max(6, lim); b.vLimA = 0; }
    }
  }
  // way over from d0 to d1 (plus a car's width) free of cars alongside or closing from behind within ~2 s?
  // (cars ahead are for the normal following / collision logic)
  function mergeClear(car, G, A, v, d0, d1) {
    const L = A.L, sg = d1 > d0 ? 1 : -1, e0 = d0 + sg * 1.3, e1 = d1 + sg * 2.3, lo = Math.min(e0, e1), hi = Math.max(e0, e1);
    for (const o of G.cars) {
      if (o === car || o.kinematic || o.dnf) continue;
      let ds = o.s - car.s; if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      if (ds > LEN + 2 || ds < -(LEN + 1 + Math.max(0, o.speed - v) * 2)) continue;
      if (o.d > lo && o.d < hi) return false;
    }
    return true;
  }

  // side to pass `o`: inside of the next corner if there is room, else the other side, else 0
  function chooseSide(A, o, dir, idx, od) {
    const hw = A.hw[idx] - EDGE;
    const roomR = hw - (od + SEP + 0.3), roomL = (od - SEP - 0.3) + hw;
    const first = dir > 0 ? roomR : roomL, second = dir > 0 ? roomL : roomR;
    if (first > 0) return dir;
    if (second > 0) return -dir;
    return 0;
  }

  // ---------- 2026 systems: Straight-mode aero + Boost ----------
  function energy(b, car, A, v, K, gripL, cl, finished, startPh) {
    const inp = b.inp;
    const horizon = v * 1.3;
    let clear = true, closeSoon = false;
    const clS = cl * CFG.aero.straightClA;
    for (let k = 0; k < K; k++) {
      const x = kX[k];
      if (x > horizon) break;
      const vk = b.atkBoost > 0 && kV[k] >= b.capS ? 99 : kV[k];   // (attacking: the straight cap is lifted)
      if (vk < v - 1.5 && x < v * 0.6) closeSoon = true;
      if (vk < v - 1) clear = false;
      // (capped at b.vTop, not VTOP: at the VTOP cap x pace a straight looked like a corner once the car passed ~330 km/h,
      // and Extreme closed Straight mode ~400 m before the end of Vortex's long straights)
      if (vCorner(kK[k], gripL, clS, b.vTop) * b.pace < v + 2) { clear = false; if (x < v * 0.7) closeSoon = true; }
    }
    if (b.aeroCD <= 0) {
      if (car.aero === 'corner' && car.inStraightZone && !car.aeroLock && clear && inp.throttle > b.pow - 0.1 && !car.offTrack) { inp.aeroPress = true; b.aeroCD = 0.4; }
      else if (car.aero === 'straight' && closeSoon) { inp.aeroPress = true; b.aeroCD = 0.4; }
    }
    // boost: corner exits while there is charge to spare, all-out when attacking / defending / Overtake Mode
    const cap = car.batteryCap || CFG.energy.cap, soc = car.battery / cap;
    // per-lap plan: spend on corner exits while above the reserve, all-out in battles / Overtake Mode,
    // never sit full (wasted harvest), lift-and-coast before braking zones when running low and not racing anyone
    let reserve = 0.45, vMax = 70;
    if (soc > 0.9) { reserve = 0; vMax = 99; }
    if (car.overtakeNext && !car.overtake) reserve = 0.85;             // Overtake Mode armed: bank energy for next lap
    if (car.overtake) { reserve = 0.02; vMax = 99; }
    if (b.atk && b.atkPh >= 1) { reserve = 0.05; vMax = 99; }
    if (b.threatT > 0) { reserve = Math.min(reserve, 0.2); vMax = 99; }    // car close behind: deploy to hold position
    if (b.defOn) { reserve = 0.15; vMax = 99; }
    if (startPh) { reserve = 0.3; vMax = 75; }
    if (soc < 0.2 && !b.atk && !(b.threatT > 0) && !startPh && !finished) {
      for (let k = 0; k < K; k++) { if (kX[k] > v * 0.45) break; if (kV[k] < v - 4) { inp.throttle = 0; break; } }
    }
    const wantB = !finished && inp.throttle > b.pow - 0.05 && v > 10 && v < vMax && soc > reserve && !car.offTrack && (b.vT > v + 1 || car.overtake) && !car.pitLimiter;
    if (wantB && b.threatT > 0 && soc <= 0.45) { b.stat.dep += 1 / 120; if (b.threatCar === b.G.player) b.stat.depPl += 1 / 120; }
    inp.boost = !finished && inp.throttle > b.pow - 0.05 && v > 10 && v < vMax && soc > reserve && !car.offTrack && (b.vT > v + 1 || car.overtake) && !car.pitLimiter;
  }

  // ---------- recovery: U-turn forward at full lock, reverse with opposite lock when a wall is close ----------
  function recover(b, car, G, A, rel, dt) {
    const inp = b.inp, track = G.track;
    b.recT += dt; b.recTot = (b.recTot || 0) + dt;
    const cr = Math.cos(rel), sr = Math.sin(rel), i = car.idx, v = car.speed;
    inp.boost = false;
    if (cr > 0.85 && (b.recFwd === 1 || v < 1)) { b.recSg = 0; b.rec = 0; b.stuckT = 0; b.recT = 0; b.recTot = 0; b.off = b.offT = car.d - lineAt(A, car.s, b.kw); b.w = b.wT = 0; return inp; }
    // turn direction latched (rel flips sign around ±180°); facing backwards: arc toward the side with more room
    if (!b.recSg) b.recSg = cr > -0.5 ? (rel > 0 ? 1 : -1) : (car.d < 0 ? 1 : -1);
    const sg = b.recSg;
    if (cr > -0.2) b.recSg = rel > 0 ? 1 : -1;
    // distance to the usable edge (asphalt + a little run-off, never beyond the barrier) ahead / behind
    const hw = A.hw[i] + 2.5, eR = Math.min(track.wallR[i] - 0.5, Math.max(hw, car.d + 1)), eL = Math.max(track.wallL[i] + 0.5, Math.min(-hw, car.d - 1));
    const wallAhead = sr > 0.05 ? (eR - car.d) / sr : sr < -0.05 ? (car.d - eL) / -sr : 99;
    const wallBehind = sr > 0.05 ? (car.d - eL) / sr : sr < -0.05 ? (eR - car.d) / -sr : 99;
    if (b.recFwd === 1) {
      inp.reverse = false; inp.steer = -sg * Math.min(car.offTrack ? 0.6 : 0.85, Math.abs(rel) * 1.5);
      inp.throttle = v < 5 ? 1 : v < 7 ? 0.25 : 0; inp.brake = v > 8 ? 0.5 : 0;
      if (b.recT > 0.4 && ((wallAhead < 2.5 + v * 0.35 && cr < 0.6) || (v < 0.6 && b.recT > 1.2))) { b.recFwd = 0; b.recT = 0; }
    } else {
      inp.reverse = true; inp.throttle = 0.8; inp.brake = 0; inp.steer = sg;
      if (car.vLong > 0.8) { inp.throttle = 0; inp.brake = 1; }   // stop before reversing
      if (b.recT > 0.5 && (b.recT > 2.2 || wallBehind < 2.5 || cr > 0.6 || (b.recT > 1.2 && v < 0.4))) { b.recFwd = 1; b.recT = 0; }
    }
    if (b.recTot > 9 && typeof Physics !== 'undefined' && Physics.resetToTrack) {
      Physics.resetToTrack(car, track);
      b.rec = 0; b.recTot = 0; b.stuckT = 0; b.off = b.offT = car.d - lineAt(A, car.s, b.kw); b.w = b.wT = 0;
    }
    return inp;
  }

  // ---------- adaptive difficulty ----------
  // Pace dial k = the field's pace relative to the AI's own reference lap on this circuit / weather (k 1.02 = laps
  // ~2 % quicker; k maps near-linearly to lap time through a calibrated effort table). Effort drives braking share
  // (comes in first: late braking is where a human finds the time), trail-braking, corner speed, how early the throttle
  // goes down on exits (throttle target taken further ahead) and kerb use.
  // The player is timed over 16 mini-sectors per lap in clean air only (no pit, spin, big off, contact, reset, standing
  // start, tyre-grip normalised; < 1 s behind / < 0.5 s ahead of another car, tow, dirty air or no Straight mode = only a
  // lower bound). Rolling best per mini-sector (best of 2, mean of the best 2 of 3-4; outliers > 6 % off the median
  // dropped) vs the reference lap -> player pace ratio; the target is that ratio x TYPICAL (a race lap, not the ideal
  // lap). k is steered straight at it (time constant ~1 lap, faster while the first data come in), warm-started from a
  // persistent skill profile built from every player lap (races, time trials, qualifying; per circuit + global).
  // Battle band: per-car offsets (2-3 cars a little quicker than the player, 2-3 level, the rest slower) + a gentle
  // pull (<= 1.5 %) on cars more than 1.5 s ahead / behind the player. Range: never slower than Easy, up to ~1 %
  // quicker than Extreme (the AI's physical limit).
  const DE = [-0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5];               // effort anchors (0 ≈ Easy, 1 ≈ Extreme)
  const D_PACE = [0.878, 0.898, 0.918, 0.938, 0.955, 0.972, 0.982, 0.99];    // corner-speed multiplier
  const D_BRK = [0.74, 0.8, 0.88, 0.95, 0.98, 1.0, 1.02, 1.04];       // braking share of the limit (clean air)
  const D_FCK = [1, 1, 1, 0.95, 0.88, 0.8, 0.7, 0.7];                 // friction-circle weight (lower = more trail-braking)
  const D_LEAD = [0, 0, 0.05, 0.1, 0.15, 0.2, 0.2, 0.2];              // s: throttle target look-ahead on exits
  const D_KERB = [0, 0, 0, 0.3, 0.8, 1, 1, 1];                        // kerb-line weight
  // past Extreme: Extreme's technique (DIFFICULTY.extreme vTop / steerI / kBlur, weight D_X) and corner grip share (fast /
  // slow corners); no team / form spread on this dial, so its top may plan a little closer to the limit than Extreme
  const D_X = [0, 0, 0, 0, 0, 0, 1, 1];
  const D_LAT = [0.93, 0.93, 0.93, 0.93, 0.93, 0.93, 0.95, 0.97];
  const D_LOWK = [0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.93, 0.9];
  const dialI = (arr, e) => {
    if (e <= DE[0]) return arr[0];
    let i = 0; while (i < DE.length - 2 && e > DE[i + 1]) i++;
    const u = Math.min(1, (e - DE[i]) / (DE[i + 1] - DE[i]));
    return arr[i] + (arr[i + 1] - arr[i]) * u;
  };
  function dialSet(b, e) {
    b.e = e; b.pace = dialI(D_PACE, e); b.brkP = dialI(D_BRK, e);
    if (b.brkCap) b.brkP = Math.min(b.brkP, b.brkCap);
    b.brkF = b.brkP * 0.96; b.fcKd = dialI(D_FCK, e);
    b.lead = dialI(D_LEAD, e); b.kwBase = dialI(D_KERB, e); b.pow = 1; b.lockV = 0.86;
    // past Extreme (e > 1): Extreme's technique blends in (none at e <= 1: the reference lap and the calibration below it stay)
    const x = dialI(D_X, e), X = DIFFICULTY.extreme || {};
    b.latP = P.lat * dialI(D_LAT, e) / D_LAT[0]; b.lowK = P.lowK * dialI(D_LOWK, e) / D_LOWK[0]; b.vTop = lerp(VTOP, X.vTop || VTOP, x);
    b.sI = (X.steerI || 0) * x; b.kBl = (X.kBlur || 0) * x; b.kX = (X.kerbX || 0) * x;
  }
  // solo lap time vs effort relative to e = E_REF, per circuit (tools/ai_adapt_cal.mjs; unknown circuits use the mean),
  // and the fixed difficulties' mean car on the same scale (k = T(E_REF) / T): Easy is the floor, Medium the cold start
  const E_REF = 0.75;
  // (e = 1.25 / 1.5 re-measured with Extreme's technique past e = 1; Vortex rescaled for its quicker reference lap, the
  // chicane kerb line — ai.js profile v2; the top of the dial stays ~0.3-1.2 % past Extreme, the physics car's limit)
  const CAL_T = [1.0645, 1.0478, 1.0312, 1.0107, 1, 0.9897, 0.9740, 0.9694];
  const CAL_TRACK = {
    vortex: [1.0654, 1.0487, 1.0330, 1.0118, 1, 0.9913, 0.9659, 0.9604],
    harbour: [1.0682, 1.0515, 1.0343, 1.0123, 1, 0.9882, 0.9794, 0.9750],
    kotori: [1.0602, 1.0440, 1.0286, 1.0080, 1, 0.9888, 0.9743, 0.9692],
    mirage: [1.0670, 1.0497, 1.0317, 1.0126, 1, 0.9919, 0.9793, 0.9788],
    dorado: [1.0616, 1.0454, 1.0293, 1.0116, 1, 0.9923, 0.9840, 0.9827],
  };
  // fixed difficulties on the k scale (k = extreme's k x extreme lap / difficulty lap), measured after the wider
  // difficulty spread (Hard ≈ +10 %, Medium ≈ +21 %, Easy ≈ +42 % vs Extreme)
  const K_FIXED = {
    vortex: { easy: 0.6910, medium: 0.8230, hard: 0.9180, extreme: 1.0346 },
    harbour: { easy: 0.7333, medium: 0.8459, hard: 0.9225, extreme: 1.0196 },
    kotori: { easy: 0.7114, medium: 0.8350, hard: 0.9177, extreme: 1.0263 },
    mirage: { easy: 0.7172, medium: 0.8379, hard: 0.9191, extreme: 1.0183 },
    serrano: { easy: 0.7192, medium: 0.8401, hard: 0.9147, extreme: 1.0273 },
    leman: { easy: 0.7111, medium: 0.8380, hard: 0.9138, extreme: 1.0318 },
    dorado: { easy: 0.7052, medium: 0.8291, hard: 0.9084, extreme: 1.0130 },
    _:{ easy: 0.714, medium: 0.837, hard: 0.918, extreme: 1.0249 },
  };
  // braking share cap of the limit envelope per circuit: Cerro Dorado's long heavy stops into hairpins (T1 from 340 km/h,
  // T7 downhill) left Extreme's 1.05 share ~15 km/h behind its plan at turn-in (wide on the exits); 1.02 = clean + quicker
  const BRK_CAP = { dorado: 1.02 };
  const ADAPT_FLOOR = 0.85;   // adaptive can go ~15 % easier than Easy
  function calOf(id) {
    const t = CAL_TRACK[id] || CAL_T, f = K_FIXED[id] || K_FIXED._;
    return { t, kEasy: f.easy * ADAPT_FLOOR, kMed: f.medium, kExt: f.extreme, kMax: 1 / t[t.length - 1] };
  }
  const kOfE = (e, c) => 1 / dialI(c.t, e);
  function eOfK(k, c) {
    const T = c.t, t = 1 / k, n = DE.length;
    if (t >= T[0]) return DE[0];
    if (t <= T[n - 1]) return DE[n - 1];
    let i = 0; while (i < n - 2 && t < T[i + 1]) i++;
    return DE[i] + (DE[i + 1] - DE[i]) * (T[i] - t) / (T[i] - T[i + 1]);
  }
  const MS = 16, SAMP = 4, GAMMA = 0.45;       // mini-sectors per lap, samples kept per mini-sector, lap time ∝ grip^-GAMMA
  const BAND_F = [0.008, 0.0055, 0.003], BAND_E = [0.001, -0.001, 0, 0.0015, -0.0015, 0.0005, -0.0005];
  const RB_G0 = 1.5, RB_K = 0.0035, RB_MAX = 0.015, RB_RATE = 0.01;   // pull: s gap, per s beyond, cap, rate (1/s)
  const TYPICAL = 0.996;   // the rolling best is an ideal lap: 'level' cars run at the player's typical race lap
  let profile = { v: 2, tracks: {}, g: null }, profileRev = 0, adaptLast = null, obsLast = null, refDiff = null;   // (v = PROFILE_V, see setProfile)

  const wetGrip = (c, w) => (c.wetGrip ? (w <= 0.5 ? lerp(c.wetGrip[0], c.wetGrip[1], w * 2) : lerp(c.wetGrip[1], c.wetGrip[2], w * 2 - 1)) : 1);
  const refComp = w => {   // reference tyre for the conditions: Weather.crossovers() (fallback without weather.js)
    const x = typeof Weather !== 'undefined' && Weather.crossovers ? Weather.crossovers() : { I: 0.25, W: 0.75 };
    return w >= x.W ? 'W' : w >= x.I ? 'I' : 'M';
  };
  // reference lap (AI at k = 1, clean air, fresh tyre for the conditions): mini-sector times + entry speeds, cached per circuit / weather
  function reference(track, wet) {
    const A = prep(track), key = refComp(wet);
    if (!A.refs) A.refs = {};
    if (A.refs[key]) return A.refs[key];
    const comp = COMPOUNDS[key] || COMPOUNDS.M, L = track.length;
    const R = { t: new Float64Array(MS), v: new Float64Array(MS), lap: 0, grip: comp.grip * wetGrip(comp, wet), msL: L / MS, sim: false, key };
    if (typeof Physics !== 'undefined' && typeof createCar === 'function' && typeof TEAMS !== 'undefined') {
      try {
        if (!refDiff) refDiff = Object.assign({}, DIFFICULTY.adaptive || DIFFICULTY.medium, { id: 'adaptive', mistake: 0, fixedK: 1, adaptive: true });
        const car = createCar({ id: 98, team: TEAMS[0], teamIndex: 0, isPlayer: false, compound: key });
        car.assists = { tc: true, abs: true }; car.stability = 1;
        const s0 = track.wrapS(-400);
        Physics.place(car, track, s0, lineAt(A, s0, 0));
        const fake = { phase: 'racing', t: 0, laps: 0, order: [car], lights: { on: 0, out: true } };
        const weather = { wet, rain: 0, timeOfDay: 'day' };
        const Gs = { track, cars: [car], player: null, race: fake, events: [], weather, attract: true };
        const world = { track, cars: [car], race: fake, events: Gs.events, weather, assists: { tc: true, abs: true }, wearPerMetre: 0 };
        const b = create(car, refDiff, 7771, Gs), dt = 1 / 120;
        // run-up + one lap to settle the battery cycle, then time the second lap
        let t = 0, dist = -400 - L, lastS = car.s, next = 0, tPrev = 0;
        while (t < 900 && next <= MS) {
          Physics.step(car, drive(b, car, Gs, dt), dt, world);
          Gs.events.length = 0; t += dt; fake.t = t;
          let ds = car.s - lastS; if (ds < -L / 2) ds += L; else if (ds > L / 2) ds -= L;
          const d0 = dist; dist += ds; lastS = car.s;
          while (next <= MS && dist >= next * R.msL) {
            const tc = t - dt + dt * (next * R.msL - d0) / Math.max(1e-6, dist - d0);
            if (next > 0) R.t[next - 1] = tc - tPrev;
            if (next < MS) R.v[next] = car.speed;
            tPrev = tc; next++;
          }
        }
        R.sim = next > MS;
      } catch (e) { R.sim = false; }
    }
    if (!R.sim) {   // no physics available: quasi-static estimate on the racing line (roughly the AI's pace)
      const tq = lineTimes(track, A.line), n = track.N;
      R.t.fill(0);
      for (let i = 0; i < n; i++) R.t[Math.min(MS - 1, Math.floor(i * track.step / R.msL))] += tq[i] * 1.07 / Math.sqrt(R.grip);
      for (let j = 0; j < MS; j++) R.v[j] = A.vr[Math.floor(j * R.msL / track.step) % n] * 0.95;
    }
    R.lap = 0; for (let j = 0; j < MS; j++) R.lap += R.t[j];
    A.refs[key] = R;
    return R;
  }

  // ----- skill profile (plain JSON; main persists it in localStorage 'apexgp.skill') -----
  function profileGlobal() {
    let sw = 0, sr = 0, n = 0;
    for (const id in profile.tracks) { const x = profile.tracks[id], w = Math.min(x.n, 10); sw += w; sr += x.r * w; n += x.n; }
    profile.g = sw > 0 ? { r: sr / sw, n } : null;
  }
  function recordRatio(id, r) {
    if (!id || !(r > 0.6 && r < 1.5)) return;
    const T = profile.tracks[id] || (profile.tracks[id] = { r, n: 0 });
    T.r += (r - T.r) * Math.max(0.2, 1 / (T.n + 1));
    T.n = Math.min(T.n + 1, 9999);
    profileGlobal(); profileRev++;
  }
  function prior(id) {
    const T = profile.tracks[id], g = profile.g;
    if (T && g) { const w = Math.min(T.n, 8); return { r: (T.r * w + g.r * 1.5) / (w + 1.5), c: Math.min(1, T.n / 3) }; }
    if (T) return { r: T.r, c: Math.min(1, T.n / 3) };
    if (g) return { r: g.r, c: 0.4 };
    return { r: calOf(id).kMed, c: 0 };
  }
  function warmK(G) {
    const S = G && G.race && G.race._aiAdapt;
    if (S) return S.k;
    const id = G && G.track ? G.track.id : null, c = calOf(id);
    return clamp(id ? prior(id).r * TYPICAL : c.kMed, c.kEasy, c.kMax);
  }

  // ----- player measurement (one pass per physics step; main calls AI.observe, AI.drive of adaptive cars too) -----
  function newObs(G, pl) {
    const samp = [], pr = prior(G.track.id);
    for (let j = 0; j < MS; j++) samp.push({ c: [], p: 0 });
    return { car: pl, trackId: G.track.id, ref: reference(G.track, G.weather ? +G.weather.wet || 0 : 0), t: null, lastS: pl.s, lx: pl.x, lz: pl.z,
      idx: -1, t0: 0, v0: 0, tS: 0, gS: 0, offT: 0, trafT: 0, bad: false, samp, raw: 0, cover: 0, nClean: 0, lapClean: 0, laps: 0, live: false,
      rj: new Float64Array(MS), wj: new Float64Array(MS), pr: pr.r, base: 0,
      wc: 0.12 + 0.25 * pr.c };           // clean coverage for full trust: quick with no profile, steadier with a good one
  }
  function observe(G) {
    const race = G.race, pl = G.player;
    if (!race || !pl || G.attract || !G.track || !G.cars) return null;
    let O = race._aiObs;
    if (!O || O.car !== pl || O.trackId !== G.track.id) O = race._aiObs = newObs(G, pl);
    obsLast = O;
    if (O.t === race.t) return O;
    const dt = O.t == null ? 0 : Math.max(0, race.t - O.t);
    O.t = race.t;
    const L = G.track.length, v = pl.speed || 0, s = pl.s, sPrev = O.lastS;
    let ds = s - sPrev; if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
    const jump = Math.hypot(pl.x - O.lx, pl.z - O.lz) > 2 + v * dt * 2.5;          // reset key / teleport
    O.lastS = s; O.lx = pl.x; O.lz = pl.z;
    const live = (race.phase === 'racing' || race.phase === 'quali') && !race.awaitConfirm && !pl.finished && !pl.kinematic && !pl.dnf;
    if (!live || jump || ds < -0.5) {
      if (O.live && O.lapClean > 0.5 * O.ref.lap) lapDone(O);                     // session / lap cut short (end of qualifying)
      O.idx = -1; O.live = live; return O;
    }
    O.live = true;
    const R = O.ref;
    if (O.idx >= 0) {
      O.tS += dt; O.gS += (pl.grip || 1) * dt;
      if (pl.offTrack) O.offT += dt;
      if (pl.inPitLane || pl.pitState || (pl.collision || 0) > 2 || pl.reverse) O.bad = true;
      if (v > 8 && pl.idx >= 0 && Math.cos(pl.h - prep(G.track).th[pl.idx]) < 0.8) O.bad = true;   // spin / big slide
      let traf = (pl.tow || 0) > 0.02 || (pl.dirty || 0) > 0.02;                    // in someone's tow / dirty air
      for (let n = 0; n < G.cars.length && !traf; n++) {                            // < ~1 s behind another car (or
        const o = G.cars[n];                                                        // fighting one < 0.5 s behind)
        if (o === pl || o.kinematic || o.dnf) continue;
        let dd = o.s - s; if (dd > L / 2) dd -= L; else if (dd < -L / 2) dd += L;
        const vv = Math.max(v, 10);
        if (Math.abs(o.d - pl.d) < 4 && ((dd > 0 && dd < LEN + vv) || (dd < 0 && dd > -LEN - vv * 0.5))) traf = true;
      }
      // no Straight mode yet in a zone (lap 1, after a stop): slower than the player can be
      if (!traf && pl.aeroLock && G.track.zoneAt && G.track.zoneAt(s) >= 0) traf = true;
      if (traf) O.trafT += dt;
    }
    const msL = R.msL, jNew = Math.floor(s / msL) % MS, jOld = Math.floor(sPrev / msL) % MS;
    if (jNew !== jOld && ds > 0) {
      let u = jNew * msL - sPrev; if (u < -L / 2) u += L;
      const tc = race.t - dt + dt * clamp(u / Math.max(1e-6, ds), 0, 1);
      if (O.idx >= 0 && O.idx === (jNew + MS - 1) % MS) msDone(O, O.idx, tc - O.t0);
      if (jNew === 0) lapDone(O);
      O.idx = jNew; O.t0 = tc; O.v0 = v; O.tS = 0; O.gS = 0; O.offT = 0; O.trafT = 0; O.bad = false;
    }
    return O;
  }
  function msDone(O, j, dur) {
    const R = O.ref, tr = R.t[j];
    if (!(tr > 0) || !(O.tS > 0)) return;
    const tc = dur * Math.pow((O.gS / O.tS) / R.grip, GAMMA);                     // normalised to the reference tyre grip
    // outliers: more than 12 % off the current estimate is a mistake / hold-up, not pace (the whole dial spans ~8 %)
    const ex = tr / (O.base || O.pr);
    if (O.bad || O.offT > 0.15 || O.v0 < 0.6 * R.v[j] || tc < 0.88 * ex || tc > 1.12 * ex) return;
    const S = O.samp[j];
    if (O.trafT <= 0.15 * dur) { S.c.push(tc); if (S.c.length > SAMP) S.c.shift(); O.lapClean += tr; O.nClean++; }
    else if (!S.p || tc < S.p) S.p = tc;                                         // in traffic: only a lower bound on the pace
    // clean ratio: rolling best per mini-sector (best of 2, mean of the best 2 of 3-4), mini-sectors more than 6 %
    // off the (time-weighted) median ratio are dropped (a mistake / hold-up that slipped through)
    const rj = O.rj, wj = O.wj;
    let n = 0;
    for (let m = 0; m < MS; m++) {
      const c = O.samp[m].c;
      if (!c.length) continue;
      let e;
      if (c.length === 1) e = c[0];
      else { const a = c.slice().sort((x, y) => x - y); e = c.length >= 3 ? (a[0] + a[1]) / 2 : a[0]; }
      rj[n] = R.t[m] / e; wj[n] = R.t[m]; n++;
    }
    let med = 0;
    if (n) {
      const ord = [];
      for (let q = 0; q < n; q++) ord.push(q);
      ord.sort((x, y) => rj[x] - rj[y]);
      let tot = 0, acc = 0;
      for (let q = 0; q < n; q++) tot += wj[q];
      for (const q of ord) { acc += wj[q]; if (acc >= tot / 2) { med = rj[q]; break; } }
    }
    let sr = 0, sp = 0;
    for (let q = 0; q < n; q++) if (Math.abs(rj[q] / med - 1) <= 0.06) { sr += wj[q]; sp += wj[q] / rj[q]; }
    O.raw = sp > 0 ? sr / sp : 0; O.cover = sr / R.lap;
    O.base = O.raw > 0 ? O.pr + (O.raw - O.pr) * clamp(O.cover / O.wc, 0, 1) : O.pr;
  }
  // the player's pace ratio: clean-air ratio blended with the warm start while coverage is small; mini-sectors with
  // only traffic samples can only raise it (being held up says the player is at least that quick)
  function playerRatio(O, pr) {
    const R = O.ref, w = clamp(O.cover / O.wc, 0, 1);
    const base = O.raw > 0 ? pr + (O.raw - pr) * w : pr;
    let sr = 0, sp = 0;
    for (let m = 0; m < MS; m++) {
      const tr = R.t[m], Q = O.samp[m];
      let e = tr / base;
      if (!Q.c.length && Q.p && Q.p < e) e = Q.p;
      sr += tr; sp += e;
    }
    return sp > 0 ? sr / sp : base;
  }
  function lapDone(O) {
    if (O.lapClean > 0.5 * O.ref.lap && O.cover > 0.5 && O.raw > 0) recordRatio(O.trackId, O.raw);
    O.lapClean = 0; O.laps++;
  }
  // manual feed of a whole lap (not needed when main calls AI.observe every step; ignored then)
  function recordPlayerLap(G, car, lapTime, sectors, clean) {
    if (!G || !G.track || !(lapTime > 0) || clean === false) return false;
    if (G.race && G.race._aiObs && G.race._aiObs.laps > 0) return false;
    const R = reference(G.track, G.weather ? +G.weather.wet || 0 : 0);
    const g = car && car.grip > 0 ? car.grip : R.grip;
    recordRatio(G.track.id, R.lap / (lapTime * Math.pow(g / R.grip, GAMMA)));
    return true;
  }

  // ----- field dial + battle band (one state per race) -----
  function newAdapt(G) {
    const race = G.race, pl = G.player, pr = prior(G.track.id), d0 = DIFFICULTY.adaptive || DIFFICULTY.medium, cal = calOf(G.track.id);
    const k0 = clamp(pr.r * TYPICAL, cal.kEasy, cal.kMax);
    const S = { k: k0, target: k0, ratio: null, cover: 0, conf: pr.c, prior: pr.r, e: eOfK(k0, cal), kFloor: cal.kEasy, kMax: cal.kMax, tref: 0, cal,
      nFast: 0, nEqual: 0, band: [], bandOf: new Map(), pl, conf0: pr.c, aggr: d0.aggression, t: -1, contacts: 0, colCD: 0, passes: 0, lastPos: pl.pos || 0 };
    const ai = G.cars.filter(c => c !== pl).sort((a, b) => ((b.team && b.team.perf) || 1) - ((a.team && a.team.perf) || 1) || a.id - b.id);
    const rnd = U.rng((((race.seed | 0) ^ 0x5bd1e995) >>> 0) || 1);
    // band sizes scale with the field: 9 rivals = 2-3 quicker, 2-3 level, the rest slower (m rivals: the same shares,
    // at least one level rival, one quicker from 2 rivals); > 3 quicker spread 0.8 .. 0.3 %, > 5 slower within -0.5 .. -2.5 %
    const m = ai.length, f1 = 2 + (rnd() < 0.5 ? 1 : 0), e1 = 2 + (rnd() < 0.5 ? 1 : 0);
    let nF = m === 9 ? f1 : Math.max(m >= 2 ? 1 : 0, Math.round(m * f1 / 9)), nE = m === 9 ? e1 : Math.max(m >= 1 ? 1 : 0, Math.round(m * e1 / 9));
    while (nF + nE > m && nF > (m >= 2 ? 1 : 0)) nF--;
    while (nF + nE > m && nE > 0) nE--;
    const nS = Math.max(0, m - nF - nE), sStep = nS > 5 ? Math.min(0.004, 0.02 / (nS - 1)) : 0.004;
    S.nFast = nF; S.nEqual = nE;
    ai.forEach((c, i) => {
      const off = i < nF ? (nF <= 3 ? BAND_F[3 - nF + i] : 0.008 - 0.005 * i / (nF - 1))
        : i < nF + nE ? BAND_E[(i - nF) % BAND_E.length] : -0.005 - sStep * (i - nF - nE);
      const e = { code: c.code, off, rb: 0 };
      S.band.push(e); S.bandOf.set(c, e);
    });
    return S;
  }
  function adaptTick(G) {
    const race = G.race, pl = G.player;
    if (!race || !pl || G.attract || !G.track) return null;
    let S = race._aiAdapt;
    if (!S || S.pl !== pl) S = race._aiAdapt = newAdapt(G);
    adaptLast = S;
    if (S.t === race.t) return S;
    const dt = S.t < 0 ? 0 : Math.max(0, race.t - S.t);
    S.t = race.t;
    const O = observe(G);
    if (O) { S.ratio = O.raw || null; S.cover = O.cover; S.tref = O.ref.lap; }
    if (race.phase !== 'racing' || pl.finished) return S;
    S.target = clamp((O ? playerRatio(O, S.prior) : S.prior) * TYPICAL, S.kFloor, S.kMax);
    S.conf = Math.max(S.conf0, clamp(S.cover / 0.7, 0, 1));
    const tau = (S.tref || 80) / S.k * lerp(0.15, 1, S.conf);
    S.k += (S.target - S.k) * (1 - Math.exp(-dt / tau));
    S.e = eOfK(S.k, S.cal);
    // style: contacts and passes -> aggression
    S.colCD -= dt;
    if ((pl.collision || 0) > 3 && S.colCD <= 0) { S.contacts++; S.colCD = 1; }
    if (pl.pos && S.lastPos && pl.pos < S.lastPos && !pl.kinematic) S.passes += S.lastPos - pl.pos;
    S.lastPos = pl.pos || S.lastPos;
    const laps = Math.max(1, (pl.lap || 1) - 0.5);
    S.aggr = clamp(0.45 + 0.12 * S.contacts / laps + 0.07 * S.passes / laps, 0.35, 1);
    return S;
  }
  // per adaptive car, every step: field dial x (1 + band offset + pull toward the player) -> driving parameters
  function adaptDrive(b, car, G, dt) {
    if (b.fixedK) return;
    const S = adaptTick(G);
    if (!S) return;
    if (b.S !== S) { b.S = S; b.bandE = S.bandOf.get(car) || null; b.band = b.bandE ? b.bandE.off : 0; b.rb = 0; }
    const race = G.race, pl = G.player;
    let rbT = b.rb;
    if (pl.finished || car.finished) rbT = 0;
    else if (race.phase === 'racing' && race.t > 20 && !pl.pitState && !car.pitState && !pl.kinematic && !car.kinematic && pl.gapLeader != null && car.gapLeader != null) {
      const gap = car.gapLeader - pl.gapLeader, a = gap < 0 ? -gap : gap;         // + = I am behind the player
      rbT = a > RB_G0 ? (gap > 0 ? 1 : -1) * Math.min(RB_MAX, (a - RB_G0) * RB_K) : 0;
    }
    b.rb = approach(b.rb, rbT, RB_RATE * dt);
    if (b.bandE) b.bandE.rb = b.rb;
    const kc = clamp(S.k * (1 + b.band + b.rb), S.kFloor * 0.98, S.kMax);
    if (Math.abs(kc - b.kc) > 2e-5) {
      b.kc = kc; dialSet(b, eOfK(kc, S.cal));
      // below the dial's slowest setting, slow the whole speed plan (same as the fixed difficulties' vScale)
      const t = 1 / kc, t0 = S.cal.t[0];
      b.vScale = t > t0 ? Math.pow(t / t0, -1 / 0.68) : 1;
    }
    b.aggr = S.aggr; b.atkGap = 0.35 + b.aggr * 0.8; b.defGap = 0.25 + b.aggr * 0.45;
  }
  // reference-lap changes per profile version: r (reference time / player time) of an older profile is rescaled so the
  // stored skill keeps meaning the same lap time. v2: Vortex T1/T2 counted as corners (kerb line) -> reference 0.215 % quicker
  const PROFILE_V = 2, REF_MIG = { 2: { vortex: 72.332 / 72.488 } };
  function setProfile(p) {
    const out = { v: PROFILE_V, tracks: {}, g: null };
    if (p && typeof p === 'object' && p.tracks && typeof p.tracks === 'object') {
      const v0 = +p.v || 1;
      for (const id in p.tracks) {
        const x = p.tracks[id];
        let m = 1; for (let v = v0 + 1; v <= PROFILE_V; v++) m *= (REF_MIG[v] && REF_MIG[v][id]) || 1;
        if (x && x.r > 0.6 && x.r < 1.5 && x.n >= 1) out.tracks[String(id).slice(0, 40)] = { r: +x.r * m, n: Math.min(9999, Math.floor(x.n)) };
      }
    }
    profile = out; profileGlobal(); profileRev++;
  }

  // ---------- strategy (Race plans the stops; the AI adds final-lap guard + covering the player's stop) ----------
  function strategy(b, car, G, race, track, A) {
    if (!race || !race.laps || car.finished) return;
    if ((car.lap || 0) >= race.laps) { if (car.wantPit) car.wantPit = false; return; }
    const st = car.strategy;
    const pl = G.player;
    if (st && st.auto !== false && pl && pl !== car && !G.attract && race.phase === 'racing') {
      const ps = pl.pitState || null;
      if (ps === 'entry' && b.plPit !== 'entry' && !car.wantPit && (car.lap || 0) < race.laps - 1) {
        // player just pitted: the car just ahead covers the undercut if its own stop is near
        let next = null;
        for (const x of st.stops || []) if (!x.done) { next = x; break; }
        const gapPl = (pl.gapLeader || 0) - (car.gapLeader || 0);   // + = player behind me
        if (next && next.lap - (car.lap || 0) <= 3 && gapPl > 0 && gapPl < 3.5 && b.rnd() < 0.3 + b.aggr * 0.6) {
          car.wantPit = true; car.nextCompound = next.compound;
        }
      }
      b.plPit = ps;
    }
    // fallback when Race did not plan anything (no Race strategy object): pit once the tyres near the cliff
    if (!st && !car.isPlayer && car.tyre && (G.world && G.world.wearPerMetre > 0)) {
      const k = COMPOUNDS[car.tyre.compound] || COMPOUNDS.M;
      if (car.tyre.wear > k.cliff - 0.05 && (car.lap || 0) < race.laps - 1) { car.wantPit = true; car.nextCompound = car.tyre.compound === 'H' ? 'M' : 'H'; }
    }
  }

  return {
    create, drive, P, _prep: prep, _vCorner: vCorner, _lineAt: lineAt,
    // adaptive difficulty / skill profile (CONTRACT §6b additions)
    observe,                              // main: once per physics step after Race.update (player timing for the skill profile)
    recordPlayerLap,                      // manual whole-lap feed (ignored while observe() is running)
    get skillProfile() { return JSON.parse(JSON.stringify(profile)); },
    set skillProfile(p) { setProfile(p); },
    get skillRev() { return profileRev; },  // bumps whenever the profile changed (main saves then)
    // debug: {k, target, ratio, cover, conf, prior, e, kFloor, kMax, tref, nFast, nEqual, band:[{code, off, rb}]}
    get adaptiveState() { return adaptLast || (obsLast ? { k: null, target: null, ratio: obsLast.raw || null, cover: obsLast.cover } : null); },
    _dial: { DE, CAL_T, E_REF, kOfE, eOfK, calOf, reference, prior, D_PACE, D_BRK, D_FCK, D_LEAD, D_KERB },
  };
})();

;
// ===== race.js
// Apex GP — race session (CONTRACT §8): start lights + jump starts, lap / sector timing, positions, gaps,
// Overtake Mode, kinematic pit-lane autopilot + tyre service, default AI pit strategy, finish + results,
// championship helpers. Pure logic (no THREE / window / document / localStorage): runs in Node.
//
// Call order per physics step (main): controlOverride -> Physics.step (all cars) -> Physics.collide -> Race.update.
//
// AI-facing car fields:
//   car.wantPit      true = "box at the next opportunity". Race takes the car over (kinematic) ~55 m before the pit
//                    entry, drives the lane, services it and releases it at the limiter-end line. Cleared after the stop.
//   car.nextCompound 'S'|'M'|'H' to fit at that stop (null = Race picks one). Cleared after the stop.
//   car.strategy     { auto, stops: [{lap, compound, done}], plan } default plan made by Race.create for AI cars.
//                    While auto !== false Race sets wantPit / nextCompound at the start of lap `lap` (the car pits at the
//                    end of that lap), reacts to real tyre wear and re-plans after every stop. Set auto = false (or
//                    replace the object) to drive wantPit / nextCompound yourself.
//   car.kinematic    true while Race moves the car in the pit lane (physics skips it; AI.drive output is ignored).
// Dynamic weather (G.weather.dynamic, see weather.js): Race steps the weather while racing, AI cars decide weather
// stops ~1 km before the pit entry (Weather.plan: expected lap time on each tyre over the laps left vs the stop,
// per-car bravery bias + a chance to miss the call by difficulty), the player gets BOX THIS LAP + the engineer's calls.
const Race = (() => {
  const R = CFG.race;
  const CP = Math.min(R.gapCheckpoint || 25, 10);   // m between gap timing checkpoints (<= 10 m keeps gaps within ~0.03 s)
  const WEAR_SCALE = { off: 0, normal: 1, high: 2 };
  const COMP_IDS = ['S', 'M', 'H'];
  const HYST = 0.5;                       // m: two running cars swap positions only beyond this
  const TT_RUNUP = 320;                   // m before the line where the time-trial car starts (flying first lap)
  const CAPTURE_AFTER = 70;               // m after the pit entry: a car on pit-lane asphalt is taken over
  const AI_CAPTURE = 55;                  // m before the pit entry: an AI car with wantPit is taken over
  const BOX_BLEND = 22;                   // m: lateral move from the fast lane into / out of the pit box
  const PIT_ACC = 6.5, PIT_STOP_DEC = 7, PIT_MAX_DEC = 45, PIT_EXIT_V = 36, PIT_GAP = 10;
  const CAP_DEC = 5;                      // m/s^2: smooth slow-down into a pit.exitCap bend
  const PIT_WING_COST = [0.2, 0.5];   // s: one random extra (race.rnd) added to a stop when either wing changes (not shown)
  const TWO_COMPOUND_PEN = 10;            // s
  const TWO_COMPOUND_MIN_LAPS = 3;        // the rule is waived in races this short (or shorter)
  const WET_DECLARED = 0.3;               // track wetness at which a dynamic-weather race is declared wet (rule waived)
  const FINISH_TIMEOUT = 240;             // safety net only (a car stuck/broken): normally every car really finishes
  const STUCK_RESET = 10;                 // s without 5 m of progress before an AI car is put back on track
  const WHEEL_R = 0.36;
  const WET_OF = { dry: 0, damp: 0.5, wet: 1 };
  const PIT_TOL_KMH = 5;                  // km/h over the pit limit tolerated at the limiter line: the standard level's (race.pitTolKmh = this race's; HUD reads it)
  let PIT_SPEED_TOL = CFG.race.pitSpeedLimit + PIT_TOL_KMH / 3.6;     // speeding threshold at the limiter line (set per race by update)
  const SPEEDING_PEN = 5;                 // s
  const AI_SPEEDING_P = 0.03;             // chance per AI pit stop of crossing the limiter line too fast
  // penalty level (CFG.penalties: 'off' | 'lenient' | 'standard' | 'strict'): race.pen = that level's knobs (null = off) for
  // causing a collision (collisionFault), track limits / corner cuts (trackLimitsStep), pit speeding and jump starts.
  // Track limits: all four wheels off (kerbs = track) and time gained vs the car's own pace -> a strike; tl.warn warnings,
  // the next one is a tl.sec penalty; a clear cut (gain > tl.cut s) is an immediate one
  const TL_WARN = CFG.penalties.standard.tl.warn, TYRE_HALF_W = 0.2;
  // the level from the session options: opts.penaltyLevel, else a level name in opts.penalties, else the legacy boolean
  // (false = 'off', default CFG.penalties.def); penalties false (the old switch) always means off
  function penaltyLevel(o) {
    const P = CFG.penalties, ok = l => typeof l === 'string' && P.levels.indexOf(l) >= 0;
    o = o || {};
    const l = ok(o.penaltyLevel) ? o.penaltyLevel : ok(o.penalties) ? o.penalties : null;
    if (o.penalties === false) return 'off';
    return l || P.def;
  }
  const ANTICIPATE_T = 0.45;              // s before lights out an AI with car.aiAnticipate is released (jumps the start)
  const QUALI_K = 1.09;                   // AI quali lap = lapTimeEst * QUALI_K / team perf (AI best race laps ~1.06-1.11)
  const WX_MISS = { easy: 0.3, medium: 0.15, hard: 0.07, adaptive: 0.12, extreme: 0.03 };   // chance an AI call is missed for a lap
  const hasWx = () => typeof Weather !== 'undefined' && Weather && Weather.plan;
  const _w0 = { x: 0, z: 0 }, _w1 = { x: 0, z: 0 };

  // ---------- helpers ----------
  const emit = (G, ev) => { (G.events || (G.events = [])).push(ev); return ev; };
  function note(race, text, color, sub) {
    race.messages.push({ text, color: color || '#ffffff', sub: sub || '', t: race.t });
    if (race.messages.length > 8) race.messages.shift();
  }
  const nextPoint = (x, p, L) => p + (Math.floor((x - p) / L) + 1) * L;   // smallest p + kL strictly > x
  const refLaps = race => Math.max(race.laps || 0, CFG.tyre.minRefLaps);
  const remainingLaps = (race, car, L) => (race.laps ? Math.max(0, (race.laps * L - car._race.dist) / L) : Infinity);

  // nominal laps until a fresh set reaches its cliff (same wear model as Physics + main's wearPerMetre)
  function lapsToCliff(race, c) {
    const k = COMPOUNDS[c] || COMPOUNDS.M;
    return race.wearScale > 0 ? k.cliff * k.life * refLaps(race) / race.wearScale : Infinity;
  }
  // wear per lap on the current set: nominal early in a stint, then the observed rate
  function wearPerLap(race, car, L) {
    if (!race.wearScale) return 0;
    const k = COMPOUNDS[car.tyre.compound] || COMPOUNDS.M;
    const nominal = race.wearScale / (k.life * refLaps(race));
    const laps = car._race.tyreDist / L;
    if (laps < 0.3 || !(car.tyre.wear > 0)) return nominal;
    return U.lerp(nominal, car.tyre.wear / laps, U.clamp((laps - 0.3) / 0.7, 0, 1));
  }
  // compound for a stop: softest that reaches the flag, different from the current one if required
  function pickCompound(race, car, L, mustChange) {
    const cur = car.tyre.compound;
    if (race.wx && car.isPlayer && race.wxPlayer && race.wxPlayer.c1 && race.wxPlayer.j === 0 && race.wxPlayer.gain > 0.005) return race.wxPlayer.c1;   // the engineer's call
    const w = wetCompound(race, car);
    if (w) return w;                                          // damp -> intermediates, wet -> full wets
    if (race.wx) return slickFor(race, car, L, mustChange);
    if (!race.wearScale) return mustChange && cur === 'S' ? 'M' : 'S';
    const excl = mustChange || (race.twoCompoundActive && car.compoundsUsed.length < 2) ? cur : null;
    const rem = remainingLaps(race, car, L);
    for (const c of COMP_IDS) if (c !== excl && lapsToCliff(race, c) * 0.95 >= rem) return c;
    return excl === 'H' ? 'M' : 'H';
  }

  function makeCar(o) {
    if (typeof createCar === 'function') return createCar(o);
    const d = o.team.driver;   // minimal stand-in for partial builds
    return {
      id: o.id, team: o.team, teamIndex: o.teamIndex, isPlayer: o.isPlayer, code: d.code, name: d.last,
      x: 0, z: 0, h: 0, vx: 0, vz: 0, r: 0, speed: 0, vLong: 0, vLat: 0, aLong: 0, aLat: 0, throttle: 0, brake: 0,
      steer: 0, steerAngle: 0, gear: 1, rpm: CFG.car.rpmIdle, shiftT: 1, wheelRot: 0, slide: 0, lockup: 0, wheelspin: 0,
      surface: SURF.TRACK, onKerb: false, offTrack: false, s: 0, d: 0, idx: -1, inPitLane: false, pitLimiter: false,
      kinematic: false, aero: 'corner', aeroT: 0, inStraightZone: false, battery: CFG.energy.cap * CFG.energy.startCharge,
      batteryCap: CFG.energy.cap, boosting: false, harvesting: false, overtake: false, overtakeNext: false, tow: 0,
      tyre: { compound: o.compound, wear: 0, laps: 0 }, grip: COMPOUNDS[o.compound].grip, collision: 0,
    };
  }
  function place(car, track, s, d) {
    s = track.wrapS(s);
    if (typeof Physics !== 'undefined' && Physics && Physics.place) Physics.place(car, track, s, d);
    else {
      const w = track.toWorld(s, d), sm = track.sample(s);
      car.x = w.x; car.z = w.z; car.h = Math.atan2(sm.tz, sm.tx);
      car.vx = car.vz = car.r = car.speed = car.vLong = car.vLat = 0;
    }
    car.s = s; car.d = d; car.idx = Math.round(s / track.step) % track.N;
  }
  function worldAt(track, s, d, out) {
    const r = track.toWorld(s, d, out);
    if (r !== out) { out.x = r.x; out.z = r.z; }
    return out;
  }
  function estimatePitLoss(track, vRef) {
    const pit = track.pit;
    if (!pit) return 22;
    const P = pit.length || track.wrapS(pit.exitS - pit.entryS), vLim = R.pitSpeedLimit;
    let tTrack = 0;
    for (let u = 0; u < P; u += track.step) {
      const i = Math.round(track.wrapS(pit.entryS + u) / track.step) % track.N;
      tTrack += track.step / Math.max(20, track.raceSpeed[i] * vRef);
    }
    const blend = Math.min(P * 0.3, pit.blendIn || 130) + Math.min(P * 0.3, pit.blendOut || 130);
    const tLane = (P - blend) / vLim + blend / ((vLim + PIT_EXIT_V) / 2) + vLim / PIT_STOP_DEC / 2 + vLim / PIT_ACC / 2
      + (R.pitServiceMin + R.pitServiceMax) / 2;
    return Math.max(8, tLane - tTrack);
  }

  // ---------- strategy ----------
  // start tyre: picked from the plan each compound leads to (planStops' cost: pace + fade + stops), the near-equal ones
  // at random (weight exp(-extra cost / START_TAU)) — a sprint no compound needs a stop for starts on one that lasts
  // (it was 22 % S / 58 % M / 20 % H whatever the race: softs in a 3-lap race meant a stop, high wear two)
  const START_TAU = 0.02;
  function aiStartCompound(race, rnd) {
    const r = rnd(), w = wetCompound(race);
    if (w) return w;
    if (!race.wearScale) return r < 0.65 ? 'S' : 'M';
    if (!(race.laps > 0)) return r < 0.22 ? 'S' : r < 0.8 ? 'M' : 'H';
    const ids = ['S', 'M', 'H'], tot = ids.map(c => { const info = {}; planStops(race, race.laps, c, [c], 0, () => 0.5, info); return info.total; });
    const best = Math.min(...tot), wt = tot.map(t => (isFinite(t) ? Math.exp(-(t - best) / START_TAU) : 0)), sum = wt.reduce((a, x) => a + x, 0);
    if (!(sum > 0)) return r < 0.22 ? 'S' : r < 0.8 ? 'M' : 'H';
    let acc = 0;
    for (let i = 0; i < ids.length; i++) { acc += wt[i] / sum; if (r < acc) return ids[i]; }
    return ids[ids.length - 1];
  }
  // Best stop plan for N laps starting on `start` (compounds `used` already count for the two-compound rule).
  // Enumerates up to 3 stops; cost = compound pace + tyre fade + pit loss. Stop laps are absolute (lapOffset + k).
  // info (optional): info.total = the plan's cost (Infinity: no plan covers the distance)
  function planStops(race, N, start, used, lapOffset, rnd, info) {
    const stops = [];
    if (info) info.total = Infinity;
    if (!(N > 0) || !race.wearScale) { if (info) info.total = 0; return stops; }
    const maxL = {}, cost = {}, fade = {};
    for (const c of ['S', 'M', 'H', 'I', 'W']) {
      if (!COMPOUNDS[c]) continue;
      // (a set that cliffs within its first lap can't run a stint: 0, not 1 — soft-to-soft 1-lap stints past the cliff
      // were planned in short high-wear races, then the worn tyres forced yet another stop)
      maxL[c] = Math.floor(lapsToCliff(race, c) * 0.93);
      cost[c] = 1 / Math.sqrt(COMPOUNDS[c].grip) - 1;
      fade[c] = 0.5 * CFG.tyre.fade * race.wearScale / (COMPOUNDS[c].life * refLaps(race));
    }
    const pitCost = race.pitLossEst / race.lapTimeEst, ids = compoundsFor(race, start);
    const seq = [start];
    let best = null;
    const evalSeq = () => {
      const k = seq.length;
      if (k > N || k > 3) return;   // at most 2 planned stops
      if (race.twoCompoundActive) { const set = new Set(used); for (const c of seq) set.add(c); if (set.size < 2) return; }
      let cap = 0;
      for (const c of seq) { if (maxL[c] < 1) return; cap += maxL[c]; }
      if (cap < N) return;
      const alloc = new Array(k).fill(1);
      for (let rem = N - k; rem > 0; rem--) {
        let bi = -1, bc = Infinity;
        for (let i = 0; i < k; i++) {
          if (alloc[i] >= maxL[seq[i]]) continue;
          const mc = cost[seq[i]] + fade[seq[i]] * (2 * alloc[i] + 1);
          if (mc < bc) { bc = mc; bi = i; }
        }
        alloc[bi]++;
      }
      let total = (k - 1) * pitCost;
      for (let i = 0; i < k; i++) total += alloc[i] * cost[seq[i]] + fade[seq[i]] * alloc[i] * alloc[i];
      if (!best || total < best.total - 1e-9) best = { total, seq: seq.slice(), alloc };
    };
    const rec = depth => { evalSeq(); if (depth < 3) for (const c of ids) { seq.push(c); rec(depth + 1); seq.pop(); } };
    rec(0);
    if (!best) {   // cannot be covered even with 3 stops: stop whenever the tyres are done
      const hc = race.wx ? (isWetTyre(start) ? start : 'H') : wetCompound(race) || 'H';
      for (let lap = Math.max(1, maxL[start]); lap < N; lap += Math.max(1, maxL[hc])) stops.push({ lap: lapOffset + lap, compound: hc, done: false });
      return stops;
    }
    if (info) info.total = best.total;
    let acc = 0;
    for (let i = 0; i < best.seq.length - 1; i++) {
      acc += best.alloc[i];
      const prev = i ? stops[i - 1].lap - lapOffset : 0, nextEnd = acc + best.alloc[i + 1];
      let lap = acc;
      const j = lap + Math.floor(rnd() * 3) - 1;   // stagger the field's stops by +-1 lap
      if (j >= 1 && j <= N - 1 && j > prev && j - prev <= maxL[best.seq[i]] && nextEnd - j <= maxL[best.seq[i + 1]]) lap = j;
      stops.push({ lap: lapOffset + lap, compound: best.seq[i + 1], done: false });
    }
    return stops;
  }
  function replan(race, car, L) {
    const st = car.strategy;
    if (!st || st.auto === false || !race.laps) return;
    const n = Math.round(remainingLaps(race, car, L));
    st.stops = planStops(race, n, car.tyre.compound, car.compoundsUsed, race.laps - n, race.rnd);
    st.plan = [car.tyre.compound].concat(st.stops.map(x => x.compound)).join('-');
    st.pending = null;
  }
  // AI pit decisions, evaluated when a car starts a lap (the pit entry is at the end of that lap)
  function strategyHook(G, race, car) {
    // a dynamic-weather race that turns wet is declared wet: the two-compound rule is off for everyone (HUD reads the flag)
    if (race.wx && race.twoCompoundActive && (race.wx.wet || 0) >= WET_DECLARED) { race.twoCompoundActive = false; race.wetDeclared = true; }
    if (car.isPlayer || car.finished || !race.laps) return;
    const st = car.strategy, auto = !!st && st.auto !== false;
    if (car.lap >= race.laps) { if (auto) car.wantPit = false; return; }   // final lap: stay out
    if (!auto || car.wantPit) return;
    const L = G.track.length;
    if (!race.wx && !tyreSuits(race, car.tyre.compound) && race.laps - car.lap >= 1) { car.wantPit = true; car.nextCompound = pickCompound(race, car, L, false); return; }
    let next = null;
    for (const x of st.stops) if (!x.done) { next = x; break; }
    if (next && car.lap >= next.lap && tyreSuits(race, next.compound, car)) { car.wantPit = true; car.nextCompound = next.compound; st.pending = next; return; }
    if (!race.wearScale) return;
    const k = COMPOUNDS[car.tyre.compound] || COMPOUNDS.M, rate = wearPerLap(race, car, L);
    const toCliff = rate > 0 ? (k.cliff - car.tyre.wear) / rate : Infinity;
    const left = remainingLaps(race, car, L);
    if (toCliff < 1.5 && left - toCliff >= 1.5) { car.wantPit = true; car.nextCompound = null; return; }   // worn out
    if (ruleOpen(race, car) && car.lap >= race.laps - 1) { car.wantPit = true; car.nextCompound = null; return; }
    if (next && toCliff > left + 0.2 && !ruleOpen(race, car)) for (const x of st.stops) x.done = true;
  }
  // two-compound rule still to be satisfied (waived once intermediates / wets were used, or the race was declared wet)
  const ruleOpen = (race, car) => race.twoCompoundActive && !race.wetDeclared && car.compoundsUsed.length < 2 && !car.compoundsUsed.some(isWetTyre);
  // softest slick that reaches the flag (a different one while the two-compound rule is open)
  function slickFor(race, car, L, mustChange) {
    const cur = car.tyre.compound;
    if (!race.wearScale) return mustChange && cur === 'S' ? 'M' : 'S';
    const excl = !isWetTyre(cur) && (mustChange || ruleOpen(race, car)) ? cur : null;
    const rem = remainingLaps(race, car, L);
    for (const c of COMP_IDS) if (c !== excl && lapsToCliff(race, c) * 0.95 >= rem) return c;
    return excl === 'H' ? 'M' : 'H';
  }

  // ---------- dynamic weather: tyre calls ----------
  const lapsToEntry = (car, L) => (car._race && isFinite(car._race.nextEntry) ? U.clamp((car._race.nextEntry - car._race.dist) / L, 0, 1.2) : 0);
  // an AI driver's bravery bias (car.wxBias), except while its tyres are plainly wrong for the track (inters on a
  // bone-dry one, full wets on a drying one, slicks in standing water): then no bias keeps it out. (A 20-car field
  // draws the extreme biases often enough that one car could otherwise sit on inters for 2 dry laps.)
  function wxBias(race, car) {
    const b = !car || car.isPlayer ? 0 : car.wxBias || 0, W = race.wx, c = car && car.tyre && car.tyre.compound;
    if (!W || !b) return b;
    if (b < 0 && ((c === 'I' && W.wet < 0.05 && W.rain < 0.05) || (c === 'W' && W.wet < 0.25 && W.rain < 0.3))) return 0;
    if (b > 0 && !isWetTyre(c) && W.wet > 0.4 && W.rain > 0.1) return 0;
    return b;
  }
  function wxPlan(race, car, L, u, rem, out) {
    const k = COMPOUNDS[car.tyre.compound] || COMPOUNDS.M;
    return Weather.plan(race.wx, {
      u, rem, cur: car.tyre.compound, wear: car.tyre.wear, wpl: wearPerLap(race, car, L), cliff: k.cliff, slick: slickFor(race, car, L, false),
      pit: race.pitLossEst / Math.max(20, race.lapTimeEst), bias: wxBias(race, car),
    }, out);
  }
  // AI: once per lap, ~1 km before the pit entry (before AI.drive lines up for the lane), decide a weather stop
  function wxCheck(G, race, car) {
    const rc = car._race, L = G.track.length, st = car.strategy;
    if (car.finished || car.dnf || car.kinematic || rc.pit || !race.laps || !st || st.auto === false || !G.track.pit) return;
    const toEntry = rc.nextEntry - rc.dist;
    if (rc.wxKey === rc.nextEntry || toEntry > Math.max(700, 0.3 * L) || toEntry < 560) return;
    rc.wxKey = rc.nextEntry;
    const rem = (race.laps * L - rc.nextEntry) / L;   // racing left after this entry
    if (rem < 0.6 || car.lap < 1) return;   // (final lap: stay out)
    if (car.wantPit && car.wxStop) return;
    const p = wxPlan(race, car, L, toEntry / L, rem, rc.wxP || (rc.wxP = {}));
    if (p.pit) {
      // missed it: stays out a lap (never two laps running; on a drying track a clearly paying call back to drier tyres
      // is never missed: the driver feels the tyres going off)
      const miss = !rc.wxMissed && race.wr() < (WX_MISS[race.difficulty] != null ? WX_MISS[race.difficulty] : 0.15);
      if (miss && !(Weather.cat(p.c1) < Weather.cat(car.tyre.compound) && p.gain > 0.05)) { rc.wxMissed = true; return; }
      rc.wxMissed = false;
      car.wantPit = true; car.nextCompound = p.c1; car.wxStop = true; st.pending = null;
    } else {
      rc.wxMissed = false;
      if (car.wantPit && car.nextCompound && !tyreSuits(race, car.nextCompound, car)) car.nextCompound = pickCompound(race, car, L, false);   // planned stop: tyres for the conditions
    }
  }
  // player: engineer's view of the conditions (hint + radio), refreshed every 0.5 s
  function wxPlayerEval(G, race, car) {
    if ((race.wxPT = (race.wxPT || 0) - 1) > 0) return race.wxPlayer;
    race.wxPT = 60;
    const rc = car._race, L = G.track.length;
    if (!rc || car.finished || !race.laps || !isFinite(rc.nextEntry)) return (race.wxPlayer = null);
    const rem = (race.laps * L - rc.nextEntry) / L;
    race.wxPlayer = rem >= 0.6 ? Object.assign({}, wxPlan(race, car, L, U.clamp((rc.nextEntry - rc.dist) / L, 0, 1.2), rem)) : null;
    return race.wxPlayer;
  }
  const TYRE_NAME = { S: 'SOFTS', M: 'MEDIUMS', H: 'HARDS', I: 'INTERS', W: 'WETS' };
  // (the player's weather / strategy radio calls live in the race engineer: src/engineer.js)

  // ---------- create ----------
  function create(G, opts = {}) {
    const track = G.track;
    if (!track) throw new Error('Race.create: G.track must be set first');
    const mode = opts.mode === 'timetrial' || opts.mode === 'championship' ? opts.mode : 'race';
    const tt = mode === 'timetrial';
    const seed = (opts.seed != null ? opts.seed : Math.floor(Math.random() * 4294967296)) >>> 0;
    const rnd = U.rng(seed ^ 0x2545f491);
    const difficulty = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'medium';
    const tyreWear = tt ? 'off' : (WEAR_SCALE[opts.tyreWear] != null ? opts.tyreWear : 'normal');
    const laps = tt ? 0 : U.clamp(Math.round(+opts.laps || 5), 1, 999);
    const playerTeam = U.clamp(opts.playerTeam | 0, 0, TEAMS.length - 1);
    const L = track.length, diff = DIFFICULTY[difficulty];
    let vAvg = 0;
    for (let i = 0; i < track.N; i++) vAvg += track.raceSpeed[i];
    vAvg /= track.N;
    const wet = G.weather && G.weather.wet != null ? +G.weather.wet || 0 : (WET_OF[opts.weather] || 0);
    const gridMode = tt || opts.attract ? 'choose' : (opts.grid === 'random' || opts.grid === 'quali' ? opts.grid : 'choose');

    const race = {
      mode, laps, phase: tt ? 'racing' : gridMode === 'quali' ? 'quali' : 'grid',
      lights: { on: 0, out: tt },
      t: 0, phaseT: 0, holdT: U.lerp(R.holdMin, R.holdMax, rnd()),
      order: [], grid: [], leaderLap: 0, fastestLap: null, sessionBestSectors: [null, null, null],
      results: null, resultsFinal: false, resultsT: 0, messages: [],
      difficulty, tyreWear, wearScale: WEAR_SCALE[tyreWear], twoCompound: !!opts.twoCompound, twoCompoundActive: false,
      penalties: true, penaltyLevel: 'standard', pen: null, pitTolKmh: PIT_TOL_KMH, wet, gridMode, quali: null, driverNames: null,
      releaseEarly: new Set(), evSeen: 0,   // AI cars released before lights out (main skips its grid hold for them)
      awaitConfirm: tt || opts.attract ? null : 'entry',   // 'entry' | 'grid' | null: frozen until Race.confirmGrid(G)
      attract: !!opts.attract, seed, rnd, trackId: track.id,
      championship: mode === 'championship' ? (opts.championship || null) : null,
      playerPitCompound: null, leaderFinished: false, winnerTime: null, playerFinishT: null,
      lapTimeEst: L / Math.max(20, vAvg * diff.pace * 0.97), pitLossEst: 22, pitG: null,
      ghostRec: null, bestGhost: null, ghostPlayer: null, trackL: L, wx: null,
    };
    // penalty level for every mode (race, championship, multiplayer, time trial: its track-limit lap invalidation):
    // opts.penaltyLevel / legacy opts.penalties, else the game's settings (G.settings). race.penalties = any penalties at all
    const gs = G.settings && typeof G.settings === 'object' ? G.settings : {};
    race.penaltyLevel = penaltyLevel({ penaltyLevel: opts.penaltyLevel != null ? opts.penaltyLevel : gs.penaltyLevel, penalties: opts.penalties != null ? opts.penalties : gs.penalties });
    race.penalties = race.penaltyLevel !== 'off';
    race.pen = race.penalties ? JSON.parse(JSON.stringify(CFG.penalties[race.penaltyLevel])) : null;
    race.pitTolKmh = race.pen ? race.pen.pitTol : PIT_TOL_KMH;
    // (waived: a sprint of <= TWO_COMPOUND_MIN_LAPS laps — nobody needs a stop there — and a wet start; a race that turns
    // wet later is declared wet in strategyHook, see ruleOpen)
    race.twoCompoundActive = race.twoCompound && race.wearScale > 0 && laps > TWO_COMPOUND_MIN_LAPS && wet < 0.25;
    race.pitLossEst = estimatePitLoss(track, diff.pace * 0.97);
    race.pitG = pitGeometry(track);
    if (G.weather && G.weather.dynamic && hasWx()) {   // dynamic weather: forecast-based tyre calls
      race.wx = G.weather; Weather.bind(race.wx, race);
      race.wr = U.rng(seed ^ 0x6a09e667);   // own stream: legacy sequences stay unchanged
      race.wxStart = Weather.startChoice(race.wx, { slick: 'M', laps, pit: race.pitLossEst / race.lapTimeEst, bias: 0 });
      race.suggestedCompound = race.wxStart;
    }
    // the player's compound suits the conditions (slicks in the wet become I / W, wets in the dry become M): a race's
    // default for the pre-race tyre pick. Time trial: the chosen starting tyre exactly (there is no pre-race pick).
    let playerCompound = COMPOUNDS[opts.playerCompound] ? opts.playerCompound : 'M';
    if (tt && COMPOUNDS[opts.playerCompound]) { /* as chosen */ }
    else if (race.wx) { if (Weather.cat(playerCompound) !== Weather.cat(race.wxStart)) playerCompound = race.wxStart; }
    else if (!tyreSuits(race, playerCompound)) playerCompound = wetCompound(race) || 'M';

    // cars: one per team in the field (race.field, fieldTeams: the player's team + the others; time trial: the player
    // only). G.cars is in team order (id = index in G.cars).
    const cars = [];
    race.field = fieldTeams(opts, playerTeam, tt);
    for (const ti of race.field) {
      const isPlayer = ti === playerTeam;
      let compound = isPlayer ? playerCompound : aiStartCompound(race, rnd), bias = 0;
      if (race.wx && !isPlayer) {   // bravery: + = trusts wet tyres less (stays on / goes back to slicks sooner)
        const ag = diff.aggression != null ? diff.aggression : 0.55;
        bias = (0.016 + 0.01 * (1 - ag)) * (race.wr() * 2 - 1) + 0.008 * (ag - 0.55);
        const c = Weather.startChoice(race.wx, { slick: 'M', laps, pit: race.pitLossEst / race.lapTimeEst, bias });
        if (isWetTyre(c)) compound = c; else if (isWetTyre(compound)) compound = 'M';
      }
      const car = makeCar({ id: cars.length, team: TEAMS[ti], teamIndex: ti, isPlayer, compound });
      car.wxBias = bias;
      cars.push(car);
    }
    const player = cars.find(c => c.isPlayer);
    // car setup (front / rear wing, CFG.setup): the player's from opts.setup = {fw, rw}; each AI car picks its own for
    // the circuit (skill by difficulty and driver, team taste for front bias, more wing in the wet; opts.aiSetups false = off)
    if (player && !opts.attract && CFG.setup && CFG.setup.apply) CFG.setup.apply(player, opts.setup);
    if (CFG.setup && CFG.setup.choose && opts.aiSetups !== false) {
      const sr = U.rng(seed ^ 0x5e7a9b1), sk0 = { easy: 0.3, medium: 0.6, hard: 0.85, extreme: 1, adaptive: 0.7 }[difficulty] ?? 0.6;
      for (const car of cars) {
        if (car.isPlayer && !opts.attract) continue;
        const bias = [0, 1, -1, 1, 0, -1, 1, 0, 2, -1, 1, -1, 0, 1, -1, 2, 0, 1, -1, 0][car.teamIndex % 20], sk = U.clamp(sk0 + ((car.team && car.team.perf) || 0.988) * 8 - 7.9, 0, 1);
        try { CFG.setup.apply(car, CFG.setup.choose(track, { skill: sk, wet, bias, rnd: sr })); } catch (e) { car.setup = undefined; }
      }
    }
    assignNames(race, cars, opts, U.rng(seed ^ 0x51ed27));
    G.cars = cars; G.player = player; G.race = race; G.ghost = null;
    if (gridMode === 'quali') { startQuali(G, race, rnd, diff); return race; }
    let grid = cars;
    if (!tt) {
      grid = cars.filter(c => !c.isPlayer).map(c => ({ c, k: c.team.perf + (rnd() - 0.5) * 0.012 }))
        .sort((a, b) => b.k - a.k).map(o => o.c);
      if (gridMode === 'random') { grid.push(player); for (let i = grid.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = grid[i]; grid[i] = grid[j]; grid[j] = x; } }
      else {
        const base = Math.max(1, Math.round(({ easy: 6, medium: 7, hard: 8 }[difficulty] || 7) * cars.length / 10));   // (scaled to the field)
        const pg = U.clamp(opts.gridPos != null ? opts.gridPos | 0 : base + Math.floor(rnd() * 3) - 1, 1, cars.length);
        grid.splice(pg - 1, 0, player);
      }
    }
    setupGrid(G, race, grid, rnd, diff);
    if (tt && typeof Ghost !== 'undefined') race.ghostRec = Ghost.createRecorder();
    if (tt && player) race.runs = [runOf(race, player)];   // time trial session: one entry per garage run
    return race;
  }

  // put cars on the grid in `grid` order (time trial: run-up before the line) and reset all race state
  function setupGrid(G, race, grid, rnd, diff) {
    const track = G.track, L = track.length, tt = race.mode === 'timetrial';
    grid.forEach((car, gi) => {
      let s, d;
      if (tt) { s = track.wrapS(-TT_RUNUP); d = track.sample(s).raceLine; }
      else { const g = track.gridSlots[gi] || { s: track.wrapS(-(10 + 8 * gi)), d: 0 }; s = g.s; d = g.d; }
      car.kinematic = false; car.inPitLane = false; car.pitLimiter = false;
      place(car, track, s, d);
      car.grid = gi + 1;
      car.tyre.wear = 0; car.tyre.laps = 0;
      car.battery = CFG.energy.cap * CFG.energy.startCharge;
    });
    race.order = grid.slice(); race.grid = grid.slice();
    race.t = 0; race.phaseT = 0; race.fastestLap = null; race.sessionBestSectors = [null, null, null];
    const cpCap = Math.ceil((Math.min(race.laps, 3) + 1) * L / CP) + 8;
    for (const car of G.cars) initCar(race, car, track, rnd, diff, tt ? 0 : cpCap);
  }

  // ---------- one-shot qualifying: the player's single flying lap vs generated AI times ----------
  function simQualiLap(G, diff) {
    if (typeof AI === 'undefined' || typeof Physics === 'undefined' || typeof createCar === 'undefined') return null;
    try {
      const track = G.track, L = track.length;
      const team = TEAMS.reduce((a, t) => (Math.abs(t.perf - 1) < Math.abs(a.perf - 1) ? t : a), TEAMS[0]);   // perf ≈ 1
      const car = createCar({ id: 99, team, teamIndex: TEAMS.indexOf(team), isPlayer: false, compound: weatherCompound(G) });
      car.assists = { tc: true, abs: true };
      const s0 = track.wrapS(-TT_RUNUP);
      Physics.place(car, track, s0, track.sample(s0).raceLine);
      const fakeRace = { phase: 'racing', t: 0, laps: 0, order: [car], lights: { out: true } };
      const Gs = { track, cars: [car], player: null, race: fakeRace, events: [], weather: G.weather, settings: G.settings, attract: true };
      const world = { track, cars: [car], race: fakeRace, events: Gs.events, weather: G.weather, wearPerMetre: 0 };
      const brain = AI.create(car, diff, 4242, Gs);
      const dt = 1 / 120; let t = 0, dist = -TT_RUNUP, lastS = car.s, tStart = null;
      while (t < 240) {
        Physics.step(car, AI.drive(brain, car, Gs, dt), dt, world);
        Gs.events.length = 0; t += dt; fakeRace.t = t;
        let ds = car.s - lastS; if (ds < -L / 2) ds += L; else if (ds > L / 2) ds -= L; dist += ds; lastS = car.s;
        if (tStart == null && dist >= 0) tStart = t;
        if (tStart != null && dist >= L) return t - tStart;
      }
    } catch (e) { /* fall back */ }
    return null;
  }
  // qualifying tyre is fixed by the conditions (Weather.crossovers(): the lap-time crossovers; fallback without weather.js)
  const wxCross = () => (typeof Weather !== 'undefined' && Weather.crossovers ? Weather.crossovers() : { I: 0.25, W: 0.75 });
  const weatherCompound = G => { const w = (G.weather && G.weather.wet) || 0, x = wxCross(); return w >= x.W ? 'W' : w >= x.I ? 'I' : 'S'; };
  function startQuali(G, race, rnd, diff) {
    const track = G.track, P = G.player;
    race.qualiCompound = weatherCompound(G);
    for (const car of G.cars) {   // remember each car's race-start tyre, everyone qualifies on the same compound
      car._startC = car.tyre.compound;
      car.tyre.compound = race.qualiCompound; car.tyre.wear = 0;
    }
    for (const car of G.cars) if (car !== P) parkInBox(track, car);
    const s = track.wrapS(-TT_RUNUP);
    place(P, track, s, track.sample(s).raceLine);
    initCar(race, P, track, rnd, diff, 0);
    P._race.aeroStartLock = false; P.aeroLock = false;
    race.order = G.cars.slice(); race.grid = G.cars.slice();
    // AI times from team pace x difficulty + noise (calibrated to the AI's real race pace on the reference line)
    // calibrated to the AI's measured solo laps per difficulty (vs the track's reference lap estimate)
    // reference AI quali lap: simulate one real flying lap with the AI on this track, difficulty and weather
    // (≈0.3 s of CPU); fall back to the lap estimate if the AI/physics aren't available
    let ref = simQualiLap(G, diff);
    if (!(ref > 20)) ref = race.lapTimeEst * QUALI_K;
    const times = G.cars.filter(c => c !== P).map(car => ({ car, time: ref / car.team.perf * (1 + (rnd() + rnd() - 1) * 0.006) }));
    times.sort((a, b) => a.time - b.time);
    race.quali = { times, done: false, player: null, endT: null, maxT: TT_RUNUP / 25 + 2.3 * race.lapTimeEst + 20, rnd, diff };
    // simulated AI sector times (split like the reference lap, small noise, summing to each lap time) so the
    // player's sector colours compare against the field instead of always being purple
    const T = G.track, secT = [0, 0, 0];
    for (let i = 0; i < T.N; i++) secT[T.sectorAt(i * T.step)] += T.step / Math.max(5, T.raceSpeed[i]);
    const tot = secT[0] + secT[1] + secT[2];
    race.sessionBestSectors = [null, null, null];
    for (const e of times) {
      const w = secT.map(x => (x / tot) * (1 + (rnd() - 0.5) * 0.012));
      const sw = w[0] + w[1] + w[2];
      e.sectors = w.map(x => e.time * x / sw);
      e.car.bestSectors = e.sectors.slice(); e.car.bestLap = e.time;
      for (let k = 0; k < 3; k++) if (race.sessionBestSectors[k] == null || e.sectors[k] < race.sessionBestSectors[k]) race.sessionBestSectors[k] = e.sectors[k];
    }
    if (times.length) race.qualiBest = { car: times[0].car, time: times[0].time };
    race.lights.out = false;
  }
  function parkInBox(track, car) {
    const pit = track.pit;
    if (!pit) return;
    const s = track.wrapS(pit.boxS[car.teamIndex] != null ? pit.boxS[car.teamIndex] : pit.entryS), d = pit.boxD;
    const w = track.toWorld(s, d), sm = track.sample(s);
    car.x = w.x; car.z = w.z; car.h = Math.atan2(sm.tz, sm.tx);
    car.vx = car.vz = car.r = car.speed = car.vLong = car.vLat = car.aLong = car.aLat = 0;
    car.s = s; car.d = d; car.idx = Math.round(s / track.step) % track.N;
    car.kinematic = true; car.inPitLane = true; car.pitLimiter = false; car.pitState = null;
    car.throttle = 0; car.brake = 0; car.gear = 1; car.rpm = CFG.car.rpmIdle; car.surface = SURF.PIT;
  }
  function qualiStep(G, race, dt) {
    const q = race.quali, P = G.player;
    race.t += dt;
    if (!q.done) {
      progress(G, race, P, dt, true);
      if (P.lapTimes.length) { q.player = P.lapTimes[0]; q.done = true; q.endT = race.t; }
      else if (race.t > q.maxT) { q.done = true; q.endT = race.t; }
      if (q.done) {
        q.times.push({ car: P, time: q.player });
        q.times.sort((a, b) => (a.time == null ? 1e9 : a.time) - (b.time == null ? 1e9 : b.time));
        emit(G, { type: 'qualiDone', times: q.times, pos: q.times.findIndex(x => x.car === P) + 1 });
        finishQuali(G, race);
      }
    }
  }
  function finishQuali(G, race) {
    const q = race.quali;
    // everyone starts the race with a full battery and fresh tyres (the quali lap doesn't carry over)
    for (const c of G.cars) {
      c.batteryCap = CFG.energy.cap; c.battery = CFG.energy.cap * CFG.energy.startCharge;
      c.overtake = false; c.overtakeNext = false; c.boosting = false;
      if (c.tyre) { c.tyre.wear = 0; if (c._startC) { c.tyre.compound = c._startC; c.compoundsUsed = [c._startC]; } }
    }
    race.suggestedCompound = G.player && G.player.tyre ? G.player.tyre.compound : null;
    if (!q.done) { q.done = true; q.times.push({ car: G.player, time: null }); q.times.sort((a, b) => (a.time == null ? 1e9 : a.time) - (b.time == null ? 1e9 : b.time)); }
    setupGrid(G, race, q.times.map(x => x.car), q.rnd, q.diff);
    race.phase = 'grid'; race.awaitConfirm = 'grid';   // grid formed; lights wait for Race.confirmGrid
  }

  // ---------- field (entry list) ----------
  // Team indices in the race, ascending: opts.field (a championship keeps its entry list; the player's team is always in
  // it) or the player's team + the next fieldSize - 1 teams in TEAMS order (default 10 = the original ten teams).
  const FIELD_DEF = () => CFG.field || { min: 2, max: TEAMS.length, def: 10 };
  function fieldSize(n) { const F = FIELD_DEF(); n = Math.round(+n); return U.clamp(isFinite(n) && n > 0 ? n : F.def, F.min, Math.min(F.max, TEAMS.length)); }
  function pickField(pt, n) {
    const out = [pt];
    n = fieldSize(n);
    for (let i = 0; i < TEAMS.length && out.length < n; i++) if (i !== pt) out.push(i);
    return out.sort((a, b) => a - b);
  }
  function fieldTeams(opts, pt, tt) {
    if (tt) return [pt];
    let f = Array.isArray(opts.field) ? opts.field.map(x => x | 0).filter((x, i, a) => x >= 0 && x < TEAMS.length && a.indexOf(x) === i) : null;
    if (!f || f.length < 2) return pickField(pt, opts.fieldSize);
    if (f.indexOf(pt) < 0) { f.sort((a, b) => a - b); f[f.length - 1] = pt; }   // (player changed team: takes the last entry's place)
    return f.sort((a, b) => a - b);
  }

  // ---------- names / weather helpers ----------
  const letters = str => String(str || '').replace(/[^A-Za-zÀ-ɏ]/g, '');
  function makeCode(last, first) { const l = letters(last).toUpperCase(); return (l + letters(first).toUpperCase() + 'XXX').slice(0, 3); }
  function assignNames(race, cars, opts, rnd) {
    const out = new Array(TEAMS.length).fill(null), usedLast = new Set(), usedFirst = new Set(), usedCode = new Set(), usedNum = new Set();
    const pool = typeof NAMES !== 'undefined' && NAMES && NAMES.first && NAMES.last && NAMES.first.length && NAMES.last.length ? NAMES : null;
    const ord = cars.slice().sort((a, b) => (b.isPlayer ? 1 : 0) - (a.isPlayer ? 1 : 0));   // player first (keeps its name)
    for (const car of ord) {
      const ti = car.teamIndex, def = TEAMS[ti].driver, given = opts.driverNames && opts.driverNames[ti];
      let n = null;
      if (car.isPlayer && opts.playerName && String(opts.playerName).trim()) {
        const parts = String(opts.playerName).trim().slice(0, 16).split(/\s+/), NS = pool && NAMES.split ? NAMES.split(parts.join(' ')) : null;   // (NAMES.split: last word = surname)
        const last = NS ? NS.last : parts.length > 1 ? parts.slice(1).join(' ') : parts[0], first = NS ? NS.first : parts.length > 1 ? parts[0] : '';
        n = { first, last, code: NS && NAMES.code ? NAMES.code(last, first) : makeCode(last, first), number: opts.playerNumber > 0 ? opts.playerNumber | 0 : def.number };
      } else if (given && given.last) n = { first: given.first || '', last: given.last, code: given.code || makeCode(given.last, given.first), number: given.number || def.number };
      else if (pool) {
        for (let k = 0; k < 40 && !n; k++) {
          let last = pool.last[Math.floor(rnd() * pool.last.length)];
          if (usedLast.has(last) && k < 39) continue;
          if (usedLast.has(last)) {   // (40 draws all taken: the next free surname in the pool, so names stay unique)
            const j0 = pool.last.indexOf(last);
            for (let j = 1; j < pool.last.length; j++) { const c = pool.last[(j0 + j) % pool.last.length]; if (!usedLast.has(c)) { last = c; break; } }
          }
          let first = pool.first[Math.floor(rnd() * pool.first.length)];
          if (usedFirst.has(first)) {   // (first names unique too, with 20 drivers: the next free one in the pool)
            const j0 = pool.first.indexOf(first);
            for (let j = 1; j < pool.first.length; j++) { const c = pool.first[(j0 + j) % pool.first.length]; if (!usedFirst.has(c)) { first = c; break; } }
          }
          n = { first, last, code: makeCode(last), number: def.number };
        }
      } else n = { first: def.first, last: def.last, code: def.code, number: def.number };
      if (usedCode.has(n.code)) {   // keep the 3-letter codes unique
        const L2 = letters(n.last).toUpperCase(), F = letters(n.first).toUpperCase() || 'X';
        const alts = [L2.slice(0, 2) + F[0], L2[0] + L2.slice(2, 4), L2.slice(0, 2) + L2.slice(-1)];
        n.code = alts.find(c => c.length === 3 && !usedCode.has(c)) || (() => {
          const b = (L2 + 'XX').slice(0, 2);
          for (let q = 0; q < 26; q++) { const c = b + String.fromCharCode(65 + (usedCode.size + q) % 26); if (!usedCode.has(c)) return c; }
          return b + 'Z';
        })();
      }
      usedLast.add(n.last); usedCode.add(n.code); if (n.first) usedFirst.add(n.first);
      if (!car.isPlayer && !(given && given.number)) {   // random, unique race number for AI drivers (2–99, never the player's)
        for (let k = 0; k < 200; k++) { const num = 2 + Math.floor(rnd() * 98); if (!usedNum.has(num)) { n.number = num; break; } }
      }
      if (car.isPlayer && opts.playerNumber > 0) n.number = opts.playerNumber | 0;
      if (!car.isPlayer && usedNum.has(n.number)) { for (let k = 0; k < 200; k++) { const num = 2 + Math.floor(rnd() * 98); if (!usedNum.has(num)) { n.number = num; break; } } }
      usedNum.add(n.number);
      car.driver = n; car.code = n.code; car.name = n.last; car.number = n.number; car.firstName = n.first; car.lastName = n.last;
      out[ti] = n;
    }
    race.driverNames = out;
  }
  // slick / intermediate / wet the conditions call for (null = slicks). Dynamic weather: the forecast over the next
  // two laps (with the car's bravery bias), else the fixed thresholds.
  function wetCompound(race, car) {
    if (race.wx) {
      // from the car's next pit entry (now, if it is already in the lane), over at most the racing it has left
      const inPit = !!car && (car.kinematic || !!(car._race && car._race.pit));
      const u = car && !inPit ? lapsToEntryR(race, car) : 0;
      const rem = car && car._race && race.trackL ? remainingLaps(race, car, race.trackL) - u : 2;
      const c = Weather.bestNow(race.wx, U.clamp(rem, 0.3, 2), wxBias(race, car), 'M', u);
      return isWetTyre(c) ? c : null;
    }
    const x = wxCross();
    return race.wet >= x.W ? 'W' : race.wet >= x.I ? 'I' : null;
  }
  const lapsToEntryR = (race, car) => (race.trackL ? lapsToEntry(car, race.trackL) : 0);
  const isWetTyre = c => c === 'I' || c === 'W';
  const tyreSuits = (race, c, car) => { const w = wetCompound(race, car); return w ? c === w : !isWetTyre(c); };
  const compoundsFor = (race, start) => { if (race.wx) return isWetTyre(start) ? [start] : COMP_IDS; const w = wetCompound(race); return w ? [w] : COMP_IDS; };
  function pitGeometry(track) {
    const pit = track.pit;
    if (!pit || !pit.laneD) return null;
    const P = pit.length || track.wrapS(pit.exitS - pit.entryS);
    const uIn = x => Math.min(P, track.wrapS(x - pit.entryS));
    const uL0 = pit.limiterS0 != null ? uIn(pit.limiterS0) : Math.min(120, P * 0.25);
    const uL1 = Math.max(uL0, pit.limiterS1 != null ? uIn(pit.limiterS1) : P - Math.min(120, P * 0.25));
    const a0 = Math.abs(pit.laneD(track.wrapS(pit.entryS + 0.05)) || 0);
    const a1 = pit.laneCenterD != null ? Math.abs(pit.laneCenterD) : Math.abs(pit.laneD(track.wrapS(pit.entryS + P / 2)) || a0 + 1);
    // bb: lateral fast lane <-> box move, 22 m, shorter with boxes < ~15 m apart (20 teams): a car turning into / out of
    // its box stays clear of a car standing in the next box
    const bsp = pit.boxS && pit.boxS.length > 1 ? Math.abs(track.deltaS(pit.boxS[0], pit.boxS[1])) : 99;
    const g = { P, uL0, uL1, a0, a1: Math.max(a1, a0 + 0.1), lhw: pit.laneHalfW || 5, cap: null, bb: U.clamp(1.45 * bsp, 14, BOX_BLEND) };
    // pit.exitCap (bend on the exit road): world-speed cap over [u0, u1] -> max autopilot rate along s per metre of lane,
    // with a braking run-in, applied by the lane autopilot (every car is handed back at the limiter-end line as usual)
    const ec = pit.exitCap;
    if (ec && ec.kph > 0) {
      const u0 = uIn(ec.s0), u1 = Math.max(u0 + 1, uIn(ec.s1)), n = Math.ceil(P) + 2, vs = new Float32Array(n).fill(1e9), vW = ec.kph / 3.6;
      const ps0 = { P, pg: g, stop: false };
      for (let u = Math.floor(u0); u <= Math.min(n - 1, Math.ceil(u1)); u++) {
        worldAt(track, track.wrapS(pit.entryS + u - 0.5), laneD(track, pit, ps0, u - 0.5), _w0);
        worldAt(track, track.wrapS(pit.entryS + u + 0.5), laneD(track, pit, ps0, u + 0.5), _w1);
        vs[u] = vW / Math.max(0.5, Math.hypot(_w1.x - _w0.x, _w1.z - _w0.z));   // (outside of a bend the lane is longer than s)
      }
      for (let u = n - 2; u >= 0; u--) vs[u] = Math.min(vs[u], Math.sqrt(vs[u + 1] * vs[u + 1] + 2 * CAP_DEC));
      g.cap = { u0, u1, kph: ec.kph, vs };
    }
    return g;
  }
  const capAt = (pg, u) => { const c = pg && pg.cap; if (!c || u > c.u1) return Infinity; const i = u < 0 ? 0 : Math.round(u); return i < c.vs.length ? c.vs[i] : Infinity; };

  function initCar(race, car, track, rnd, diff, cpCap) {
    const L = track.length, dist = track.deltaS(0, car.s);
    Object.assign(car, {
      lap: 0, lapsDone: 0, raceDist: dist, pos: car.grid || 1, gapLeader: 0, gapAhead: 0, lapsDown: 0,
      lastLap: null, bestLap: null, lapTimes: [], curLapTime: 0,
      sectors: [null, null, null], lastSectors: [null, null, null], bestSectors: [null, null, null],
      sectorFlags: [null, null, null], lastSectorFlags: [null, null, null],
      finished: false, finishTime: null, penalty: 0, penaltyServed: 0, pitStops: 0, compoundsUsed: [car.tyre.compound],
      penPending: false, lapHist: [], tlWarn: 0, boxCall: false,   // track-limits strikes; BOX THIS LAP sign up (boxHint)
      pitState: null, pitCompound: null, pitProgress: null, lastPitTime: null, lastServiceTime: null,
      dnf: false, jumpStart: false, kinematic: false, inPitLane: false, pitLimiter: false,
      wantPit: false, nextCompound: null, overtake: false, overtakeNext: false, strategy: null,
    });
    car.batteryCap = CFG.energy.cap;
    car.aeroLock = race.mode !== 'timetrial';
    if (!car.isPlayer && race.laps) {
      const stops = planStops(race, race.laps, car.tyre.compound, car.compoundsUsed, 0, rnd);
      car.strategy = { auto: true, stops, plan: [car.tyre.compound].concat(stops.map(x => x.compound)).join('-'), pending: null };
    }
    car._race = {
      prevS: car.s, dist, maxDist: dist,
      nextB: nextPoint(dist, 0, L), nextBi: 2, lineDist: 0,             // next timing line: the start/finish line
      lapStartT: 0, sectorStartT: 0, finishKey: 0,
      nextDetect: nextPoint(dist, track.overtakeDetectS || 0, L), detectPending: false,
      nextEntry: track.pit ? nextPoint(dist, track.pit.entryS, L) : Infinity, boxHintKey: null,
      cp: cpCap ? new Float64Array(cpCap) : null, cpv: cpCap ? new Float32Array(cpCap) : null, cpN: 0,
      stops: [], stopRec: null,
      gridX: car.x, gridZ: car.z,
      launchT: race.attract || car.isPlayer ? 0 : U.lerp(0.12, 0.3, rnd()) * (diff.reaction / 0.3),
      hold: { throttle: 0, brake: 1, steer: 0, boost: false, aeroPress: false, hold: true },
      pit: null, pitCooldown: -Infinity, tyreDist: 0, progD: dist, progT: 0, preLane: false,
      aeroStartLock: race.mode !== 'timetrial', aeroStartZ: false, aeroPitLockD: null,
      finPos: null, penDone: 0, penFrom: null,   // position at the flag; post-race penalty already applied; position before it
      h: { c0: car.tyre.compound, stops: 0, pen: 0, served: 0, r: 0, w: 0, n: 0, inLap: false, outLap: false, bad: false, entryRun: null },   // this lap so far (car.lapHist)
      run: 0,   // time trial: garage runs completed (Race.garageGo)
    };
  }

  // ---------- per-step update ----------
  function update(G, dt) {
    const race = G.race, track = G.track;
    if (!race || !track || !race.order || !race.order.length) return;
    const cars = G.cars;
    if (G.weather && G.weather.wet != null) race.wet = +G.weather.wet || 0;
    if (race.awaitConfirm) return;   // entry / grid screen: everything frozen, lights not started
    PIT_SPEED_TOL = CFG.race.pitSpeedLimit + (race.pitTolKmh != null ? race.pitTolKmh : PIT_TOL_KMH) / 3.6;   // (this race's level)
    if (race.phase === 'quali') { qualiStep(G, race, dt); return; }
    let racing = race.phase === 'racing' || race.phase === 'finished';
    if (racing) race.t += dt;
    else { startSequence(G, race, dt); racing = race.phase === 'racing'; }
    if (racing && race.wx) Weather.step(race.wx, G, dt);
    scanCollisions(G, race);
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i], rc = car._race;
      if (!rc) continue;
      if (racing && race.wx && !car.isPlayer && race.phase === 'racing') wxCheck(G, race, car);
      if (rc.pit) pitStep(G, race, car, dt);
      else if (racing) checkPitEntry(G, race, car);
      else checkJumpStart(G, race, car);
      progress(G, race, car, dt, racing);
      aeroLockStep(track, car, rc);
      if (racing) { stuckCheck(G, race, car); trackLimitsStep(G, race, car, dt); histStep(race, car, rc); }
      rc.pvx = car.vx || 0; rc.pvz = car.vz || 0; rc.pbr = car.brake || 0;   // pre-contact state for the next step's collisions
    }
    updateOrder(G, race, racing && race.mode !== 'timetrial');
    if (race.leaderFinished && race.phase === 'racing' && race.mode !== 'timetrial') settlePenalties(G, race, false);
    if (race.mode !== 'timetrial') {
      updateGaps(race, track.length);
      for (let i = 0; i < cars.length; i++) {
        const rc = cars[i]._race;
        if (rc && rc.detectPending) { rc.detectPending = false; armOvertake(G, race, cars[i]); }
      }
      if (G.player && !race.attract && race.wx && race.phase === 'racing') wxPlayerEval(G, race, G.player);   // (the engineer reads it: Race.weatherCall)
      if (G.player && !race.attract) boxHint(G, race, G.player);
      if (racing) checkRaceEnd(G, race, dt);
    } else if (G.player) ghostStep(G, race, G.player);
    const lead = race.order[0];
    race.leaderLap = race.laps ? Math.min(race.laps, lead.lap) : lead.lap;
    race.evSeen = G.events ? G.events.length : 0;
  }

  // ---------- causing a collision ----------
  // Reads the collision events Physics.collide pushed this step (G.events is cleared by main once per frame): e.intensity =
  // normal closing speed at the contact (m/s); e.nx / nz = contact normal car -> other, e.avx .. e.bvz = both velocities
  // before that impulse (else the start-of-step velocities rc.pvx / pvz). Fault (collisionFault) in the TRACK frame: the
  // closing speed along the contact normal = the longitudinal part the car behind brings (it must avoid the car ahead) +
  // each car's own sideways motion towards the other (its d-rate across the track: a car's own yaw never makes the other
  // one look like the mover). The offender's part must be >= col.share of it, else it is a racing incident. Kinds:
  //   rear : nose into the back of a car nearly in line, >= col.rear m/s. Not when the car ahead is stopped / spinning or
  //          cut across into this car's lane in the last 0.8 s.
  //   dive : a lunge (>= col.back m back a second earlier, still closing at >= col.lunge m/s) into the rear quarter / side
  //          of a car it never got alongside, >= col.dive m/s; col.diveNA: also when that car turned in on it (it may)
  //   side : moved across into a car alongside (at most col.along m further back, centre to centre), >= col.side m/s. A car
  //          further back is not alongside: the car ahead may take its line (racing incident).
  // Never: light contact (< col.light), a car pushed into another (hit by a third car < CHAIN s before), a car that lost
  // control (sliding / spinning; strict col.spin: that too), the other car of an incident already penalised, cars in the pit
  // lane. First-lap latitude: thresholds x col.lap1 in the race's first col.lap1Dist m. One penalty per offender per
  // col.cool s; col.big = { imp, sec }: a heavier penalty for a big hit.
  // Multiplayer: a car posed from network reports (server: car.net.auth 'client'; client: remote proxies car.netLive; or
  // car.remotePose) has a velocity up to ~0.1-0.25 s old: a car braking harder than the one ahead of it, extrapolated at its
  // old speed, overlaps it in a phantom contact with the old (higher) closing speed. That overestimate (NET_AGE x the
  // acceleration difference along the normal, from the reported pedals; NET_LAT m/s^2 sideways, either way) is taken off
  // before the thresholds. (An underestimate, e.g. the car ahead braking, is left alone.)
  const CHAIN = 0.6, INC_GAP = 1.5, CUT_T = 0.8;   // s: pushed-into window; one incident per pair; "cut across" look-back
  const NET_AGE = 0.15, NET_LAT = 8;
  const isRemote = c => !!(c && (c.remotePose || c.netLive || (c.net && c.net.auth === 'client')));
  function netSlack(f) {
    const F = f.ahead, R = F === f.car ? f.victim : f.car, gF = isRemote(F) ? NET_AGE : 0, gR = isRemote(R) ? NET_AGE : 0;
    if (!gF && !gR) return 0;
    const acc = c => (c.throttle || 0) * 6 - (c.brake || 0) * CFG.perf.brakeDecel(c.speed || 0, c.grip || 1);
    return Math.max(0, acc(F) * gF - acc(R) * gR) * Math.max(0, f.nl) + NET_LAT * Math.max(gF, gR) * Math.abs(f.nt) + 0.5;
  }
  const HQ = 14, HQ_DT = 0.1;                        // per-car history (s, d every 0.1 s, 1.4 s) for the look-backs
  function scanCollisions(G, race) {
    const ev = G.events, C = race.pen && race.pen.col;
    if (!ev) return;
    // (each contact is judged once: flagged, not an index -- main clears G.events once per frame, several steps per frame)
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.type !== 'collision' || e._judged) continue;
      e._judged = true;
      const a = e.car, b = e.other;
      if (!a || !b || !a._race || !b._race || !(e.intensity > 1.5) || race.phase !== 'racing' || race.attract) continue;
      a._race.touchT = b._race.touchT = race.t;   // (track limits: a car knocked off is not judged)
      const f = collisionFault(a, b, e.intensity, G.track, e, C || CFG.penalties.standard.col);
      if (!f) continue;
      const o = f.car, v = f.victim, rc = o._race;
      v._race.hitT = race.t; v._race.hitBy = o;   // (a car pushed on into another is excused, see below)
      if (!C || !race.penalties || o.finished || o.kinematic || v.kinematic || o.inPitLane || v.inPitLane) continue;
      const key = Math.min(a.id, b.id) * 4096 + Math.max(a.id, b.id), inc = race.inc || (race.inc = new Map()), I = inc.get(key);
      const same = I && race.t - I.t < INC_GAP;
      if (same) I.t = race.t; else inc.set(key, { t: race.t, by: null });
      if (same && I.by && I.by !== o) continue;                                          // the other car of a judged incident
      if (rc.hitT != null && rc.hitBy !== v && race.t - rc.hitT < CHAIN) continue;       // pushed into it by a third car
      const k = rc.dist < C.lap1Dist ? C.lap1 : 1;                                       // first-lap latitude
      if (e.intensity - netSlack(f) < Math.max(C.light, f.need) * k) continue;
      if (rc.lastColPen != null && race.t - rc.lastColPen < C.cool) continue;
      rc.lastColPen = race.t;
      inc.get(key).by = o;
      const sec = C.big && e.intensity >= C.big.imp * k ? C.big.sec : C.sec;
      const turn = turnLabel(G.track, o.s), where = turn ? ' (' + turn + ')' : '';
      o.penalty += sec;
      emit(G, { type: 'penalty', car: o, sec, reason: 'Causing a collision' + where, detail: f.why, kind: f.kind, other: v, turn, imp: e.intensity });
      if (o.isPlayer) note(race, sec + ' S PENALTY', '#ffd12e', 'Causing a collision' + where + ' · ' + f.why);
    }
  }
  // per-car look-back history (race time, s, d) sampled every HQ_DT s while racing
  function histStep(race, car, rc) {
    let q = rc.hq;
    if (!q) q = rc.hq = { n: 0, i: 0, last: -1, t: new Float64Array(HQ), s: new Float64Array(HQ), d: new Float32Array(HQ) };
    if (q.n && race.t - q.last < HQ_DT - 1e-6 && race.t >= q.last) return;
    q.last = race.t; q.t[q.i] = race.t; q.s[q.i] = car.s; q.d[q.i] = car.d || 0; q.i = (q.i + 1) % HQ; if (q.n < HQ) q.n++;
  }
  const _hp = [{ s: 0, d: 0 }, { s: 0, d: 0 }];
  function histAt(car, t, slot) {   // sample nearest race time t (within 0.12 s), or null
    const q = car._race && car._race.hq;
    if (!q || !q.n) return null;
    let best = -1, bd = 0.12;
    for (let k = 0; k < q.n; k++) { const j = (q.i - 1 - k + HQ) % HQ, e = Math.abs(q.t[j] - t); if (e < bd) { bd = e; best = j; } }
    if (best < 0) return null;
    const o = _hp[slot]; o.s = q.s[best]; o.d = q.d[best];
    return o;
  }
  // a car that has lost control: facing well away from the track direction, or sliding (body slip > ~17 deg)
  function lostControl(T, c) {
    const i = c.idx >= 0 ? c.idx : T.idxAt(c.s), rel = U.wrapAngle((c.h || 0) - Math.atan2(T.tz[i], T.tx[i]));
    return Math.abs(rel) > 0.7 || Math.abs(Math.atan2(c.vLat || 0, Math.max(3, Math.abs(c.vLong || 0)))) > 0.3;
  }
  // who caused the contact between a and b (either order) -> { car, victim, kind, why, need (m/s the contact must reach) } |
  // null (racing incident / accident). imp = e.intensity; track, e (the collision event, optional: pre-impulse velocities +
  // normal) and col (race.pen.col, default the standard level); info (optional, tests / logs) receives the analysis
  function collisionFault(a, b, imp, track, e, col, info) {
    const T = track, C = col || CFG.penalties.standard.col;
    if (!T || !T.tx) return null;
    const ab = T.deltaS(a.s, b.s), F = ab >= 0 ? b : a, R = F === b ? a : b, ds = Math.abs(ab), dd = (F.d || 0) - (R.d || 0);
    // velocities before the contact; each car in its own track frame: u along the track, w = sideways (+ = right)
    const pre = (c, z) => (e && e.avx != null ? (c === e.car ? (z ? e.avz : e.avx) : (z ? e.bvz : e.bvx))
      : c._race && c._race.pvx != null ? (z ? c._race.pvz : c._race.pvx) : (z ? c.vz : c.vx)) || 0;
    const iF = F.idx >= 0 ? F.idx : T.idxAt(F.s), iR = R.idx >= 0 ? R.idx : T.idxAt(R.s);
    const fvx = pre(F, 0), fvz = pre(F, 1), rvx = pre(R, 0), rvz = pre(R, 1);
    const uF = fvx * T.tx[iF] + fvz * T.tz[iF], wF = fvx * T.nx[iF] + fvz * T.nz[iF];
    const uR = rvx * T.tx[iR] + rvz * T.tz[iR], wR = rvx * T.nx[iR] + rvz * T.nz[iR];
    // contact normal R -> F: the physics' own, else between the nearest collision circles
    let nx = 0, nz = 0;
    if (e && e.nx != null) { const sg = e.car === R ? 1 : -1; nx = e.nx * sg; nz = e.nz * sg; }
    else {
      const OFF = CFG.car.collisionOffset || 1.55;
      let bd = Infinity;
      for (let p = -1; p <= 1; p += 2) for (let q = -1; q <= 1; q += 2) {
        const dx = F.x + Math.cos(F.h) * OFF * q - R.x - Math.cos(R.h) * OFF * p, dz = F.z + Math.sin(F.h) * OFF * q - R.z - Math.sin(R.h) * OFF * p, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; const l = Math.sqrt(d2) || 1; nx = dx / l; nz = dz / l; }
      }
    }
    const nl = nx * T.tx[iR] + nz * T.tz[iR], nt = nx * T.nx[iR] + nz * T.nz[iR], ant = Math.abs(nt), sg = nt >= 0 ? 1 : -1;
    const closeL = uR - uF, towR = wR * sg, towF = -wF * sg;          // catching the car ahead; sideways towards the other
    const shR = closeL * nl + towR * ant, shF = towF * ant, pR = Math.max(0, shR), pF = Math.max(0, shF), tot = pR + pF;
    if (tot < 0.8) { if (info) Object.assign(info, { F, R, ds, dd, closeL, towR, towF, nl, nt, pR, pF, tot }); return null; }
    // a second ago: how far back the car behind was (divebomb), how far across the car ahead was (cut across)
    const t = (R._race && R._race.hq && R._race.hq.last) || 0;
    const hR = histAt(R, t - 1.0, 0), hF = histAt(F, t - 1.0, 1);
    const backPast = hR && hF ? T.deltaS(hR.s, hF.s) : ds + closeL;
    const lunge = backPast >= C.back && closeL >= C.lunge;             // came from far back, still closing fast
    const cR = histAt(R, t - CUT_T, 0), cF = histAt(F, t - CUT_T, 1);
    const cutIn = !!(cR && cF && Math.abs(cF.d - cR.d) > 2.3 && T.deltaS(cR.s, cF.s) < 15);
    const inline = Math.abs(dd) < 1.35 && ds > 3.0, alongside = ds <= C.along;
    if (info) Object.assign(info, { F, R, ds, dd, closeL, towR, towF, nl, nt, pR, pF, tot, backPast, lunge, cutIn, inline, alongside });
    let off = pR >= C.share * tot ? R : pF >= C.share * tot ? F : null, kind = null, why = '', need = 0;
    if (off === R) {
      if (towR * ant > closeL * nl) { kind = 'side'; need = C.side; why = alongside ? 'Moved across into a car alongside' : 'Moved across into the car ahead'; }
      else if ((F.speed || 0) < 8 || lostControl(T, F)) return null;                   // car ahead stopped / spun: an accident
      else if (lunge && !alongside && !inline) { kind = 'dive'; need = C.dive; why = 'Divebomb from too far back'; }
      else if (cutIn) return null;                                                     // it cut across into this car's lane
      else { kind = 'rear'; need = C.rear; why = (R._race && R._race.pbr > 0.3) || (R.brake || 0) > 0.3 ? 'Hit from behind under braking' : 'Hit from behind'; }
    } else if (off === F) {
      if (alongside) { kind = 'side'; need = C.side; why = 'Moved across into a car alongside'; }
      else off = null;   // the car behind was not alongside: the car ahead may take its line
    }
    // a lunge from far back into a car that turned in on it (never alongside: it may): the lunging car's (col.diveNA)
    if (!off && C.diveNA && lunge && !alongside && (F.speed || 0) >= 8 && !lostControl(T, F)) { off = R; kind = 'dive'; need = C.dive; why = 'Divebomb from too far back'; }
    if (!off) return null;
    if (lostControl(T, off)) { if (!C.spin) return null; kind = 'spin'; why = 'Lost control into another car'; need = Math.max(need, C.side); }
    return { car: off, victim: off === R ? F : R, ahead: F, kind, why, need, ds, dd, nl, nt, share: (off === R ? pR : pF) / tot };
  }
  // "T4": the corner containing s (or the nearest apex within 150 m); '' without corner data
  function turnLabel(track, s) {
    const C = track && track.corners;
    if (!C || !C.length) return '';
    let best = null, bd = 150;
    for (const c of C) {
      const in0 = track.deltaS(c.s0, s), len = track.deltaS(c.s0, c.s1);
      if (len > 0 && in0 >= 0 && in0 <= len) return 'T' + c.num;
      const d = Math.abs(track.deltaS(c.s, s));
      if (d < bd) { bd = d; best = c; }
    }
    return best ? 'T' + best.num : '';
  }

  // ---------- track limits ----------
  // A breach = all four wheels off (no part of any tyre on track or kerb; the pit lane counts as track). When the car
  // rejoins, the time it took is compared with its own pace (rc.tlK: EMA of speed / raceSpeed while on track) over the
  // same stretch (race.pen.tl): a gain > tl.gain s is a strike (TRACK LIMITS WARNING n/tl.warn; the strike after the last
  // warning = a tl.sec penalty, then the count starts again); a gain > tl.cut s (a cut chicane) is a tl.sec penalty at once.
  // Going off and losing time is no offence, nor is a breach within 1.5 s of a contact. Time trial: an advantage breach
  // (the level's tl.gain) invalidates the lap. Penalties off: nothing (in any mode).
  function wheelsOff(track, car) {
    const i = car.idx >= 0 ? car.idx : Math.round(track.wrapS(car.s) / track.step) % track.N;
    if (Math.abs(car.d || 0) < track.halfW[i] - 1.2) return false;   // (cheap: nowhere near an edge)
    const ch = Math.cos(car.h), sh = Math.sin(car.h), tx = track.tx[i], tz = track.tz[i];
    const cosR = ch * tx + sh * tz, sinR = sh * tx - ch * tz, C = CFG.car, hw = (C.trackWidth || 1.6) / 2;
    for (const ax of [C.cgToFront || 1.85, -(C.cgToRear || 1.55)]) {
      const s = track.wrapS(car.s + ax * cosR), d0 = car.d + ax * sinR;
      for (const sd of [-hw, hw]) {
        const d = d0 + sd, din = d - Math.sign(d) * TYRE_HALF_W, sf = track.surface(s, din);
        if (sf === SURF.TRACK || sf === SURF.KERB || sf === SURF.PIT) return false;
      }
    }
    return true;
  }
  function trackLimitsStep(G, race, car, dt) {
    const rc = car._race, T = G.track;
    if (race.phase !== 'racing' || race.attract || car.finished || car.dnf || car.kinematic || car.inPitLane || !T.halfW) { rc.tlOff = null; return; }
    if (!race.pen) { rc.tlOff = null; return; }   // (penalties off: no strikes, no invalidated time-trial laps either)
    const off = wheelsOff(T, car);
    if (!off) {
      const i = car.idx >= 0 ? car.idx : 0, vr = T.raceSpeed[i];
      if ((car.speed || 0) > 8 && vr > 1) rc.tlK = rc.tlK == null ? 0.95 : rc.tlK + (U.clamp(car.speed / vr, 0.5, 1.15) - rc.tlK) * Math.min(1, dt / 1.5);
      if (rc.tlOff) { const x = rc.tlOff; rc.tlOff = null; tlJudge(G, race, car, x); }
      return;
    }
    if (!rc.tlOff) rc.tlOff = { t0: race.t, D0: rc.dist, s0: car.s, k: U.clamp(rc.tlK || 0.95, 0.6, 1.1) };
  }
  function tlJudge(G, race, car, x) {
    const rc = car._race, T = G.track, D1 = rc.dist, len = D1 - x.D0, tAct = race.t - x.t0;
    if (!(len > 1) || len > 800 || (rc.touchT != null && race.t - rc.touchT < 1.5)) return;   // (backwards / knocked off)
    const tl = race.pen.tl;
    let tRef = 0;
    for (let u = 0; u < len; u += 2) tRef += Math.min(2, len - u) / Math.max(8, T.raceSpeed[Math.round(T.wrapS(x.s0 + u) / T.step) % T.N] * x.k);
    const gain = tRef - tAct;
    if (gain <= tl.gain) return;
    const turn = turnLabel(T, x.s0 + len * 0.5), where = turn ? ' (' + turn + ')' : '';
    if (race.mode === 'timetrial') {
      if (rc.h) rc.h.bad = true;
      emit(G, { type: 'trackLimits', car, invalid: true, turn, gain });
      return;
    }
    const cut = gain > tl.cut;
    car.tlWarn = (car.tlWarn || 0) + (cut ? 0 : 1);
    if (!cut && car.tlWarn <= tl.warn) { emit(G, { type: 'trackLimits', car, n: car.tlWarn, max: tl.warn, turn, gain }); return; }
    if (!cut) car.tlWarn = 0;
    car.penalty += tl.sec;
    const reason = (cut ? 'Corner cut' : 'Track limits') + where;
    emit(G, { type: 'penalty', car, sec: tl.sec, reason, detail: cut ? 'Gained ' + gain.toFixed(1) + ' s off track' : tl.warn + ' warnings used', kind: cut ? 'cut' : 'limits', turn, gain });
    if (car.isPlayer) note(race, tl.sec + ' S PENALTY', '#ffd12e', reason);
  }

  function startSequence(G, race, dt) {
    race.phaseT += dt;
    if (race.phase === 'grid') {
      if (race.phaseT >= R.lightsDelay) {
        race.phase = 'lights'; race.phaseT = 0; race.lights.on = 1;
        emit(G, { type: 'lightOn', n: 1 });
      }
      return;
    }
    const n = Math.min(5, 1 + Math.floor(race.phaseT / R.lightsInterval));
    while (race.lights.on < n) { race.lights.on++; emit(G, { type: 'lightOn', n: race.lights.on }); }
    const tOut = 4 * R.lightsInterval + race.holdT;
    if (race.lights.on === 5 && !race.attract && tOut - race.phaseT <= ANTICIPATE_T)
      for (const c of G.cars) if (c.aiAnticipate && !c.isPlayer) race.releaseEarly.add(c);
    if (race.phaseT >= tOut) {
      race.releaseEarly.clear();
      race.lights.on = 0; race.lights.out = true; race.phase = 'racing'; race.t = 0; race.phaseT = 0;
      for (const c of G.cars) if (c._race) { c._race.lapStartT = 0; c._race.sectorStartT = 0; }   // lap 1 / S1 clocks: lights out
      emit(G, { type: 'lightsOut' });
    }
  }

  function checkJumpStart(G, race, car) {
    if (car.jumpStart || race.attract || !race.penalties || !race.pen) return;
    const rc = car._race, dx = car.x - rc.gridX, dz = car.z - rc.gridZ, jd = race.pen.jump, sec = race.pen.jumpSec;   // (level: tolerance, s)
    if (dx * dx + dz * dz <= jd * jd || !(car.isPlayer || car.throttle > 0.1)) return;
    car.jumpStart = true; car.penalty += sec;
    emit(G, { type: 'jumpStart', car, sec });
    emit(G, { type: 'penalty', car, sec, reason: 'Jump start' });
    if (car.isPlayer) note(race, 'JUMP START', '#ff3b3b', '+' + sec + 's time penalty');
  }

  // crossing-time interpolation scratch (set per car per step)
  let cT0 = 0, cD0 = 0, cSpan = 0, cDt = 0;
  const crossT = p => cT0 + (cSpan > 1e-9 ? U.clamp((p - cD0) / cSpan, 0, 1) : 1) * cDt;

  // Race distance from s (wraps counted with deltaS). Crossing events use the high-water mark maxDist, so reversing
  // over a line and driving forward again never counts twice; cars start behind the line (dist < 0, lap 0).
  function progress(G, race, car, dt, racing) {
    const track = G.track, L = track.length, rc = car._race;
    const prev = rc.dist;
    rc.dist += track.deltaS(rc.prevS, car.s);
    rc.prevS = car.s;
    if (rc.dist > prev) rc.tyreDist += rc.dist - prev;
    if (car.finished) return;
    car.raceDist = rc.dist;
    if (!racing || car.dnf) return;
    if (rc.dist > rc.maxDist) {
      const m1 = rc.dist;
      cT0 = race.t - dt; cD0 = prev; cSpan = m1 - prev; cDt = dt;   // this step moved prev -> m1
      rc.maxDist = m1;
      if (rc.cp) {
        while (rc.cpN * CP <= m1) {
          if (rc.cpN >= rc.cp.length) {
            const a = new Float64Array(rc.cp.length * 2), b = new Float32Array(rc.cp.length * 2);
            a.set(rc.cp); b.set(rc.cpv); rc.cp = a; rc.cpv = b;
          }
          rc.cp[rc.cpN] = crossT(rc.cpN * CP); rc.cpv[rc.cpN] = car.speed || 0; rc.cpN++;
        }
      }
      while (rc.nextB <= m1 && !car.finished) {
        const p = rc.nextB, tc = crossT(p);
        if (rc.nextBi === 2) { lineCrossing(G, race, car, p, tc); rc.nextBi = 0; rc.nextB = p + track.sectorS[0]; }
        else if (rc.nextBi === 0) { sectorDone(G, race, car, 0, tc); rc.nextBi = 1; rc.nextB = rc.lineDist + track.sectorS[1]; }
        else { sectorDone(G, race, car, 1, tc); rc.nextBi = 2; rc.nextB = rc.lineDist + L; }
      }
      if (car.finished) return;
      if (m1 >= rc.nextDetect) { rc.nextDetect = nextPoint(m1, track.overtakeDetectS || 0, L); if (car.lap >= 1) rc.detectPending = true; }
      if (m1 >= rc.nextEntry) rc.nextEntry = nextPoint(m1, track.pit.entryS, L);
    }
    if (rc.cp) {   // standstills (pit box, stuck car) keep the gap interpolation exact around them
      const v = car.speed || 0;
      if (!rc.stopRec) {
        if (v < 0.05) { rc.stopRec = { d: rc.maxDist, t0: race.t, t1: null }; rc.stops.push(rc.stopRec); if (rc.stops.length > 24) rc.stops.shift(); }
      } else if (v > 0.08 || rc.dist > rc.stopRec.d + 0.3) { rc.stopRec.t1 = race.t - (car.kinematic ? v / PIT_ACC : 0); rc.stopRec = null; }
    }
    // race lap 1 runs from lights out (standing start from the grid slot); time trial / quali: from the first crossing
    car.curLapTime = car.lap >= 1 || (race.mode !== 'timetrial' && race.phase !== 'quali') ? race.t - rc.lapStartT : 0;
  }

  // Straight mode lockout (physics honours car.aeroLock): from the start through the start straight's zone (the one
  // the car is in past the line; lifted when it leaves it), else until 1000 m into lap 1 (and out of any zone entered
  // before that), and after a pit exit until the start of the next straight zone. (A flat 1000 m also locked a zone
  // starting before 1000 m for the whole of lap 1: Cerro Dorado's SM2, 890 m after the line.)
  function aeroLockStep(track, car, rc) {
    if (rc.aeroStartLock) {
      const inZ = !!(track.zoneAt && track.zoneAt(car.s) >= 0);
      if (inZ && rc.dist > 0) rc.aeroStartZ = true;
      else if (!inZ && (rc.dist >= 1000 || rc.aeroStartZ)) rc.aeroStartLock = false;
    }
    if (rc.aeroPitLockD != null && rc.maxDist >= rc.aeroPitLockD) rc.aeroPitLockD = null;
    car.aeroLock = rc.aeroStartLock || rc.aeroPitLockD != null || !!car.kinematic;
  }

  // safety net: an AI car that has not gained 5 m in STUCK_RESET s (beached in gravel, wedged on a wall, spun
  // backwards) is put back on the racing line by Physics.resetToTrack. The player has main's reset key instead.
  function stuckCheck(G, race, car) {
    const rc = car._race;
    if (rc.dist > rc.progD + 5 || car.kinematic || car.finished || car.dnf) { rc.progD = Math.max(rc.progD, rc.dist); rc.progT = race.t; return; }
    if ((car.isPlayer && !race.attract) || race.t - rc.progT < STUCK_RESET) return;
    rc.progT = race.t; rc.progD = rc.dist;
    if (typeof Physics !== 'undefined' && Physics && Physics.resetToTrack) Physics.resetToTrack(car, G.track);
  }

  // a sector time's colour against the bests as they are now (not as they were when it was set): purple = the session's
  // best of every car (in multiplayer the server's), green = the driver's own best, yellow = slower. So a purple turns
  // green / yellow on screen as soon as someone beats it. fallback: the flag stored when it was set (no bests yet)
  function sectorFlag(race, car, i, t, fallback) {
    if (!(t > 0) || !race) return fallback || null;
    const sb = race.sessionBestSectors && race.sessionBestSectors[i], pb = car && car.bestSectors && car.bestSectors[i], E = 5e-4;   // (ms on the wire)
    if (!(sb > 0) && !(pb > 0)) return fallback || 'yellow';
    if (sb > 0 ? t <= sb + E : fallback === 'purple') return 'purple';
    return pb > 0 && t <= pb + E ? 'green' : 'yellow';
  }
  function sectorDone(G, race, car, i, tc) {
    const rc = car._race, st = tc - rc.sectorStartT;
    rc.sectorStartT = tc;
    car.sectors[i] = st;
    const sb = race.sessionBestSectors[i], pb = car.bestSectors[i];
    let flag;
    if (sb == null || st < sb) { flag = 'purple'; race.sessionBestSectors[i] = st; }
    else if (pb == null || st < pb) flag = 'green';
    else flag = 'yellow';
    if (pb == null || st < pb) car.bestSectors[i] = st;
    car.sectorFlags[i] = flag;
    emit(G, { type: 'sector', car, i, time: st, flag });
    const h = rc.h, W = G.weather;   // lap history: conditions sampled at each sector line
    if (h) { h.r += W ? +W.rain || 0 : 0; h.w += W && W.wet != null ? +W.wet || 0 : race.wet || 0; h.n++; }
  }

  // ---------- per-lap history (results screen): car.lapHist[] = { lap, time, pos, c0, c, pit, pen, served, fw, rw,
  // cond: 'dry'|'damp'|'light'|'heavy' (Weather.now thresholds), r, w (mean rain / track wetness), pb, fl (set at the end) }
  // Also s: [S1, S2, S3], run (time trial: garage run the lap belongs to), inLap / outLap (pit entry / pit exit during
  // the lap), invalid (time trial: in / out lap or a reset -> no best lap, no ghost).
  function histReset(car) {
    const h = car._race.h;
    h.c0 = car.tyre.compound; h.stops = car.pitStops; h.pen = car.penalty + car.penaltyServed; h.served = car.penaltyServed;
    h.r = 0; h.w = 0; h.n = 0; h.inLap = false; h.outLap = false; h.bad = false; h.entryRun = null;
  }
  function histLap(G, race, car, lt, invalid) {
    const rc = car._race, h = rc.h, W = G.weather, su = car.setup, def = CFG.setup ? CFG.setup.def : 6;
    const r = h.n ? h.r / h.n : W ? +W.rain || 0 : 0, w = h.n ? h.w / h.n : W && W.wet != null ? +W.wet || 0 : race.wet || 0;
    car.lapHist.push({
      lap: car.lap, time: lt, pos: car.pos, c0: h.c0, c: car.tyre.compound, pit: car.pitStops - h.stops,
      pen: car.penalty + car.penaltyServed - h.pen, served: car.penaltyServed - h.served,
      fw: su && su.fw != null ? su.fw : def, rw: su && su.rw != null ? su.rw : def,
      cond: r >= 0.55 ? 'heavy' : r >= 0.05 ? 'light' : w >= 0.1 ? 'damp' : 'dry', r, w, pb: false, fl: false,
      s: [car.sectors[0], car.sectors[1], car.sectors[2]], run: h.entryRun != null ? h.entryRun : rc.run || 0,
      inLap: !!h.inLap, outLap: !!h.outLap, invalid: !!invalid,
    });
    histReset(car);
  }
  function markInLap(rc) { if (rc.h && !rc.h.inLap) { rc.h.inLap = true; rc.h.entryRun = rc.run || 0; } }
  // time trial: the lap just run through the pits (or with a reset) is no valid lap
  const lapInvalid = (race, rc) => race.mode === 'timetrial' && !!rc.h && (rc.h.inLap || rc.h.outLap || rc.h.bad);
  function histFinal(G, race) {   // personal best (green) and the race's fastest lap (purple)
    const fl = race.fastestLap;
    for (const c of G.cars) for (const e of c.lapHist || []) { e.pb = e.time === c.bestLap; e.fl = !!fl && fl.car === c && fl.lap === e.lap; }
  }

  function lineCrossing(G, race, car, p, tc) {
    const rc = car._race;
    rc.lineDist = p;
    let lapEv = null;
    const inv = car.lap >= 1 && lapInvalid(race, rc);   // (time trial in / out lap: no best, no ghost)
    if (car.lap >= 1) {
      sectorDone(G, race, car, 2, tc);
      const lt = tc - rc.lapStartT;
      car.lapsDone = car.lap;
      car.lapTimes.push(lt); car.lastLap = lt;
      const pb = !inv && (car.bestLap == null || lt < car.bestLap);
      if (pb) car.bestLap = lt;
      lapEv = emit(G, { type: 'lap', car, lap: car.lap, time: lt, best: pb, invalid: inv });
      if (!inv && race.phase !== 'quali' && (!race.fastestLap || lt < race.fastestLap.time)) {
        race.fastestLap = { car, time: lt, lap: car.lap };
        emit(G, { type: 'fastestLap', car, time: lt });
      }
      if (race.phase !== 'quali') histLap(G, race, car, lt, inv);
    } else histReset(car);
    if (race.ghostRec && car.isPlayer) {   // time trial: close the recording (the out-lap is never a ghost)
      Ghost.record(race.ghostRec, car, race.t - rc.lapStartT);
      const lap = Ghost.finishLap(race.ghostRec, tc - rc.lapStartT, car.lap >= 1 && !inv);
      if (lap) {
        lap.trackId = race.trackId; race.bestGhost = lap; race.ghostPlayer = Ghost.createPlayer(lap);
        if (lapEv) lapEv.ghost = lap;
      }
    }
    car.tyre.laps = Math.floor(rc.tyreDist / G.track.length);
    if (race.phase === 'quali') { car.lap++; rc.lapStartT = tc; rc.sectorStartT = tc; return; }
    if (lapEv && race.laps && (race.leaderFinished || car.lapsDone >= race.laps)) { finishCar(G, race, car, p, tc); return; }
    // race start: the first crossing from the grid is no lap -- lap 1 and its S1 keep counting from lights out (t = 0)
    // for every car from its own grid slot; time trial: the flying lap starts here, after the run-up
    const standing = car.lap === 0 && race.mode !== 'timetrial';
    car.lap++;
    if (!standing) { rc.lapStartT = tc; rc.sectorStartT = tc; }
    for (let i = 0; i < 3; i++) {
      car.lastSectors[i] = car.sectors[i]; car.lastSectorFlags[i] = car.sectorFlags[i];
      car.sectors[i] = null; car.sectorFlags[i] = null;
    }
    if (race.mode !== 'timetrial') overtakeAtLine(G, race, car);
    strategyHook(G, race, car);
    if (car.isPlayer && race.laps > 1 && car.lap === race.laps) note(race, 'FINAL LAP');
  }

  function finishCar(G, race, car, p, tc) {
    const rc = car._race;
    car.finished = true; car.finishTime = tc; rc.finishKey = p; car.raceDist = p;
    if (!race.leaderFinished) { race.leaderFinished = true; race.winnerTime = tc; }
    if (race.penalties && ruleOpen(race, car)) {   // (same test as the strategy's: waivers included)
      car.penalty += TWO_COMPOUND_PEN;
      emit(G, { type: 'penalty', car, sec: TWO_COMPOUND_PEN, reason: 'Two-compound rule' });
      const hl = car.lapHist[car.lapHist.length - 1];
      if (hl) hl.pen += TWO_COMPOUND_PEN;
    }
    endOvertake(car);
    car.overtakeNext = false; car.wantPit = false; car.nextCompound = null;
    for (let i = 0; i < 3; i++) { car.lastSectors[i] = car.sectors[i]; car.lastSectorFlags[i] = car.sectorFlags[i]; }
    // position on the road at the flag (more laps first, then finish time + penalties already settled for the others;
    // this car's own unserved penalty is applied later by settlePenalties, as the cars behind finish)
    let pos = 1;
    const me = tc + car.penalty;
    for (const o of G.cars) {
      if (o === car || o.dnf) continue;
      const q = o._race;
      if (o.finished ? q.finishKey > p || (q.finishKey === p && effT(o) <= me) : q.dist > p) pos++;
    }
    rc.finPos = pos;
    car.penPending = car.penalty > 0;
    if (car.isPlayer) { race.playerFinishT = race.t; note(race, 'FINISHED P' + pos); }
    emit(G, { type: 'finish', car, pos });
    if (race.playerFinishT != null) { race.results = classify(G, false); race.resultsT = 0; }
  }

  function checkRaceEnd(G, race, dt) {
    if (race.phase !== 'racing' || !race.leaderFinished) return;
    let all = true;
    for (const c of G.cars) if (!c.finished && !c.dnf) { all = false; break; }
    if (all || (race.playerFinishT != null && race.t - race.playerFinishT >= FINISH_TIMEOUT)) {
      race.results = classify(G, true);
      updateOrder(G, race, true);          // (committed estimates) then every penalty still pending is applied now,
      settlePenalties(G, race, true);      // before the results: tower order = classification
      histFinal(G, race);
      race.resultsFinal = true;
      race.phase = 'finished';
      for (const c of G.cars) c.wantPit = false;
      emit(G, { type: 'raceEnd' });
    } else if (race.playerFinishT != null && (race.resultsT += dt) >= 0.5) {
      race.resultsT = 0;
      race.results = classify(G, false);   // provisional, refreshed while the rest finish
    }
  }

  // Classification: laps desc, then total time incl. penalties. commit = freeze unfinished cars (estimated times).
  function classify(G, commit) {
    const race = G.race, L = G.track.length;
    const rows = G.cars.map(car => {
      const rc = car._race;
      let laps = car.lapsDone, raw = car.finishTime, est = false;
      if (!car.finished && !car.dnf) {
        laps = race.laps ? Math.min(race.laps, car.lapsDone + 1) : car.lapsDone;
        const ref = car.bestLap || car.lastLap || race.lapTimeEst;
        raw = race.t + Math.max(0, laps * L - rc.dist) / (L / (ref * 1.02));
        est = true;
        if (commit) {
          car.finished = true; car.finishTime = raw; car.lapsDone = laps; car.lap = laps;
          rc.finishKey = laps * L; car.raceDist = rc.finishKey; car.classifiedEstimate = true;
        }
      }
      const time = raw == null ? null : raw + car.penalty;
      return { car, laps, rawTime: raw, penalty: car.penalty, time, dnf: !!car.dnf, estimated: est };
    });
    rows.sort((a, b) => (a.dnf - b.dnf) || (b.laps - a.laps) || ((a.time == null ? 1e12 : a.time) - (b.time == null ? 1e12 : b.time))
      || ((a.rawTime || 0) - (b.rawTime || 0)));   // (same tie-break as the tower: equal totals -> first across the line)
    const w = rows[0], fl = race.fastestLap && race.fastestLap.car;
    rows.forEach((r, i) => {
      const c = r.car;
      r.pos = i + 1;
      r.lapsDown = r.dnf ? 0 : w.laps - r.laps;
      r.gap = i === 0 || r.dnf || r.lapsDown > 0 ? null : r.time - w.time;
      r.gapText = r.dnf ? 'DNF' : i === 0 ? U.fmtTime(r.time) : r.lapsDown > 0 ? '+' + r.lapsDown + (r.lapsDown > 1 ? ' LAPS' : ' LAP') : U.fmtGap(r.gap);
      r.bestLap = c.bestLap;
      r.points = !r.dnf && i < POINTS.length ? POINTS[i] : 0;
      r.fastestLap = fl === c;
      r.teamIndex = c.teamIndex; r.code = c.code; r.grid = c.grid; r.pitStops = c.pitStops; r.penaltyServed = c.penaltyServed || 0;
      r.name = c.driver ? (c.driver.first ? c.driver.first + ' ' : '') + c.driver.last : c.name; r.firstName = c.firstName; r.lastName = c.lastName;
      r.compounds = c.compoundsUsed.slice();
    });
    return rows;
  }

  // ---------- unserved penalties at the flag ----------
  // A finished car's classified time is finishTime + penalty (effT), so it sorts by that among the cars that finished on
  // the same lap: it keeps its place on the road until a car behind finishes within the penalty, which then moves ahead
  // (posChange -> tower arrows; intervals are effT differences, e.g. 3.5 s ahead with +5 s = 1.5 s behind). It can drop
  // several places. The penalty is settled (event penaltyApplied {car, sec, from, to}) once a car finishes on its lap
  // at or beyond effT, or nobody left on its lap can still finish (the rest finished / out / lapped), or the race ends.
  // Laps come first, so a penalty never drops a car behind one a lap down.
  const effT = car => car.finishTime + car.penalty;
  function settlePenalties(G, race, final) {
    for (const a of G.cars) {
      const ra = a._race;
      if (!ra || !a.finished || a.dnf || !(a.penalty > ra.penDone + 1e-9)) { a.penPending = false; continue; }
      if (ra.penFrom == null) ra.penFrom = ra.finPos != null && ra.penDone === 0 ? ra.finPos : a.pos;
      a.penPending = true;
      let beyond = false, canFinish = false;
      if (!final) {
        const due = effT(a);
        for (const b of G.cars) {
          if (b === a || b.dnf) continue;
          if (b.finished) { if (b.lapsDone === a.lapsDone && b.finishTime >= due) beyond = true; }
          else if ((b.lap | 0) === a.lapsDone) canFinish = true;
        }
      }
      if (!final && !beyond && canFinish) continue;
      const sec = a.penalty - ra.penDone, from = ra.penFrom, to = a.pos;
      ra.penDone = a.penalty; ra.penFrom = null; a.penPending = false;
      emit(G, { type: 'penaltyApplied', car: a, sec, from, to, kept: to === from });
      if (a.isPlayer && !race.attract) note(race, Math.round(sec) + ' S PENALTY APPLIED', '#ffd12e', to !== from ? 'P' + from + ' → P' + to : 'POSITION KEPT');
    }
  }

  // ---------- positions & gaps ----------
  const orderKey = car => (car.finished ? car._race.finishKey : car._race.dist);
  function aheadOf(a, b) {
    if (a.dnf !== b.dnf) return b.dnf;
    const ka = orderKey(a), kb = orderKey(b);
    if (a.finished && b.finished) return ka > kb || (ka === kb && (effT(a) < effT(b) || (effT(a) === effT(b) && a.finishTime < b.finishTime)));
    if (a.finished || b.finished) return ka > kb;
    return ka > kb + HYST;
  }
  function updateOrder(G, race, events) {
    const o = race.order;
    for (let i = 1; i < o.length; i++) {   // insertion sort: the order is almost always already sorted
      const c = o[i];
      let j = i - 1;
      while (j >= 0 && aheadOf(c, o[j])) { o[j + 1] = o[j]; j--; }
      o[j + 1] = c;
    }
    for (let i = 0; i < o.length; i++) {
      const c = o[i], p = i + 1;
      if (c.pos !== p) {
        if (events) emit(G, { type: 'posChange', car: c, from: c.pos, to: p });
        c.pos = p;
      }
    }
  }
  // fraction of an interval's time spent covering x of its h metres, for constant acceleration from speed va to vb
  // (exact for launches and for braking into / pulling away from a standstill; linear if both speeds are ~0)
  function accelFrac(x, h, va, vb) {
    if (!(h > 0) || x >= h) return 1;
    if (x <= 0) return 0;
    const vx = Math.sqrt(Math.max(0, va * va + (vb * vb - va * va) * x / h));
    const th = va + vb > 1e-6 ? 2 * h / (va + vb) : 0;
    if (!(th > 0)) return x / h;
    return U.clamp((va + vx > 1e-6 ? 2 * x / (va + vx) : 0) / th, 0, 1);
  }
  // race time at which `car` first reached race distance D: timing checkpoints (time + speed) interpolated with a
  // constant-acceleration model scaled to the measured interval time, split at any standstill inside the interval
  function timeAt(race, car, D) {
    const rc = car._race;
    if (!rc.cp || D < 0) return null;
    const k = Math.floor(D / CP);
    if (k >= rc.cpN) return null;
    const d0 = k * CP, t0 = rc.cp[k], v0 = rc.cpv[k];
    let d1, t1, v1;
    if (k + 1 < rc.cpN) { d1 = d0 + CP; t1 = rc.cp[k + 1]; v1 = rc.cpv[k + 1]; }
    else {
      d1 = car.finished ? rc.finishKey : rc.maxDist; t1 = car.finished ? car.finishTime : race.t; v1 = car.speed || 0;
      if (d1 <= d0) return t0;
    }
    for (let i = rc.stops.length - 1; i >= 0; i--) {
      const st = rc.stops[i];
      if (st.d < d0 || st.d > d1) continue;   // (st.d === d1 when the car is standing there right now)
      if (D <= st.d) return t0 + (st.t0 - t0) * accelFrac(D - d0, st.d - d0, v0, 0);
      const tl = st.t1 != null ? st.t1 : race.t;
      return tl + (t1 - tl) * accelFrac(D - st.d, d1 - st.d, 0, v1);
    }
    return t0 + (t1 - t0) * accelFrac(D - d0, d1 - d0, v0, v1);
  }
  // seconds that b is behind a (a is ahead in the order): now minus the time a was where b is now
  function gapBetween(race, a, b) {
    if (a.finished && b.finished && a.lapsDone === b.lapsDone) return Math.max(0, effT(b) - effT(a));   // incl. penalties
    const rb = b._race, D = b.finished ? rb.finishKey : Math.min(rb.dist, rb.maxDist);
    let ta = timeAt(race, a, D);
    if (ta != null && a.finished && !b.finished) ta += a._race.penDone;   // a's settled penalty (a pending one: on the road)
    if (ta == null) return Math.max(0, orderKey(a) - D) / Math.max(10, b.speed || 0, a.speed || 0);
    return Math.max(0, (b.finished ? b.finishTime : race.t) - ta);
  }
  function updateGaps(race, L) {
    const o = race.order, lead = o[0];
    lead.gapLeader = 0; lead.gapAhead = 0; lead.lapsDown = 0;
    const kl = orderKey(lead);
    for (let i = 1; i < o.length; i++) {
      const c = o[i];
      if (c.dnf) { c.gapLeader = 0; c.gapAhead = 0; c.lapsDown = 0; continue; }
      c.gapLeader = gapBetween(race, lead, c);
      c.lapsDown = Math.max(0, Math.floor((kl - orderKey(c)) / L));
      c.gapAhead = i === 1 ? c.gapLeader : gapBetween(race, o[i - 1], c);
    }
  }

  // ---------- Overtake Mode ----------
  function armOvertake(G, race, car) {
    if (car.finished || car.dnf || car.kinematic || car.pos <= 1) return;
    if (race.laps && car.lap >= race.laps) return;   // final lap: nothing left to arm for
    if (!(car.gapAhead < R.overtakeGap) || car.overtakeNext) return;
    car.overtakeNext = true;
    emit(G, { type: 'overtakeArmed', car });
  }
  function overtakeAtLine(G, race, car) {
    const E = CFG.energy, on = car.overtakeNext && !car.finished;
    car.overtakeNext = false;
    if (on) {
      car.overtake = true;
      car.batteryCap = E.cap + E.overtakeBonus;
      car.battery = Math.min(car.batteryCap, (car.battery || 0) + E.overtakeBonus);
      emit(G, { type: 'overtakeActive', car });
    } else if (car.overtake) endOvertake(car);
  }
  function endOvertake(car) {
    car.overtake = false;
    car.batteryCap = CFG.energy.cap;
    if (car.battery > car.batteryCap) car.battery = car.batteryCap;
  }

  // ---------- hints ----------
  // The BOX THIS LAP sign (car.boxCall, HUD) stays up until the car takes the pit entry it was called for or drives past
  // it; a call passed by is "declined": the same reason (+ tyre) is not called again until the car next pits.
  function boxCallTrack(car, rc) {
    if (car.inPitLane || car.kinematic) rc.boxDeclined = null;
    const bc = rc.boxCall;
    if (!bc) return;
    if (car.inPitLane || car.pitState || car.kinematic || car.finished) { rc.boxCall = null; car.boxCall = false; return; }
    if (rc.maxDist > bc.entry + CAPTURE_AFTER) { rc.boxCall = null; car.boxCall = false; rc.boxDeclined = bc.key; }
  }
  function boxHint(G, race, car) {
    const pit = G.track.pit, rc = car._race;
    if (rc) boxCallTrack(car, rc);
    if (!pit || !race.laps || car.finished || car.kinematic || car.lap < 1 || race.phase !== 'racing') return;
    if (rc.boxHintKey === rc.nextEntry || rc.boxCall) return;
    const L = G.track.length, afterEntry = (race.laps * L - rc.nextEntry) / L;   // racing left past the next entry
    // never while in / just out of the pit lane, or once this lap's entry is already behind the car
    if (car.inPitLane || car.pitState || rc.nextEntry - rc.dist < 30) return;
    if (rc.lastPitExitDist != null && rc.dist - rc.lastPitExitDist < 0.8 * L) return;
    // call it late in the lap (like a real engineer), not right at the start/finish line
    if ((rc.nextEntry - rc.dist) / L > 0.35) return;
    if (afterEntry < 0.5) return;
    let reason = null;
    const k = COMPOUNDS[car.tyre.compound] || COMPOUNDS.M;
    let compound = null;
    if (race.wx) { const pl = race.wxPlayer; if (pl && pl.pit && afterEntry >= 0.6) { reason = Weather.cat(pl.c1) === Weather.cat(car.tyre.compound) ? 'wear' : 'weather'; compound = pl.c1; } }
    else if (!tyreSuits(race, car.tyre.compound) && afterEntry >= 1) { reason = 'weather'; compound = wetCompound(race) || 'M'; }
    const rate = wearPerLap(race, car, L);
    // wear call only after a full lap and once the tyres are meaningfully used (never at the start)
    if (!reason && rate > 0 && afterEntry >= 1 && car.lap >= 2 && car.tyre.wear >= 0.35 * k.cliff) {
      const toCliff = (k.cliff - car.tyre.wear) / rate, toEntry = (rc.nextEntry - rc.dist) / L;
      if (toCliff < toEntry + 1 && remainingLaps(race, car, L) - toCliff >= 1.5) reason = 'wear';
    }
    if (!reason && ruleOpen(race, car) && afterEntry < 1.5 && car.lap >= 2) reason = 'rule';
    if (!reason) return;
    rc.boxHintKey = rc.nextEntry;
    const key = reason + ':' + (compound || '');
    if (key === rc.boxDeclined) return;   // passed up once already: only a new reason brings the sign back
    rc.boxCall = { entry: rc.nextEntry, key }; car.boxCall = true;
    emit(G, { type: 'boxThisLap', car, reason, compound });
    note(race, 'BOX THIS LAP', '#ffd12e', reason === 'rule' ? 'Two-compound rule' : reason === 'weather' ? (compound ? TYRE_NAME[compound] + ' for the conditions' : 'Change tyres for the conditions') : 'Tyres near the cliff');
  }

  // ---------- pit lane ----------
  // AI cars: kinematic from ~55 m before the entry to the limiter-end line. Player (and a multiplayer human on the server,
  // car.pitManual): drives the entry road itself; at the speed-limit line (speeding check) the autopilot takes over, drives
  // the fast lane, turns into the box, services, waits for throttle. Everyone is handed back at the limiter-end line with
  // the limiter lifted: from there the car drives the exit road itself (AI: flat out along the lane to the end of its white
  // line, then merges). Any car inside the speed-limited lane without the autopilot — got in past the line across the entry
  // blend, spun / reversed in, backed up from the exit — is taken over where it is: nobody drives down the pit lane freely.
  const manualPit = (race, car) => (car.isPlayer || car.pitManual) && !race.attract && !car.finished;
  function checkPitEntry(G, race, car) {
    const track = G.track, pit = track.pit, pg = race.pitG;
    if (!pg || car.finished || car.dnf) return;
    const rc = car._race;
    const L = track.length;
    let u = track.wrapS(car.s - pit.entryS);
    if (u > L / 2) u -= L;
    // in the lane from the limiter line to just short of its end (never the release line itself): the takeover
    if (u >= pg.uL0 && u < pg.uL1 - 3 && track.inPitArea(car.s, car.d)) { limiterLine(G, race, car, u); return; }
    if (rc.dist < rc.pitCooldown) return;
    if (manualPit(race, car)) { playerPitRoad(G, race, car, u); return; }
    if (u < -AI_CAPTURE || u > CAPTURE_AFTER) return;
    const i = car.idx >= 0 ? car.idx : Math.round(car.s / track.step) % track.N;
    if (!((car.vLong != null ? car.vLong : car.speed) > 0.5) || Math.cos(car.h) * track.tx[i] + Math.sin(car.h) * track.tz[i] < 0.5) return;
    if (u >= 0 && track.inPitArea(car.s, car.d)) {
      // committed to the lane (an AI car brushing the pit-entry line is not a pit stop)
      if (car.isPlayer || car.wantPit || pit.side * car.d - track.halfW[i] > 2 || u > 30) { startPit(G, race, car, u); return; }
    }
    if (!car.isPlayer && car.wantPit && race.phase === 'racing' && race.laps && car.lap < race.laps) startPit(G, race, car, u);
  }
  // the entry road (pit entry .. limiter line): HUD / engineer flags only, the player drives
  function playerPitRoad(G, race, car, u) {
    const track = G.track, pg = race.pitG, rc = car._race, vLim = R.pitSpeedLimit;
    const onRoad = u >= -2 && u < pg.uL0 && track.inPitArea(car.s, car.d) && (car.vLong || 0) > -0.5;
    if (!onRoad) {
      if (rc.preLane) { rc.preLane = false; car.inPitLane = false; car.limiterWarn = false; if (car.pitState === 'entry') car.pitState = null; }
      return;
    }
    if (!rc.preLane) {
      rc.preLane = true; car.inPitLane = true; car.pitState = 'entry';
      if (car.isPlayer) {
        if (!race.playerPitCompound) race.playerPitCompound = pickCompound(race, car, track.length, true);
        car.pitCompound = race.playerPitCompound;
      }
      markInLap(rc);
      emit(G, { type: 'pitEntry', car });
    }
    car.limiterWarn = (car.vLong || 0) > vLim + 0.3 && pg.uL0 - u < 150;
  }
  // the limiter line (or anywhere in the limited lane): the autopilot takes the car
  function limiterLine(G, race, car, u) {
    const rc = car._race, manual = manualPit(race, car), viaRoad = manual && rc.preLane;
    if (manual) {
      if (!rc.preLane) { markInLap(rc); emit(G, { type: 'pitEntry', car }); }   // (came in without the entry road)
      if (race.penalties && race.mode !== 'timetrial' && (car.vLong || 0) > PIT_SPEED_TOL) {   // speed-limit line crossed too fast (no penalty in time trial)
        car.penalty += SPEEDING_PEN;
        emit(G, { type: 'penalty', car, sec: SPEEDING_PEN, reason: 'Speeding in pit lane' });
      }
      rc.preLane = false; car.limiterWarn = false;
    }
    startPit(G, race, car, u, manual);
    // got in some other way than down the entry road: a stop only with room left to line up for the box, else a
    // drive-through (a car level with / past its box would be pulled back into it)
    const ps = rc.pit;
    if (ps && ps.stop && !viaRoad && u > ps.uBox - Math.max(ps.blend, ps.pg.bb || BOX_BLEND)) ps.stop = false;
  }

  // lateral pit path: the fast lane beside the dashed centre line (track side) once the lane has opened out,
  // then a turn into the box on the garage side
  function laneD(track, pit, ps, u) {
    const uu = U.clamp(u, 0.05, ps.P - 0.05), s = track.wrapS(pit.entryS + uu), pg = ps.pg;
    let d = pit.laneD(s);
    if (d == null) d = pit.side * track.halfW[Math.round(s / track.step) % track.N];
    d -= pit.side * pg.lhw * 0.5 * U.clamp((Math.abs(d) - pg.a0) / (pg.a1 - pg.a0), 0, 1);
    if (ps.stop) { const k = 1 - Math.abs(u - ps.uBox) / (pg.bb || BOX_BLEND); if (k > 0) d += (pit.boxD - d) * U.smooth(k); }
    return d;
  }
  function pathD(track, pit, ps, u) {
    const d = laneD(track, pit, ps, u), k = (u - ps.u0) / ps.blend;
    return k < 1 ? d + (ps.d0 - ps.base0) * (1 - U.smooth(k)) : d;
  }

  function startPit(G, race, car, u0, manual) {
    const track = G.track, pit = track.pit, pg = race.pitG, rc = car._race, vLim = R.pitSpeedLimit;
    const box = pit.boxS && pit.boxS[car.teamIndex] != null ? pit.boxS[car.teamIndex] : pit.entryS + pg.P / 2;
    const ps = {
      P: pg.P, pg, u: u0, u0, v: Math.max(0, car.vLong != null ? car.vLong : car.speed || 0), tau: 0,
      d0: car.d, h0: car.h, blend: Math.max(30, 30 - u0), base0: 0, manual: !!manual,
      uL0: pg.uL0, uL1: pg.uL1, uBox: U.clamp(Math.min(pg.P, track.wrapS(box - pit.entryS)), pg.uL0 + 1, Math.max(pg.uL0 + 1, pg.uL1 - 1)),
      // everyone is handed back at the limiter-end line (the AI drives the exit road itself, like the player) -
      // or past the end of an exit-road speed cap (pit.exitCap: autopilot through the bend)
      // (a pit.exitCap slows the car to its kph in the lane before that line; full control after it)
      uExit: pg.uL1,
      state: 'entry', stop: !car.finished, service: 0, serviceDur: U.lerp(R.pitServiceMin, R.pitServiceMax, race.rnd()),
      penServed: 0, enterT: race.t, aEntry: 12,
      speeding: !manual && race.penalties && !race.attract && race.phase === 'racing' && race.rnd() < (car.pitSpeedingChance != null ? car.pitSpeedingChance : AI_SPEEDING_P),
    };
    if (ps.v > vLim) ps.aEntry = U.clamp((ps.v * ps.v - vLim * vLim) / (2 * Math.max(5, pg.uL0 - u0)), 12, PIT_MAX_DEC);
    ps.base0 = laneD(track, pit, ps, u0);
    rc.pit = ps;
    car.kinematic = true; car.inPitLane = true; car.pitLimiter = true; car.pitState = 'entry'; car.pitProgress = null;
    car.boosting = false; car.harvesting = false; car.aero = 'corner'; car.inStraightZone = false;
    car.tow = 0; car.slide = 0; car.lockup = 0; car.wheelspin = 0; car.reverse = false;
    if (car.isPlayer) {
      if (!race.playerPitCompound) race.playerPitCompound = pickCompound(race, car, track.length, true);
      car.pitCompound = race.playerPitCompound;
    }
    markInLap(rc);
    if (!manual) emit(G, { type: 'pitEntry', car });   // (the player's pitEntry fired on the entry road)
  }

  function laneLimit(G, car, ps) {   // keep a gap to a moving car ahead in the lane
    let lim = Infinity;
    const T = G.track;
    for (const o of G.cars) {
      const q = o !== car && o._race && o._race.pit;
      if (!q && o !== car && !o.kinematic && !o.dnf) {   // handed back onto the exit road just ahead (may be braking for a lane bend)
        const gap = T.deltaS(car.s, o.s);
        if (gap > 0 && gap < PIT_GAP + 8 && (o.speed || 0) > 3 && T.wrapS(o.s - T.pit.entryS) >= ps.uL1 - 1 && T.inPitArea(o.s, o.d)) {
          const vs = (o.vLong || 0) / Math.max(0.5, 1 - T.curv[o.idx >= 0 ? o.idx : 0] * o.d);   // its speed along s
          lim = Math.min(lim, Math.max(0, vs + (gap - PIT_GAP) * 1.5));
        }
        continue;
      }
      if (!q || q.state === 'service' || q.state === 'wait' || (q.stop && Math.abs(q.u - q.uBox) < (ps.pg.bb || BOX_BLEND) * 0.6)) continue;
      const gap = q.u - ps.u;
      if (gap > 0 && gap < PIT_GAP + 8) lim = Math.min(lim, Math.max(0, q.v + (gap - PIT_GAP) * 1.5));
    }
    return lim;
  }
  // no unsafe release: nobody coming down the lane who would reach this box before the car has pulled out into the
  // fast lane (0.6 bb at PIT_ACC, ~2 s; a busy lane holds it until the stream has passed). A car that stops in its own
  // box before this one, or stands in its box, is no conflict.
  function laneClear(G, car, ps) {
    const tOut = Math.sqrt(1.2 * (ps.pg.bb || BOX_BLEND) / PIT_ACC);
    for (const o of G.cars) {
      const q = o !== car && o._race && o._race.pit;
      if (!q || q.state === 'service' || q.state === 'wait' || q.state === 'go' || q.state === 'garage') continue;
      const gap = ps.u - q.u;
      if (gap <= -3 || (q.state === 'entry' && q.stop && q.uBox < ps.u - 4)) continue;
      if (gap < 8 + Math.max(q.v, 4) * tOut) return false;
    }
    return true;
  }

  function pitStep(G, race, car, dt) {
    const track = G.track, pit = track.pit, ps = car._race.pit, vLim = R.pitSpeedLimit, vPrev = ps.v;
    ps.tau += dt;
    if (ps.state === 'entry') {
      if (ps.stop && car.finished && ps.u < ps.uBox - (ps.pg.bb || BOX_BLEND)) ps.stop = false;   // took the flag in the lane
      if (ps.speeding && ps.u >= ps.uL0) {   // (AI) crossed the speed-limit line too fast
        ps.speeding = false;
        if (ps.v > PIT_SPEED_TOL) {   // (held up behind another car in the lane = no offence)
          car.penalty += SPEEDING_PEN;
          emit(G, { type: 'penalty', car, sec: SPEEDING_PEN, reason: 'Speeding in pit lane', speed: ps.v });
        }
      }
      const vL0 = ps.speeding ? vLim + 6 : vLim;
      let vT = ps.u < ps.uL0 ? Math.sqrt(vL0 * vL0 + 2 * ps.aEntry * (ps.uL0 - ps.u)) : vLim;
      if (ps.stop) vT = Math.min(vT, Math.sqrt(2 * PIT_STOP_DEC * Math.max(0, ps.uBox - ps.u)));
      vT = Math.min(vT, laneLimit(G, car, ps), capAt(ps.pg, ps.u));
      ps.v = ps.v < vT ? Math.min(vT, ps.v + PIT_ACC * dt) : Math.max(vT, ps.v - PIT_MAX_DEC * dt);
      ps.u += ps.v * dt;
      if (ps.stop && car.finished && ps.u >= ps.uBox - 0.002) {
        // already took the chequered flag (line crossed in the pit lane): no service after the finish —
        // tyres and penalties stay as they were, the car just rolls on through the lane
        ps.stop = false; ps.state = 'exit'; car.pitState = 'exit'; car.pitProgress = null;
        note(race, car.code + ': FINISHED IN THE PIT LANE', '#ffffff', 'No stop after the flag');
      } else if (ps.stop && ps.u >= ps.uBox - 0.002 && race.mode === 'timetrial' && car.isPlayer && !race.attract) {
        // time trial: the car parks in its garage; the garage page (Menu.showGarage) picks tyres + wings -> garageGo
        ps.u = ps.uBox; ps.v = 0; ps.state = 'garage'; car.pitState = 'garage'; car.pitProgress = null; ps.garageT = race.t;
        race.garage = { car, t0: race.t };
        emit(G, { type: 'ttGarage', car });
      } else if (ps.stop && ps.u >= ps.uBox - 0.002) {
        ps.u = ps.uBox; ps.v = 0; ps.state = 'service'; car.pitState = 'service'; car.pitProgress = 0;
        // player's wing change (Race.choosePitWings): extra time only when a wing really changes
        const pw = car.isPlayer && race.playerPitWings, cs = car.setup || { fw: 6, rw: 6 };
        if (pw && (pw.fw !== cs.fw || pw.rw !== cs.rw)) {
          ps.wings = { fw: pw.fw, rw: pw.rw };
          ps.wingCost = U.lerp(PIT_WING_COST[0], PIT_WING_COST[1], race.rnd());
          ps.serviceDur += ps.wingCost;
          car.pitWingNote = 'WINGS ' + [pw.fw !== cs.fw ? 'F ' + cs.fw + '→' + pw.fw : '', pw.rw !== cs.rw ? 'R ' + cs.rw + '→' + pw.rw : ''].filter(Boolean).join(' · ');
        }
        if (car.penalty > 0) {   // unserved time penalties are served now, on top of the tyre change
          ps.penServed = car.penalty; ps.serviceDur += car.penalty;
          car.penaltyServed += car.penalty; car.penalty = 0;
          emit(G, { type: 'penaltyServed', car, sec: ps.penServed });
        }
        emit(G, { type: 'pitStop', car, duration: ps.serviceDur });
      } else if (!ps.stop && ps.u >= ps.uBox) { ps.state = 'exit'; car.pitState = 'exit'; }
    } else if (ps.state === 'service') {
      ps.service += dt;
      car.pitProgress = Math.min(1, ps.service / ps.serviceDur);
      car.pitElapsed = ps.service; car.pitDur = ps.serviceDur; car.pitPen = ps.penServed || 0;   // HUD stopwatch
      if (ps.service >= ps.serviceDur) {
        finishService(G, race, car, ps);
        if (ps.state === 'wait') emit(G, { type: 'pitReady', car });
      }
    } else if (ps.state === 'wait') {   // player: new tyres on, go when the throttle is pressed
      if (!manualPit(race, car) || !car.isPlayer || (G.input && G.input.throttle > 0.3)) { ps.state = 'go'; }   // (a multiplayer human on the server: no local input)
    } else if (ps.state === 'garage') {   // lap clock stands still in the garage (the weather keeps running)
      car._race.lapStartT += dt; car._race.sectorStartT += dt;
    }
    if (ps.state === 'go') {
      if (laneClear(G, car, ps)) { ps.state = 'exit'; car.pitState = 'exit'; ps.stopEnd = race.t; }
    } else if (ps.state === 'exit') {
      const vc = capAt(ps.pg, ps.u);
      const vT = Math.min(ps.u < ps.uL1 ? vLim : PIT_EXIT_V, laneLimit(G, car, ps), vc);
      car.pitCap = vc < vLim - 0.3 ? ps.pg.cap.kph : 0;   // HUD: the exit-cap sign (e.g. 80) while it holds the car
      ps.v = ps.v < vT ? Math.min(vT, ps.v + PIT_ACC * dt) : Math.max(vT, ps.v - PIT_MAX_DEC * dt);
      ps.u = Math.min(ps.uExit, ps.u + ps.v * dt);
    }
    pitPose(track, pit, car, ps, dt, vPrev);
    if (ps.state === 'exit' && ps.u >= ps.uExit) release(G, race, car, ps);
  }

  function finishService(G, race, car, ps) {
    const L = G.track.length;
    let c = car.isPlayer
      ? (COMPOUNDS[race.playerPitCompound] ? race.playerPitCompound : pickCompound(race, car, L, true))
      : (COMPOUNDS[car.nextCompound] ? car.nextCompound : pickCompound(race, car, L, false));
    // dynamic weather: a planned / covering stop never fits tyres the conditions don't call for (weather calls stand)
    if (race.wx && !car.isPlayer && !car.wxStop && !tyreSuits(race, c, car)) c = pickCompound(race, car, L, false);
    car.wxStop = false;
    car.tyre.compound = c; car.tyre.wear = 0; car.tyre.laps = 0;
    car.grip = COMPOUNDS[c].grip;
    if (car.compoundsUsed.indexOf(c) < 0) car.compoundsUsed.push(c);
    car.pitStops++;
    car.lastServiceTime = ps.service;
    car.wantPit = false; car.nextCompound = null; car.pitProgress = null;
    if (car.isPlayer) { race.playerPitCompound = null; car.pitCompound = null; }
    if (ps.wings && CFG.setup) { CFG.setup.apply(car, ps.wings); emit(G, { type: 'setupChange', car, setup: ps.wings }); }
    if (car.isPlayer) { race.playerPitWings = null; car.pitWings = null; car.pitWingNote = null; }
    car._race.tyreDist = 0;
    replan(race, car, L);
    // the lap-start strategy call of the lap the car is now on already ran while it was in the lane (wantPit still set):
    // run it again, or a stop the new plan puts at the end of this lap (a box past the line: the lap count already moved on)
    // is never made — the two-compound rule's second compound was missed that way
    if (!car.isPlayer && car.lap > 0) strategyHook(G, race, car);
    ps.state = 'go'; car.pitState = 'service';   // no "press ↑" wait: the car leaves the box as soon as the tyres are on
  }

  function release(G, race, car, ps) {
    const rc = car._race;
    rc.lastPitExitDist = rc.dist;   // no "box this lap" call right after a stop
    car.kinematic = false; car.inPitLane = false; car.pitLimiter = false; car.pitState = null; car.pitProgress = null; car.pitCap = 0;
    car.aLong = 0; car.aLat = 0; car.r = 0;
    car.lastPitTime = race.t - ps.enterT;
    rc.pit = null; rc.pitCooldown = rc.dist + 150;
    let nz = null;   // no Straight mode in the zone the car rejoins in: locked until the next zone starts
    for (const z of G.track.straightZones || []) { const p = nextPoint(rc.dist, z.s0, G.track.length); if (nz == null || p < nz) nz = p; }
    rc.aeroPitLockD = nz; car.aeroLock = nz != null;
    if (rc.h) rc.h.outLap = true;
    emit(G, { type: 'pitExit', car, stopTime: ps.stop ? ps.service : 0, penaltyServed: ps.penServed, laneTime: car.lastPitTime });
  }

  // ---------- time-trial garage ----------
  const runOf = (race, car) => ({ compound: car.tyre.compound, fw: car.setup && car.setup.fw != null ? car.setup.fw : CFG.setup ? CFG.setup.def : 6,
    rw: car.setup && car.setup.rw != null ? car.setup.rw : CFG.setup ? CFG.setup.def : 6, t: race.t });
  // leave the garage with a fresh set of `compound` and wings {fw, rw} (saved by main via setupChange): a new run starts
  function garageGo(G, sel = {}) {
    const race = G.race, car = G.player, rc = car && car._race, ps = rc && rc.pit;
    if (!race || !ps || ps.state !== 'garage') return false;
    const c = COMPOUNDS[sel.compound] ? sel.compound : car.tyre.compound;
    car.tyre.compound = c; car.tyre.wear = 0; car.tyre.laps = 0; car.grip = COMPOUNDS[c].grip;
    if (car.compoundsUsed.indexOf(c) < 0) car.compoundsUsed.push(c);
    car.pitStops++; rc.tyreDist = 0;
    if (CFG.setup) {
      const S = CFG.setup, cs = car.setup || {}, w = { fw: S.wing(sel.fw != null ? sel.fw : cs.fw), rw: S.wing(sel.rw != null ? sel.rw : cs.rw) };
      if (w.fw !== cs.fw || w.rw !== cs.rw || !car.setup) { S.apply(car, w); emit(G, { type: 'setupChange', car, setup: w }); }
    }
    race.playerPitCompound = null; car.pitCompound = null; race.playerPitWings = null; car.pitWings = null; car.pitWingNote = null;
    rc.run = (rc.run || 0) + 1;
    (race.runs || (race.runs = [])).push(runOf(race, car));
    ps.service = race.t - (ps.garageT || race.t); race.garage = null;
    ps.state = 'go'; car.pitState = 'service';
    emit(G, { type: 'pitStop', car, duration: 0, garage: true });
    return true;
  }

  // pose + plausible dynamic fields for renderers / audio / HUD while the car is kinematic
  function pitPose(track, pit, car, ps, dt, vPrev) {
    const s = track.wrapS(pit.entryS + ps.u), d = pathD(track, pit, ps, ps.u);
    worldAt(track, s, d, _w0);
    const u2 = ps.u + 0.5;
    worldAt(track, track.wrapS(pit.entryS + u2), pathD(track, pit, ps, u2), _w1);
    const dx = (_w1.x - _w0.x) * 2, dz = (_w1.z - _w0.z) * 2;
    const speed = ps.v * (Math.hypot(dx, dz) || 1);
    let h = Math.atan2(dz, dx);
    if (ps.tau < 0.4) h = ps.h0 + U.wrapAngle(h - ps.h0) * U.smooth(ps.tau / 0.4);
    h = U.wrapAngle(h);
    car.r = dt > 0 ? U.wrapAngle(h - car.h) / dt : 0;
    car.x = _w0.x; car.z = _w0.z; car.h = h;
    car.vx = Math.cos(h) * speed; car.vz = Math.sin(h) * speed;
    const acc = dt > 0 ? (ps.v - vPrev) / dt : 0;
    car.aLong = U.expDecay(car.aLong || 0, acc, 20, dt);
    car.aLat = speed * car.r;
    car.speed = speed; car.vLong = speed; car.vLat = 0;
    car.s = s; car.d = d; car.idx = Math.round(s / track.step) % track.N;
    car.throttle = acc > 0.3 ? 0.6 : ps.v > 0.5 ? 0.2 : 0;
    car.brake = acc < -0.5 ? U.clamp(-acc / 30, 0.15, 1) : 0;
    const k = speed > 1 ? car.r / speed : 0, sm = CFG.car.steerMax;
    car.steerAngle = U.clamp(Math.atan(CFG.car.wheelbase * k), -sm, sm);
    car.steer = car.steerAngle / sm;
    car.wheelRot += speed * dt / WHEEL_R;
    const kmh = speed * 3.6, top = CFG.car.gearTop;
    let g = 1;
    while (g < 8 && kmh > top[g] * 0.86) g++;
    if (g !== car.gear) { car.gear = g; car.shiftT = 0; } else car.shiftT = (car.shiftT || 0) + dt;
    car.rpm = U.expDecay(car.rpm || CFG.car.rpmIdle, Math.max(CFG.car.rpmIdle, CFG.car.rpmMax * kmh / top[g]), 20, dt);
    car.surface = SURF.PIT; car.onKerb = false; car.offTrack = false;
    car.aero = 'corner'; car.aeroT = U.approach(car.aeroT || 0, 0, dt / CFG.aero.closeTime);
    car.boosting = false; car.harvesting = false; car.tow = 0; car.dirty = 0;
  }

  // ---------- time-trial ghost ----------
  function ghostStep(G, race, car) {
    if (!race.ghostRec) return;
    const t = race.t - car._race.lapStartT;
    Ghost.record(race.ghostRec, car, t);
    if (race.ghostPlayer && car.lap >= 1) {
      const p = Ghost.sample(race.ghostPlayer, t), g = G.ghost || (G.ghost = { x: 0, z: 0, h: 0, visible: false });
      g.x = p.x; g.z = p.z; g.h = p.h;
      g.visible = t <= race.ghostPlayer.lap.time + 0.25;
    } else if (G.ghost) G.ghost.visible = false;
  }
  // main: after create, pass a stored best lap (Ghost.deserialize) for this track
  function setGhost(G, lap) {
    const race = G.race;
    if (!race || !lap || !(lap.time > 0) || !(lap.n >= 2) || typeof Ghost === 'undefined') return false;
    if (lap.trackId && race.trackId && lap.trackId !== race.trackId) return false;
    if (race.bestGhost && race.bestGhost.time <= lap.time) return false;
    race.bestGhost = lap; race.ghostPlayer = Ghost.createPlayer(lap);
    if (race.ghostRec) race.ghostRec.bestTime = lap.time;
    return true;
  }

  // ---------- control ----------
  // Input the race system imposes on a car (grid hold / launch reaction), else null. Kinematic cars need none.
  function controlOverride(G, car) {
    const race = G.race, rc = car._race;
    if (!race || !rc || car.kinematic) return null;
    if (race.awaitConfirm) return rc.hold;
    if (race.phase === 'lights' && race.releaseEarly.has(car)) return null;   // anticipating the start
    if (race.phase === 'grid' || race.phase === 'lights') return car.isPlayer && !race.attract ? null : rc.hold;
    if (race.phase === 'racing' && race.t < rc.launchT && !car.isPlayer && !car.aiAnticipate) return rc.hold;   // anticipators are already rolling
    return null;
  }
  // player's wing change for the next stop: ±clicks on the planned front / rear wing (clamped 1..11); returns the plan.
  // If either wing really changes, the stop takes a random 0.2-0.5 s longer (PIT_WING_COST, added when the car stops in
  // its box; never shown on screen)
  function choosePitWings(G, dFw, dRw) {
    const race = G.race, car = G.player, S = CFG.setup;
    if (!race || !car || !S) return null;
    const cur = race.playerPitWings || { fw: (car.setup || {}).fw || S.def, rw: (car.setup || {}).rw || S.def };
    const w = { fw: S.wing(cur.fw + (dFw | 0)), rw: S.wing(cur.rw + (dRw | 0)) };
    race.playerPitWings = w; car.pitWings = w;
    return w;
  }
  // player's tyre choice for the next / current stop (main: keys 1/2/3)
  function choosePitCompound(G, c) {
    const race = G.race;
    if (!race || !COMPOUNDS[c]) return null;
    race.playerPitCompound = c;
    if (G.player) G.player.pitCompound = c;
    return c;
  }

  // ---------- championship ----------
  function newChampionship(settings) {
    const rounds = settings && Array.isArray(settings.rounds) && settings.rounds.length ? settings.rounds.slice() : ['vortex', 'harbour', 'kotori'];
    // the season's entry list (fixed for every round, with the drivers): settings.field, else the player's team +
    // settings.fieldSize - 1 others (pickField)
    const field = settings && Array.isArray(settings.field) && settings.field.length >= 2 ? fieldTeams({ field: settings.field }, U.clamp((settings.teamIndex | 0), 0, TEAMS.length - 1), false)
      : pickField(U.clamp(((settings && settings.teamIndex) | 0), 0, TEAMS.length - 1), settings && settings.fieldSize);
    const standings = {};
    field.forEach(i => { standings[i] = 0; });
    return { rounds, round: 0, standings, history: [], complete: false, field };
  }
  // a championship's entry list: champ.field, or (saves from before field sizes) its standings' teams = the ten teams
  function champField(champ) {
    if (!champ) return null;
    if (Array.isArray(champ.field) && champ.field.length >= 2) return champ.field.slice();
    const k = Object.keys(champ.standings || {}).map(Number).filter(x => x >= 0 && x < TEAMS.length);
    return k.length >= 2 ? k.sort((a, b) => a - b) : pickField(0, 10);
  }
  // idempotent per results array; advances champ.round
  function applyResults(champ, results, trackId) {
    if (!champ || !Array.isArray(results) || results._champApplied) return champ;
    results._champApplied = true;
    const rows = results.map(r => ({ teamIndex: r.car ? r.car.teamIndex : r.teamIndex, pos: r.pos, points: r.points || 0, dnf: !!r.dnf }));
    for (const r of rows) champ.standings[r.teamIndex] = (champ.standings[r.teamIndex] || 0) + r.points;
    champ.history.push({ round: champ.round, trackId: trackId || champ.rounds[champ.round] || null, results: rows });
    champ.round++;
    champ.complete = champ.round >= champ.rounds.length;
    return champ;
  }
  function standingsTable(champ) {
    const rows = Object.keys(champ.standings).map(k => ({ teamIndex: +k, points: champ.standings[k], wins: 0, podiums: 0, best: 99 }));
    const by = new Map(rows.map(r => [r.teamIndex, r]));
    for (const h of champ.history || []) for (const r of h.results) {
      const row = by.get(r.teamIndex);
      if (!row || r.dnf) continue;
      if (r.pos === 1) row.wins++;
      if (r.pos <= 3) row.podiums++;
      row.best = Math.min(row.best, r.pos);
    }
    rows.sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || a.best - b.best || a.teamIndex - b.teamIndex);
    rows.forEach((r, i) => { r.pos = i + 1; });
    return rows;
  }

  return {
    create, update, controlOverride, choosePitCompound, choosePitWings, setGhost,
    garageGo,   // time trial: leave the garage {compound, fw, rw}
    PIT_TOL_KMH, TL_WARN, collisionFault, turnLabel,   // (HUD pit-speed colour; tests)
    sectorFlag,   // sectorFlag(race, car, i, time, storedFlag) -> 'purple' | 'green' | 'yellow' against the current bests (HUD)
    penaltyLevel,   // penaltyLevel(opts | settings) -> 'off' | 'lenient' | 'standard' | 'strict' (race.pen = CFG.penalties[level])
    markLapInvalid: (G, car) => { const rc = car && car._race; if (rc && rc.h && G.race && G.race.mode === 'timetrial') rc.h.bad = true; },   // e.g. a reset
    skipQuali: G => { if (G.race && G.race.phase === 'quali') { G.race.awaitConfirm = null; finishQuali(G, G.race); } },
    // HUD: entry screen confirmed (starts quali or the lights) / quali grid screen confirmed (starts the lights)
    confirmGrid: G => { const r = G.race; if (!r || !r.awaitConfirm) return false; r.awaitConfirm = null; r.phaseT = 0; if (r.phase === 'quali') r.t = 0; return true; },
    classify: G => (G.race && G.race.mode !== 'timetrial' ? classify(G, false) : null),   // provisional results
    lapsToCliff: (G, c) => lapsToCliff(G.race, c),
    // dynamic weather: the engineer's current view for the player {pit, c1, j, gain} (null = no call)
    weatherCall: G => (G.race && G.race.wx ? G.race.wxPlayer || null : null),
    newChampionship, applyResults, standingsTable,
    // field size: pickField(playerTeam, n) -> team indices, champField(champ) -> a season's entry list, fieldSize(n) clamp
    pickField, champField, fieldSize,
    // pre-race screen: the player's starting tyre (fresh set)
    setStartCompound: (G, c) => {
      const P = G.player; if (!P || !COMPOUNDS[c] || !G.race || (G.race.phase !== 'grid' && G.race.phase !== 'lights' && !G.race.awaitConfirm)) return false;
      P.tyre.compound = c; P.tyre.wear = 0; P.tyre.laps = 0; P.compoundsUsed = [c]; P._startC = c; G.race.suggestedCompound = c;
      return true;
    },
  };
})();

;
// ===== ghost.js
// Apex GP — time-trial ghost: records the player's pose along a lap (every 0.05 s of lap time), replays the best
// lap with angle-aware interpolation and (de)serialises it compactly for localStorage. Pure logic (runs in Node).
//
//   rec = Ghost.createRecorder(bestTime?)   Ghost.record(rec, car, lapTime) every step (lapTime may start < 0)
//   lap = Ghost.finishLap(rec, lapTime, valid = true)   -> lap data if it beat rec.bestTime, else null; starts next lap
//   p = Ghost.createPlayer(lap); Ghost.sample(p, lapTime) -> {x, z, h} (reused object)
//   str = Ghost.serialize(lap); lap = Ghost.deserialize(str)   (null if invalid)
// lap data: { v: 1, time, dt, n, x: Float32Array, z: Float32Array, h: Float32Array, trackId? }
const Ghost = (() => {
  const DT = 0.05;
  const QXZ = 100, QH = 10000;          // quantisation: 1 cm, 1e-4 rad (delta-coded int16)
  const MAX_N = 24000;                  // 20 minutes of samples per lap
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const B64I = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) B64I[B64.charCodeAt(i)] = i;

  // keeps the last two poses (q older, p newer) so a sample time can always be bracketed, even across a lap boundary
  function createRecorder(bestTime) {
    return { n: 0, x: [], z: [], h: [], has: false, qt: 0, qx: 0, qz: 0, qh: 0, pt: 0, px: 0, pz: 0, ph: 0,
      overflow: false, bestTime: bestTime > 0 ? bestTime : Infinity, best: null };
  }
  function push(rec, x, z, h) {
    if (rec.n >= MAX_N) { rec.overflow = true; return; }
    const i = rec.n++;
    rec.x[i] = x; rec.z[i] = z; rec.h[i] = h;
  }
  // sample i is the pose at lap time i * DT, interpolated between the bracketing steps
  function record(rec, car, t) {
    if (!rec.has) {
      while (rec.n * DT <= t && !rec.overflow) push(rec, car.x, car.z, car.h);
      rec.has = true;
      rec.qt = rec.pt = t; rec.qx = rec.px = car.x; rec.qz = rec.pz = car.z; rec.qh = rec.ph = car.h;
      return;
    }
    if (!(t > rec.pt + 1e-9)) return;   // no time progress (duplicate call in the same step)
    while (rec.n * DT <= t && !rec.overflow) {
      const ts = rec.n * DT;
      if (ts >= rec.pt) {
        const f = (ts - rec.pt) / (t - rec.pt);
        push(rec, rec.px + (car.x - rec.px) * f, rec.pz + (car.z - rec.pz) * f, rec.ph + U.wrapAngle(car.h - rec.ph) * f);
      } else if (ts >= rec.qt && rec.pt > rec.qt) {
        const f = (ts - rec.qt) / (rec.pt - rec.qt);
        push(rec, rec.qx + (rec.px - rec.qx) * f, rec.qz + (rec.pz - rec.qz) * f, rec.qh + U.wrapAngle(rec.ph - rec.qh) * f);
      } else push(rec, rec.qx, rec.qz, rec.qh);
    }
    rec.qt = rec.pt; rec.qx = rec.px; rec.qz = rec.pz; rec.qh = rec.ph;
    rec.pt = t; rec.px = car.x; rec.pz = car.z; rec.ph = car.h;
  }
  // lap completed after lapTime s: returns the lap if valid and faster than the best, then starts the next lap.
  // (Race records the crossing step with the old lap's clock first, so the lap is sampled right up to the line.)
  function finishLap(rec, lapTime, valid) {
    let out = null;
    if (valid !== false && !rec.overflow && rec.n >= 2 && lapTime > 0 && lapTime < rec.bestTime) {
      // samples at lap times i * DT <= lapTime (integer count; the crossing step's clock can run past the line, so it may
      // already have recorded samples beyond it: keep exactly one past the line)
      const k1 = Math.floor(lapTime / DT + 1e-9) + 1;
      if (rec.n > k1 + 1) rec.n = k1 + 1;
      if (rec.n <= k1 && rec.pt > rec.qt) {   // one sample past the line (extrapolated from the last step) so replay reaches it
        const f = (rec.n * DT - rec.qt) / (rec.pt - rec.qt);
        push(rec, rec.qx + (rec.px - rec.qx) * f, rec.qz + (rec.pz - rec.qz) * f, rec.qh + U.wrapAngle(rec.ph - rec.qh) * f);
      }
      const n = rec.n;
      out = { v: 1, time: lapTime, dt: DT, n, x: new Float32Array(n), z: new Float32Array(n), h: new Float32Array(n) };
      for (let i = 0; i < n; i++) { out.x[i] = rec.x[i]; out.z[i] = rec.z[i]; out.h[i] = rec.h[i]; }
      rec.bestTime = lapTime; rec.best = out;
    }
    rec.n = 0; rec.overflow = false;
    rec.qt -= lapTime; rec.pt -= lapTime;   // the last poses now straddle t = 0 of the new lap
    return out;
  }
  function startLap(rec) { rec.n = 0; rec.overflow = false; rec.has = false; }

  function createPlayer(lap) { return { lap, out: { x: 0, z: 0, h: 0 }, done: false }; }
  function sample(p, t) {
    const L = p.lap, o = p.out, n = L.n;
    if (!n) return o;
    let f = t / L.dt;
    if (!(f > 0)) f = 0;
    const i = Math.floor(f);
    p.done = t > L.time;
    if (i >= n - 1) { o.x = L.x[n - 1]; o.z = L.z[n - 1]; o.h = U.wrapAngle(L.h[n - 1]); return o; }
    const u = f - i;
    o.x = L.x[i] + (L.x[i + 1] - L.x[i]) * u;
    o.z = L.z[i] + (L.z[i + 1] - L.z[i]) * u;
    o.h = U.wrapAngle(L.h[i] + U.wrapAngle(L.h[i + 1] - L.h[i]) * u);
    return o;
  }

  // ---------- compact serialisation: JSON header + base64 of little-endian int16 deltas ----------
  const clamp16 = v => (v < -32768 ? -32768 : v > 32767 ? 32767 : v);
  function b64enc(b) {
    const parts = [];
    for (let i = 0; i < b.length; i += 3) {
      const n = (b[i] << 16) | ((i + 1 < b.length ? b[i + 1] : 0) << 8) | (i + 2 < b.length ? b[i + 2] : 0);
      parts.push(B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '='));
    }
    return parts.join('');
  }
  function b64dec(s) {
    let len = s.length;
    while (len > 0 && s[len - 1] === '=') len--;
    const out = new Uint8Array(Math.floor(len * 3 / 4));
    let o = 0;
    for (let i = 0; i < len; i += 4) {
      const c = k => (i + k < len ? B64I[s.charCodeAt(i + k) & 127] : 0);
      const a = c(0), b = c(1), cc = c(2), d = c(3);
      if (a < 0 || b < 0 || cc < 0 || d < 0) throw new Error('bad base64');
      const v = (a << 18) | (b << 12) | (cc << 6) | d;
      if (o < out.length) out[o++] = (v >> 16) & 255;
      if (o < out.length) out[o++] = (v >> 8) & 255;
      if (o < out.length) out[o++] = v & 255;
    }
    return out;
  }
  function serialize(lap) {
    const n = lap.n, bytes = new Uint8Array(Math.max(0, n - 1) * 6);
    const x0 = Math.round(lap.x[0] * QXZ), z0 = Math.round(lap.z[0] * QXZ), h0 = Math.round(U.wrapAngle(lap.h[0]) * QH);
    let qx = x0, qz = z0, qh = h0, o = 0;
    const put = v => { v &= 0xffff; bytes[o++] = v & 255; bytes[o++] = v >> 8; };
    for (let i = 1; i < n; i++) {
      const dx = clamp16(Math.round(lap.x[i] * QXZ) - qx), dz = clamp16(Math.round(lap.z[i] * QXZ) - qz);
      const dh = clamp16(Math.round(U.wrapAngle(lap.h[i] - qh / QH) * QH));
      qx += dx; qz += dz; qh += dh;          // deltas against the reconstruction: no drift
      put(dx); put(dz); put(dh);
    }
    return JSON.stringify({ v: 1, track: lap.trackId || null, t: Math.round(lap.time * 1e4) / 1e4, dt: lap.dt || DT, n, x0, z0, h0, d: b64enc(bytes) });
  }
  function deserialize(str) {
    try {
      const o = typeof str === 'string' ? JSON.parse(str) : str;
      if (!o || o.v !== 1 || !(o.n >= 2) || !(o.t > 0) || typeof o.d !== 'string') return null;
      const n = o.n | 0, b = b64dec(o.d);
      if (b.length < (n - 1) * 6) return null;
      const lap = { v: 1, time: o.t, dt: o.dt > 0 ? o.dt : DT, n, x: new Float32Array(n), z: new Float32Array(n), h: new Float32Array(n) };
      if (o.track) lap.trackId = o.track;
      let qx = o.x0, qz = o.z0, qh = o.h0, p = 0;
      const get = () => { const v = b[p] | (b[p + 1] << 8); p += 2; return v >= 0x8000 ? v - 0x10000 : v; };
      lap.x[0] = qx / QXZ; lap.z[0] = qz / QXZ; lap.h[0] = qh / QH;
      for (let i = 1; i < n; i++) {
        qx += get(); qz += get(); qh += get();
        lap.x[i] = qx / QXZ; lap.z[i] = qz / QXZ; lap.h[i] = qh / QH;
      }
      return lap;
    } catch (e) { return null; }
  }

  return { DT, createRecorder, record, finishLap, startLap, createPlayer, sample, serialize, deserialize };
})();

;
// ===== netcore.js
// Apex GP — multiplayer core. DOM-free (runs in the browser, in the Node server and in Node bot clients).
// Declares only `NetCore`. The browser side (WebSocket, lobby, name tags) is net.js; the server is server/server.mjs.
//
// Model: every client simulates its OWN car (instant control) and streams its state; the server runs the race with the
// same logic modules (lights, timing, positions, gaps, penalties, pit stops, weather, AI cars, results) and relays the
// other cars. A human car is handed to the server (`ctl` message, new epoch) while Race drives it down the pit lane and
// while its player is gone (an AI brain drives it; reconnecting within 60 s hands it back).
//
// Wire format: text frames = JSON control messages {t: type, ...}; binary frames (little endian):
//   STATE  client -> server, 30 Hz, 34 B        the client's car: pose, velocity, inputs, gear / rpm, flags
//   SNAP   server -> client, 30 Hz, 12 + 28 B/car other cars (far ones every 3rd snapshot); human cars carry the
//                                                 sender's own sample time, so receivers interpolate / predict exactly
//   RACE   server -> client,  5 Hz,  8 + 16 B/car positions, laps, race distance, gaps
// Times on the wire are server-clock milliseconds (clients estimate the offset with ping / pong).
const NetCore = (() => {
  const VERSION = 1;
  const PORT = 8787;
  const HZ = { send: 30, snap: 30, race: 5 };
  const MT = { STATE: 1, SNAP: 2, RACE: 3 };
  const STATE_LEN = 34, SNAP_HEAD = 12, SNAP_CAR = 28, RACE_HEAD = 8, RACE_CAR = 16;
  const NEAR = 250, FAR_EVERY = 3;        // m: cars closer than NEAR to a client are in every snapshot, others every 3rd
  const INTERP = 0.1;                     // s: render delay of far remote cars; near ones are predicted to "now"
  const PRED_NEAR = 35, PRED_FAR = 110;   // m: prediction (0 delay) below PRED_NEAR, full INTERP delay beyond PRED_FAR
  const MAX_EXTRAP = 0.6;                 // s: dead reckoning beyond the newest sample (then the car holds). A lost TCP
                                          // segment stalls the stream for ~ping + 60 ms on top of the latency: at 0.3 s
                                          // a car alongside stopped dead for a few frames on an 80 ms link, then jumped
  // Time base: the local car's state is at the physics clock S.physT (server ms), which lags the frame by main's step
  // remainder (0-8 ms); remote cars are drawn at that same moment and the local state is stamped with it (drawing them at
  // "now" instead put a 0-67 cm longitudinal jump per frame at 300 km/h between two cars side by side).
  const SMOOTH_W = 14;                    // 1/s: a new sample's change of a remote car's predicted pose is blended in
                                          // (critically damped offset, ~0.25 s) instead of snapping the car
  const SNAP_M = 8;                       // m: a bigger change (reset to the track, pit lane placement) snaps
  const HANDBACK = 0.6;                   // s: pause menu closed -> the AI's inputs fade into the player's
  const COMP = ['S', 'M', 'H', 'I', 'W'];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const q16 = (v, k) => { v = Math.round(v * k); return v < -32768 ? -32768 : v > 32767 ? 32767 : v; };
  const u8 = v => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
  const wrapA = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // ---------- car state (STATE packet body, also the relayed sample) ----------
  const newState = () => ({ epoch: 0, seq: 0, t: 0, x: 0, z: 0, h: 0, vx: 0, vz: 0, r: 0, throttle: 0, brake: 0, steer: 0,
    gear: 1, rpm: 0, aeroT: 0, wear: 0, bat: 0, boosting: false, harvesting: false, straight: false, reset: false,
    onKerb: false, offTrack: false, smoke: false, reverse: false, finished: false, pitc: 0 });
  function stateFromCar(car, s) {
    s.x = car.x; s.z = car.z; s.h = car.h; s.vx = car.vx; s.vz = car.vz; s.r = car.r || 0;
    s.throttle = car.throttle || 0; s.brake = car.brake || 0; s.steer = car.steer || 0;
    s.gear = car.gear | 0; s.rpm = car.rpm || 0; s.aeroT = car.aeroT || 0;
    s.wear = (car.tyre && car.tyre.wear) || 0;
    s.bat = car.batteryCap > 0 ? (car.battery || 0) / car.batteryCap : 0;
    s.boosting = !!car.boosting; s.harvesting = !!car.harvesting; s.straight = car.aero === 'straight';
    s.onKerb = !!car.onKerb; s.offTrack = !!car.offTrack; s.reverse = !!car.reverse; s.finished = !!car.finished;
    s.smoke = (car.slide || 0) > 0.5 || (car.lockup || 0) > 0.5 || (car.wheelspin || 0) > 0.5;
    return s;
  }
  function writeState(dv, s) {
    dv.setUint8(0, MT.STATE); dv.setUint8(1, s.epoch & 255); dv.setUint16(2, s.seq & 65535, true); dv.setUint32(4, s.t >>> 0, true);
    dv.setFloat32(8, s.x, true); dv.setFloat32(12, s.z, true);
    dv.setInt16(16, q16(wrapA(s.h), 10000), true); dv.setInt16(18, q16(s.vx, 100), true); dv.setInt16(20, q16(s.vz, 100), true); dv.setInt16(22, q16(s.r, 1000), true);
    dv.setUint8(24, u8(s.throttle * 255)); dv.setUint8(25, u8(s.brake * 255)); dv.setInt8(26, clamp(Math.round(s.steer * 127), -127, 127));
    dv.setUint8(27, (clamp(s.gear + 1, 0, 15)) | (s.boosting ? 16 : 0) | (s.harvesting ? 32 : 0) | (s.straight ? 64 : 0) | (s.reset ? 128 : 0));
    dv.setUint8(28, u8(s.rpm / 60)); dv.setUint8(29, u8(s.aeroT * 255)); dv.setUint8(30, u8(s.wear * 255)); dv.setUint8(31, u8(s.bat * 255));
    dv.setUint8(32, (s.onKerb ? 1 : 0) | (s.offTrack ? 2 : 0) | (s.smoke ? 4 : 0) | (s.reverse ? 8 : 0) | (s.finished ? 16 : 0));
    dv.setUint8(33, s.pitc | 0);
    return STATE_LEN;
  }
  function readState(dv, s) {
    if (dv.byteLength < STATE_LEN || dv.getUint8(0) !== MT.STATE) return null;
    s.epoch = dv.getUint8(1); s.seq = dv.getUint16(2, true); s.t = dv.getUint32(4, true);
    s.x = dv.getFloat32(8, true); s.z = dv.getFloat32(12, true);
    s.h = dv.getInt16(16, true) / 10000; s.vx = dv.getInt16(18, true) / 100; s.vz = dv.getInt16(20, true) / 100; s.r = dv.getInt16(22, true) / 1000;
    s.throttle = dv.getUint8(24) / 255; s.brake = dv.getUint8(25) / 255; s.steer = dv.getInt8(26) / 127;
    const g = dv.getUint8(27); s.gear = (g & 15) - 1; s.boosting = !!(g & 16); s.harvesting = !!(g & 32); s.straight = !!(g & 64); s.reset = !!(g & 128);
    s.rpm = dv.getUint8(28) * 60; s.aeroT = dv.getUint8(29) / 255; s.wear = dv.getUint8(30) / 255; s.bat = dv.getUint8(31) / 255;
    const f = dv.getUint8(32); s.onKerb = !!(f & 1); s.offTrack = !!(f & 2); s.smoke = !!(f & 4); s.reverse = !!(f & 8); s.finished = !!(f & 16);
    s.pitc = dv.getUint8(33);
    return (isFinite(s.x) && isFinite(s.z)) ? s : null;
  }
  function copyState(a, b) { for (const k in a) b[k] = a[k]; return b; }

  // ---------- snapshot (server -> client) ----------
  // car flags: 1 human, 2 server authority, 4 kinematic (pit autopilot), 8 AI driving a human's car, 16 boosting,
  // 32 harvesting, 64 straight mode, 128 on a kerb. flags2 (with the gear): 16 smoke, 32 reverse, 64 stale sample.
  function writeSnapHead(dv, n, seq, serverT, raceT) {
    dv.setUint8(0, MT.SNAP); dv.setUint8(1, n); dv.setUint16(2, seq & 65535, true); dv.setUint32(4, serverT >>> 0, true); dv.setFloat32(8, raceT || 0, true);
    return SNAP_HEAD;
  }
  function writeSnapCar(dv, o, id, epoch, flags, age, s, stale) {
    dv.setUint8(o, id); dv.setUint8(o + 1, epoch & 255);
    dv.setUint8(o + 2, flags | (s.boosting ? 16 : 0) | (s.harvesting ? 32 : 0) | (s.straight ? 64 : 0) | (s.onKerb ? 128 : 0));
    dv.setUint8(o + 3, clamp(s.gear + 1, 0, 15) | (s.smoke ? 16 : 0) | (s.reverse ? 32 : 0) | (stale ? 64 : 0));
    dv.setUint16(o + 4, clamp(Math.round(age), 0, 65535), true);
    dv.setFloat32(o + 6, s.x, true); dv.setFloat32(o + 10, s.z, true);
    dv.setInt16(o + 14, q16(wrapA(s.h), 10000), true); dv.setInt16(o + 16, q16(s.vx, 100), true); dv.setInt16(o + 18, q16(s.vz, 100), true); dv.setInt16(o + 20, q16(s.r, 1000), true);
    dv.setUint8(o + 22, u8(s.throttle * 255)); dv.setUint8(o + 23, u8(s.brake * 255)); dv.setInt8(o + 24, clamp(Math.round(s.steer * 127), -127, 127));
    dv.setUint8(o + 25, u8(s.rpm / 60)); dv.setUint8(o + 26, u8(s.aeroT * 255)); dv.setUint8(o + 27, u8(s.bat * 255));
    return o + SNAP_CAR;
  }
  const _sn = newState(), _hd = { seq: 0, t: 0, raceT: 0, n: 0 };
  // cb(id, epoch, flags, sampleT, state) per car; returns the header (reused object) or null
  function readSnap(dv, cb) {
    if (dv.byteLength < SNAP_HEAD || dv.getUint8(0) !== MT.SNAP) return null;
    const n = dv.getUint8(1);
    _hd.n = n; _hd.seq = dv.getUint16(2, true); _hd.t = dv.getUint32(4, true); _hd.raceT = dv.getFloat32(8, true);
    if (dv.byteLength < SNAP_HEAD + n * SNAP_CAR) return null;
    for (let i = 0, o = SNAP_HEAD; i < n; i++, o += SNAP_CAR) {
      const s = _sn, id = dv.getUint8(o), ep = dv.getUint8(o + 1), f = dv.getUint8(o + 2), g = dv.getUint8(o + 3);
      s.gear = (g & 15) - 1; s.smoke = !!(g & 16); s.reverse = !!(g & 32); s.stale = !!(g & 64);
      s.boosting = !!(f & 16); s.harvesting = !!(f & 32); s.straight = !!(f & 64); s.onKerb = !!(f & 128);
      const age = dv.getUint16(o + 4, true);
      s.x = dv.getFloat32(o + 6, true); s.z = dv.getFloat32(o + 10, true);
      s.h = dv.getInt16(o + 14, true) / 10000; s.vx = dv.getInt16(o + 16, true) / 100; s.vz = dv.getInt16(o + 18, true) / 100; s.r = dv.getInt16(o + 20, true) / 1000;
      s.throttle = dv.getUint8(o + 22) / 255; s.brake = dv.getUint8(o + 23) / 255; s.steer = dv.getInt8(o + 24) / 127;
      s.rpm = dv.getUint8(o + 25) * 60; s.aeroT = dv.getUint8(o + 26) / 255; s.bat = dv.getUint8(o + 27) / 255;
      s.t = _hd.t - age;
      cb(id, ep, f & 15, s.t, s);
    }
    return _hd;
  }

  // ---------- race block (server -> client, 5 Hz): pos, lapsDown, lap, raceDist, gapLeader, gapAhead ----------
  function writeRace(dv, seq, raceT, cars) {
    dv.setUint8(0, MT.RACE); dv.setUint8(1, cars.length); dv.setUint16(2, seq & 65535, true); dv.setFloat32(4, raceT || 0, true);
    let o = RACE_HEAD;
    for (const c of cars) {
      dv.setUint8(o, c.id); dv.setUint8(o + 1, clamp(c.pos | 0, 0, 255)); dv.setUint8(o + 2, clamp(c.lapsDown | 0, 0, 255)); dv.setUint8(o + 3, clamp(c.lap | 0, 0, 255));
      dv.setFloat32(o + 4, c.raceDist || 0, true); dv.setFloat32(o + 8, c.gapLeader || 0, true); dv.setFloat32(o + 12, c.gapAhead || 0, true);
      o += RACE_CAR;
    }
    return o;
  }
  function readRace(dv, byId) {
    if (dv.byteLength < RACE_HEAD || dv.getUint8(0) !== MT.RACE) return -1;
    const n = dv.getUint8(1);
    if (dv.byteLength < RACE_HEAD + n * RACE_CAR) return -1;
    for (let i = 0, o = RACE_HEAD; i < n; i++, o += RACE_CAR) {
      const c = byId[dv.getUint8(o)];
      if (!c) continue;
      c.pos = dv.getUint8(o + 1); c.lapsDown = dv.getUint8(o + 2); c.lap = dv.getUint8(o + 3);
      c.raceDist = dv.getFloat32(o + 4, true); c.gapLeader = dv.getFloat32(o + 8, true); c.gapAhead = dv.getFloat32(o + 12, true);
    }
    return dv.getFloat32(4, true);
  }

  // ---------- discrete race fields (JSON diffs, only cars whose fields changed) ----------
  const r3 = v => (v == null || !isFinite(v) ? null : Math.round(v * 1000) / 1000);
  const r2 = v => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
  const arr3 = a => (Array.isArray(a) ? a.map(r3) : null);
  function infoOf(car) {
    const rc = car._race || {};
    return {
      i: car.id, D: car.lapsDone | 0, ll: r3(car.lastLap), bl: r3(car.bestLap), ls: r3(rc.lapStartT || 0), lt: arr3(car.lapTimes),
      sc: arr3(car.sectors), sf: car.sectorFlags ? car.sectorFlags.slice() : null, lsc: arr3(car.lastSectors), lsf: car.lastSectorFlags ? car.lastSectorFlags.slice() : null,
      bs: arr3(car.bestSectors), pe: r3(car.penalty || 0), pp: car.penPending ? 1 : 0, pd: r3(rc.penDone || 0), psv: r3(car.penaltyServed || 0),
      ps: car.pitStops | 0, pst: car.pitState || null, ipl: car.inPitLane ? 1 : 0, plim: car.pitLimiter ? 1 : 0,
      ppr: car.pitProgress == null ? null : r2(car.pitProgress), pel: car.pitState === 'service' ? r2(car.pitElapsed) : null, pdu: car.pitState === 'service' ? r2(car.pitDur) : null, ppn: r2(car.pitPen || 0),
      c: car.tyre ? car.tyre.compound : 'M', w: car.tyre ? r2(car.tyre.wear) : 0, cu: (car.compoundsUsed || []).join(''),
      ot: car.overtake ? 1 : 0, otn: car.overtakeNext ? 1 : 0, f: car.finished ? 1 : 0, ft: r3(car.finishTime), dnf: car.dnf ? 1 : 0,
      al: car.aeroLock ? 1 : 0, bc: r2(car.batteryCap), g: car.grid | 0, js: car.jumpStart ? 1 : 0,
    };
  }
  // isMe: the local car keeps its own physics fields (wear, battery) — only race-control fields are taken
  function applyInfo(car, o, isMe) {
    const rc = car._race || (car._race = {});
    car.lapsDone = o.D; car.lastLap = o.ll; car.bestLap = o.bl; rc.lapStartT = o.ls || 0;
    if (o.lt) car.lapTimes = o.lt;
    if (o.sc) car.sectors = o.sc; if (o.sf) car.sectorFlags = o.sf; if (o.lsc) car.lastSectors = o.lsc; if (o.lsf) car.lastSectorFlags = o.lsf; if (o.bs) car.bestSectors = o.bs;
    car.penalty = o.pe || 0; car.penPending = !!o.pp; rc.penDone = o.pd || 0; car.penaltyServed = o.psv || 0;
    car.pitStops = o.ps | 0; car.pitState = o.pst || null; car.inPitLane = !!o.ipl; car.pitLimiter = !!o.plim;
    car.pitProgress = o.ppr; car.pitElapsed = o.pel; car.pitDur = o.pdu; car.pitPen = o.ppn || 0;
    const c = COMP.includes(o.c) ? o.c : 'M';
    if (car.tyre && car.tyre.compound !== c) { car.tyre.compound = c; if (typeof COMPOUNDS !== 'undefined' && COMPOUNDS[c]) car.grip = COMPOUNDS[c].grip; }
    if (!isMe && car.tyre) car.tyre.wear = o.w || 0;
    car.compoundsUsed = String(o.cu || c).split('');
    // Overtake Mode: the battery bonus for the local car (Race does this on the server's copy at the line)
    if (isMe && typeof CFG !== 'undefined') {
      const E = CFG.energy;
      if (o.ot && !car.overtake) { car.batteryCap = E.cap + E.overtakeBonus; car.battery = Math.min(car.batteryCap, (car.battery || 0) + E.overtakeBonus); }
      else if (!o.ot && car.overtake) { car.batteryCap = E.cap; if (car.battery > car.batteryCap) car.battery = car.batteryCap; }
    } else if (o.bc > 0) car.batteryCap = o.bc;
    car.overtake = !!o.ot; car.overtakeNext = !!o.otn;
    car.finished = !!o.f; car.finishTime = o.ft; car.dnf = !!o.dnf; car.aeroLock = !!o.al; car.jumpStart = !!o.js;
    if (o.g) car.grid = o.g;
  }

  // ---------- events (server Race -> clients): car references become ids ----------
  // lightOn / lightsOut are scheduled on each client (all show the lights at the same moment); collisions are local.
  const EV_SKIP = new Set(['lightOn', 'lightsOut', 'collision', 'shift', 'radio', 'setupChange', 'ttGarage', 'boxThisLap', 'qualiDone', 'raceEnd']);
  function packEvent(ev) {
    if (!ev || !ev.type || EV_SKIP.has(ev.type)) return null;
    const o = {};
    for (const k in ev) {
      const v = ev[k];
      if (v == null || typeof v === 'function') continue;
      if (typeof v === 'object') { if (typeof v.id === 'number' && v.teamIndex != null) o[k] = { $c: v.id }; }
      else o[k] = v;
    }
    return o;
  }
  function unpackEvent(o, byId) {
    const ev = {};
    for (const k in o) {
      const v = o[k];
      if (v && typeof v === 'object' && v.$c != null) { const c = byId[v.$c]; if (!c) return null; ev[k] = c; }
      else ev[k] = v;
    }
    return ev;
  }

  // ---------- clock sync (ping / pong): offset = server - local, from the lowest-RTT quarter of the last 32 samples ----
  // (their mean: a sample's error is half its up / down delay difference, which averages out over the few fastest —
  // about half the error of the single fastest sample with +-15 ms of jitter; each ms of error between two clients shows
  // a car alongside 8 cm off at 300 km/h)
  const makeClock = () => ({ off: 0, rtt: 0, ping: 0, ok: false, win: [], rtts: [] });
  function clockSample(C, sentLocal, serverT, recvLocal) {
    const rtt = recvLocal - sentLocal;
    if (!(rtt >= 0) || rtt > 10000) return;
    C.win.push([rtt, serverT + rtt / 2 - recvLocal]);
    if (C.win.length > 32) C.win.shift();
    C.rtts.push(rtt); if (C.rtts.length > 5) C.rtts.shift();
    const w = C.win.slice().sort((a, b) => a[0] - b[0]), k = Math.max(1, w.length >> 2);
    let best = 0;
    for (let i = 0; i < k; i++) best += w[i][1];
    best /= k;
    if (!C.ok || Math.abs(best - C.off) > 40) C.off = best;
    else C.off += (best - C.off) * 0.3;
    C.ok = true; C.rtt = rtt;
    const m = C.rtts.slice().sort((a, b) => a - b); C.ping = m[m.length >> 1];
  }
  const serverNow = (C, localNow) => localNow + C.off;

  // ---------- interpolation buffer per remote car (server-clock sample times) ----------
  const BN = 24;
  function makeBuf() {
    const f = () => new Float64Array(BN);
    return { n: 0, head: -1, t: f(), x: f(), z: f(), h: f(), vx: f(), vz: f(), r: f(), last: newState(), lastT: -Infinity, recvT: 0 };
  }
  function bufPush(B, t, s) {
    if (!(t > B.lastT)) return false;   // duplicate / out of order
    const i = B.head = (B.head + 1) % BN;
    B.t[i] = t; B.x[i] = s.x; B.z[i] = s.z; B.h[i] = s.h; B.vx[i] = s.vx; B.vz[i] = s.vz; B.r[i] = s.r;
    if (B.n < BN) B.n++;
    B.lastT = t;
    copyState(s, B.last);
    return true;
  }
  const bufReset = B => { B.n = 0; B.head = -1; B.lastT = -Infinity; };
  // pose at server time T (ms): cubic Hermite between the bracketing samples (heading too, with the yaw rates), else dead
  // reckoning along an arc from the newest one (at most MAX_EXTRAP s). out gets x, z, h, vx, vz, r, ex (s of
  // extrapolation). maxT: only the samples up to that time (the prediction before newer samples came in)
  function bufSample(B, T, out, maxT) {
    if (!B.n) return false;
    let k = B.head, j = -1, c = 0;
    if (maxT != null) { while (c < B.n && B.t[k] > maxT) { k = (k - 1 + BN) % BN; c++; } if (c === B.n) return false; }
    for (; c < B.n; c++) {
      if (B.t[k] <= T) break;
      j = k; k = (k - 1 + BN) % BN;
      if (c === B.n - 1) k = -1;
    }
    if (k < 0) { k = j; j = -1; T = B.t[k]; }   // older than the whole buffer: the oldest sample
    if (j >= 0) {
      const dt = (B.t[j] - B.t[k]) / 1000, u = (T - B.t[k]) / (B.t[j] - B.t[k]);
      const u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      out.x = h00 * B.x[k] + h10 * dt * B.vx[k] + h01 * B.x[j] + h11 * dt * B.vx[j];
      out.z = h00 * B.z[k] + h10 * dt * B.vz[k] + h01 * B.z[j] + h11 * dt * B.vz[j];
      out.h = wrapA(B.h[k] + h10 * dt * B.r[k] + h01 * wrapA(B.h[j] - B.h[k]) + h11 * dt * B.r[j]);
      out.vx = B.vx[k] + (B.vx[j] - B.vx[k]) * u; out.vz = B.vz[k] + (B.vz[j] - B.vz[k]) * u; out.r = B.r[k] + (B.r[j] - B.r[k]) * u;
      out.ex = 0;
      return true;
    }
    const e = clamp((T - B.t[k]) / 1000, 0, MAX_EXTRAP);
    // the speed change between the two newest samples carries on (braking / accelerating): a constant-speed guess put a
    // braking car alongside ~2 cm ahead by each next sample, then back — a 30 Hz shudder against the local car
    let acc = 0;
    if (B.n > 1 && e > 0 && c + 1 < B.n) {
      const k0 = (k - 1 + BN) % BN, dt = (B.t[k] - B.t[k0]) / 1000;
      if (dt > 0.01 && dt < 0.25) acc = clamp((Math.hypot(B.vx[k], B.vz[k]) - Math.hypot(B.vx[k0], B.vz[k0])) / dt, -60, 25);
    }
    extrap(B.x[k], B.z[k], B.h[k], B.vx[k], B.vz[k], B.r[k], e, out, acc);
    out.ex = e;
    return true;
  }
  // constant yaw rate: the velocity turns with the car (arc), turn limited to 0.6 rad; acc (m/s^2): the speed changes
  // along the arc for at most ACC_T s (not below a standstill)
  const ACC_T = 0.12;
  function extrap(x, z, h, vx, vz, r, e, out, acc) {
    let w = r;
    if (Math.abs(w * e) > 0.6) w = Math.sign(w) * 0.6 / Math.max(e, 1e-6);
    const th = w * e;
    let a, b;
    if (Math.abs(th) < 1e-4) { a = e; b = w * e * e * 0.5; } else { a = Math.sin(th) / w; b = (1 - Math.cos(th)) / w; }
    out.x = x + vx * a - vz * b; out.z = z + vx * b + vz * a;
    const c = Math.cos(th), s = Math.sin(th);
    out.vx = vx * c - vz * s; out.vz = vx * s + vz * c; out.h = wrapA(h + th); out.r = r;
    const v = acc ? Math.hypot(vx, vz) : 0;
    if (v > 0.5) {
      const ea = Math.min(e, ACC_T, acc < 0 ? -v / acc : Infinity), ds = acc * ea * (e - 0.5 * ea), t2 = w * e * 0.667;
      const c2 = Math.cos(t2), s2 = Math.sin(t2), k = (v + acc * ea) / v;
      out.x += (vx * c2 - vz * s2) / v * ds; out.z += (vx * s2 + vz * c2) / v * ds;
      out.vx *= k; out.vz *= k;
    }
    return out;
  }

  // ---------- room settings (server sanitises, clients show them) ----------
  const OPT = {
    mode: ['race', 'timetrial'], laps: [1, 2, 3, 5, 8, 10, 15, 20, 30], weather: ['dry', 'damp', 'wet', 'dynamic'], timeOfDay: ['day', 'dusk', 'night'],
    difficulty: ['easy', 'medium', 'hard', 'extreme'], tyreWear: ['off', 'normal', 'high'], contact: ['contact', 'ghost'],
    penaltyLevel: ['off', 'lenient', 'standard', 'strict'],
  };
  const DEF = { mode: 'race', trackId: 'vortex', laps: 5, fieldSize: 10, weather: 'dry', timeOfDay: 'day', difficulty: 'medium', penalties: true,
    penaltyLevel: 'standard', contact: 'contact', tyreWear: 'normal', twoCompound: false, humanSlots: 4 };
  const MAX_CARS = 20;   // humans + AI on one grid (also the most drivers in a room)
  // Grid size: the host picks the human places when creating the room (humanSlots: the room is full at that many drivers)
  // and the number of AI racers in the lobby (aiCount, at most MAX_CARS - humanSlots). A race starts with the humans in
  // the room + aiCount AI cars (at least 2 cars). Older clients / bots send only fieldSize (the total): aiCount null.
  // penaltyLevel off | lenient | standard | strict (penalties = level !== 'off', kept for older clients).
  function roomSettings(s, trackIds, humans) {
    s = s && typeof s === 'object' ? s : {};
    const pick = (k, list) => (list.includes(s[k]) ? s[k] : DEF[k]);
    const o = {};
    for (const k of ['mode', 'weather', 'timeOfDay', 'difficulty', 'tyreWear', 'contact']) o[k] = pick(k, OPT[k]);
    o.trackId = trackIds.includes(s.trackId) ? s.trackId : trackIds.includes(DEF.trackId) ? DEF.trackId : trackIds[0];
    o.laps = clamp(Math.round(+s.laps) || DEF.laps, 1, 50);
    const hs = Math.round(+s.humanSlots);
    o.humanSlots = clamp(hs > 0 ? hs : s.aiCount == null ? MAX_CARS : DEF.humanSlots, Math.max(2, humans | 0), MAX_CARS);
    const ai = s.aiCount == null || s.aiCount === '' ? NaN : Math.round(+s.aiCount);
    o.aiCount = isFinite(ai) ? clamp(ai, 0, MAX_CARS - o.humanSlots) : null;
    o.fieldSize = o.aiCount != null ? clamp((humans | 0) + o.aiCount, 2, MAX_CARS) : clamp(Math.round(+s.fieldSize) || DEF.fieldSize, Math.max(2, humans | 0), MAX_CARS);
    o.penaltyLevel = OPT.penaltyLevel.includes(s.penaltyLevel) ? s.penaltyLevel : s.penalties === false ? 'off' : DEF.penaltyLevel;
    o.penalties = o.penaltyLevel !== 'off'; o.twoCompound = !!s.twoCompound;
    return o;
  }
  // cars on the grid when a race starts with `humans` drivers
  const gridSize = (st, humans) => clamp(st.aiCount != null ? (humans | 0) + st.aiCount : Math.max(humans | 0, st.fieldSize | 0), 2, MAX_CARS);
  // a player's car setups (private: sent to the server, never shown to the others): { trackId: { fw, rw } }, wings 1..11
  function cleanSetups(o, trackIds) {
    const out = {};
    if (!o || typeof o !== 'object') return out;
    const W = typeof CFG !== 'undefined' && CFG.setup && CFG.setup.wing ? CFG.setup.wing : v => clamp(Math.round(+v) || 6, 1, 11);
    for (const id of Object.keys(o).slice(0, 64)) {
      if (trackIds && !trackIds.includes(id)) continue;
      const v = o[id];
      if (v && typeof v === 'object') out[id] = { fw: W(v.fw), rw: W(v.rw) };
    }
    return out;
  }

  // ---------- client session: building the local race from the server's setup ----------
  // The browser passes these through main's startSession (settings + Race.create opts + afterCreate); bots call
  // buildSession directly. setup = { mode, seed, settings, field: [teamIndex], cars: [{id, team, pid, name, first, last,
  // code, number, compound, grid}], you: carId }
  function sessionSettings(base, setup) {
    const S = setup.settings, me = setup.cars.find(c => c.id === setup.you) || setup.cars[0];
    return Object.assign({}, base || {}, {
      mode: setup.mode === 'timetrial' ? 'timetrial' : 'race', trackId: S.trackId, laps: S.laps, difficulty: S.difficulty, weather: S.weather,
      timeOfDay: S.timeOfDay, tyreWear: S.tyreWear, twoCompound: !!S.twoCompound, penalties: S.penalties !== false,
      penaltyLevel: OPT.penaltyLevel.includes(S.penaltyLevel) ? S.penaltyLevel : S.penalties === false ? 'off' : DEF.penaltyLevel,
      // your car setup for this circuit exactly as the server runs it (setup.mySetup; missing = your saved one)
      setups: setup.mySetup ? Object.assign({}, base && base.setups, { [S.trackId]: { fw: setup.mySetup.fw, rw: setup.mySetup.rw } }) : base && base.setups,
      fieldSize: setup.field ? setup.field.length : 1, grid: 'choose', gridPos: (me && me.grid) || 1, teamIndex: me ? me.team : 0,
      compound: (me && me.compound) || 'M', playerName: (me && me.name) || (base && base.playerName) || 'Player', playerNumber: (me && me.number) || 7,
    });
  }
  const raceOpts = setup => (setup.mode === 'timetrial' ? { seed: setup.seed } : { field: setup.field.slice(), seed: setup.seed, aiSetups: false });
  // after Race.create: names, numbers, grid slots and tyres exactly as on the server; remote cars are moved by snapshots
  function patchRace(G, setup) {
    if (setup.mode === 'timetrial') return;
    const race = G.race, byId = [];
    for (const c of setup.cars) {
      const car = G.cars[c.id];
      if (!car || car.teamIndex !== c.team) throw new Error('multiplayer: entry list mismatch (car ' + c.id + ')');
      byId[c.id] = car;
      car.driver = { first: c.first || '', last: c.last, code: c.code, number: c.number };
      car.code = c.code; car.name = c.last; car.number = c.number; car.firstName = c.first || ''; car.lastName = c.last;
      car.netHuman = !!c.pid; car.netPid = c.pid || null; car.netName = c.name || c.last;
      car.tyre.compound = c.compound; car.tyre.wear = 0; car.compoundsUsed = [c.compound];
      if (typeof COMPOUNDS !== 'undefined' && COMPOUNDS[c.compound]) car.grip = COMPOUNDS[c.compound].grip;
      car.grid = c.grid; car.pos = c.grid;
      const slot = G.track.gridSlots[c.grid - 1] || { s: G.track.wrapS(-(10 + 8 * c.grid)), d: 0 };
      if (typeof Physics !== 'undefined') Physics.place(car, G.track, slot.s, slot.d);
      if (car._race) { car._race.gridX = car.x; car._race.gridZ = car.z; car._race.lapStartT = 0; }
      car.strategy = null; car.wantPit = false; car.nextCompound = null;
      if (car.id !== setup.you) { car.kinematic = false; car.isPlayer = false; }   // (snapshots: kinematic = in the pit lane)
    }
    race.order = G.cars.slice().sort((a, b) => a.grid - b.grid); race.grid = race.order.slice();
    race.awaitConfirm = null; race.phase = 'grid'; race.lights = { on: 0, out: false }; race.t = 0;
    race.releaseEarly && race.releaseEarly.clear && race.releaseEarly.clear();
    race.net = true;
    return byId;
  }

  // ---------- local car: slipstream from remote cars + contact (the other client resolves its own half) ----------
  const SOFT = 0.7;   // share of the symmetric contact impulse applied to the local car (hides latency jitter)
  // The other car's side of a contact is applied by its own client and only seen here a latency later. Until then it is
  // assumed: half the overlap and its share of the impulse go onto the remote car's pose / velocity at once (b._cv, the
  // part not in its network samples yet, fading out over about that latency: cvStep). Without it this side kept pushing
  // against a car that had already moved away: each car took the whole correction and two cars leaning on each other
  // bounced apart (contact events ~6x single player's, the gap between them wobbling)
  const cvOf = b => b._cv || (b._cv = { x: 0, z: 0, vx: 0, vz: 0 });
  function cvStep(c, dt, tau) {
    const v = c._cv;
    if (!v || (v.x === 0 && v.z === 0 && v.vx === 0 && v.vz === 0)) return;
    v.x += v.vx * dt; v.z += v.vz * dt;
    const k = 1 - Math.exp(-dt / tau), dx = v.x * k, dz = v.z * k, dvx = v.vx * k, dvz = v.vz * k;
    v.x -= dx; v.z -= dz; v.vx -= dvx; v.vz -= dvz; c.x -= dx; c.z -= dz; c.vx -= dvx; c.vz -= dvz;
    if (Math.abs(v.x) + Math.abs(v.z) < 1e-4 && Math.abs(v.vx) + Math.abs(v.vz) < 1e-3) v.x = v.z = v.vx = v.vz = 0;
  }
  function towFor(me, others, dt) {
    const SS = CFG.slipstream, ch = Math.cos(me.h), sh = Math.sin(me.h);
    let tow = 0, dirty = 0;
    for (let j = 0; j < others.length; j++) {
      const b = others[j];
      if (b === me || !b.netLive || b.netKin) continue;
      const dx = b.x - me.x, dz = b.z - me.z;
      if (dx > SS.range || dx < -SS.range || dz > SS.range || dz < -SS.range) continue;
      const along = dx * ch + dz * sh;
      if (along < 3 || along > SS.range) continue;
      const lat = Math.abs(-dx * sh + dz * ch), wHalf = SS.halfWidth * (0.7 + 0.6 * along / SS.range);
      if (lat > wHalf) continue;
      const lr = lat / wHalf, k = Math.pow(1 - along / SS.range, 0.6) * (1 - lr * lr);
      if (k > tow) tow = k;
      const DR = SS.dirtyRange || 30;
      if (along < DR) { const dk = (1 - along / DR) * (1 - lat / wHalf); if (dk > dirty) dirty = dk; }
    }
    const sm = v => smooth(v);
    me.tow = U.expDecay(me.tow || 0, tow * sm((me.speed - 25) / 20), 5, dt);
    me.dirty = U.expDecay(me.dirty || 0, dirty * sm((me.speed - 20) / 20), 5, dt);
  }
  function contactFor(me, others, events) {
    const C = CFG.car, R = C.collisionRadius, OFF = C.collisionOffset, I = C.inertia, m = C.mass;
    let hit = 0;
    for (let j = 0; j < others.length; j++) {
      const b = others[j];
      if (b === me || !b.netLive || b.netKin) continue;
      const ddx = b.x - me.x, ddz = b.z - me.z;
      if (ddx * ddx + ddz * ddz > 49) continue;
      const ach = Math.cos(me.h), ash = Math.sin(me.h), bch = Math.cos(b.h), bsh = Math.sin(b.h);
      let bp = 0, bax = 0, baz = 0, bbx = 0, bbz = 0, bdx = 0, bdz = 0, bd = 0;
      for (let ca = -1; ca <= 1; ca += 2) {
        const ax = me.x + ach * OFF * ca, az = me.z + ash * OFF * ca;
        for (let cb = -1; cb <= 1; cb += 2) {
          const bx = b.x + bch * OFF * cb, bz = b.z + bsh * OFF * cb, dx = bx - ax, dz = bz - az, dist = Math.hypot(dx, dz), pen = 2 * R - dist;
          if (pen > bp) { bp = pen; bax = ax; baz = az; bbx = bx; bbz = bz; bdx = dx; bdz = dz; bd = dist; }
        }
      }
      if (!(bp > 0)) continue;
      const nx = bd > 1e-4 ? bdx / bd : 1, nz = bd > 1e-4 ? bdz / bd : 0;
      me.x -= nx * bp * 0.5; me.z -= nz * bp * 0.5;   // own half of the separation
      const cv = cvOf(b);
      b.x += nx * bp * 0.5; b.z += nz * bp * 0.5; cv.x += nx * bp * 0.5; cv.z += nz * bp * 0.5;   // (and the other's, as its client does)
      const cx = (bax + bbx) * 0.5, cz = (baz + bbz) * 0.5, oax = cx - me.x, oaz = cz - me.z, obx = cx - b.x, obz = cz - b.z;
      const vax = me.vx + me.r * -oaz, vaz = me.vz + me.r * oax, vbx = b.vx + (b.r || 0) * -obz, vbz = b.vz + (b.r || 0) * obx;
      const rvx = vbx - vax, rvz = vbz - vaz, vn = rvx * nx + rvz * nz;
      if (vn >= 0) continue;
      const raN = oax * nz - oaz * nx, rbN = obx * nz - obz * nx, kN = 2 / m + (raN * raN) / I + (rbN * rbN) / I;
      const jn = -(1.15) * vn / kN, tx = -nz, tz = nx, vt = rvx * tx + rvz * tz;
      const raT = oax * tz - oaz * tx, rbT = obx * tz - obz * tx, kT = 2 / m + (raT * raT) / I + (rbT * rbT) / I;
      const jt = clamp(-vt / kT, -0.25 * jn, 0.25 * jn), Jx = (nx * jn + tx * jt) * SOFT, Jz = (nz * jn + tz * jt) * SOFT;
      me.vx -= Jx / m; me.vz -= Jz / m;
      b.vx += Jx / m; b.vz += Jz / m; cv.vx += Jx / m; cv.vz += Jz / m;
      me.r -= (oax * Jz - oaz * Jx) / I * 0.6;
      const imp = -vn;
      me.collision = Math.max(me.collision || 0, imp);
      if (imp > hit) hit = imp;
      if (events && imp > 1.5) events.push({ type: 'collision', car: me, other: b, intensity: imp });
    }
    return hit;
  }

  // ---------- validation (server): a client's car state must be plausible ----------
  const VMAX = 115;   // m/s
  function plausible(track, prev, s, dtMs, proj) {
    const v = Math.hypot(s.vx, s.vz);
    if (!(v <= VMAX) || !isFinite(s.h)) return 'speed';
    const b = track.bounds, M = 60;
    if (s.x < b.minX - M || s.x > b.maxX + M || s.z < b.minZ - M || s.z > b.maxZ + M) return 'bounds';
    const p = track.project(s.x, s.z, prev ? prev.idx : -1, proj);
    const wall = Math.max(Math.abs(track.wallL[p.idx]), Math.abs(track.wallR[p.idx]));
    if (Math.abs(p.d) > wall + 25 && !track.inPitArea(p.s, p.d)) return 'offmap';
    if (prev && !s.reset) {
      const jump = Math.hypot(s.x - prev.x, s.z - prev.z), allow = VMAX * Math.max(0.05, dtMs / 1000) + 20;
      if (jump > allow) return 'jump';
    }
    if (prev && s.reset && Math.abs(track.deltaS(prev.s, p.s)) > 250) return 'reset';
    return null;
  }

  // ---------- client session (browser net.js and Node bots): one per race / time-trial session ----------
  // G must already hold the session built from the setup (browser: main's startSession with sessionSettings / raceOpts /
  // patchRace; bots: the same calls directly). opts: { clock, bot: bool (AI drives the local car), difficulty }.
  const HOLD = { throttle: 0, brake: 1, steer: 0, boost: false, aeroPress: false, hold: true };
  const BRAKE = { throttle: 0, brake: 1, steer: 0, boost: false, aeroPress: false };
  function createSession(G, setup, opts = {}) {
    const S = {
      G, setup, mode: setup.mode === 'timetrial' ? 'timetrial' : 'race', me: G.player, clock: opts.clock || makeClock(), bot: !!opts.bot,
      byId: [], remote: [], bufs: [], contact: !!setup.settings && setup.settings.contact !== 'ghost',
      epoch: setup.epoch || 1, follow: false, why: null, sched: setup.sched || null, raceT0: setup.t0 != null ? setup.t0 : null, simT: null,
      st: newState(), seq: 0, sendAcc: 0, out: [], brain: null, pin: { throttle: 0, brake: 0, steer: 0, boost: false, aeroPress: false, kb: false },
      off: { x: 0, z: 0, h: 0, on: false }, ghosts: new Map(), roster: [], lb: [], forced: null, lapsSent: 0, reset: false,
      stats: { snaps: 0, snapBytes: 0, raceBytes: 0, jsonBytes: 0, sent: 0, sentBytes: 0, lat: [], t0: 0 }, _o: {}, _p: {}, _q: {},
      physT: null, pauseBrain: null, handT: 0, pmix: { throttle: 0, brake: 0, steer: 0, boost: false, aeroPress: false, kb: false }, pitcSent: null,
    };
    if (S.mode === 'race') {
      for (const car of G.cars) { S.byId[car.id] = car; S.bufs[car.id] = makeBuf(); if (car !== S.me) { S.remote.push(car); car.netLive = false; } }
      if (S.me) S.me.netLive = true;
    } else {
      S.byId[setup.you] = S.me;
      if (Array.isArray(setup.players)) setRoster(S, setup.players);
    }
    return S;
  }
  // time trial: the other drivers (live ghosts, not in G.cars)
  function setRoster(S, list) {
    S.roster = list;
    for (const p of list) {
      if (p.id === S.setup.you) continue;
      let g = S.ghosts.get(p.id);
      if (!g) { g = { id: p.id, buf: makeBuf(), car: { id: p.id, x: 0, z: 0, h: 0, vx: 0, vz: 0, r: 0, speed: 0, s: 0, d: 0, idx: -1, wheelRot: 0, steer: 0, steerAngle: 0, aeroT: 0, throttle: 0, gear: 1, rpm: 0 }, visible: false }; S.ghosts.set(p.id, g); }
      g.pid = p.pid; g.name = p.name; g.team = p.team; g.number = p.number; g.active = p.active !== false;
      g.car.team = typeof TEAMS !== 'undefined' ? TEAMS[p.team] : null; g.car.netName = p.name; g.car.number = p.number; g.car.netHuman = true;
    }
    for (const id of [...S.ghosts.keys()]) if (!list.some(p => p.id === id)) S.ghosts.delete(id);
  }
  function aiInput(S, dt) {
    const G = S.G, me = S.me;
    if (typeof AI === 'undefined') return BRAKE;
    if (!S.brain) S.brain = AI.create(me, DIFFICULTY[S.botDiff] || DIFFICULTY.medium, 4242 + me.id * 7, G);
    return AI.drive(S.brain, me, G, dt);
  }
  // pause menu open (the race goes on behind it): an AI brain drives the car at race pace — racing line, racecraft, like
  // an AI car — made from where the car is each time the menu opens (a stale brain would snap its line). Menu closed: the
  // AI's pedals / steering fade into the player's over HANDBACK s (the player's brake counts at once), then it is dropped.
  function pauseDrive(S, p, dt, paused) {
    const G = S.G, me = S.me;
    if (typeof AI === 'undefined') return paused ? BRAKE : p;
    if (!S.pauseBrain) { const st = S.setup.settings || {}; S.pauseBrain = AI.create(me, DIFFICULTY[st.difficulty] || DIFFICULTY.medium, 7331 + me.id * 13, G); }
    const a = AI.drive(S.pauseBrain, me, G, dt);
    if (paused) { S.handT = 0; return a; }
    S.handT += dt;
    const k = smooth(S.handT / HANDBACK), m = S.pmix;
    m.throttle = a.throttle + (p.throttle - a.throttle) * k; m.brake = Math.max(p.brake, a.brake + (p.brake - a.brake) * k);
    m.steer = a.steer + (p.steer - a.steer) * k; m.boost = p.boost; m.aeroPress = p.aeroPress; m.kb = p.kb;
    if (S.handT >= HANDBACK) S.pauseBrain = null;
    return m;
  }
  // the pit entry road (entry .. limiter line) is the player's to drive, as in single player: the same HUD / engineer
  // flags as Race.playerPitRoad sets there, at once (the server's Race decides the same and takes the car over at the
  // limiter line with a `ctl`; from the line until it arrives the car is on the limiter already, as the autopilot's is)
  function pitRoadFlags(S) {
    const G = S.G, me = S.me, T = G.track, pit = T && T.pit, pg = G.race && G.race.pitG;
    let road = false, lane = false, u = 0;
    if (pit && pg && !me.finished && me.s != null) {
      u = T.wrapS(me.s - pit.entryS);
      if (u > T.length / 2) u -= T.length;
      const inA = T.inPitArea(me.s, me.d);
      road = inA && u >= -2 && u < pg.uL0 && (me.vLong || 0) > -0.5;
      lane = inA && u >= pg.uL0 && u < pg.uL1 - 3;
    }
    me.inPitLane = road || lane; me.pitLimiter = lane; me.pitState = road || lane ? 'entry' : null;
    me.limiterWarn = road && (me.vLong || 0) > CFG.race.pitSpeedLimit + 0.3 && pg.uL0 - u < 150;
  }
  // one physics step (120 Hz). Race mode: the local car only (the server runs the race); returns true when it handled
  // the step. Time trial: false (main runs the solo session normally).
  function sessionTick(S, dt, inp, first, localNow) {
    if (S.mode !== 'race') return false;
    const G = S.G, race = G.race, me = S.me;
    const sn = serverNow(S.clock, localNow);
    if (S.simT == null || Math.abs(S.simT - sn) > 250) S.simT = sn;
    else if (first) S.simT += (sn - S.simT) * 0.25;
    S.simT += dt * 1000;
    // physics clock: exactly one step per tick (sessionFrame keeps it on the synchronised clock)
    if (S.physT == null || Math.abs(S.physT - sn) > 250) S.physT = sn - dt * 1000;
    S.physT += dt * 1000;
    // the remote cars move on with each step (sessionFrame places them once per frame): contact, slipstream and the AI's
    // perception see them where they are at this step, not where they were drawn at the last frame (0.7 m per step at
    // 300 km/h: a car alongside slid back and forth against the local one between frames)
    const tau = (S.clock.ping + 30) / 1000;   // (the other car's response shows in its samples after about this)
    for (let i = 0; i < S.remote.length; i++) { const c = S.remote[i]; if (c.netLive) { c.x += c.vx * dt; c.z += c.vz * dt; c.h += (c.r || 0) * dt; cvStep(c, dt, tau); } }
    // start lights from the server's schedule: every client shows them at the same moment
    const sc = S.sched;
    if (sc && race.phase !== 'racing' && race.phase !== 'finished') {
      if (race.phase === 'grid' && S.simT >= sc.lights[0]) race.phase = 'lights';
      if (race.phase === 'lights') {
        let n = 0;
        for (let k = 0; k < 5; k++) if (S.simT >= sc.lights[k]) n = k + 1;
        while (race.lights.on < n && S.simT < sc.out) { race.lights.on++; G.events.push({ type: 'lightOn', n: race.lights.on }); }
        if (S.simT >= sc.out) {
          race.lights.on = 0; race.lights.out = true; race.phase = 'racing';
          if (S.raceT0 == null) S.raceT0 = sc.out;
          if (S.simT - sc.out < 1500) G.events.push({ type: 'lightsOut' });
        }
      }
    }
    // the race clock of this car's own state (its lap timer, as the server times the states it is sent)
    if ((race.phase === 'racing' || race.phase === 'finished') && (S.raceT0 != null || sc)) race.t = Math.max(0, (S.physT - (S.raceT0 != null ? S.raceT0 : sc.out)) / 1000);
    if (me && !S.follow) {
      let input;
      const racing = race.phase === 'racing' || race.phase === 'finished';
      if (!sc) input = HOLD;                                   // waiting for everyone to load
      else if (me.finished || (S.bot && racing)) input = S.drive ? S.drive(S, dt) : aiInput(S, dt);   // cool-down lap (bots: always)
      else if (S.bot) input = HOLD;
      else if (!inp) input = BRAKE;
      else {
        const p = S.pin;
        p.throttle = inp.throttle; p.brake = inp.brake; p.steer = inp.steer; p.boost = inp.boost; p.aeroPress = first && inp.aeroPress; p.kb = !!inp.kb;
        input = G.paused || S.pauseBrain ? pauseDrive(S, p, dt, !!G.paused) : p;   // (the race goes on behind the pause menu: the AI drives)
      }
      Physics.step(me, input, dt, G.world);
      if (S.contact) contactFor(me, S.remote, G.events);
      towFor(me, S.remote, dt);
      pitRoadFlags(S);
    }
    if (me && me._race && !me.finished) me.curLapTime = race.phase === 'racing' ? Math.max(0, race.t - (me._race.lapStartT || 0)) : 0;
    if (race.wx && race.phase === 'racing' && typeof Weather !== 'undefined' && Weather.step) Weather.step(race.wx, G, dt);
    return true;
  }
  // render frame: poses of the remote cars (and the local car while the server drives it) at the moment of the local
  // car's state (S.physT). Near cars are predicted to that moment (what you see is what you hit), far ones interpolated
  // INTERP s in the past; blended by distance. simLocal: the local clock time of the local car's state (main: the frame
  // time minus the physics step remainder; bots the same), else localNow.
  function sessionFrame(S, dt, localNow, simLocal) {
    const G = S.G, me = S.me, o = S._o, track = G.track;
    // the physics clock follows the synchronised clock slowly (<= 1 ms per frame): clock corrections never jolt a car.
    // A hitch (main dropped steps) or a big clock correction: at once
    const sn = serverNow(S.clock, simLocal != null ? simLocal : localNow);
    if (S.mode !== 'race' && S.physT != null) S.physT += dt * 1000;   // (time trial: main steps the car, no sessionTick)
    if (S.physT == null || Math.abs(sn - S.physT) > 25) S.physT = sn;
    else S.physT += clamp((sn - S.physT) * Math.min(1, dt * 2), -1, 1);
    const T0 = S.physT, mx = me ? me.x : 0, mz = me ? me.z : 0, ks = 1 - Math.exp(-18 * dt);
    const place = (c, B, T, fx) => {
      if (!bufSample(B, T, o)) return false;
      let ex, ez, eh;
      if (fx) { ex = S.off.x; ez = S.off.z; eh = S.off.h; }
      else {
        // new samples change the prediction (the newest sample is extrapolated): the change goes into a correction
        // offset that is blended out, critically damped (continuous speed too), instead of snapping the car
        const E = c._ne || (c._ne = { x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, lt: -Infinity });
        const w = S.smoothW || SMOOTH_W, e = Math.exp(-w * dt);   // (smoothW: tests)
        let a = E.vx + w * E.x; E.x = (E.x + a * dt) * e; E.vx = (E.vx - w * a * dt) * e;
        a = E.vz + w * E.z; E.z = (E.z + a * dt) * e; E.vz = (E.vz - w * a * dt) * e;
        a = E.vh + w * E.h; E.h = (E.h + a * dt) * e; E.vh = (E.vh - w * a * dt) * e;
        if (B.lastT !== E.lt) {
          const q = S._q;
          if (E.lt > -Infinity && bufSample(B, T, q, E.lt)) { E.x += q.x - o.x; E.z += q.z - o.z; E.h += wrapA(q.h - o.h); }
          E.lt = B.lastT;
          if (E.x * E.x + E.z * E.z > SNAP_M * SNAP_M || Math.abs(E.h) > 0.5) E.x = E.z = E.h = E.vx = E.vz = E.vh = 0;
        }
        ex = E.x; ez = E.z; eh = E.h;
      }
      const cv = c._cv;   // (a contact response not in its samples yet: contactFor)
      if (cv) { ex += cv.x; ez += cv.z; }
      c.x = o.x + ex; c.z = o.z + ez; c.h = wrapA(o.h + eh); c.vx = o.vx + (cv ? cv.vx : 0); c.vz = o.vz + (cv ? cv.vz : 0); c.r = o.r;
      const ch = Math.cos(c.h), sh = Math.sin(c.h), L = B.last;
      c.speed = Math.hypot(c.vx, c.vz); c.vLong = c.vx * ch + c.vz * sh; c.vLat = -c.vx * sh + c.vz * ch;
      c.steer = (c.steer || 0) + (L.steer - (c.steer || 0)) * ks;   // (30 Hz steering samples: eased, the front wheels don't twitch)
      c.throttle = L.throttle; c.brake = L.brake; c.gear = L.gear; c.rpm = L.rpm; c.aeroT = L.aeroT; c.aero = L.straight ? 'straight' : 'corner';
      c.boosting = L.boosting; c.harvesting = L.harvesting; c.onKerb = L.onKerb; c.reverse = L.reverse;
      c.slide = L.smoke ? 0.7 : 0; c.lockup = L.smoke && L.brake > 0.5 ? 0.7 : 0; c.wheelspin = L.smoke && L.throttle > 0.5 && !(L.brake > 0.5) ? 0.6 : 0;
      c.steerAngle = c.steer * 0.52 / (1 + Math.abs(c.vLong) / 20);
      c.wheelRot = (c.wheelRot || 0) + c.speed * dt / 0.36;
      if (c.batteryCap > 0) c.battery = L.bat * c.batteryCap;
      if (track) {
        const p = track.project(c.x, c.z, c.idx != null ? c.idx : -1, S._p);
        c.s = p.s; c.d = p.d; c.idx = p.idx;
        const sf = track.surface(c.s, c.d);
        c.surface = sf; c.offTrack = sf === SURF.GRASS || sf === SURF.GRAVEL || sf === SURF.RUNOFF;
      }
      return true;
    };
    const delayFor = c => INTERP * 1000 * smooth((Math.hypot(c.x - mx, c.z - mz) - PRED_NEAR) / (PRED_FAR - PRED_NEAR));
    if (S.mode === 'race') {
      for (let i = 0; i < S.remote.length; i++) {
        const c = S.remote[i], B = S.bufs[c.id];
        if (B.n) c.netLive = place(c, B, T0 - delayFor(c), false);
      }
      if (me && S.follow) {
        const B = S.bufs[me.id];
        if (B.n) {
          if (S.off.pending) {   // hand-over to the server: blend from where the car was drawn into the server's pose
            if (bufSample(B, T0 - 50, o)) { S.off.x = me.x - o.x; S.off.z = me.z - o.z; S.off.h = wrapA(me.h - o.h); if (Math.hypot(S.off.x, S.off.z) > 40) S.off.x = S.off.z = S.off.h = 0; }
            S.off.pending = false;
          }
          const k = Math.exp(-3 * dt); S.off.x *= k; S.off.z *= k; S.off.h *= k;
          place(me, B, T0 - 50, true);
        }
      }
    } else {
      for (const g of S.ghosts.values()) {
        const B = g.buf;
        // (drawn at the frame's time like the solo car main moves on by G.renderLead; the race's remote cars are placed at
        // the physics clock for contact and moved on by main with the local car)
        g.visible = B.n > 0 && g.active && T0 - B.lastT < 2500 && place(g.car, B, T0 + (G.renderLead || 0) * 1000 - delayFor(g.car), false);
      }
    }
  }
  // take the local car back from the server (pit exit / AI hand-back), at its state extrapolated to the physics clock
  function adopt(S, st, localNow) {
    const me = S.me, G = S.G;
    const e = clamp(((S.physT != null ? S.physT : serverNow(S.clock, localNow)) - st.t) / 1000, 0, 0.3), o = extrap(st.x, st.z, st.h, st.vx, st.vz, st.r, e, S._o);
    S.pitcSent = null;
    me.x = o.x; me.z = o.z; me.h = o.h; me.vx = o.vx; me.vz = o.vz; me.r = st.r;
    me.gear = st.gear; me.rpm = st.rpm; me.kinematic = false; me.inPitLane = false; me.pitLimiter = false; me.pitState = null; me.pitProgress = null;
    if (st.battery != null) me.battery = st.battery; if (st.batteryCap) me.batteryCap = st.batteryCap;
    if (st.compound && me.tyre) { me.tyre.compound = st.compound; me.tyre.wear = st.wear || 0; if (typeof COMPOUNDS !== 'undefined' && COMPOUNDS[st.compound]) me.grip = COMPOUNDS[st.compound].grip; }
    me.aeroLock = !!st.aeroLock; me.aero = 'corner';
    const p = G.track.project(me.x, me.z, me.idx, S._p); me.s = p.s; me.d = p.d; me.idx = p.idx;
    S.off.x = S.off.z = S.off.h = 0;
  }
  // realtime binary from the server
  function onBinary(S, dv, localNow) {
    const type = dv.byteLength ? dv.getUint8(0) : 0;
    if (type === MT.SNAP) {
      S.stats.snaps++; S.stats.snapBytes += dv.byteLength;
      const sn = serverNow(S.clock, localNow);
      readSnap(dv, (id, ep, flags, t, s) => {
        if (S.mode === 'race') {
          const c = S.byId[id], B = S.bufs[id];
          if (!c || !B) return;
          if (c === S.me && !S.follow) return;
          if (B.lastT > t + 1500) bufReset(B);   // (server restarted its clock / new session)
          const fresh = bufPush(B, t, s);
          if (fresh) B.recvT = localNow;
          c.netKin = !!(flags & 4); c.netAi = !!(flags & 8); c.netSrv = !!(flags & 2);
          if (c !== S.me) c.kinematic = c.netKin;   // (the local AI hands skip cars in the pit lane, as in a normal race)
          if (fresh && c.netHuman && !(flags & 8) && S.stats.lat.length < 4000) S.stats.lat.push(sn - t);   // human sample age on arrival (one-way latency; a repeated stale sample is no arrival)
        } else {
          const g = S.ghosts.get(id);
          if (!g) return;
          if (g.buf.lastT > t + 1500) bufReset(g.buf);
          bufPush(g.buf, t, s);
          if (S.stats.lat.length < 4000) S.stats.lat.push(sn - t);
        }
      });
    } else if (type === MT.RACE && S.mode === 'race') {
      S.stats.raceBytes += dv.byteLength;
      if (readRace(dv, S.byId) >= 0) {
        const o = S.G.race.order;
        for (let i = 1; i < o.length; i++) { const c = o[i]; let j = i - 1; while (j >= 0 && (o[j].pos || 99) > (c.pos || 99)) { o[j + 1] = o[j]; j--; } o[j + 1] = c; }
      }
    }
  }
  // JSON control messages for the session; returns true if handled
  function onMessage(S, m, localNow) {
    const G = S.G, race = G.race, me = S.me;
    switch (m.t) {
      case 'sched': S.sched = m.sched; return true;
      case 'go': S.raceT0 = m.t0; return true;
      case 'ctl':
        if (!me || m.id !== me.id) return true;
        if (m.auth !== 'server' && S.why === 'pit') { me.pitCompound = null; if (race) race.playerPitCompound = null; }   // (out of the lane: this stop's tyre choice is used up)
        S.epoch = m.epoch; S.why = m.why || null;
        if (m.auth === 'server') { if (!S.follow) { S.follow = true; S.off.pending = true; me.kinematic = true; bufReset(S.bufs[me.id]); } }
        else { if (m.st) adopt(S, m.st, localNow); S.follow = false; me.kinematic = false; }
        return true;
      case 'info':
        if (S.mode !== 'race') return true;
        for (const o of m.c || []) {
          const c = S.byId[o.i];
          if (!c) continue;
          applyInfo(c, o, c === me);
          if (c === me && !S.follow) pitRoadFlags(S);   // (driving it: the pit road flags are the local ones, not the delayed server's)
        }
        if (m.r) {
          const r = m.r;
          race.leaderLap = r.leaderLap; race.laps = r.laps || race.laps; race.sessionBestSectors = r.sbs || race.sessionBestSectors;
          race.leaderFinished = !!r.lf; race.twoCompoundActive = !!r.tca;
          race.fastestLap = r.fl && S.byId[r.fl[0]] ? { car: S.byId[r.fl[0]], time: r.fl[1], lap: r.fl[2] } : null;
          if (r.phase === 'finished') race.phase = 'finished';
          else if (r.phase === 'racing' && !S.sched && race.phase !== 'racing' && race.phase !== 'finished' && S.raceT0 != null) { race.phase = 'racing'; race.lights.on = 0; race.lights.out = true; }   // (no schedule: joined late)
        }
        return true;
      case 'ev':
        if (S.mode !== 'race') return true;
        for (const o of m.e || []) { const ev = unpackEvent(o, S.byId); if (ev) G.events.push(ev); }
        return true;
      case 'wx':
        if (race && race.wx) { const W = race.wx; W.x = Math.max(W.x || 0, m.x || 0); W.wet = m.wet; W.rain = m.rain; if (m.trend != null) W.trend = m.trend; }
        if (G.weather && !G.weather.dynamic) { G.weather.wet = m.wet; G.weather.rain = m.rain; }
        return true;
      case 'res': {
        if (S.mode !== 'race') return true;
        for (const c of m.cars || []) {
          const car = S.byId[c.id]; if (!car) continue;
          for (const k of ['lapTimes', 'lapHist', 'bestLap', 'lastLap', 'finishTime', 'pitStops', 'penalty', 'penaltyServed', 'finished', 'dnf', 'compoundsUsed', 'lapsDone']) if (c[k] !== undefined) car[k] = c[k];
        }
        race.results = (m.rows || []).map(r => Object.assign({}, r, { car: S.byId[r.id] })).filter(r => r.car);
        if (m.fl && S.byId[m.fl[0]]) race.fastestLap = { car: S.byId[m.fl[0]], time: m.fl[1], lap: m.fl[2] };
        race.resultsFinal = true; race.phase = 'finished';
        race.order = race.results.map(r => r.car).concat(G.cars.filter(c => !race.results.some(r => r.car === c)));
        race.order.forEach((c, i) => { c.pos = i + 1; });
        G.events.push({ type: 'raceEnd' });
        S.ended = true;
        return true;
      }
      case 'roster': if (S.mode === 'timetrial') setRoster(S, m.players || []); return true;
      case 'lb': {
        S.lb = m.rows || [];
        // time trial: the session-best sectors (purple) are everyone's — the others' best laps' sectors join the local
        // session's own (race mode: the server's race sends them, info r.sbs)
        const sb = S.mode === 'timetrial' && race && race.sessionBestSectors;
        if (sb) for (const r of S.lb) if (Array.isArray(r.s)) for (let k = 0; k < 3; k++) { const v = +r.s[k]; if (v > 0 && !(sb[k] > 0 && sb[k] <= v)) sb[k] = v; }
        return true;
      }
      default: return false;
    }
  }
  // the local car's STATE packet, due every 1 / HZ.send s (returns the byte length to send, or 0)
  function outState(S, dv, dt, localNow) {
    const me = S.me;
    // in the pit lane (the server drives): a tyre choice made after the limiter line goes as a message (no STATE then)
    if (me && S.follow && S.why === 'pit' && me.pitCompound && me.pitCompound !== S.pitcSent && COMP.includes(me.pitCompound)) { S.pitcSent = me.pitCompound; S.out.push({ t: 'pitc', c: me.pitCompound }); }
    if (!me || (S.mode === 'race' && S.follow)) { S.sendAcc = 0; return 0; }
    S.sendAcc += dt;
    if (S.sendAcc < 1 / HZ.send - 0.002) return 0;
    S.sendAcc = Math.min(S.sendAcc - 1 / HZ.send, 0.05);
    const s = stateFromCar(me, S.st);
    // stamped with the physics clock (the moment of this state), whole ms on the wire: the pose moved to that exact ms
    const tp = S.physT != null ? S.physT : serverNow(S.clock, localNow), ts = Math.round(tp), dq = (ts - tp) / 1000;
    s.x += s.vx * dq; s.z += s.vz * dq; s.h = wrapA(s.h + s.r * dq);
    s.epoch = S.epoch; s.seq = (++S.seq) & 65535; s.t = ts;
    // a jump since the last packet = a reset to the track (R): flagged, so the server accepts the new position
    if (S._lx != null && Math.hypot(me.x - S._lx, me.z - S._lz) > 10 + me.speed * 0.05) S.reset = true;
    S._lx = me.x; S._lz = me.z;
    s.reset = S.reset; S.reset = false;
    s.pitc = me.pitCompound && COMP.indexOf(me.pitCompound) >= 0 ? COMP.indexOf(me.pitCompound) + 1 : 0;
    S.stats.sent++; S.stats.sentBytes += STATE_LEN;
    return writeState(dv, s);
  }
  // time trial: lap reports (+ the ghost of a new personal best) from this frame's events
  function ttEvents(S) {
    if (S.mode !== 'timetrial') return;
    const G = S.G, me = S.me;
    for (const ev of G.events) {
      if (ev.type !== 'lap' || ev.car !== me) continue;
      S.out.push({ t: 'lap', time: ev.time, lap: ev.lap, s: (me.lastSectors || []).slice(0, 3), valid: !ev.invalid });
      if (ev.ghost && typeof Ghost !== 'undefined') S.out.push({ t: 'ghost', time: ev.time, data: Ghost.serialize(ev.ghost) });
    }
    // a downloaded ghost stays the one to chase (Race would replace it with a new personal best)
    const race = G.race;
    if (S.forced && race && race.ghostPlayer && race.ghostPlayer.lap !== S.forced && typeof Ghost !== 'undefined') race.ghostPlayer = Ghost.createPlayer(S.forced);
  }
  function chaseGhost(S, data) {
    const G = S.G, race = G.race;
    if (typeof Ghost === 'undefined' || !race) return false;
    const lap = data ? Ghost.deserialize(data) : null;
    if (!lap) { S.forced = null; return false; }
    S.forced = lap; race.bestGhost = race.bestGhost && race.bestGhost.time < lap.time ? race.bestGhost : lap;
    race.ghostPlayer = Ghost.createPlayer(lap);
    return true;
  }
  const latStats = S => {
    const a = S.stats.lat.slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const q = f => a[Math.min(a.length - 1, Math.floor(f * a.length))];
    return { n: a.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: a[a.length - 1] };
  };

  // 6-digit room codes, shown as "123 456"
  const fmtCode = c => String(c).replace(/^(\d{3})(\d{3})$/, '$1 $2');
  const cleanCode = s => String(s == null ? '' : s).replace(/\D/g, '').slice(0, 6);
  const cleanName = n => String(n == null ? '' : n).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Player';

  return {
    VERSION, PORT, HZ, MT, STATE_LEN, SNAP_HEAD, SNAP_CAR, RACE_HEAD, RACE_CAR, NEAR, FAR_EVERY, INTERP, PRED_NEAR, PRED_FAR, MAX_EXTRAP, COMP, OPT, DEF,
    newState, stateFromCar, writeState, readState, copyState, writeSnapHead, writeSnapCar, readSnap, writeRace, readRace,
    infoOf, applyInfo, packEvent, unpackEvent, EV_SKIP,
    makeClock, clockSample, serverNow, makeBuf, bufPush, bufReset, bufSample, extrap,
    roomSettings, gridSize, cleanSetups, MAX_CARS, sessionSettings, raceOpts, patchRace, towFor, contactFor, SOFT, plausible,
    createSession, setRoster, aiInput, sessionTick, sessionFrame, onBinary, onMessage, outState, ttEvents, chaseGhost, adopt, latStats, HOLD,
    fmtCode, cleanCode, cleanName,
  };
})();
