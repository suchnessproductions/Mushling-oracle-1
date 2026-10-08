// Mushling Match — flip-and-pair memory game, 10 levels.
// Levels 1-3 are free; the rest need the full deck (which also widens the
// portrait pool from the 13 free cards to all 49).

// Tiles carry a portrait + a name caption, so columns stay low until the
// deck gets big; the last levels go to 6 columns and scroll.
const MATCH_LEVELS = [
  { level: 1, cols: 3, pairs: 3 },
  { level: 2, cols: 4, pairs: 4 },
  { level: 3, cols: 4, pairs: 6 },
  { level: 4, cols: 4, pairs: 8 },
  { level: 5, cols: 5, pairs: 10 },
  { level: 6, cols: 6, pairs: 12 },
  { level: 7, cols: 6, pairs: 15 },
  { level: 8, cols: 6, pairs: 18 },
  { level: 9, cols: 6, pairs: 21 },
  { level: 10, cols: 6, pairs: 24 },
];
// Testing switch: true lets any level be chosen with the arrows and ignores the free-tier lock.
// Set to false to restore progress-gated levels.
const LEVELS_OPEN = true;
const MATCH_FREE_LEVELS = 3;
const MATCH_KEY = 'mushling.matchReached';

const match = {
  levelIndex: 0,
  tiles: [],       // { cardNumber, matched }
  flipped: [],     // indices currently face-up, max 2
  moves: 0,
  locked: false,
};

function matchCardPool() {
  return MUSHLING_CARDS.filter(c => state.unlocked || c.isFree).map(c => c.number);
}

function startMatchLevel(levelIndex) {
  match.levelIndex = Math.max(0, Math.min(levelIndex, MATCH_LEVELS.length - 1));
  const cfg = MATCH_LEVELS[match.levelIndex];
  if (match.levelIndex > gameStore.get(MATCH_KEY, 0)) gameStore.set(MATCH_KEY, match.levelIndex);
  const locked = !LEVELS_OPEN && !state.unlocked && match.levelIndex >= MATCH_FREE_LEVELS;
  document.getElementById('match-locked').style.display = locked ? 'flex' : 'none';
  document.getElementById('match-grid').style.display = locked ? 'none' : '';
  if (locked) {
    match.tiles = []; match.flipped = []; match.moves = 0; match.locked = false;
    refreshMatchLabels();
    document.getElementById('match-win').style.display = 'none';
    return;
  }
  const chosen = sample(matchCardPool(), cfg.pairs);
  const pairDeck = sample(chosen.concat(chosen), chosen.length * 2); // shuffled
  match.tiles = pairDeck.map(n => ({ cardNumber: n, matched: false }));
  match.flipped = [];
  match.moves = 0;
  match.locked = false;

  refreshMatchLabels();
  document.getElementById('match-win').style.display = 'none';
  renderMatchGrid(cfg.cols);
}

// level / moves labels, re-drawn on a language change too
function refreshMatchLabels() {
  const cfg = MATCH_LEVELS[match.levelIndex];
  document.getElementById('match-level-label').textContent = t('matchLevel', { level: cfg.level });
  document.getElementById('match-moves-label').textContent = t('matchMoves', { moves: match.moves });
  document.getElementById('match-locked-text').textContent = t('matchLocked', { from: MATCH_FREE_LEVELS + 1, to: MATCH_LEVELS.length });
  const reached = Math.min(gameStore.get(MATCH_KEY, 0), MATCH_LEVELS.length - 1);
  document.getElementById('match-prev').disabled = match.levelIndex <= 0;
  document.getElementById('match-fwd').disabled = match.levelIndex >= (LEVELS_OPEN ? MATCH_LEVELS.length - 1 : reached);
  if (document.getElementById('match-win').style.display !== 'none') {
    const last = match.levelIndex === MATCH_LEVELS.length - 1;
    document.getElementById('match-win-text').textContent = t('matchWin', { level: cfg.level, moves: match.moves }) + (last ? ' ' + t('matchAllDone') : '');
    document.getElementById('match-next-level').textContent = last ? t('walkAgain') : t('matchNextLevel');
  }
}

function renderMatchGrid(cols) {
  const grid = document.getElementById('match-grid');
  grid.dataset.baseCols = cols;
  grid.innerHTML = '';
  match.tiles.forEach((tile, i) => {
    const el = document.createElement('div');
    el.className = 'match-tile';
    el.dataset.index = i;
    el.innerHTML = `<div class="tile-back">🍄</div>`;
    el.addEventListener('click', () => flipMatchTile(i));
    grid.appendChild(el);
  });
  fitMatchGrid();
}

// Size the board so it fits the visible screen with no scrolling: pick the column
// count that gives the biggest 3:4 tiles whose rows still fit the available height.
function fitMatchGrid() {
  const grid = document.getElementById('match-grid');
  const sc = grid.closest('.screen-content');
  const n = grid.children.length;
  if (!n) return;
  const gap = 5, winReserve = 66, bottomPad = 80;
  const vh = window.innerHeight;
  const top = grid.offsetParent && grid.getBoundingClientRect().top > 0 ? grid.getBoundingClientRect().top : 128;
  const availH = Math.max(160, vh - top - bottomPad - winReserve);
  const availW = Math.min(380, Math.max(200, (sc && sc.clientWidth ? sc.clientWidth - 36 : window.innerWidth - 36)));
  const base = parseInt(grid.dataset.baseCols, 10) || 3;
  let best = null;
  for (let c = base; c <= 12; c++) {
    const rows = Math.ceil(n / c);
    const w = Math.min(120, Math.floor((availW - (c - 1) * gap) / c));
    const h = w * 4 / 3;
    if (rows * h + (rows - 1) * gap <= availH && (!best || w > best.w)) best = { c, w };
  }
  if (!best) { // nothing fits at 3:4: take the widest-column option and squash the height
    const c = 12, w = Math.floor((availW - (c - 1) * gap) / c);
    best = { c, w, squash: true };
  }
  grid.style.gap = gap + 'px';
  grid.style.gridTemplateColumns = `repeat(${best.c}, ${best.w}px)`;
  grid.style.justifyContent = 'center';
  grid.style.setProperty('--tile-w', best.w + 'px');
  grid.classList.toggle('tiny', best.w < 70);
  grid.classList.toggle('dense', best.w < 100);
}
window.addEventListener('resize', () => { if (document.getElementById('match-grid').offsetParent) fitMatchGrid(); });

function flipMatchTile(i) {
  const tile = match.tiles[i];
  if (match.locked || tile.matched || match.flipped.includes(i)) return;

  const el = document.querySelector(`#match-grid [data-index="${i}"]`);
  const card = cardByNumber(tile.cardNumber);
  el.innerHTML = `<div class="tile-face"><img src="${card.img}" alt="${cardText(card, 'name')}"><div class="tile-name">${cardText(card, 'name')}</div></div>`;
  match.flipped.push(i);

  if (match.flipped.length === 2) {
    match.moves++;
    refreshMatchLabels();
    const [a, b] = match.flipped;
    if (match.tiles[a].cardNumber === match.tiles[b].cardNumber) {
      match.tiles[a].matched = true;
      match.tiles[b].matched = true;
      document.querySelector(`#match-grid [data-index="${a}"]`).classList.add('matched');
      document.querySelector(`#match-grid [data-index="${b}"]`).classList.add('matched');
      match.flipped = [];
      checkMatchWin();
    } else {
      match.locked = true;
      setTimeout(() => {
        [a, b].forEach(idx => {
          document.querySelector(`#match-grid [data-index="${idx}"]`).innerHTML = `<div class="tile-back">🍄</div>`;
        });
        match.flipped = [];
        match.locked = false;
      }, 700);
    }
  }
}

function checkMatchWin() {
  if (match.tiles.every(t => t.matched)) {
    const cfg = MATCH_LEVELS[match.levelIndex];
    const last = match.levelIndex === MATCH_LEVELS.length - 1;
    document.getElementById('match-win').style.display = 'flex';
    document.getElementById('match-win-text').textContent = t('matchWin', { level: cfg.level, moves: match.moves }) + (last ? ' ' + t('matchAllDone') : '');
    document.getElementById('match-next-level').textContent = last ? t('walkAgain') : t('matchNextLevel');
  }
}

document.getElementById('match-next-level').addEventListener('click', () => {
  startMatchLevel(match.levelIndex === MATCH_LEVELS.length - 1 ? 0 : match.levelIndex + 1);
});
document.getElementById('match-prev').addEventListener('click', () => startMatchLevel(match.levelIndex - 1));
document.getElementById('match-fwd').addEventListener('click', () => startMatchLevel(match.levelIndex + 1));

// Open at the furthest level reached whenever the Match screen is opened via the hub tile.
document.querySelector('[data-nav="screen-match"]').addEventListener('click', () => {
  startMatchLevel(Math.min(gameStore.get(MATCH_KEY, 0), MATCH_LEVELS.length - 1));
});
