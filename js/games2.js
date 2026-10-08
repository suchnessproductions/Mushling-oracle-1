// The four other mini-games: Which Mushling Are You?, Grow the Garden,
// Walk Mushling Home and Firefly Catch. Strings live in strings.js (and each language pack).

// ---------- small shared helpers ----------
const gameStore = {
  mem: {},
  get(key, fallback) {
    try { const v = localStorage.getItem(key); if (v !== null) return JSON.parse(v); } catch (e) { /* use memory */ }
    return key in this.mem ? this.mem[key] : fallback;
  },
  set(key, value) {
    this.mem[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* in-memory only */ }
  },
};
function gameScreenActive(id) {
  const el = document.getElementById(id);
  return !!(el && el.classList.contains('active'));
}
function gamePool() {
  return state.unlocked ? MUSHLING_CARDS : MUSHLING_CARDS.filter(c => c.isFree);
}

// ======================================================================
// Which Mushling Are You?
// ======================================================================
const QUIZ_DIMS = ['brave', 'gentle', 'curious', 'creative', 'steady', 'playful', 'wise'];
// Each card's leading trait. Seven questions, four answers each; every answer adds a point to one trait.
const QUIZ_TRAIT_OF_CARD = {
  1: 'brave', 6: 'brave', 16: 'brave', 21: 'brave', 25: 'brave', 27: 'brave', 29: 'brave', 44: 'brave',
  5: 'gentle', 11: 'gentle', 22: 'gentle', 28: 'gentle', 36: 'gentle', 37: 'gentle', 43: 'gentle',
  8: 'curious', 12: 'curious', 24: 'curious', 26: 'curious', 33: 'curious', 39: 'curious', 42: 'curious',
  2: 'creative', 10: 'creative', 13: 'creative', 14: 'creative', 15: 'creative', 19: 'creative', 46: 'creative',
  3: 'steady', 7: 'steady', 9: 'steady', 17: 'steady', 30: 'steady', 34: 'steady', 47: 'steady',
  18: 'playful', 20: 'playful', 23: 'playful', 31: 'playful', 32: 'playful', 40: 'playful', 45: 'playful',
  4: 'wise', 35: 'wise', 38: 'wise', 41: 'wise', 48: 'wise', 49: 'wise',
};
// the trait each answer (a, b, c, d) points to, per question
const QUIZ_ANSWERS = [
  ['brave', 'gentle', 'curious', 'creative'],
  ['steady', 'playful', 'wise', 'brave'],
  ['playful', 'wise', 'creative', 'gentle'],
  ['gentle', 'steady', 'curious', 'brave'],
  ['steady', 'curious', 'playful', 'creative'],
  ['brave', 'gentle', 'wise', 'playful'],
  ['curious', 'creative', 'steady', 'wise'],
];
const quiz = { i: 0, scores: {}, done: false, trait: null, card: null };
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

function startQuiz() {
  quiz.i = 0; quiz.done = false; quiz.trait = null; quiz.card = null;
  quiz.scores = {}; QUIZ_DIMS.forEach(d => { quiz.scores[d] = 0; });
  renderQuiz();
}
function renderQuiz() {
  const qv = document.getElementById('quiz-question-view');
  const rv = document.getElementById('quiz-result-view');
  if (quiz.done) {
    qv.style.display = 'none'; rv.style.display = 'block';
    const card = quiz.card;
    document.getElementById('quiz-result-intro').textContent = t('quizResultIntro');
    const img = document.getElementById('quiz-result-img');
    img.src = card.img; img.alt = cardText(card, 'name');
    document.getElementById('quiz-result-name').textContent = cardText(card, 'name');
    document.getElementById('quiz-result-trait').textContent = t('quizTrait' + cap1(quiz.trait)) + ' — ' + t('quizTrait' + cap1(quiz.trait) + 'Line');
    document.getElementById('quiz-result-message').textContent = '“' + cardText(card, 'message') + '”';
    return;
  }
  qv.style.display = 'block'; rv.style.display = 'none';
  const n = quiz.i + 1, total = QUIZ_ANSWERS.length;
  document.getElementById('quiz-progress-label').textContent = t('quizProgress', { n, total });
  document.getElementById('quiz-bar-fill').style.width = ((n - 1) / total * 100) + '%';
  document.getElementById('quiz-q').textContent = t('quizQ' + n);
  const box = document.getElementById('quiz-options');
  box.innerHTML = '';
  QUIZ_ANSWERS[quiz.i].forEach((trait, k) => {
    const b = document.createElement('button');
    b.className = 'quiz-option';
    b.textContent = t('quizQ' + n + 'abcd'[k]);
    b.addEventListener('click', () => answerQuiz(trait));
    box.appendChild(b);
  });
}
function answerQuiz(trait) {
  quiz.scores[trait]++;
  quiz.i++;
  if (quiz.i < QUIZ_ANSWERS.length) { renderQuiz(); return; }
  const top = Math.max(...QUIZ_DIMS.map(d => quiz.scores[d]));
  const tied = QUIZ_DIMS.filter(d => quiz.scores[d] === top);
  quiz.trait = tied[Math.floor(Math.random() * tied.length)];
  const pool = gamePool();
  let cands = pool.filter(c => QUIZ_TRAIT_OF_CARD[c.number] === quiz.trait);
  if (!cands.length) cands = pool;
  quiz.card = cands[Math.floor(Math.random() * cands.length)];
  quiz.done = true;
  renderQuiz();
}
document.getElementById('quiz-again').addEventListener('click', startQuiz);
document.querySelector('[data-nav="screen-quiz"]').addEventListener('click', startQuiz);

// ======================================================================
// Grow the Garden
// ======================================================================
const GARDEN_KEY = 'mushlingGarden';
const GARDEN_MAX = 12;
const BLOOMS = ['🌷', '🌻', '🌼', '🌸', '🌺', '🪻', '🍄'];

function gardenToday() {
  if (window.__mushlingToday) return window.__mushlingToday;
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dayNumber(s) { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function loadGarden() { return gardenStore(); }
function gardenStore() {
  const g = gameStore.get(GARDEN_KEY, null);
  return g && Array.isArray(g.plants) ? g : { plants: [], streak: 0, best: 0, last: null };
}
function gardenStreakNow(g) {
  if (!g.last) return 0;
  const gap = dayNumber(gardenToday()) - dayNumber(g.last);
  return gap <= 1 ? g.streak : 0;
}
function plantStage(p) {
  const age = dayNumber(gardenToday()) - dayNumber(p.date);
  return age <= 0 ? 0 : age === 1 ? 1 : age <= 3 ? 2 : 3;
}
function plantEmoji(p) {
  const stage = plantStage(p);
  return stage === 0 ? '🌰' : stage === 1 ? '🌱' : stage === 2 ? '🌿' : BLOOMS[p.card % BLOOMS.length];
}
function renderGarden() {
  const g = gardenStore();
  const today = gardenToday();
  const streak = gardenStreakNow(g);
  document.getElementById('garden-streak').textContent = t('gardenStreak', { count: streak });
  document.getElementById('garden-best').textContent = t('gardenBest', { count: g.best });
  const plantedToday = g.last === today;
  const note = document.getElementById('garden-note');
  note.textContent = plantedToday ? t('gardenPlanted') : g.plants.length === 0 ? t('gardenEmpty') : streak === 0 ? t('gardenWelcomeBack') : t('gardenIntro');
  const btn = document.getElementById('garden-plant-btn');
  btn.textContent = t('gardenPlant');
  btn.disabled = plantedToday;
  const plot = document.getElementById('garden-plot');
  plot.innerHTML = '';
  for (let i = 0; i < GARDEN_MAX; i++) {
    const p = g.plants[i];
    const cell = document.createElement('button');
    cell.className = 'garden-cell' + (p ? ' has-plant' : '');
    if (p) {
      cell.textContent = plantEmoji(p);
      cell.addEventListener('click', () => showPlantDetail(p));
    }
    plot.appendChild(cell);
  }
}
function showPlantDetail(p) {
  const card = cardByNumber(p.card);
  const names = ['gardenSeed', 'gardenSprout', 'gardenLeafy', 'gardenBloom'];
  const el = document.getElementById('garden-detail');
  el.style.display = 'block';
  el.innerHTML = '';
  const h = document.createElement('strong'); h.textContent = plantEmoji(p) + ' ' + t(names[plantStage(p)]) + ' · ' + t('gardenFrom', { card: cardText(card, 'name') });
  const m = document.createElement('p'); m.textContent = '“' + cardText(card, 'message') + '”';
  el.appendChild(h); el.appendChild(m);
}
document.getElementById('garden-plant-btn').addEventListener('click', () => {
  const g = gardenStore();
  const today = gardenToday();
  if (g.last === today) return;
  const gap = g.last ? dayNumber(today) - dayNumber(g.last) : null;
  g.streak = gap === 1 ? g.streak + 1 : 1;
  g.best = Math.max(g.best || 0, g.streak);
  g.last = today;
  const have = new Set(g.plants.map(p => p.card));
  const pool = gamePool();
  const fresh = pool.filter(c => !have.has(c.number));
  const pick = sample(fresh.length ? fresh : pool, 1)[0];
  g.plants.unshift({ card: pick.number, date: today });
  g.plants = g.plants.slice(0, GARDEN_MAX);
  gameStore.set(GARDEN_KEY, g);
  renderGarden();
  showPlantDetail(g.plants[0]);
});
document.querySelector('[data-nav="screen-garden"]').addEventListener('click', () => {
  document.getElementById('garden-detail').style.display = 'none';
  renderGarden();
});

// ======================================================================
// Walk Mushling Home — a sliding maze. Mushling slides until blocked; home stops them too.
// Levels are checked solvable; "min" is the fewest slides.
// ======================================================================
const WALK_LEVELS = [{"rows":[".....",".H...","....#",".##..","...S#"],"min":4},{"rows":["..#..",".....","....S","..#.#",".#..H"],"min":4},{"rows":["...#H",".....",".....","#....",".S.##"],"min":5},{"rows":["#....","##..H","....#",".....","S...."],"min":5},{"rows":["#...#","S....","...H.","...#.",".#..."],"min":6},{"rows":["..#..","..#..",".....","...#S",".H#.."],"min":6},{"rows":[".....","....#",".....","#..#.","S..#H"],"min":6},{"rows":["..#..","....#","...#.","...#H","S#..."],"min":7},{"rows":["....#","....S",".#..#","..H..",".##.."],"min":7},{"rows":[".....","..H#.","#..##",".....","..#S."],"min":8},{"rows":[".....#","...S..","#..#.#","..#...",".H....","..#..#"],"min":8},{"rows":[".#.#S.","....#.","..#...","......",".....#","#..H#."],"min":8},{"rows":["S.#...","......","...#..",".###..",".#..H.",".#...."],"min":9},{"rows":["..#...",".H....","......","#..#..",".##..#","#..S.."],"min":9},{"rows":["#...#.","...#S.","....#.","......","#H#...","..#..."],"min":10},{"rows":[".#S#..","......",".....#","...#..","..#...","##.H.."],"min":10},{"rows":["H##...",".#..S.","..#...","#....#","......","...#.."],"min":11},{"rows":["S....#","#.#..#","...#..","....#.","....H.","..#..."],"min":11},{"rows":["#.#...","......",".....#","###...","..S#H.","......"],"min":11},{"rows":["..##..",".#....","......","..#...",".H.#S#","...#.."],"min":12},{"rows":["S.....#","##..#..","....##.","#.#....",".......","..H#...","...#..."],"min":12},{"rows":[".....##","......#","..#.#..","#....#.",".#.H...",".......","....##S"],"min":13},{"rows":[".....#.","..#....","......#","..H.##.","..###S.",".....#.","..#...."],"min":13},{"rows":["#......","....H#.",".#.##..","#.#...#",".......",".....#.","#....S."],"min":13},{"rows":["#..#..#","...#...","....#..","..#....",".......",".#H....","..#S##."],"min":14},{"rows":[".#.....",".S#....",".##H..#","...#...","#....#.",".#.....","......#"],"min":14},{"rows":[".##..##",".......","......#","#......","S##.H..",".......","..#...#"],"min":15},{"rows":["....#..","#......","......#",".......","##...#.","H...##.","#...#S."],"min":15},{"rows":["...#..#",".#.....","..#S...","#..#.H#",".#..#..","#......",".....#."],"min":15},{"rows":["##...#.","..#....","....#..","S#.#..#","#.#....","H......","...#..."],"min":16},{"rows":[".....#..",".....#H.","...#....","#.......","..#.####","...#..S.",".#...#..","..#..#.."],"min":16},{"rows":[".##.....",".#S.#...",".##.#..#","...#....","........","#.......","H...#...","#.#....#"],"min":17},{"rows":["##......","......#.","....##.S","...##.#.",".......#","#..#....","H##.....","....#..."],"min":17},{"rows":[".....#..","...#....","S##.....",".....#.#","#....#.H","..#.#...",".##....#","....#..."],"min":17},{"rows":["...#....","........","#......#","###....#","..H..##.",".....#S.","...#....","##..#..."],"min":18},{"rows":["..#...H#","S.##..#.",".#..#..#","........","...#....","#.#....#","..#.....","#..#...."],"min":18},{"rows":["#.......","..#.##..","....#...",".......#","##.#....",".H#...##",".#..#...","...#S..."],"min":19},{"rows":["#S..#.H#","....##..","...#....",".##..#.#","..#.....","#.......","...#....","..#.#..."],"min":19},{"rows":["..#....#","......#.","....#...",".#...##.",".....S#.","#.#..#..","...##...","H#.....#"],"min":20},{"rows":["##...#..","..#.H.#.",".#..#...","...#....","..#.....",".....#.#","...#..#.","#...#..S"],"min":20},{"rows":["#H.#..#..","......#..","..#......","##....#..","#...#..#.","#....#...",".#...#...","..#.#....","#.....#.S"],"min":20},{"rows":["..###....",".........","#....#.#.",".#.#.#...",".S#......","..#...###",".#..#....","...#.#...","...#.H..."],"min":21},{"rows":["...#.#..#",".......S.","#.....###","...#.#.#.","..#....H.","#........","...#.....","...#...##","..#.#...#"],"min":21},{"rows":["S.#..#...",".........",".#.....#.","##...#...","....#..##","....#....","..#......","#..##...#",".#H..#..#"],"min":22},{"rows":["....#..#.","..#.#....","....#.#..",".#....#.#",".....#...","..#.#...H","#.#...#..","S#..#...#","....##..."],"min":22},{"rows":["........#","##....#H.","....##.##","#.....##.",".......#.","..#..#...","...#.....",".#..#....","..#.S#..#"],"min":22},{"rows":["...#.#..#",".......#.","#...#.#..",".#.##....","...#...#H","...#....#","....#S#..","#....#...","#..#....."],"min":23},{"rows":["..#...#.S","......H.#","....###..","#.###..#.","#........","...##....","...#...#.","......#..","#..##...."],"min":23},{"rows":["#.#..#..#",".........",".#....#..","#...#....","..#.....#",".#..#...#","..#...#.S","#.H#...#.","...#....#"],"min":24},{"rows":["#.#.S#...","....#..#.","...#..##H",".#..#....","......##.",".#...#..#","..#...#..",".........","...##...#"],"min":24}];
const WALK_FREE_LEVELS = 3;
const WALK_KEY = 'mushling.walkReached';
const walk = { level: 0, rows: [], size: 0, pos: null, home: null, moves: 0, busy: false, won: false };

function startWalk(level) {
  walk.level = level;
  if (level > gameStore.get(WALK_KEY, 0)) gameStore.set(WALK_KEY, level);
  const lv = WALK_LEVELS[level];
  walk.rows = lv.rows; walk.size = lv.rows.length;
  walk.moves = 0; walk.won = false; walk.busy = false;
  walk.pos = null; walk.home = null;
  lv.rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === 'S') walk.pos = [r, c];
    if (ch === 'H') walk.home = [r, c];
  }));
  const locked = !LEVELS_OPEN && !state.unlocked && level >= WALK_FREE_LEVELS;
  document.getElementById('walk-locked').style.display = locked ? 'block' : 'none';
  document.getElementById('walk-locked-text').textContent = t('walkLocked', { from: WALK_FREE_LEVELS + 1, to: WALK_LEVELS.length });
  document.getElementById('walk-board').style.display = locked ? 'none' : '';
  document.querySelector('.walk-pad').style.display = locked ? 'none' : 'grid';
  document.getElementById('screen-walk').classList.remove('walk-won');
  document.getElementById('walk-win').style.display = 'none';
  document.getElementById('walk-next').style.display = 'none';
  renderWalk();
}
function renderWalk() {
  document.getElementById('walk-level-label').textContent = t('walkLevel', { level: walk.level + 1, total: WALK_LEVELS.length });
  document.getElementById('walk-moves-label').textContent = t('walkMoves', { moves: walk.moves });
  document.getElementById('walk-restart').setAttribute('aria-label', t('walkRestart'));
  document.getElementById('walk-prev').disabled = walk.level <= 0;
  document.getElementById('walk-fwd').disabled = walk.level >= (LEVELS_OPEN ? WALK_LEVELS.length - 1 : Math.min(gameStore.get(WALK_KEY, 0), WALK_LEVELS.length - 1));
  if (walk.won) {
    document.getElementById('walk-win-text').textContent = t('walkWin', { moves: walk.moves }) + ' ' + t('walkBestMoves', { best: WALK_LEVELS[walk.level].min });
  }
  const board = document.getElementById('walk-board');
  if (board.style.display === 'none') return;
  board.style.setProperty('--n', walk.size);
  board.innerHTML = '';
  walk.rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const cell = document.createElement('div');
    cell.className = 'walk-cell' + (ch === '#' ? ' rock' : '');
    if (ch === '#') cell.textContent = '🪨';
    if (ch === 'H') { cell.textContent = '🏡'; cell.classList.add('home'); }
    board.appendChild(cell);
  }));
  const p = document.createElement('div');
  p.className = 'walk-player'; p.id = 'walk-player'; p.textContent = '🍄';
  board.appendChild(p);
  placeWalkPlayer(0);
}
function placeWalkPlayer(cells) {
  const p = document.getElementById('walk-player');
  if (!p) return;
  p.style.transitionDuration = (0.07 * Math.max(1, cells)) + 's';
  p.style.left = (walk.pos[1] * 100 / walk.size) + '%';
  p.style.top = (walk.pos[0] * 100 / walk.size) + '%';
}
function walkMove(dir) {
  if (walk.won || walk.busy || !walk.rows.length) return;
  if (document.getElementById('walk-board').style.display === 'none') return;
  const d = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
  let [r, c] = walk.pos, steps = 0;
  for (;;) {
    const nr = r + d[0], nc = c + d[1];
    if (nr < 0 || nc < 0 || nr >= walk.size || nc >= walk.size || walk.rows[nr][nc] === '#') break;
    r = nr; c = nc; steps++;
    if (r === walk.home[0] && c === walk.home[1]) break;
  }
  if (!steps) return;
  walk.pos = [r, c]; walk.moves++; walk.busy = true;
  document.getElementById('walk-moves-label').textContent = t('walkMoves', { moves: walk.moves });
  placeWalkPlayer(steps);
  setTimeout(() => {
    walk.busy = false;
    if (r === walk.home[0] && c === walk.home[1]) walkWon();
  }, 70 * steps + 40);
}
function walkWon() {
  walk.won = true;
  const last = walk.level === WALK_LEVELS.length - 1;
  document.getElementById('walk-win-text').textContent = t('walkWin', { moves: walk.moves }) + ' ' + t('walkBestMoves', { best: WALK_LEVELS[walk.level].min });
  if (last) document.getElementById('walk-win-text').textContent += ' ' + t('walkAllDone');
  document.getElementById('walk-next').textContent = last ? t('walkAgain') : t('walkNext');
  document.getElementById('screen-walk').classList.add('walk-won');
  document.getElementById('walk-win').style.display = 'block';
  document.getElementById('walk-next').style.display = '';
  try { document.getElementById('walk-win').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* older browsers */ }
}
document.querySelectorAll('.walk-pad button').forEach(b => b.addEventListener('click', () => walkMove(b.dataset.dir)));
document.getElementById('walk-restart').addEventListener('click', () => startWalk(walk.level));
function walkStep(d) {
  const reached = gameStore.get(WALK_KEY, 0);
  const to = walk.level + d;
  if (to < 0 || to >= WALK_LEVELS.length || (!LEVELS_OPEN && to > reached)) return;
  startWalk(to);
}
document.getElementById('walk-prev').addEventListener('click', () => walkStep(-1));
document.getElementById('walk-fwd').addEventListener('click', () => walkStep(1));
document.querySelector('[data-nav="screen-walk"]').addEventListener('click', () => {
  startWalk(Math.min(gameStore.get(WALK_KEY, 0), WALK_LEVELS.length - 1));
});
document.getElementById('walk-next').addEventListener('click', () => {
  startWalk(walk.level === WALK_LEVELS.length - 1 ? 0 : walk.level + 1);
});
document.addEventListener('keydown', (e) => {
  if (!gameScreenActive('screen-walk')) return;
  const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
  if (dir) { e.preventDefault(); walkMove(dir); }
});
(function swipe() {
  const board = document.getElementById('walk-board');
  let x0 = 0, y0 = 0;
  board.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  board.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    walkMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { passive: true });
})();

// ======================================================================
// Firefly Catch — tap each firefly near the peak of its glow.
// ======================================================================
const ff = { running: false, flies: [], score: 0, lives: 3, nextSpawn: 0, raf: 0, started: 0, over: false, won: false, level: 0 };
const FF_BEST_KEY = 'mushlingFireflyBest';
const FF_KEY = 'mushling.fireflyReached';
// goal = fireflies to catch; period = ms for one glow cycle; gap = ms between spawns;
// max = fireflies on screen at once; good / perfect = brightness needed (0..1); lives = lights
const FF_LEVELS = [
  { goal: 8,  period: 2400, gap: 1400, max: 3, good: 0.55, perfect: 0.85, lives: 3 },
  { goal: 10, period: 2200, gap: 1250, max: 3, good: 0.60, perfect: 0.86, lives: 3 },
  { goal: 12, period: 2000, gap: 1150, max: 4, good: 0.62, perfect: 0.87, lives: 3 },
  { goal: 14, period: 1800, gap: 1050, max: 4, good: 0.65, perfect: 0.88, lives: 3 },
  { goal: 16, period: 1650, gap: 950,  max: 4, good: 0.68, perfect: 0.89, lives: 3 },
  { goal: 18, period: 1500, gap: 850,  max: 5, good: 0.70, perfect: 0.90, lives: 3 },
  { goal: 20, period: 1350, gap: 750,  max: 5, good: 0.73, perfect: 0.91, lives: 3 },
  { goal: 22, period: 1200, gap: 650,  max: 5, good: 0.76, perfect: 0.92, lives: 3 },
  { goal: 25, period: 1050, gap: 560,  max: 6, good: 0.80, perfect: 0.93, lives: 3 },
  { goal: 30, period: 880,  gap: 430,  max: 6, good: 0.85, perfect: 0.95, lives: 2 },
];
function ffCfg() { return FF_LEVELS[ff.level]; }

function ffLabels() {
  const cfg = ffCfg();
  document.getElementById('ff-level-label').textContent = t('walkLevel', { level: ff.level + 1, total: FF_LEVELS.length });
  document.getElementById('ff-score').textContent = ff.score + ' / ' + cfg.goal;
  document.getElementById('ff-lives').textContent = t('fireflyLives', { lives: '✨'.repeat(Math.max(0, ff.lives)) || '–' });
  document.getElementById('ff-best').textContent = '';
  document.getElementById('ff-prev').disabled = ff.level <= 0;
  document.getElementById('ff-fwd').disabled = ff.level >= FF_LEVELS.length - 1 || (!LEVELS_OPEN && ff.level >= Math.min(gameStore.get(FF_KEY, 0), FF_LEVELS.length - 1));
}
function ffShowOverlay(text, btnText) {
  document.getElementById('ff-overlay-text').textContent = text;
  document.getElementById('ff-start').textContent = btnText;
  document.getElementById('ff-overlay').style.display = 'flex';
}
function ffOverlayForState() {
  if (ff.won) {
    const last = ff.level === FF_LEVELS.length - 1;
    ffShowOverlay(t('fireflyLevelDone', { level: ff.level + 1 }) + (last ? ' ' + t('matchAllDone') : ''), last ? t('walkAgain') : t('matchNextLevel'));
  } else if (ff.over) ffShowOverlay(t('fireflyEnd', { score: ff.score }), t('fireflyAgain'));
  else ffShowOverlay(t('fireflyIntro'), t('fireflyStart'));
}
function ffIdle() {
  cancelAnimationFrame(ff.raf);
  ff.running = false; ff.over = false; ff.won = false; ff.score = 0; ff.lives = ffCfg().lives; ff.flies = [];
  document.querySelectorAll('#ff-field .ff-fly').forEach(n => n.remove());
  ffOverlayForState();
  ffLabels();
}
function ffSetLevel(i) {
  ff.level = Math.max(0, Math.min(i, FF_LEVELS.length - 1));
  if (ff.level > gameStore.get(FF_KEY, 0)) gameStore.set(FF_KEY, ff.level);
  ffIdle();
}
function ffStart() {
  if (ff.won) { ffSetLevel(ff.level === FF_LEVELS.length - 1 ? 0 : ff.level + 1); }
  document.querySelectorAll('#ff-field .ff-fly').forEach(n => n.remove());
  ff.flies = []; ff.score = 0; ff.lives = ffCfg().lives; ff.running = true; ff.over = false; ff.won = false;
  ff.started = performance.now(); ff.nextSpawn = ff.started + 400;
  document.getElementById('ff-overlay').style.display = 'none';
  ffLabels();
  ff.raf = requestAnimationFrame(ffTick);
}
function ffSpawn(now) {
  const field = document.getElementById('ff-field');
  const w = field.clientWidth, h = field.clientHeight;
  const el = document.createElement('button');
  el.className = 'ff-fly';
  const x = 30 + Math.random() * (w - 60), y = 30 + Math.random() * (h - 60);
  el.style.left = x + 'px'; el.style.top = y + 'px';
  const period = ffCfg().period * (0.9 + Math.random() * 0.2);
  const fly = { el, t0: now, period, x, y };
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); ffTap(fly); });
  field.appendChild(el);
  ff.flies.push(fly);
}
function ffBright(fly, now) { return 0.5 - 0.5 * Math.cos(2 * Math.PI * (now - fly.t0) / fly.period); }
function ffTick(now) {
  if (!ff.running) return;
  if (!gameScreenActive('screen-firefly')) { ffIdle(); return; }
  const cfg = ffCfg();
  if (now >= ff.nextSpawn && ff.flies.length < cfg.max) {
    ffSpawn(now);
    ff.nextSpawn = now + cfg.gap + Math.random() * cfg.gap * 0.3;
  }
  ff.flies = ff.flies.filter(f => {
    const age = now - f.t0;
    if (age > f.period * 2) { f.el.remove(); return false; }
    f.el.style.setProperty('--g', ffBright(f, now).toFixed(3));
    return true;
  });
  ff.raf = requestAnimationFrame(ffTick);
}
function ffPop(x, y, text, good) {
  const pop = document.createElement('span');
  pop.className = 'ff-pop-item' + (good ? '' : ' bad');
  pop.textContent = text; pop.style.left = x + 'px'; pop.style.top = y + 'px';
  document.getElementById('ff-pop').appendChild(pop);
  setTimeout(() => pop.remove(), 800);
}
function ffTap(fly) {
  if (!ff.running) return;
  const cfg = ffCfg();
  const b = ffBright(fly, performance.now());
  fly.el.remove();
  ff.flies = ff.flies.filter(f => f !== fly);
  if (b >= cfg.perfect) { ff.score++; ffPop(fly.x, fly.y, t('fireflyPerfect'), true); }
  else if (b >= cfg.good) { ff.score++; ffPop(fly.x, fly.y, t('fireflyGood'), true); }
  else { ff.lives--; ffPop(fly.x, fly.y, t('fireflyMiss'), false); }
  ffLabels();
  if (ff.lives <= 0) ffEnd(false);
  else if (ff.score >= cfg.goal) ffEnd(true);
}
function ffEnd(won) {
  ff.running = false; ff.over = !won; ff.won = !!won;
  cancelAnimationFrame(ff.raf);
  document.querySelectorAll('#ff-field .ff-fly').forEach(n => n.remove());
  ff.flies = [];
  const best = gameStore.get(FF_BEST_KEY, 0);
  if (ff.score > best) gameStore.set(FF_BEST_KEY, ff.score);
  if (won && ff.level + 1 > gameStore.get(FF_KEY, 0) && ff.level + 1 < FF_LEVELS.length) gameStore.set(FF_KEY, ff.level + 1);
  ffOverlayForState();
  ffLabels();
}
document.getElementById('ff-start').addEventListener('click', ffStart);
document.getElementById('ff-prev').addEventListener('click', () => ffSetLevel(ff.level - 1));
document.getElementById('ff-fwd').addEventListener('click', () => ffSetLevel(ff.level + 1));
document.querySelector('[data-nav="screen-firefly"]').addEventListener('click', () => ffSetLevel(Math.min(gameStore.get(FF_KEY, 0), FF_LEVELS.length - 1)));

// ---------- language changes ----------
function refreshGameLabels() {
  if (gameScreenActive('screen-quiz')) renderQuiz();
  if (gameScreenActive('screen-garden')) renderGarden();
  if (gameScreenActive('screen-walk')) { renderWalk(); }
  if (gameScreenActive('screen-firefly')) {
    ffLabels();
    if (!ff.running) ffOverlayForState();
  }
}
