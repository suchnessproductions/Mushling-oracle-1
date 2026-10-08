// The Mushling Oracle — prototype app logic
// Static front-end: no server of its own, no real payments. Sage talks to
// real Claude through the published artifact's `sample` capability (see the
// "sage chat" section below) rather than a backend holding an API key.
// State persists only in memory + a little localStorage (journal, language).

const state = {
  // Prototype default: everything unlocked, so whoever is playing this to
  // review the app sees all of it (stories included) without first having
  // to find the demo toggle. Flip the Settings toggle to preview what a
  // non-paying visitor actually sees.
  unlocked: true,
  lang: 'en',
  reading: null,             // { spreadId, cardNumbers:[...], index:0 }  (spreadId 'gallery' = a Gallery look-up)
  lastFinishedReading: null, // { spreadId, cardNumbers:[...] } — set when a reading is finished; gates Sage
  sageFreeLeft: 5,
  sageUnlockLeft: 300, // matches the real subscribed-tier cap (300/month) — the demo shouldn't run out mid-session
  journal: loadJournal(),
};

// ---------- language ----------
// English lives in strings.js (UI) and data.js (cards, spreads). Every other
// language is one pack in js/i18n/<code>.js, loaded on demand into
// window.MUSHLING_I18N[code] = { meta, ui, sage, spreads, cards }. Anything a
// pack doesn't have falls back to English, so a half-finished pack degrades
// to mixed text rather than breaking.

window.MUSHLING_I18N = window.MUSHLING_I18N || {};
const LANG_KEY = 'mushlingLang';

function langInfo(code) { return MUSHLING_LANGUAGES.find(l => l.code === code) || MUSHLING_LANGUAGES[0]; }
function readyLanguages() { return MUSHLING_LANGUAGES.filter(l => l.ready); }
function pack() { return state.lang === 'en' ? null : window.MUSHLING_I18N[state.lang] || null; }

function loadPack(code) {
  return new Promise((resolve, reject) => {
    if (code === 'en' || window.MUSHLING_I18N[code]) return resolve();
    const s = document.createElement('script');
    s.src = `js/i18n/${code}.js`;
    s.onload = () => (window.MUSHLING_I18N[code] ? resolve() : reject(new Error('empty pack')));
    s.onerror = () => reject(new Error('load failed'));
    document.head.appendChild(s);
  });
}

// UI text: t('progress', {spread, n, total}). Plural entries are objects keyed
// by Intl.PluralRules category and are chosen with vars.count.
function t(key, vars) {
  vars = vars || {};
  const p = pack();
  let v = p && p.ui && p.ui[key] !== undefined ? p.ui[key] : MUSHLING_UI_EN[key];
  if (v === undefined) return key;
  if (v && typeof v === 'object') {
    let cat = 'other';
    try { cat = new Intl.PluralRules(state.lang).select(Number(vars.count)); } catch (e) { /* keep other */ }
    v = v[cat] !== undefined ? v[cat] : v.other;
  }
  return String(v).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

function cardText(card, field) {
  const p = pack();
  const c = p && p.cards && p.cards[card.number];
  return (c && c[field]) || card[field];
}
function spreadText(spread, field) {
  const p = pack();
  const s = p && p.spreads && p.spreads[spread.id];
  return (s && s[field]) || spread[field];
}
function spreadPositions(spread) { return spreadText(spread, 'positions'); }
function spreadMeanings(spread) { return spreadText(spread, 'positionMeanings'); }

function positionLabel(spread, index) {
  const list = spreadPositions(spread);
  return shortPosition((list && list[index]) || '');
}
// "The Moss · What Is" -> "The Moss": only the name part is shown; the meaning lives in the explanation text
function shortPosition(label) { return String(label).split(' · ')[0]; }

function applyStaticText() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}

function dateLocale() { return state.lang; }

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- helpers ----------

function cardByNumber(n) {
  return MUSHLING_CARDS.find(c => c.number === n);
}

function spreadById(id) {
  return MUSHLING_SPREADS.find(s => s.id === id);
}

function isRevealed(card) {
  return state.unlocked || card.isFree;
}

function sample(arr, n) {
  const pool = arr.slice();
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function loadJournal() {
  try {
    return JSON.parse(localStorage.getItem('mushlingJournal') || '[]');
  } catch (e) { return []; }
}

function saveJournalEntry(entry) {
  state.journal.unshift(entry);
  try {
    localStorage.setItem('mushlingJournal', JSON.stringify(state.journal));
  } catch (e) { /* storage unavailable, demo still works in-memory */ }
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- navigation ----------

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.nav === id);
  });
  window.scrollTo(0, 0);

  if (id === 'screen-reading') renderSpreadList();
  if (id === 'screen-gallery') {
    renderGallery();
    if (state.galleryReturn) { document.querySelector('#screen-gallery .screen-content').scrollTop = state.galleryScroll || 0; state.galleryReturn = false; }
  }
  if (id === 'screen-journal') renderJournal();
  if (id === 'screen-sage') renderSageScreen();
  if (id === 'screen-settings') renderLanguagePicker();
}

document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) switchScreen(navBtn.dataset.nav);
});

// ---------- spread picker ----------

let selectedSpreadIdx = 0;

// The three spreads available on the free tier, by id so reordering or
// renaming in data.js can't silently change which ones are free.
const FREE_SPREADS = ['single-spore', 'two-paths', 'original-draw'];
function isSpreadFree(s) { return FREE_SPREADS.includes(s.id); }

function renderSpreadList() {
  const pills = document.getElementById('spread-pills');
  pills.innerHTML = '';
  MUSHLING_SPREADS.forEach((s, idx) => {
    const locked = !isSpreadFree(s) && !state.unlocked;
    const btn = document.createElement('button');
    btn.className = 'spread-pill' + (idx === selectedSpreadIdx ? ' active' : '') + (locked ? ' locked' : '');
    // name on the left, a fixed-width chip on the right (card count, or a lock)
    // so every pill lines up the same way whatever the name's length or language
    btn.innerHTML = `<span class="pill-name">${escapeHtml(spreadText(s, 'name'))}</span><span class="pill-chip">${locked ? '🔒' : s.cardCount}</span>`;
    btn.addEventListener('click', () => {
      selectedSpreadIdx = idx;
      renderSpreadList();
    });
    pills.appendChild(btn);
  });
  renderSpreadDetail();
}

function renderSpreadDetail() {
  const s = MUSHLING_SPREADS[selectedSpreadIdx];
  const locked = !isSpreadFree(s) && !state.unlocked;
  const wrap = document.getElementById('spread-detail');
  wrap.className = 'spread-detail';
  const positions = spreadPositions(s);
  const meanings = spreadMeanings(s);
  wrap.innerHTML = `
    <div class="spread-detail-top">
      <h3>${escapeHtml(spreadText(s, 'name'))}${locked ? ' 🔒' : ''}</h3>
      <span class="spread-count">${escapeHtml(t('cardCount', { count: s.cardCount }))}</span>
    </div>
    <p class="desc">${escapeHtml(spreadText(s, 'longDescription') || spreadText(s, 'description'))}</p>
    <div class="positions">
      ${positions.map((p, i) => `
        <div class="position-row">
          <div class="position-name">${escapeHtml(shortPosition(p))}</div>
          <div class="position-meaning">${escapeHtml(meanings[i] || '')}</div>
        </div>
      `).join('')}
    </div>
    <div class="spread-detail-actions">
      ${locked
        ? `<button class="link-btn" data-nav="screen-settings">${escapeHtml(t('unlockToUse'))}</button>`
        : `<button class="btn-primary" data-draw style="padding:8px 18px;font-size:0.85rem">${escapeHtml(t('drawButton'))}</button>`}
    </div>
  `;
  const drawBtn = wrap.querySelector('[data-draw]');
  if (drawBtn) drawBtn.addEventListener('click', () => startReading(s));
}

function startReading(spread) {
  // in the free tier, a draw should only ever surface cards that are
  // actually revealed — pulling from the full 49 and then blacking out
  // whatever wasn't unlocked turned "draw a card" into "maybe draw a
  // locked mystery card", which isn't a real reading
  const pool = state.unlocked ? MUSHLING_CARDS : MUSHLING_CARDS.filter(c => c.isFree);
  const numbers = sample(pool.map(c => c.number), spread.cardCount);
  state.reading = { spreadId: spread.id, cardNumbers: numbers, index: 0 };
  // starting a fresh reading re-gates Sage until THIS one is finished —
  // otherwise Sage stayed permanently unlocked after the first-ever finish
  // and kept surfacing an old, unrelated reading's synthesis/conversation
  // the moment you tapped the Sage tab mid-way through a new one.
  state.lastFinishedReading = null;
  resetSageConversation();
  switchScreen('screen-draw-result');
  renderDrawResult();
}

// ---------- draw result ----------

function renderDrawResult() {
  const r = state.reading;
  const n = r.cardNumbers[r.index];
  const card = cardByNumber(n);
  const revealed = isRevealed(card);
  const spread = spreadById(r.spreadId);
  const isGalleryLookup = r.spreadId === 'gallery';

  document.getElementById('draw-position-label').textContent =
    spread ? positionLabel(spread, r.index) : cardText(card, 'name');

  // the position label alone ("The West Shade · Endings") isn't enough to
  // go on for the less self-explanatory spreads — spell out what this
  // position is actually asking, right under the label, every time
  document.getElementById('draw-position-explain').textContent = spread ? (spreadMeanings(spread)[r.index] || '') : '';

  const img = document.getElementById('draw-card-img');
  img.src = card.img;
  img.alt = cardText(card, 'name');
  img.style.filter = revealed ? '' : 'grayscale(0.9) brightness(0.35) blur(2px)';

  document.getElementById('draw-card-name').textContent = revealed ? cardText(card, 'name') : t('unknownCardName');
  document.getElementById('draw-card-message').textContent = revealed ? cardText(card, 'message') : t('unknownCardMessage');
  document.getElementById('draw-card-interp').textContent = revealed ? cardText(card, 'interpretation') : '';

  const nextBtn = document.getElementById('draw-next-btn');
  const finishBtn = document.getElementById('draw-finish-btn');
  const hasNext = r.index < r.cardNumbers.length - 1;
  // a Gallery look-up isn't a reading — there's nothing to finish or
  // advance through, so neither button belongs here
  nextBtn.style.display = (!isGalleryLookup && hasNext) ? 'block' : 'none';
  finishBtn.style.display = (!isGalleryLookup && !hasNext) ? 'block' : 'none';
  document.getElementById('draw-prev-btn').style.display = (!isGalleryLookup && r.index > 0) ? 'block' : 'none';
  document.getElementById('draw-nav-row').classList.toggle('has-prev', !isGalleryLookup && r.index > 0);

  // Back goes to wherever the card was opened from: the Gallery for a look-up, the spread picker otherwise
  document.querySelector('#screen-draw-result .back-btn').dataset.nav = isGalleryLookup ? 'screen-gallery' : 'screen-reading';

  // stash current card number on the action row for story/sage/journal handlers
  document.getElementById('screen-draw-result').dataset.currentCard = n;

  // new card → back to the Message tab rather than leaving Meaning open
  setDrawTab('message');
}

function setDrawTab(name) {
  document.querySelectorAll('.draw-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
  document.querySelectorAll('.draw-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
}

document.getElementById('draw-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.draw-tab');
  if (btn && btn.dataset.tab) setDrawTab(btn.dataset.tab);
  // the Story pill has data-action="story" instead of data-tab — its own
  // click listener (below) handles navigation
});

document.getElementById('draw-next-btn').addEventListener('click', () => {
  state.reading.index++;
  renderDrawResult();
});

document.querySelector('#screen-draw-result .back-btn').addEventListener('click', () => {
  state.galleryReturn = !!(state.reading && state.reading.spreadId === 'gallery');
});

document.getElementById('draw-prev-btn').addEventListener('click', () => {
  if (state.reading.index > 0) { state.reading.index--; renderDrawResult(); }
});

document.getElementById('draw-finish-btn').addEventListener('click', () => {
  // finishing a reading is what unlocks Sage. Sage opens with a synthesis of
  // the whole spread (it counts as one Sage conversation); the save-to-journal
  // offer sits under the chat and carries the synthesis along.
  state.lastFinishedReading = {
    spreadId: state.reading.spreadId,
    cardNumbers: state.reading.cardNumbers.slice(),
  };
  resetSageConversation();
  switchScreen('screen-sage');
});

document.getElementById('draw-art-wrap').addEventListener('click', () => {
  const n = Number(document.getElementById('screen-draw-result').dataset.currentCard);
  const card = cardByNumber(n);
  if (!isRevealed(card)) { showToast(t('lockedSee')); return; }
  openZoom(card.img, cardText(card, 'name'));
});

document.querySelector('[data-action="story"]').addEventListener('click', () => {
  const n = Number(document.getElementById('screen-draw-result').dataset.currentCard);
  const card = cardByNumber(n);
  if (!isRevealed(card)) { showToast(t('lockedStory')); return; }
  openStory(card);
});

// ---------- zoom modal ----------

function openZoom(src, alt) {
  document.getElementById('zoom-img').src = src;
  document.getElementById('zoom-img').alt = alt;
  document.getElementById('zoom-modal').classList.add('active');
}
document.getElementById('zoom-close').addEventListener('click', () =>
  document.getElementById('zoom-modal').classList.remove('active'));
document.getElementById('zoom-modal').addEventListener('click', (e) => {
  if (e.target.id === 'zoom-modal') document.getElementById('zoom-modal').classList.remove('active');
});

// ---------- story time ----------

let storyPages = [];
let storyIndex = 0;
let storyCard = null;

// Splits a story into pages at sentence ends. The sentence pattern covers the
// full stops used by Latin, Cyrillic, Japanese and Chinese text (. ! ? … 。！？),
// optionally followed by a closing quote or bracket.
function paginateStory(text) {
  const sentences = text.match(/[^.!?…。！？]+[.!?…。！？]+["'”’»」』)\]]*\s*|[^.!?…。！？]+$/g) || [text];
  // a very long sentence is broken at its commas / semicolons so no page grows past the fixed box
  const pieces = [];
  sentences.forEach(s => {
    if (s.length <= 200) { pieces.push(s); return; }
    const parts = s.match(/[^,;:，、；：—–]+[,;:，、；：—–]*\s*/g) || [s];
    let buf = '';
    parts.forEach(pt => { if ((buf + pt).length > 160 && buf) { pieces.push(buf); buf = ''; } buf += pt; });
    if (buf) pieces.push(buf);
  });
  const pages = [];
  let cur = '';
  pieces.forEach(s => {
    if ((cur + s).length > 200 && cur) {
      pages.push(cur.trim());
      cur = '';
    }
    cur += s;
  });
  if (cur.trim()) pages.push(cur.trim());
  return pages.length ? pages : [text];
}

function openStory(card) {
  storyCard = card;
  storyPages = paginateStory(cardText(card, 'story') || t('storyMissing'));
  storyIndex = 0;
  document.getElementById('story-title').textContent = cardText(card, 'name');
  switchScreen('screen-story');
  renderStoryPage();
}

function renderStoryPage() {
  document.getElementById('story-text').textContent = storyPages[storyIndex];
  const dots = document.getElementById('story-dots');
  dots.innerHTML = storyPages.map((_, i) =>
    `<span class="${i === storyIndex ? 'active' : ''}"></span>`).join('');
  document.getElementById('story-prev').style.visibility = storyIndex === 0 ? 'hidden' : 'visible';
  const isLast = storyIndex === storyPages.length - 1;
  document.getElementById('story-next').style.visibility = isLast ? 'hidden' : 'visible';
  document.getElementById('story-end').style.display = isLast ? 'block' : 'none';
}

document.getElementById('story-prev').addEventListener('click', () => {
  if (storyIndex > 0) { storyIndex--; renderStoryPage(); }
});
document.getElementById('story-next').addEventListener('click', () => {
  if (storyIndex < storyPages.length - 1) { storyIndex++; renderStoryPage(); }
});

// ---------- gallery ----------

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  MUSHLING_CARDS.forEach(card => {
    const revealed = isRevealed(card);
    const tile = document.createElement('div');
    tile.className = 'gallery-tile' + (revealed ? '' : ' locked');
    tile.innerHTML = `
      <img src="${card.img}" alt="${escapeHtml(cardText(card, 'name'))}">
      <span class="num-badge">${String(card.number).padStart(2, '0')}</span>
      ${revealed ? '' : '<div class="lock-badge">🔒</div>'}
    `;
    tile.addEventListener('click', () => {
      if (!revealed) { showToast(t('lockedMeet')); return; }
      state.galleryScroll = document.querySelector('#screen-gallery .screen-content').scrollTop;
      state.reading = { spreadId: 'gallery', cardNumbers: [card.number], index: 0 };
      switchScreen('screen-draw-result');
      renderDrawResult();
    });
    grid.appendChild(tile);
  });
}

// ---------- journal ----------

// entries saved before spreads had ids carry only an English spreadName
function entrySpread(entry) {
  return (entry.spreadId && spreadById(entry.spreadId)) || MUSHLING_SPREADS.find(s => s.name === entry.spreadName) || null;
}
function entrySpreadName(entry) {
  const s = entrySpread(entry);
  return s ? spreadText(s, 'name') : (entry.spreadName || '');
}

function filterJournal(query) {
  if (!query) return state.journal;
  const q = query.toLowerCase();
  return state.journal.filter(entry => {
    const haystack = [entry.title, entry.comment, entry.synthesis, entrySpreadName(entry), entry.spreadName]
      .filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

function renderJournal() {
  const wrap = document.getElementById('journal-list');
  const searchRow = document.getElementById('journal-search-row');
  const query = document.getElementById('journal-search') ? document.getElementById('journal-search').value.trim() : '';

  if (!state.journal.length) {
    if (searchRow) searchRow.style.display = 'none';
    wrap.innerHTML = `<div class="journal-empty">
      <p class="display" style="font-size:1.3rem">${escapeHtml(t('journalEmptyTitle'))}</p>
      <p>${escapeHtml(t('journalEmptyBody'))}</p>
    </div>`;
    return;
  }
  if (searchRow) searchRow.style.display = '';

  const filtered = filterJournal(query);
  if (!filtered.length) {
    wrap.innerHTML = `<div class="journal-empty">
      <p class="display" style="font-size:1.1rem">${escapeHtml(t('journalNoMatch', { query }))}</p>
    </div>`;
    return;
  }

  // each entry is a title + the essentials up front (date, spread, your
  // note); Sage's synthesis and any back-and-forth that followed are real
  // content but not what you're scanning for, so they fold away behind
  // <details> instead of all getting "plastered" onto the card at once
  wrap.innerHTML = filtered.map(entry => {
    const date = new Date(entry.date).toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
    const spreadName = entrySpreadName(entry);
    const title = entry.title || t('journalDefaultTitle', { spread: spreadName });
    const conversation = entry.transcript && entry.transcript.length > 0 ? entry.transcript : null;
    return `<div class="journal-entry">
      <div class="journal-entry-top">
        <div class="journal-entry-title">${escapeHtml(title)}</div>
        <div class="meta">${escapeHtml(date)}</div>
      </div>
      <div class="meta">${escapeHtml(spreadName)}</div>
      <div class="comment">${entry.comment ? `“${escapeHtml(entry.comment)}”` : `<span class="no-note">${escapeHtml(t('journalNoNote'))}</span>`}</div>
      ${entry.synthesis ? `
        <details class="journal-detail">
          <summary>${escapeHtml(t('journalSynthesis'))}</summary>
          <div class="synthesis">${escapeHtml(entry.synthesis)}</div>
        </details>` : ''}
      ${conversation ? `
        <details class="journal-detail">
          <summary>${escapeHtml(t('journalConversation', { count: conversation.length }))}</summary>
          <div class="journal-transcript">
            ${conversation.map(m => `<div class="transcript-line ${m.who === 'user' ? 'user' : 'sage'}"><span class="who">${escapeHtml(m.who === 'user' ? t('whoYou') : t('whoSage'))}</span>${escapeHtml(m.text)}</div>`).join('')}
          </div>
        </details>` : ''}
    </div>`;
  }).join('');
}

document.getElementById('journal-search').addEventListener('input', renderJournal);

// ---------- sage chat ----------
// Sage talks to real Claude through the artifact's `sample` capability —
// the viewer's own Claude account, no API key embedded in this page (which
// a static, publicly-viewable page could never hold safely). If that
// capability isn't available in a given view (declined, or this page is
// opened somewhere that doesn't serve it), Sage falls back to a lightweight
// offline keyword-reflection engine so the screen still does *something*
// sensible rather than breaking outright.

let claudeSample = null; // resolved async below; stays null = use the offline fallback
const claudeReady = (async () => {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      claudeSample = await window.claude.use('sample');
    }
  } catch (e) { /* leave null */ }
})();

const SAGE_BASE = "You are Glowcap, the Seer: a Mushling whose cap glows softly, and the resident guide of The Mushling Oracle — a whimsical oracle-card app about small forest creatures called Mushlings. You speak warmly and briefly, like someone who has spent a long time quietly living in these woods: gentle, a little wry, never clinical or therapist-sounding. Ask at most one real question per reply. Keep replies to 2-4 sentences unless asked for more. Never mention that you're an AI, a model, or a prompt, and never break character.";

// Sage answers in whichever language the reader chose in Settings
function sageInstructions() {
  if (state.lang === 'en') return SAGE_BASE;
  const L = langInfo(state.lang);
  const p = pack();
  const guide = p && p.meta && p.meta.guideName; // the guide's name in this language ("Sabio" in Spanish)
  return `${SAGE_BASE} Always reply in ${L.english} (${L.name}), whatever language the person writes in, unless they ask you to switch.${guide ? ` In ${L.english} your name is ${guide}.` : ''}`;
}

const SYNTHESIS_REQUEST = "Their reading is complete. Give them your synthesis of the whole reading — not a card-by-card recap. Name the thread that runs through the cards, say how the positions speak to each other (where two cards echo each other or pull against each other, say so), and offer the one thing this spread most seems to want them to notice. Close with a single gentle question. Write about 150 to 220 words in two or three short paragraphs, speaking to them directly as \"you\". No headings, no bullet points.";

let sageTurns = []; // the running {role, content} conversation this page keeps — sample() itself remembers nothing between calls
let chatTranscript = []; // clean {who, text} record of the follow-up conversation shown on screen (the synthesis is kept
                          // separately) — saved to the journal with the entry
let synthesis = { started: false, running: false, text: '' };

function resetSageConversation() {
  sageTurns = [];
  chatTranscript = [];
  synthesis = { started: false, running: false, text: '' };
  const log = document.getElementById('chat-log');
  if (log) log.innerHTML = '';
  const strip = document.getElementById('sage-reading');
  if (strip) strip.innerHTML = '';
  removeSageSaveSheet();
}

function readingContext() {
  const r = state.lastFinishedReading;
  if (!r) return '';
  const spread = spreadById(r.spreadId);
  const lines = r.cardNumbers.map((n, i) => {
    const c = cardByNumber(n);
    const pos = (spread && positionLabel(spread, i)) || `Card ${i + 1}`;
    const meaning = spread && spreadMeanings(spread)[i];
    return `- ${pos}${meaning ? ` (${meaning})` : ''}: "${cardText(c, 'name')}" — "${cardText(c, 'message')}" (${cardText(c, 'interpretation')})`;
  });
  return `They just completed a "${spread ? spreadText(spread, 'name') : ''}" reading:\n${lines.join('\n')}`;
}

async function callSage(userText) {
  const leading = sageTurns.length === 0 ? sageInstructions() + '\n\n' + readingContext() + '\n\n' : '';
  const content = leading + userText;

  sageTurns.push({ role: 'user', content });
  const bubble = pushSageLine(t('sageThinking'));
  bubble.classList.add('thinking');

  try {
    const { text } = await claudeSample(sageTurns, {
      cache: false,
      onText: ({ text: liveText }) => {
        bubble.classList.remove('thinking');
        bubble.textContent = liveText;
        syncTranscriptEntry(bubble);
        scrollChatToBottom();
      },
    });
    sageTurns.push({ role: 'assistant', content: text });
    syncTranscriptEntry(bubble, text);
  } catch (e) {
    bubble.classList.remove('thinking');
    sageTurns.pop(); // don't keep a turn that never got a reply
    const permanent = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
    if (permanent.includes(e && e.code)) {
      claudeSample = null; // stop trying for the rest of this view; use the offline engine from here on
      bubble.textContent = sageReplyFor(userText);
      syncTranscriptEntry(bubble);
    } else if (e && e.code === 'rate_limited') {
      bubble.textContent = t('sageBusy');
      syncTranscriptEntry(bubble);
    } else if (e && e.code === 'cancelled') {
      removeTranscriptEntry(bubble);
      bubble.remove();
    } else {
      bubble.textContent = t('sageLost');
      syncTranscriptEntry(bubble);
    }
  }
}

// ---------- reading strip + synthesis ----------
// Finishing a reading opens Sage with a synthesis of the whole spread, written
// by real Claude when it's reachable. It counts as ONE Sage conversation —
// charged only once a real answer arrives, so a failed attempt or the offline
// fallback never costs anything. The follow-up chat continues from it.

function counterKey() { return state.unlocked ? 'sageUnlockLeft' : 'sageFreeLeft'; }
function counterMax() { return state.unlocked ? 300 : 5; }

function renderReadingStrip() {
  const strip = document.getElementById('sage-reading');
  const r = state.lastFinishedReading;
  if (!strip || !r) return;
  const spread = spreadById(r.spreadId);
  strip.innerHTML = r.cardNumbers.map((n, i) => {
    const c = cardByNumber(n);
    const revealed = isRevealed(c);
    const label = spread ? shortPosition(positionLabel(spread, i)) : '';
    return `<div class="strip-card">
      <img src="${c.img}" alt="${escapeHtml(cardText(c, 'name'))}"${revealed ? '' : ' style="filter:grayscale(0.9) brightness(0.4)"'}>
      <div class="strip-pos">${escapeHtml(label)}</div>
    </div>`;
  }).join('');
}

function offlineSynthesis() {
  const r = state.lastFinishedReading;
  const spread = spreadById(r.spreadId);
  const lines = r.cardNumbers.map((n, i) => {
    const c = cardByNumber(n);
    return t('synthesisOfflineCard', {
      position: (spread && positionLabel(spread, i)) || '',
      card: cardText(c, 'name'),
      message: cardText(c, 'message'),
    });
  });
  return [t('synthesisOfflineIntro'), ...lines, t('synthesisOfflineOutro')].join('\n\n');
}

function makeSynthesisCard() {
  const log = document.getElementById('chat-log');
  const card = document.createElement('div');
  card.className = 'synthesis-card';
  card.innerHTML = `<div class="synthesis-title"></div><div class="synthesis-body"></div><div class="synthesis-foot"></div>`;
  card.querySelector('.synthesis-title').textContent = '🍄 ' + t('synthesisTitle');
  log.appendChild(card);
  return {
    card,
    body: card.querySelector('.synthesis-body'),
    foot: card.querySelector('.synthesis-foot'),
  };
}

async function runSynthesis() {
  const r = state.lastFinishedReading;
  if (!r || synthesis.running) return;
  synthesis.started = true;
  synthesis.running = true;

  const log = document.getElementById('chat-log');
  log.querySelectorAll('.synthesis-card').forEach(el => el.remove());
  const ui = makeSynthesisCard();

  await claudeReady;

  const key = counterKey();
  if (state[key] <= 0) {
    ui.body.textContent = t('synthesisNoneLeft');
    synthesis.running = false;
    return;
  }

  if (!claudeSample) {
    // no real Claude from here: a simple weave of the cards' own messages, free of charge
    synthesis.text = offlineSynthesis();
    ui.body.textContent = synthesis.text;
    synthesis.running = false;
    return;
  }

  ui.body.textContent = t('synthesisWorking');
  ui.body.classList.add('thinking');
  const turns = [{ role: 'user', content: sageInstructions() + '\n\n' + readingContext() + '\n\n' + SYNTHESIS_REQUEST }];
  try {
    const { text } = await claudeSample(turns, {
      cache: false,
      onText: ({ text: live }) => {
        ui.body.classList.remove('thinking');
        ui.body.textContent = live;
        scrollChatToBottom();
      },
    });
    ui.body.classList.remove('thinking');
    ui.body.textContent = text;
    synthesis.text = text;
    // the follow-up chat picks up from here, with the synthesis in its memory
    sageTurns = [turns[0], { role: 'assistant', content: text }];
    state[key] = Math.max(0, state[key] - 1);
    renderSageCounter();
    ui.foot.textContent = t('synthesisUsedOne');
  } catch (e) {
    ui.body.classList.remove('thinking');
    const permanent = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
    if (permanent.includes(e && e.code)) {
      claudeSample = null;
      synthesis.text = offlineSynthesis();
      ui.body.textContent = synthesis.text;
    } else if (e && e.code === 'cancelled') {
      ui.card.remove();
    } else {
      ui.body.textContent = e && e.code === 'rate_limited' ? t('sageBusy') : t('sageLost');
      const retry = document.createElement('button');
      retry.className = 'link-btn';
      retry.textContent = t('synthesisRetry');
      retry.addEventListener('click', () => { synthesis.running = false; runSynthesis(); });
      ui.foot.appendChild(retry);
    }
  } finally {
    synthesis.running = false;
  }
}

// ---------- save-to-journal ----------
// The save offer sits under the chat from the moment a reading is finished —
// talking to Sage first is optional, and saving isn't gated on it.

// the reading is over: forget it, and Glowcap's page goes back to open conversation
function endSageSession() {
  state.lastFinishedReading = null;
  resetSageConversation();
}

function removeSageSaveSheet() {
  const slot = document.getElementById('sage-save-slot');
  if (slot) slot.innerHTML = '';
}

function defaultJournalTitle(r) {
  const spread = spreadById(r.spreadId);
  const dateLabel = new Date().toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric' });
  return `${spread ? spreadText(spread, 'name') : ''} — ${dateLabel}`;
}

function ensureSaveOfferVisible() {
  if (document.getElementById('sage-save-sheet')) return; // already up, don't rebuild it out from under a half-typed note
  const r = state.lastFinishedReading;
  if (!r) return;
  const sheet = document.createElement('div');
  sheet.className = 'journal-save-sheet';
  sheet.id = 'sage-save-sheet';
  sheet.innerHTML = `
    <div style="font-size:0.9rem;margin-bottom:4px">${escapeHtml(t('saveTitle'))}</div>
    <input type="text" class="journal-title-input" placeholder="${escapeHtml(t('saveTitlePlaceholder'))}" value="${escapeHtml(defaultJournalTitle(r))}">
    <textarea placeholder="${escapeHtml(t('saveNotePlaceholder'))}"></textarea>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <button class="btn-primary" style="padding:10px 20px;font-size:0.9rem">${escapeHtml(t('saveButton'))}</button>
      <button class="link-btn" id="sage-save-dismiss">${escapeHtml(t('saveDismiss'))}</button>
    </div>
  `;
  // lives below the chat input, not inside the scrolling log — talking to
  // Sage stays optional, the save offer is a fixed footer under it
  document.getElementById('sage-save-slot').appendChild(sheet);

  sheet.querySelector('button.btn-primary').addEventListener('click', () => {
    const title = sheet.querySelector('.journal-title-input').value.trim() || defaultJournalTitle(r);
    const comment = sheet.querySelector('textarea').value.trim();
    const spread = spreadById(r.spreadId);
    // saved as of right now — the synthesis, plus anything said to Sage after it
    saveJournalEntry({
      date: new Date().toISOString(),
      title,
      spreadId: r.spreadId,
      spreadName: spread ? spread.name : '',
      cardNumbers: r.cardNumbers.slice(),
      comment,
      synthesis: synthesis.text || '',
      transcript: chatTranscript.slice(),
    });
    showToast(t('savedToast'));
    endSageSession();
    switchScreen('screen-home');
  });
  sheet.querySelector('#sage-save-dismiss').addEventListener('click', () => {
    endSageSession();
    switchScreen('screen-home');
  });
}

function renderSageScreen() {
  // Glowcap is always open for conversation; a finished reading just adds the
  // synthesis and the save offer on top
  document.getElementById('sage-gate').style.display = 'none';
  document.getElementById('sage-chat-ui').style.display = 'flex';
  renderSageCounter();
  if (!state.lastFinishedReading) {
    // no reading in play: open talk, with a short greeting on an empty page
    if (chatTranscript.length === 0) pushSageLine(t('sageOpen'));
    return;
  }
  renderReadingStrip();
  ensureSaveOfferVisible();
  // first visit after finishing a reading: Glowcap opens with the synthesis
  if (!synthesis.started) runSynthesis();
}

// Offline fallback — lightweight keyword reflection, used only when the
// `sample` capability is unavailable. Not a real conversation; just keeps
// the chat on-topic rather than silent or random. Uses the active
// language's keywords and lines when its pack has them.

let lastSageReply = '';

function sageOfflineData() {
  const p = pack();
  return (p && p.sage && p.sage.topics && p.sage.fallback) ? p.sage : MUSHLING_SAGE_EN;
}

function sageReplyFor(text) {
  const data = sageOfflineData();
  const lower = text.toLowerCase();
  const topic = data.topics.find(tp => tp.words.some(w => lower.includes(w)));
  const pool = topic ? topic.lines : data.fallback;
  const choices = pool.filter(l => l !== lastSageReply);
  const reply = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length ? choices.length : pool.length))];
  lastSageReply = reply;
  return reply;
}

function renderSageCounter() {
  const el = document.getElementById('sage-counter');
  const vars = { left: state[counterKey()], max: counterMax() };
  el.textContent = state.unlocked ? t('counterPaid', vars) : t('counterFree', vars);
}

function scrollChatToBottom() {
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

function pushBubble(text, who) {
  const log = document.getElementById('chat-log');
  const b = document.createElement('div');
  b.className = `chat-bubble ${who}`;
  b.textContent = text;
  log.appendChild(b);
  scrollChatToBottom();
  // record a clean, display-only copy of the conversation as it happens —
  // this (not sageTurns, which carries hidden system-prompt text on its
  // first entry) is what gets saved with the journal entry
  const entry = { who, text };
  chatTranscript.push(entry);
  b._transcriptEntry = entry;
  return b;
}

function pushSageLine(text) { return pushBubble(text, 'sage'); }

// keeps a bubble's transcript record in sync as its text changes (streaming,
// then the final settled reply) — pass text explicitly, or it reads the
// bubble's current textContent
function syncTranscriptEntry(bubble, text) {
  if (bubble && bubble._transcriptEntry) {
    bubble._transcriptEntry.text = text !== undefined ? text : bubble.textContent;
  }
}

// a cancelled reply never actually said anything — drop its placeholder
// from the saved transcript along with the bubble itself
function removeTranscriptEntry(bubble) {
  if (!bubble || !bubble._transcriptEntry) return;
  const idx = chatTranscript.indexOf(bubble._transcriptEntry);
  if (idx > -1) chatTranscript.splice(idx, 1);
}

document.getElementById('chat-send').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const key = counterKey();
  if (state[key] <= 0) {
    pushSageLine(state.unlocked ? t('sageLimitPaid') : t('sageLimitFree'));
    return;
  }

  pushBubble(text, 'user');
  input.value = '';
  state[key]--;
  renderSageCounter();

  const afterReply = () => {
    if (state[key] === 0) {
      pushSageLine(state.unlocked ? t('sageLimitPaid') : t('sageLimitFree'));
    }
  };

  if (claudeSample) {
    callSage(text).then(afterReply);
  } else {
    setTimeout(() => {
      pushSageLine(sageReplyFor(text));
      afterReply();
    }, 500);
  }
}

// ---------- settings ----------

function renderLanguagePicker() {
  const wrap = document.getElementById('lang-pills');
  if (!wrap) return;
  wrap.innerHTML = '';
  readyLanguages().forEach(L => {
    const btn = document.createElement('button');
    btn.className = 'lang-pill' + (L.code === state.lang ? ' active' : '');
    btn.textContent = L.name;
    btn.lang = L.code;
    btn.addEventListener('click', () => setLanguage(L.code));
    wrap.appendChild(btn);
  });
}

// re-draws whichever screen is showing, so a language or unlock change shows up immediately
function rerenderActiveScreen() {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  if (active.id === 'screen-reading') renderSpreadList();
  if (active.id === 'screen-gallery') renderGallery();
  if (active.id === 'screen-journal') renderJournal();
  if (active.id === 'screen-draw-result' && state.reading) renderDrawResult();
  if (active.id === 'screen-story' && storyCard) {
    const page = storyIndex;
    openStory(storyCard);
    storyIndex = Math.min(page, storyPages.length - 1);
    renderStoryPage();
  }
  if (active.id === 'screen-sage' && state.lastFinishedReading) { renderReadingStrip(); renderSageCounter(); }
  if (active.id === 'screen-match' && typeof refreshMatchLabels === 'function') refreshMatchLabels();
  if (typeof refreshGameLabels === 'function') refreshGameLabels();
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = langInfo(state.lang).dir || 'ltr';
  applyStaticText();
  renderLanguagePicker();
  syncUnlockUI();
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.placeholder = t('chatPlaceholder');
}

async function setLanguage(code) {
  if (code === state.lang) return;
  const previous = state.lang;
  showToast(t('languageLoading'));
  try {
    await loadPack(code);
  } catch (e) {
    showToast(t('languageFailed', { language: langInfo(previous).name }));
    return;
  }
  state.lang = code;
  try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* not remembered, still works */ }
  applyLanguage();
  showToast(t('languageChanged', { language: langInfo(code).name }));
}

function syncUnlockUI() {
  // the toggle previews the LOCKED/free-tier view, so it reads "on" when we're
  // showing that restricted state — i.e. the inverse of state.unlocked
  document.getElementById('demo-toggle').classList.toggle('on', !state.unlocked);
  document.getElementById('btn-unlock-deck').textContent = state.unlocked ? t('unlockedButton') : t('unlockButton');
  document.getElementById('btn-unlock-deck').disabled = state.unlocked;

  document.getElementById('unlock-settings-title').textContent = state.unlocked ? t('unlockTitleUnlocked') : t('unlockTitleLocked');
  document.getElementById('unlock-settings-copy').textContent = state.unlocked ? t('unlockCopyUnlocked') : t('unlockCopyLocked');

  rerenderActiveScreen();
}

document.getElementById('demo-toggle').addEventListener('click', () => {
  state.unlocked = !state.unlocked;
  if (!state.unlocked) {
    // reset to a fresh 5 every time free-tier preview is switched on, so
    // testing "what happens when Sage's limit is hit" is always a clean,
    // repeatable 5 messages away instead of wherever a past test left it
    state.sageFreeLeft = 5;
    renderSageCounter();
  }
  syncUnlockUI();
  showToast(state.unlocked ? t('toastDemoUnlocked') : t('toastDemoLocked'));
});

document.getElementById('btn-unlock-deck').addEventListener('click', () => {
  state.unlocked = true;
  syncUnlockUI();
  showToast(t('toastUnlocked'));
});

document.getElementById('btn-subscribe').addEventListener('click', () => {
  state.sageUnlockLeft = 300; // prototype stand-in for the real monthly cap
  showToast(t('toastSubscribed'));
});

// ---------- mini-games hub ----------

// ---------- boot ----------

(async function boot() {
  let wanted = 'en';
  try { wanted = localStorage.getItem(LANG_KEY) || ''; } catch (e) { wanted = ''; }
  if (!wanted) {
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    wanted = readyLanguages().some(l => l.code === nav) ? nav : 'en';
  }
  if (!readyLanguages().some(l => l.code === wanted)) wanted = 'en';
  try { await loadPack(wanted); state.lang = wanted; } catch (e) { state.lang = 'en'; }
  applyLanguage();
})();
