// Mushling Match — flip-and-pair memory game.
// Prototype scope: levels 1-3 only (the free tier), using the 13 free cards as art.

// Fewer columns than you'd think — these tiles carry a portrait + a name
// caption, not just a color or a symbol, so they need real size to read at
// a glance. 4 columns on a phone-width screen made them too small to use.
const MATCH_LEVELS = [
  { level: 1, cols: 2, pairs: 3 },
  { level: 2, cols: 3, pairs: 4 },
  { level: 3, cols: 3, pairs: 6 },
];

const match = {
  levelIndex: 0,
  tiles: [],       // { cardNumber, matched }
  flipped: [],     // indices currently face-up, max 2
  moves: 0,
  locked: false,
};

function freeCardPool() {
  return MUSHLING_CARDS.filter(c => c.isFree).map(c => c.number);
}

function startMatchLevel(levelIndex) {
  match.levelIndex = levelIndex % MATCH_LEVELS.length;
  const cfg = MATCH_LEVELS[match.levelIndex];
  const chosen = sample(freeCardPool(), cfg.pairs);
  const pairDeck = sample(chosen.concat(chosen), chosen.length * 2); // shuffled
  match.tiles = pairDeck.map(n => ({ cardNumber: n, matched: false }));
  match.flipped = [];
  match.moves = 0;
  match.locked = false;

  document.getElementById('match-level-label').textContent = `Level ${cfg.level}`;
  document.getElementById('match-moves-label').textContent = 'Moves: 0';
  document.getElementById('match-win').style.display = 'none';
  renderMatchGrid(cfg.cols);
}

function renderMatchGrid(cols) {
  const grid = document.getElementById('match-grid');
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = '';
  match.tiles.forEach((tile, i) => {
    const el = document.createElement('div');
    el.className = 'match-tile';
    el.dataset.index = i;
    el.innerHTML = `<div class="tile-back">🍄</div>`;
    el.addEventListener('click', () => flipMatchTile(i));
    grid.appendChild(el);
  });
}

function flipMatchTile(i) {
  const tile = match.tiles[i];
  if (match.locked || tile.matched || match.flipped.includes(i)) return;

  const el = document.querySelector(`#match-grid [data-index="${i}"]`);
  const card = cardByNumber(tile.cardNumber);
  el.innerHTML = `<div class="tile-face"><img src="${card.img}" alt="${card.name}"><div class="tile-name">${card.name}</div></div>`;
  match.flipped.push(i);

  if (match.flipped.length === 2) {
    match.moves++;
    document.getElementById('match-moves-label').textContent = `Moves: ${match.moves}`;
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
    document.getElementById('match-win-text').textContent =
      `Level ${cfg.level} solved in ${match.moves} moves!`;
    document.getElementById('match-win').style.display = 'block';
  }
}

document.getElementById('match-next-level').addEventListener('click', () => {
  startMatchLevel(match.levelIndex + 1);
});

// Start/restart level 1 whenever the Match screen is opened via the hub tile.
document.querySelector('[data-nav="screen-match"]').addEventListener('click', () => {
  startMatchLevel(0);
});
