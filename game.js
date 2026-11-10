'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Retro palette. The active skin's palette (same indices) lives in COLORS; see SKINS.
const BASE_COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#f48fb1', // + - pink
  '#a1887f', // U - taupe
  '#dce775', // Y - lime
  '#eceff1', // 1x1 - white
  '#7986cb', // hollow 3x3 - indigo
  '#ef5350', // bomb
  '#ffee58', // lightning (row)
  '#ffee58', // lightning (column)
  '#b39ddb', // tint
  '#8d6e63', // gravity
  '#4fc3f7', // freeze
  '#e0e0e0', // wildcard (board-only cell, no piece)
];
let COLORS = BASE_COLORS; // reassigned by applySkin(); always read at call time

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[0,8,0],[8,8,8],[0,8,0]],                  // + (pentomino)
  [[9,0,9],[9,9,9],[0,0,0]],                  // U (pentomino)
  [[0,10,0,0],[10,10,10,10],[0,0,0,0],[0,0,0,0]], // Y (pentomino)
  [[11]],                                      // 1x1 single (Tetris reward)
  [[12,12,12],[12,0,12],[12,12,12]],          // hollow 3x3 (challenge)
  [[13]], [[14]], [[15]], [[16]], [[17]], [[18]], // power-ups (1x1): see BOMB..FREEZE
];

// Piece indices beyond the 7 tetrominoes (see PIECES / COLORS).
const PENTOMINOES = [8, 9, 10];
const SINGLE = 11;
const HOLLOW = 12;
const PENTOMINO_CHANCE = 0.10; // per random piece
const HOLLOW_CHANCE = 0.04;

// Power-ups: 1x1 pieces (types 13-18) granted every POWERUP_EVERY cleared lines. They are never merged
// into the board: their effect fires on lock (see applyPowerUp). WILD is a board-only cell value (no piece).
const BOMB = 13, LIGHTNING_ROW = 14, LIGHTNING_COL = 15, TINT = 16, GRAVITY = 17, FREEZE = 18;
const WILD = 19;
const POWER_TYPES = [BOMB, LIGHTNING_ROW, LIGHTNING_COL, TINT, GRAVITY, FREEZE];
const POWER_NAMES = {
  [BOMB]: 'BOMB', [LIGHTNING_ROW]: 'LIGHTNING', [LIGHTNING_COL]: 'LIGHTNING',
  [TINT]: 'TINT', [GRAVITY]: 'GRAVITY', [FREEZE]: 'FREEZE',
};
const GLYPHS = {
  [BOMB]: '💣', [LIGHTNING_ROW]: '↔', [LIGHTNING_COL]: '↕',
  [TINT]: '🎨', [GRAVITY]: '⬇', [FREEZE]: '❄', [WILD]: '?',
};
const LIGHTNING_SOUND = [[1100, 0, 0.06, 'square'], [700, 0.06, 0.06, 'square'], [1400, 0.12, 0.1, 'square']];
const POWER_SOUNDS = { // [freq, delay, duration, wave]
  [BOMB]: [[140, 0, 0.3, 'sawtooth'], [90, 0.1, 0.35, 'sawtooth']],
  [LIGHTNING_ROW]: LIGHTNING_SOUND,
  [LIGHTNING_COL]: LIGHTNING_SOUND,
  [TINT]: [[523, 0, 0.1, 'triangle'], [659, 0.08, 0.1, 'triangle'], [784, 0.16, 0.14, 'triangle']],
  [GRAVITY]: [[440, 0, 0.1, 'sine'], [330, 0.09, 0.1, 'sine'], [220, 0.18, 0.18, 'sine']],
  [FREEZE]: [[1568, 0, 0.12, 'sine'], [1319, 0.1, 0.12, 'sine'], [1047, 0.2, 0.25, 'sine']],
};
const POWERUP_EVERY = 5;           // cleared lines per power-up
const FREEZE_MS = 5000;
const POWER_POINTS_PER_BLOCK = 10; // bomb / lightning, per destroyed block, times level

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];       // indexed by lines cleared (0-3)
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000]; // indexed by lines cleared
const B2B_MULTIPLIER = 1.5;
const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
const EFFECT_MS = 1400;
const FLASH_MS = 350;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const b2bEl = document.getElementById('b2b');
const powerEl = document.getElementById('power');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const pauseMenu = document.getElementById('pause-menu');
const controlsPanel = document.getElementById('controls-panel');
const controlsList = document.getElementById('controls-list');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const startLevelSelect = document.getElementById('start-level');
const recordsPanel = document.getElementById('records-panel');
const recordsList = document.getElementById('records-list');
const recordsBest = document.getElementById('records-best');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const newRecordMsg = document.getElementById('new-record-msg');
const startBtn = document.getElementById('start-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const RECORDS_KEY = 'tetris.records';
const NAME_KEY = 'playerName';
const MAX_RECORDS = 5;
const NAME_MAX = 12;

const MAX_START_LEVEL = 15;
const RESUME_LOCK_MS = 150; // game keys are ignored this long after resuming

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let hold, canHold; // hold: piece type (1-7) or null; canHold: false until the current piece locks
// combo: consecutive locks that cleared lines (0 = chain broken); b2b: last line clear was "difficult"
// lastMoveRotate: the last successful move of the active piece was a rotation (needed for T-spin)
let combo, b2b, lastMoveRotate, effects, flash;
let rewardPending; // a Tetris was cleared: the next generated piece is the 1x1 single
// powerProgress: lines cleared toward the next power-up; powerPending: power piece type queued as next piece
// freezeLeft: ms of suspended gravity (decremented inside loop(), so pausing doesn't consume it)
let powerProgress, powerPending, freezeLeft;
// startLevel: level the next game starts at (chosen in the pause menu, persisted); inputLockUntil: timestamp
let startLevel = 1;
let inputLockUntil = 0;
// idle: start screen, no game running; maxCombo: best combo of the current game; records: persisted
// leaderboard ({ top, bestCombo, maxLines }); pendingEntry: this game's result waiting for a name
// (only when it makes the top); lastRank: index of the saved entry to highlight (-1 none)
let idle = false;
let maxCombo = 0;
let records = { top: [], bestCombo: 0, maxLines: 0 };
let pendingEntry = null;
let lastRank = -1;

// Fall interval in ms for a level (floor of 100 ms).
function intervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const roll = Math.random();
  if (roll < HOLLOW_CHANCE) return makePiece(HOLLOW);
  if (roll < HOLLOW_CHANCE + PENTOMINO_CHANCE)
    return makePiece(PENTOMINOES[Math.floor(Math.random() * PENTOMINOES.length)]);
  return makePiece(Math.floor(Math.random() * 7) + 1);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveRotate = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function moveHorizontal(dx) {
  if (!collide(current.shape, current.x + dx, current.y)) {
    current.x += dx;
    lastMoveRotate = false;
  }
}

// T-spin (3-corner rule): the T locked right after a rotation, with 3+ of the
// 4 diagonal neighbours of its center occupied (walls and floor count as occupied).
function isTSpin() {
  if (current.type !== 3 || !lastMoveRotate) return false;
  const cx = current.x + 1, cy = current.y + 1;
  let corners = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) corners++;
  }
  return corners >= 3;
}

// A row is complete when its gaps are no more than its wildcards (each wildcard covers one gap).
function isRowFull(row) {
  let gaps = 0, wilds = 0;
  for (const v of row) {
    if (v === 0) gaps++;
    else if (v === WILD) wilds++;
  }
  return gaps <= wilds;
}

function clearLines(tspin) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (isRowFull(board[r])) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }

  if (!cleared) {
    combo = 0; // a lock without a clear breaks the chain (B2B is kept)
    if (tspin) {
      const points = TSPIN_SCORES[0] * level;
      score += points;
      announce([{ text: 'T-SPIN', color: '#ba68c8' }, { text: `+${points}` }]);
      playClearSound(0, 0, true, false);
    }
    updateHUD();
    return;
  }

  combo++;
  if (combo > maxCombo) maxCombo = combo;
  const tier = Math.min(cleared, 4); // power-ups can clear more than 4 rows at once: score as a Tetris
  const difficult = tspin || tier === 4;
  let base = tspin ? TSPIN_SCORES[Math.min(cleared, 3)] : LINE_SCORES[tier];
  const b2bBonus = difficult && b2b;
  if (b2bBonus) base = Math.floor(base * B2B_MULTIPLIER);
  b2b = difficult; // an easy clear breaks B2B, a difficult one starts/keeps it

  const perfect = board.every(row => row.every(v => v === 0));
  let points = base * level * combo;
  if (perfect) points += PERFECT_CLEAR_SCORES[tier] * level;
  score += points; // uses the level before this clear raises it
  lines += cleared;
  level = startLevel + Math.floor(lines / 10);
  dropInterval = intervalForLevel(level);

  const items = [];
  if (tspin) items.push({ text: `T-SPIN ${CLEAR_NAMES[tier]}`, color: '#ba68c8' });
  else if (tier >= 2) items.push({ text: CLEAR_NAMES[tier], color: tier === 4 ? '#4dd0e1' : '#e0e0e0' });
  if (b2bBonus) items.push({ text: 'BACK-TO-BACK x1.5', color: '#ffd54f' });
  if (combo >= 2) items.push({ text: `COMBO x${combo}`, color: '#ffb74d' });
  if (perfect) items.push({ text: 'PERFECT CLEAR!', color: '#81c784' });
  if (tier === 4) {
    rewardPending = true;
    items.push({ text: 'BONUS: 1x1', color: COLORS[SINGLE] });
  }
  powerProgress += cleared; // a big clear can leave a remainder >= POWERUP_EVERY: it pays out on the next clear
  if (powerProgress >= POWERUP_EVERY) {
    powerProgress -= POWERUP_EVERY;
    powerPending = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
    items.push({ text: `POWER-UP: ${POWER_NAMES[powerPending]}`, color: COLORS[powerPending] });
  }
  items.push({ text: `+${points}` });
  announce(items);
  if (perfect) triggerFlash('#81c784');
  else if (difficult) triggerFlash(tspin ? '#ba68c8' : '#4dd0e1');
  playClearSound(tier, combo, tspin, perfect);
  updateHUD();
}

// ---- Power-ups ----
function isPower(type) {
  return type >= BOMB && type <= FREEZE;
}

// Pieces fall column by column until no block has a hole beneath it.
function compactBoard() {
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = ROWS - 1; r >= 0; r--) if (board[r][c]) col.push(board[r][c]);
    for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) board[r][c] = col[i] || 0;
  }
}

// Turns every block of `target` into a wildcard. Without a usable target (empty cell or a wildcard)
// it picks the most common color on the board (ties: lowest index). No blocks: nothing happens.
function tintBoard(target) {
  if (!target || target === WILD) {
    const count = {};
    for (const row of board) for (const v of row) if (v && v !== WILD) count[v] = (count[v] || 0) + 1;
    target = Number(Object.keys(count).sort((a, b) => count[b] - count[a] || a - b)[0]);
  }
  if (!target) return;
  for (const row of board)
    for (let c = 0; c < COLS; c++) if (row[c] === target) row[c] = WILD;
}

// Fires the effect around the cell the 1x1 piece rests on (the floor row if there is no block beneath).
// The piece itself is never merged. Line clears caused by the effect go through clearLines() as usual.
function applyPowerUp(piece) {
  const tx = piece.x;
  const ty = Math.min(piece.y + 1, ROWS - 1);
  let destroyed = 0;
  switch (piece.type) {
    case BOMB:
      for (let r = ty - 1; r <= ty + 1; r++)
        for (let c = tx - 1; c <= tx + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c]) { board[r][c] = 0; destroyed++; }
      break;
    case LIGHTNING_ROW: // collapses like a normal line, but doesn't count as a cleared line
      destroyed = board[ty].filter(Boolean).length;
      board.splice(ty, 1);
      board.unshift(new Array(COLS).fill(0));
      break;
    case LIGHTNING_COL:
      for (let r = 0; r < ROWS; r++) if (board[r][tx]) { board[r][tx] = 0; destroyed++; }
      break;
    case TINT:
      tintBoard(board[ty][tx]);
      break;
    case GRAVITY:
      compactBoard();
      break;
    case FREEZE:
      freezeLeft = FREEZE_MS;
      break;
  }
  const points = destroyed * POWER_POINTS_PER_BLOCK * level;
  score += points;
  const items = [{ text: POWER_NAMES[piece.type], color: COLORS[piece.type] }];
  if (points) items.push({ text: `+${points}` });
  announce(items);
  triggerFlash(COLORS[piece.type]);
  for (const s of POWER_SOUNDS[piece.type]) beep(...s);
}

// ---- Visual effects (drawn on the board canvas) ----
function announce(items) {
  const now = performance.now();
  effects = items.map((it, i) => ({ ...it, born: now, y0: 230 + i * 28 })); // newest event replaces older ones
}

function triggerFlash(color) {
  flash = { color, born: performance.now() };
}

function drawEffects() {
  const now = performance.now();
  effects = effects.filter(e => now - e.born < EFFECT_MS);
  ctx.save();
  if (flash) {
    const age = (now - flash.born) / FLASH_MS;
    if (age >= 1) {
      flash = null;
    } else {
      ctx.globalAlpha = 0.35 * (1 - age);
      ctx.fillStyle = flash.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
  if (freezeLeft > 0) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = COLORS[FREEZE];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    const label = `❄ ${(freezeLeft / 1000).toFixed(1)}s`;
    ctx.strokeText(label, canvas.width / 2, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, canvas.width / 2, 24);
  }
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.font = 'bold 20px system-ui, sans-serif';
  for (const e of effects) {
    const age = (now - e.born) / EFFECT_MS;
    ctx.globalAlpha = 1 - age * age;
    const y = e.y0 - age * 30;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(e.text, canvas.width / 2, y);
    ctx.fillStyle = e.color || '#ffffff';
    ctx.fillText(e.text, canvas.width / 2, y);
  }
  ctx.restore();
}

// ---- Sound (Web Audio, no assets). M toggles mute. ----
let audioCtx = null;
let muted = false;
const NOTES = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880]; // pentatonic; combo climbs it

function beep(freq, delay, dur, type = 'square', vol = 0.05) {
  if (muted) return;
  try {
    if (!audioCtx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) { /* audio unavailable */ }
}

function playClearSound(cleared, comboCount, tspin, perfect) {
  if (perfect) {
    [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.08, 0.2, 'triangle', 0.07));
    return;
  }
  if (!cleared) { // T-spin without lines
    beep(330, 0, 0.1, 'sawtooth');
    beep(440, 0.08, 0.14, 'sawtooth');
    return;
  }
  const root = NOTES[Math.min(Math.max(comboCount - 1, 0), NOTES.length - 4)];
  const ratios = [1, 1.25, 1.5, 2];
  for (let i = 0; i < cleared; i++) beep(root * ratios[i], i * 0.07, 0.12);
  if (tspin) beep(root * 2.5, cleared * 0.07, 0.2, 'sawtooth');
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy !== current.y) lastMoveRotate = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = isTSpin(); // must be evaluated before the piece is merged
  if (isPower(current.type)) applyPowerUp(current);
  else merge();
  clearLines(tspin);
  spawn();
}

function spawn() {
  current = next;
  if (rewardPending) {
    next = makePiece(SINGLE); // queued after the piece the player already saw
    rewardPending = false;
  } else if (powerPending) { // if both are pending, the 1x1 goes first and the power-up on the following spawn
    next = makePiece(powerPending);
    powerPending = null;
  } else {
    next = randomPiece();
  }
  canHold = true;
  lastMoveRotate = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  drawHold();
}

// Stash the active piece; swap with the held one if any. Once per piece.
function holdPiece() {
  if (!canHold) return;
  const type = current.type;
  if (hold === null) {
    hold = type;
    spawn(); // takes `next`; may call endGame()
  } else {
    current = makePiece(hold);
    hold = type;
    if (collide(current.shape, current.x, current.y)) endGame();
  }
  canHold = false;
  lastMoveRotate = false;
  dropAccum = 0; // the new piece doesn't inherit the old piece's drop progress
  drawHold();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo >= 2 ? `x${combo}` : '–';
  b2bEl.hidden = !b2b;
  powerEl.textContent = `${powerProgress}/${POWERUP_EVERY}`;
}

// ---- Skins: a palette (indexed like BASE_COLORS) plus a function that paints one block ----
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(hex, target, t) {
  const a = hexToRgb(hex), b = hexToRgb(target);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function derivePalette(fn) {
  return BASE_COLORS.map(c => (c ? fn(c) : c));
}

function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Each block function sets its own globalAlpha and must leave no shadow/stroke state behind.
function retroBlock(c, x, y, size, color, alpha) {
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  c.fillStyle = 'rgba(255,255,255,0.12)'; // highlight
  c.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function neonBlock(c, x, y, size, color, alpha) {
  const px = x * size + 2, py = y * size + 2, s = size - 4;
  c.save();
  c.shadowColor = color;
  c.shadowBlur = 10;
  c.globalAlpha = alpha * 0.3;
  c.fillStyle = color;
  c.fillRect(px, py, s, s);
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(px, py, s, s);
  c.restore();
}

function pastelBlock(c, x, y, size, color, alpha) {
  const px = x * size + 1, py = y * size + 1, s = size - 2, r = Math.max(2, Math.round(size * 0.28));
  c.globalAlpha = alpha;
  c.fillStyle = color;
  roundRectPath(c, px, py, s, s, r);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)'; // soft highlight
  roundRectPath(c, px + 3, py + 3, s - 6, Math.max(2, s * 0.25), r / 2);
  c.fill();
}

// Deterministic texture (no randomness per frame): lit top/left edge, shaded bottom/right, light checker inside.
function pixelBlock(c, x, y, size, color, alpha) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  const u = Math.max(1, Math.floor(s / 5)), cells = Math.floor(s / u);
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.fillRect(px, py, s, s);
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      let shade = null;
      if (i === 0 || j === 0) shade = 'rgba(255,255,255,0.40)';
      else if (i === cells - 1 || j === cells - 1) shade = 'rgba(0,0,0,0.35)';
      else if ((i + j) % 2 === 0) shade = 'rgba(0,0,0,0.10)';
      if (shade) {
        c.fillStyle = shade;
        c.fillRect(px + i * u, py + j * u, u, u);
      }
    }
  }
}

const DEFAULT_SKIN = 'retro';
const SKINS = {
  retro: { label: 'Retro', colors: BASE_COLORS, block: retroBlock },
  neon: { label: 'Neon', colors: derivePalette(c => mixHex(c, '#ffffff', 0.2)), block: neonBlock },
  pastel: { label: 'Pastel', colors: derivePalette(c => mixHex(c, '#ffffff', 0.5)), block: pastelBlock },
  pixel: { label: 'Pixel art', colors: BASE_COLORS, block: pixelBlock },
};
let skinName = DEFAULT_SKIN;

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  SKINS[skinName].block(context, x, y, size, COLORS[colorIndex], alpha ?? 1);
  const glyph = GLYPHS[colorIndex];
  if (glyph) { // power-ups and wildcards: outlined block with a symbol
    context.save();
    context.strokeStyle = colorIndex === WILD ? '#555555' : '#ffffff';
    context.lineWidth = 2;
    context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
    context.font = `bold ${Math.floor(size * 0.6)}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = colorIndex === WILD ? '#333333' : '#ffffff';
    context.fillText(glyph, x * size + size / 2, y * size + size / 2 + 1);
    context.restore();
  }
  context.globalAlpha = 1;
}

let gridColor = '#22222e'; // overwritten from the --grid CSS variable by applyTheme()

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawEffects();
}

// Draws a piece centered in a 4x4 grid of 30px blocks (used by NEXT and HOLD canvases).
function drawPreview(context, cnv, shape, alpha) {
  const NB = 30;
  context.clearRect(0, 0, cnv.width, cnv.height);
  if (!shape) return;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB, alpha);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next.shape);
}

// Dimmed while hold is locked for the current piece.
function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold === null ? null : PIECES[hold], canHold ? 1 : 0.3);
}

// One overlay, several panels: 'start' | 'gameover' | 'pause' | 'controls'
function showOverlay(mode) {
  overlay.classList.remove('hidden');
  overlayTitle.textContent = { start: 'RECORDS', gameover: 'GAME OVER', pause: 'PAUSA', controls: 'CONTROLES' }[mode];
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayScore.hidden = mode !== 'gameover' && mode !== 'pause';
  pauseMenu.hidden = mode !== 'pause';
  controlsPanel.hidden = mode !== 'controls';
  recordsPanel.hidden = mode !== 'start' && mode !== 'gameover';
  resetRecordsBtn.hidden = recordsPanel.hidden;
  startBtn.hidden = mode !== 'start';
  restartBtn.hidden = mode !== 'gameover';
  nameForm.hidden = mode !== 'gameover' || !pendingEntry;
  if (!recordsPanel.hidden) renderRecords();
  if (!nameForm.hidden) {
    newRecordMsg.textContent = rankFor(pendingEntry.score) === 0 ? '¡NUEVO RECORD!' : `¡ENTRAS EN EL TOP ${MAX_RECORDS}!`;
    nameInput.value = loadName();
    nameInput.focus();
    if (nameInput.select) nameInput.select();
  }
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  finishRun();
  showOverlay('gameover');
  draw(); // paint the final state (also when the game ends from a key press)
}

// Start screen: a fresh game is built (so draw() has something to paint) but the loop stays stopped.
function showStart() {
  init();
  cancelAnimationFrame(animId);
  idle = true;
  draw();
  showOverlay('start');
  startBtn.focus();
}

function togglePause() {
  if (gameOver || idle) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // Space must not re-click a menu button
    lastTime = performance.now();
    inputLockUntil = lastTime + RESUME_LOCK_MS;
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showOverlay('pause');
    resumeBtn.focus();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0; // gravity is suspended while frozen; manual moves still work
  } else {
    dropAccum += dt;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return; // endGame() ran during this frame; don't reschedule the loop
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  idle = false;
  maxCombo = 0;
  pendingEntry = null;
  lastRank = -1;
  dropInterval = intervalForLevel(level);
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  combo = 0;
  b2b = false;
  effects = [];
  flash = null;
  rewardPending = false;
  powerProgress = 0;
  powerPending = null;
  freezeLeft = 0;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if ((tag === 'INPUT' || tag === 'TEXTAREA') && e.code !== 'Escape') return; // typing: no global shortcuts
  if (tag === 'SELECT' && !['Escape', 'KeyP', 'KeyM'].includes(e.code)) return; // arrows/space belong to the dropdown
  if (e.code === 'Escape') {
    if (paused && !controlsPanel.hidden) showOverlay('pause'); // close the controls panel first
    else togglePause();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyM') { setMuted(!muted); return; }
  if (paused || gameOver || idle) return;
  if (performance.now() < inputLockUntil) return;
  switch (e.code) {
    case 'ArrowLeft':
      moveHorizontal(-1);
      break;
    case 'ArrowRight':
      moveHorizontal(1);
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { commitPending(); restartBtn.blur(); init(); }); // never lose an unsaved record
startBtn.addEventListener('click', () => { startBtn.blur(); init(); });
pauseRestartBtn.addEventListener('click', () => { pauseRestartBtn.blur(); init(); });
resumeBtn.addEventListener('click', togglePause);
controlsBtn.addEventListener('click', () => { showOverlay('controls'); controlsBackBtn.focus(); });
controlsBackBtn.addEventListener('click', () => { showOverlay('pause'); controlsBtn.focus(); });

// ---- Start level (applies to the next game; persisted) ----
function setStartLevel(value) {
  const n = Math.floor(Number(value));
  startLevel = Number.isFinite(n) ? Math.min(MAX_START_LEVEL, Math.max(1, n)) : 1;
  startLevelSelect.value = String(startLevel);
  try { localStorage.setItem('startLevel', String(startLevel)); } catch (e) { /* storage unavailable */ }
}

for (let i = 1; i <= MAX_START_LEVEL; i++) {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = String(i);
  startLevelSelect.append(opt);
}
startLevelSelect.addEventListener('change', () => setStartLevel(startLevelSelect.value));

try { setStartLevel(localStorage.getItem('startLevel') || 1); } catch (e) { setStartLevel(1); }

// ---- Records (localStorage) ----
function defaultRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function sanitizeName(raw) {
  return String(raw).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX) || 'ANÓNIMO';
}

// Reads and validates stored records: corrupt or hand-edited data falls back to defaults / is dropped.
function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!raw || typeof raw !== 'object') return defaultRecords();
    const nat = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const top = (Array.isArray(raw.top) ? raw.top : [])
      .filter(e => e && typeof e === 'object' && Number.isFinite(e.score) && e.score > 0)
      .map(e => ({
        name: sanitizeName(typeof e.name === 'string' ? e.name : ''),
        score: Math.floor(e.score),
        lines: nat(e.lines),
        level: Math.max(1, nat(e.level)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
    return { top, bestCombo: nat(raw.bestCombo), maxLines: nat(raw.maxLines) };
  } catch (e) {
    return defaultRecords();
  }
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) { /* storage unavailable */ }
}

function loadName() {
  try {
    return String(localStorage.getItem(NAME_KEY) || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX);
  } catch (e) {
    return '';
  }
}

// Position a score would take in the top (ties go after existing equal scores), or -1 if it doesn't make it.
function rankFor(points) {
  if (!(points > 0)) return -1;
  const i = records.top.findIndex(e => points > e.score);
  if (i !== -1) return i;
  return records.top.length < MAX_RECORDS ? records.top.length : -1;
}

// Game over: persist the personal bests and queue the result if it makes the top (it needs a name).
function finishRun() {
  if (maxCombo > records.bestCombo) records.bestCombo = maxCombo;
  if (lines > records.maxLines) records.maxLines = lines;
  saveRecords();
  pendingEntry = rankFor(score) !== -1 ? { score, lines, level } : null;
  lastRank = -1;
}

function commitPending() {
  if (!pendingEntry) return;
  const entry = { name: sanitizeName(nameInput.value), ...pendingEntry };
  pendingEntry = null;
  const rank = rankFor(entry.score);
  if (rank !== -1) {
    records.top.splice(rank, 0, entry);
    records.top.length = Math.min(records.top.length, MAX_RECORDS);
    lastRank = rank;
    saveRecords();
    try { localStorage.setItem(NAME_KEY, entry.name); } catch (e) { /* storage unavailable */ }
  }
  nameForm.hidden = true;
  renderRecords();
  restartBtn.focus();
}

function renderRecords() {
  recordsList.replaceChildren();
  if (!records.top.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin records todavía';
    recordsList.append(li);
  }
  records.top.forEach((entry, i) => {
    const li = document.createElement('li');
    if (i === lastRank) li.className = 'highlight';
    const cells = [String(i + 1), entry.name, entry.score.toLocaleString()];
    for (const text of cells) {
      const span = document.createElement('span');
      span.textContent = text; // textContent only: names come from user input
      li.append(span);
    }
    li.title = `${entry.lines} líneas · nivel ${entry.level}`;
    recordsList.append(li);
  });
  const combo = records.bestCombo >= 2 ? `x${records.bestCombo}` : '–';
  recordsBest.textContent = `Mejor combo: ${combo} · Máx. líneas: ${records.maxLines}`;
}

nameForm.addEventListener('submit', e => { e.preventDefault(); commitPending(); });
resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBtn.blur();
  if (!confirm('¿Borrar todos los records, el mejor combo y las líneas máximas?')) return;
  records = defaultRecords();
  lastRank = -1;
  saveRecords();
  renderRecords();
});

records = loadRecords();

// The controls list in the menu mirrors the side panel (single source of truth in index.html)
const sideControls = document.querySelector('.panel .controls ul');
if (sideControls) controlsList.append(sideControls.cloneNode(true));

// ---- Mute (persisted like the theme) ----
function setMuted(value) {
  muted = value;
  try { localStorage.setItem('muted', value ? '1' : '0'); } catch (e) { /* storage unavailable */ }
}

try { muted = localStorage.getItem('muted') === '1'; } catch (e) { /* ignore */ }

// ---- Theme (dark by default, light via toggle) ----
const themeToggle = document.getElementById('theme-toggle');

function refreshGridColor() {
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  refreshGridColor();
  if (current) draw(); // repaint even while paused
}

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(theme);
  try { localStorage.setItem('theme', theme); } catch (e) { /* storage unavailable */ }
  themeToggle.blur(); // keep keyboard focus on the game (Space = hard drop)
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

// ---- Skin (retro by default; applied without reloading) ----
const skinSelect = document.getElementById('skin-select');
for (const [name, skin] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = skin.label;
  skinSelect.append(opt);
}

function applySkin(name) {
  skinName = Object.prototype.hasOwnProperty.call(SKINS, name) ? name : DEFAULT_SKIN; // own keys only: 'constructor' etc. are invalid
  COLORS = SKINS[skinName].colors;
  document.documentElement.dataset.skin = skinName;
  skinSelect.value = skinName;
  refreshGridColor(); // the skin can override --canvas-bg / --grid in CSS
  if (current) { draw(); drawNext(); drawHold(); } // repaint everything, also while paused
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem('skin', skinName); } catch (e) { /* storage unavailable */ }
  skinSelect.blur(); // keep keyboard focus on the game
});

let savedSkin = null;
try { savedSkin = localStorage.getItem('skin'); } catch (e) { /* ignore */ }
applySkin(savedSkin);

showStart();
