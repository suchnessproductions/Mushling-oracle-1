// The Mushling Oracle — prototype app logic
// Static front-end: no server of its own, no real payments. Sage talks to
// real Claude through the published artifact's `sample` capability (see the
// "sage chat" section below) rather than a backend holding an API key.
// State persists only in memory + a little localStorage (journal) for this demo.

const state = {
  // Prototype default: everything unlocked, so whoever is playing this to
  // review the app sees all of it (stories included) without first having
  // to find the demo toggle. Flip the Settings toggle to preview what a
  // non-paying visitor actually sees.
  unlocked: true,
  reading: null,             // { spreadName, cardNumbers:[...], index:0 }
  lastFinishedReading: null, // { spreadName, positions, cardNumbers:[...] } — set when a reading is finished; gates Sage
  sageFreeLeft: 5,
  sageUnlockLeft: 300, // matches the real subscribed-tier cap (300/month) — the demo shouldn't run out mid-session
  journal: loadJournal(),
};

// ---------- helpers ----------

function cardByNumber(n) {
  return MUSHLING_CARDS.find(c => c.number === n);
}

function spreadByName(name) {
  return MUSHLING_SPREADS.find(s => s.name === name);
}

// positionMeanings are stored as "Label: explanation." strings (the label
// repeats the position name, sometimes with a " · subtitle" on top of it)
// — this pulls out just the explanation half for display next to the
// already-shown label, instead of repeating the whole thing.
function positionExplanation(spread, index) {
  if (!spread || !spread.positionMeanings) return '';
  const raw = spread.positionMeanings[index];
  if (!raw) return '';
  const splitAt = raw.indexOf(': ');
  return splitAt === -1 ? raw : raw.slice(splitAt + 2);
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
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
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
  if (id === 'screen-gallery') renderGallery();
  if (id === 'screen-journal') renderJournal();
  if (id === 'screen-sage') renderSageScreen();
}

document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) switchScreen(navBtn.dataset.nav);
});

// ---------- spread picker ----------

let selectedSpreadIdx = 0;

function renderSpreadList() {
  const pills = document.getElementById('spread-pills');
  pills.innerHTML = '';
  MUSHLING_SPREADS.forEach((s, idx) => {
    const free = idx < 3; // Single Spore, Two Paths, Original Draw
    const locked = !free && !state.unlocked;
    const btn = document.createElement('button');
    btn.className = 'spread-pill' + (idx === selectedSpreadIdx ? ' active' : '');
    btn.innerHTML = `${s.name}${locked ? ' <span class="lock">🔒</span>' : ''}`;
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
  const free = selectedSpreadIdx < 3;
  const locked = !free && !state.unlocked;
  const wrap = document.getElementById('spread-detail');
  wrap.className = 'spread-detail';
  // one description, not a short line plus a "Learn more" toggle for a
  // longer one — the longer version reads better on its own, so that's
  // the one shown
  wrap.innerHTML = `
    <div class="spread-detail-top">
      <h3>${s.name}${locked ? ' 🔒' : ''}</h3>
      <span class="spread-count">${s.cardCount} card${s.cardCount > 1 ? 's' : ''}</span>
    </div>
    <p class="desc">${s.longDescription || s.description}</p>
    <div class="positions">
      ${s.positions.map((p, i) => `
        <div class="position-row">
          <div class="position-name">${p}</div>
          <div class="position-meaning">${positionExplanation(s, i)}</div>
        </div>
      `).join('')}
    </div>
    <div class="spread-detail-actions">
      ${locked
        ? `<button class="link-btn" data-nav="screen-settings">Unlock to use →</button>`
        : `<button class="btn-primary" data-draw style="padding:8px 18px;font-size:0.85rem">Draw</button>`}
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
  state.reading = { spreadName: spread.name, positions: spread.positions, cardNumbers: numbers, index: 0 };
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

  document.getElementById('draw-position-label').textContent =
    r.positions && r.positions[r.index] ? r.positions[r.index] : card.name;
  document.getElementById('draw-progress').textContent =
    r.cardNumbers.length > 1 ? `${r.spreadName} · Card ${r.index + 1} of ${r.cardNumbers.length}` : r.spreadName;

  // the position label alone ("The West Shade · Endings") isn't enough to
  // go on for the less self-explanatory spreads — spell out what this
  // position is actually asking, right under the label, every time
  const spread = spreadByName(r.spreadName);
  document.getElementById('draw-position-explain').textContent = spread ? positionExplanation(spread, r.index) : '';

  const img = document.getElementById('draw-card-img');
  img.src = card.img;
  img.alt = card.name;
  img.style.filter = revealed ? '' : 'grayscale(0.9) brightness(0.35) blur(2px)';

  document.getElementById('draw-card-name').textContent = revealed ? card.name : '??? — a Mushling you haven\'t met yet';
  document.getElementById('draw-card-message').textContent = revealed
    ? card.message
    : 'Unlock the Full Deck to reveal this Mushling\'s message.';
  document.getElementById('draw-card-interp').textContent = revealed ? card.interpretation : '';

  const nextBtn = document.getElementById('draw-next-btn');
  const finishBtn = document.getElementById('draw-finish-btn');
  const hasNext = r.index < r.cardNumbers.length - 1;
  // a Gallery look-up isn't a reading — there's nothing to finish or
  // advance through, so neither button belongs here
  const isGalleryLookup = r.spreadName === 'Gallery';
  nextBtn.style.display = (!isGalleryLookup && hasNext) ? 'block' : 'none';
  finishBtn.style.display = (!isGalleryLookup && !hasNext) ? 'block' : 'none';

  // stash current card number on the action row for story/sage/journal handlers
  document.getElementById('screen-draw-result').dataset.currentCard = n;

  // new card → back to the Message tab rather than leaving Meaning open
  setDrawTab('message');
}

function setDrawTab(name) {
  document.querySelectorAll('.draw-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.draw-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
}

document.getElementById('draw-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.draw-tab');
  if (btn && btn.dataset.tab) setDrawTab(btn.dataset.tab);
  // the Story pill has data-action="story" instead of data-tab — its own
  // click listener (bound where Story Time used to live) handles navigation
});

document.getElementById('draw-next-btn').addEventListener('click', () => {
  state.reading.index++;
  renderDrawResult();
});

document.getElementById('draw-finish-btn').addEventListener('click', () => {
  // finishing a reading is what unlocks Sage, and it's a fresh reading to
  // reflect on — reset so the next visit to Sage synthesizes THIS one.
  // Sage reads the synthesis first; the save-to-journal offer (with a
  // personal-notes field) comes after that, inside the Sage screen itself.
  state.lastFinishedReading = {
    spreadName: state.reading.spreadName,
    positions: state.reading.positions,
    cardNumbers: state.reading.cardNumbers.slice(),
  };
  resetSageConversation();
  switchScreen('screen-sage');
});

document.getElementById('draw-art-wrap').addEventListener('click', () => {
  const n = Number(document.getElementById('screen-draw-result').dataset.currentCard);
  const card = cardByNumber(n);
  if (!isRevealed(card)) { showToast('Unlock the Full Deck to see this Mushling.'); return; }
  openZoom(card.img, card.name);
});

document.querySelector('[data-action="story"]').addEventListener('click', () => {
  const n = Number(document.getElementById('screen-draw-result').dataset.currentCard);
  const card = cardByNumber(n);
  if (!isRevealed(card)) { showToast('Unlock the Full Deck to read this story.'); return; }
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

function paginateStory(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const pages = [];
  let cur = '';
  sentences.forEach(s => {
    if ((cur + s).length > 260 && cur) {
      pages.push(cur.trim());
      cur = '';
    }
    cur += s;
  });
  if (cur.trim()) pages.push(cur.trim());
  return pages.length ? pages : [text];
}

function openStory(card) {
  storyPages = paginateStory(card.story || 'This Mushling\'s story is still being written.');
  storyIndex = 0;
  document.getElementById('story-title').textContent = card.name;
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
      <img src="${card.img}" alt="${card.name}">
      <span class="num-badge">${String(card.number).padStart(2, '0')}</span>
      ${revealed ? '' : '<div class="lock-badge">🔒</div>'}
    `;
    tile.addEventListener('click', () => {
      if (!revealed) { showToast('Unlock the Full Deck to meet this Mushling.'); return; }
      state.reading = { spreadName: 'Gallery', positions: [card.name], cardNumbers: [card.number], index: 0 };
      switchScreen('screen-draw-result');
      renderDrawResult();
    });
    grid.appendChild(tile);
  });
}

// ---------- journal ----------

function filterJournal(query) {
  if (!query) return state.journal;
  const q = query.toLowerCase();
  return state.journal.filter(entry => {
    const haystack = [entry.title, entry.comment, entry.synthesis, entry.spreadName]
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
      <p class="display" style="font-size:1.3rem">Nothing here yet.</p>
      <p>Your first saved reading will start your journal.</p>
    </div>`;
    return;
  }
  if (searchRow) searchRow.style.display = '';

  const filtered = filterJournal(query);
  if (!filtered.length) {
    wrap.innerHTML = `<div class="journal-empty">
      <p class="display" style="font-size:1.1rem">No entries match "${query}".</p>
    </div>`;
    return;
  }

  // each entry is a title + the essentials up front (date, spread, your
  // note); Sage's synthesis and any back-and-forth that followed are real
  // content but not what you're scanning for, so they fold away behind
  // <details> instead of all getting "plastered" onto the card at once
  wrap.innerHTML = filtered.map(entry => {
    const date = new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const title = entry.title || `${entry.spreadName} reading`;
    const conversation = entry.transcript && entry.transcript.length > 1 ? entry.transcript : null;
    return `<div class="journal-entry">
      <div class="journal-entry-top">
        <div class="journal-entry-title">${title}</div>
        <div class="meta">${date}</div>
      </div>
      <div class="meta">${entry.spreadName}</div>
      <div class="comment">${entry.comment ? `"${entry.comment}"` : '<span class="no-note">No note added</span>'}</div>
      ${entry.synthesis ? `
        <details class="journal-detail">
          <summary>Sage's take</summary>
          <div class="synthesis">${entry.synthesis}</div>
        </details>` : ''}
      ${conversation ? `
        <details class="journal-detail">
          <summary>Full conversation (${conversation.length} messages)</summary>
          <div class="journal-transcript">
            ${conversation.map(t => `<div class="transcript-line ${t.who}"><span class="who">${t.who === 'user' ? 'You' : 'Sage'}</span>${t.text}</div>`).join('')}
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
(async () => {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      claudeSample = await window.claude.use('sample');
    }
  } catch (e) { /* leave null */ }
})();

const SAGE_INSTRUCTIONS = "You are Sage, the resident guide of The Mushling Oracle — a whimsical oracle-card app about small forest creatures called Mushlings. You speak warmly and briefly, like someone who has spent a long time quietly living in these woods: gentle, a little wry, never clinical or therapist-sounding. Ask at most one real question per reply. Keep replies to 2-4 sentences unless asked for more. Never mention that you're an AI, a model, or a prompt, and never break character.";

let sageTurns = []; // the running {role, content} conversation this page keeps — sample() itself remembers nothing between calls
let chatTranscript = []; // clean {who, text} record of what's actually shown on screen — no system-prompt
                          // scaffolding mixed in like sageTurns has — kept so the whole conversation can be
                          // saved to the journal if they talked to Sage before saving

function resetSageConversation() {
  sageTurns = [];
  chatTranscript = [];
  const log = document.getElementById('chat-log');
  if (log) log.innerHTML = '';
  removeSageSaveSheet();
}

function readingContext() {
  const r = state.lastFinishedReading;
  if (!r) return '';
  const lines = r.cardNumbers.map((n, i) => {
    const c = cardByNumber(n);
    const pos = (r.positions && r.positions[i]) || `Card ${i + 1}`;
    return `- ${pos}: "${c.name}" — "${c.message}" (${c.interpretation})`;
  });
  return `They just completed a "${r.spreadName}" reading:\n${lines.join('\n')}`;
}

async function callSage(userText) {
  const leading = sageTurns.length === 0 ? SAGE_INSTRUCTIONS + '\n\n' + readingContext() + '\n\n' : '';
  const content = leading + userText;

  sageTurns.push({ role: 'user', content });
  const bubble = pushSageLine('Thinking…');
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
      bubble.textContent = "Sage's getting a lot of visitors right now — try again in a moment.";
      syncTranscriptEntry(bubble);
    } else if (e && e.code === 'cancelled') {
      removeTranscriptEntry(bubble);
      bubble.remove();
    } else {
      bubble.textContent = (e && e.text) || "Sage lost their train of thought there — try asking again.";
      syncTranscriptEntry(bubble);
    }
  }
}

// ---------- save-to-journal ----------
// A finished reading always lands on a blank Sage screen — no auto-generated
// opener eating into the conversation limit — with the save offer visible
// right away. Talking to Sage first is optional; saving isn't gated on it.

function removeSageSaveSheet() {
  const slot = document.getElementById('sage-save-slot');
  if (slot) slot.innerHTML = '';
}

function defaultJournalTitle(r) {
  const dateLabel = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${r.spreadName} — ${dateLabel}`;
}

function ensureSaveOfferVisible() {
  if (document.getElementById('sage-save-sheet')) return; // already up, don't rebuild it out from under a half-typed note
  const r = state.lastFinishedReading;
  if (!r) return;
  const sheet = document.createElement('div');
  sheet.className = 'journal-save-sheet';
  sheet.id = 'sage-save-sheet';
  sheet.innerHTML = `
    <div style="font-size:0.9rem;margin-bottom:4px">Save this reading to your journal?</div>
    <input type="text" class="journal-title-input" placeholder="Title this entry" value="${defaultJournalTitle(r)}">
    <textarea placeholder="Add your own note, if you want (optional)"></textarea>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <button class="btn-primary" style="padding:10px 20px;font-size:0.9rem">Save to Journal</button>
      <button class="link-btn" id="sage-save-dismiss">Not now</button>
    </div>
  `;
  // lives below the chat input, not inside the scrolling log — talking to
  // Sage stays optional, the save offer is a fixed footer under it
  document.getElementById('sage-save-slot').appendChild(sheet);

  sheet.querySelector('button.btn-primary').addEventListener('click', () => {
    const title = sheet.querySelector('.journal-title-input').value.trim() || defaultJournalTitle(r);
    const comment = sheet.querySelector('textarea').value.trim();
    // saved as of right now — if they talked to Sage first, that whole
    // conversation comes along with the save
    saveJournalEntry({
      date: new Date().toISOString(),
      title,
      spreadName: r.spreadName,
      cardNumbers: r.cardNumbers.slice(),
      comment,
      transcript: chatTranscript.slice(),
    });
    showToast('Saved to your journal.');
    sheet.remove();
    switchScreen('screen-home');
  });
  sheet.querySelector('#sage-save-dismiss').addEventListener('click', () => {
    sheet.remove();
    switchScreen('screen-home');
  });
}

function renderSageScreen() {
  const gate = document.getElementById('sage-gate');
  const chatUI = document.getElementById('sage-chat-ui');
  if (!state.lastFinishedReading) {
    gate.style.display = 'block';
    chatUI.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  chatUI.style.display = 'flex';
  renderSageCounter();
  // blank slate every time — no auto-generated opener; Sage only speaks once
  // they actually say something
  ensureSaveOfferVisible();
}

// Offline fallback — lightweight keyword reflection, used only when the
// `sample` capability is unavailable. Not a real conversation; just keeps
// the chat on-topic rather than silent or random.

const SAGE_TOPICS = [
  {
    key: 'anxiety',
    words: ['anxious', 'anxiety', 'stress', 'stressed', 'worried', 'worry', 'nervous', 'overwhelmed', 'panic', 'scared', 'afraid'],
    lines: [
      "That sounds like a lot to be carrying. Is it one thing in particular, or more of a general hum underneath everything?",
      "Worry like that usually has a specific shape if you look at it directly. What's the actual worst case you're picturing?",
      "Where do you feel that — more in your chest, your stomach, your head? Sometimes naming where it lives takes a bit of its power away.",
    ],
  },
  {
    key: 'work',
    words: ['job', 'work', 'career', 'boss', 'coworker', 'co-worker', 'office', 'promotion', 'fired', 'quit', 'interview'],
    lines: [
      "Work has a way of taking up more room than it should. Is this about the job itself, or how it fits into the rest of your life right now?",
      "What would it look like if this went well? Sometimes that's clearer than what you're afraid of.",
      "Is this something you have real choice in, or does it mostly feel like something happening to you?",
    ],
  },
  {
    key: 'relationships',
    words: ['relationship', 'partner', 'boyfriend', 'girlfriend', 'husband', 'wife', 'friend', 'family', 'mom', 'dad', 'breakup', 'love', 'marriage'],
    lines: [
      "People are the hardest weather to forecast. What do you actually want to happen here, if you set aside what you think you're supposed to want?",
      "Is this a pattern you've seen before with them, or does this feel like something new?",
      "What's the part of this you haven't said to them directly yet?",
    ],
  },
  {
    key: 'stuck',
    words: ['decide', 'decision', 'choice', 'stuck', 'confused', 'unsure', "don't know", 'dont know', 'torn', 'undecided'],
    lines: [
      "You don't have to have it figured out yet. What would one small, reversible step look like, instead of the whole decision at once?",
      "Sometimes being stuck means both options are actually fine, and the discomfort is just about choosing at all. Does that sound true here?",
      "If a friend described this exact situation to you, what would you tell them?",
    ],
  },
  {
    key: 'sadness',
    words: ['sad', 'grief', 'loss', 'lost', 'miss', 'lonely', 'alone', 'down', 'crying', 'cry'],
    lines: [
      "That's a heavy one to sit with. You don't need to make it smaller than it is.",
      "Is this something recent, or something that's been with you a while?",
      "I'm glad you said that out loud instead of carrying it quietly.",
    ],
  },
  {
    key: 'good',
    words: ['excited', 'happy', 'hopeful', 'grateful', 'proud', 'great news', 'good news', 'relieved'],
    lines: [
      "That's a good feeling to sit in for a second before moving on to what's next.",
      "What made that land, specifically? It's worth noticing.",
      "Good — hold onto that one.",
    ],
  },
  {
    key: 'greeting',
    words: ['hi', 'hello', 'hey', "what's up", 'whats up'],
    lines: [
      "Hello. What's on your mind?",
      "Hey there. What brought you here today?",
    ],
  },
  {
    key: 'thanks',
    words: ['thank', 'thanks', 'appreciate'],
    lines: [
      "Of course. That's what I'm here for.",
      "Anytime. Was there more you wanted to sit with, or does that feel complete?",
    ],
  },
];

const SAGE_FALLBACK = [
  "Say more about that — what's underneath it?",
  "That's worth sitting with. Does it feel more like a question or a decision?",
  "I hear that. What's the part of this you haven't said out loud yet?",
  "What does your gut say, before you start reasoning it out?",
];

let lastSageReply = '';

function sageReplyFor(text) {
  const lower = text.toLowerCase();
  const topic = SAGE_TOPICS.find(t => t.words.some(w => lower.includes(w)));
  const pool = topic ? topic.lines : SAGE_FALLBACK;
  const choices = pool.filter(l => l !== lastSageReply);
  const reply = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length ? choices.length : pool.length))];
  lastSageReply = reply;
  return reply;
}

function renderSageCounter() {
  const el = document.getElementById('sage-counter');
  if (state.unlocked) {
    el.textContent = `${state.sageUnlockLeft} of 300 conversations left`;
  } else {
    el.textContent = `${state.sageFreeLeft} of 5 free conversations left`;
  }
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
  // first entry) is what gets offered up when someone wants to save the
  // whole conversation, not just Sage's opening synthesis
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

  const counterKey = state.unlocked ? 'sageUnlockLeft' : 'sageFreeLeft';
  if (state[counterKey] <= 0) {
    pushSageLine("That's your last free chat with Sage for now — want to keep talking? Subscribe for 300 messages a month.");
    return;
  }

  pushBubble(text, 'user');
  input.value = '';
  state[counterKey]--;
  renderSageCounter();

  const afterReply = () => {
    if (state[counterKey] === 0) {
      pushSageLine("That's your last free chat with Sage for now — want to keep talking? Subscribe for 300 messages a month.");
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

function syncUnlockUI() {
  // the toggle previews the LOCKED/free-tier view, so it reads "on" when we're
  // showing that restricted state — i.e. the inverse of state.unlocked
  document.getElementById('demo-toggle').classList.toggle('on', !state.unlocked);
  document.getElementById('btn-unlock-deck').textContent = state.unlocked ? 'Unlocked ✓' : 'Unlock for $5';
  document.getElementById('btn-unlock-deck').disabled = state.unlocked;

  const title = document.getElementById('unlock-settings-title');
  const copy = document.getElementById('unlock-settings-copy');
  if (state.unlocked) {
    title.textContent = 'The whole forest is yours';
    copy.textContent = 'All 49 Mushlings, every spread, every story, every game — unlocked.';
  } else {
    title.textContent = 'Meet the rest of the forest';
    copy.textContent = "You've met 13 Mushlings so far. There are 36 more waiting — plus every spread, every story, every game. Unlock the whole deck once, keep it forever.";
  }

  // re-render whatever screen is currently showing so locked/unlocked state is reflected immediately
  const active = document.querySelector('.screen.active');
  if (active) {
    if (active.id === 'screen-reading') renderSpreadList();
    if (active.id === 'screen-gallery') renderGallery();
    if (active.id === 'screen-draw-result' && state.reading) renderDrawResult();
  }
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
  showToast(state.unlocked ? 'Demo: back to the full unlocked app' : 'Demo: now previewing the free-tier (locked) view — 5 of 5 Sage conversations');
});

document.getElementById('btn-unlock-deck').addEventListener('click', () => {
  state.unlocked = true;
  syncUnlockUI();
  showToast('Unlocked! All 49 Mushlings are yours.');
});

document.getElementById('btn-subscribe').addEventListener('click', () => {
  state.sageUnlockLeft = 300; // prototype stand-in for the real monthly cap
  showToast('Subscribed (demo) — 300 Sage conversations this month.');
});

// ---------- mini-games hub ----------

// The four "Coming soon" tiles are inert by design (only Mushling Match is
// built for this prototype) — but a tap that does nothing reads as broken,
// not as "not built yet". Give it an explicit answer instead of silence.
document.querySelectorAll('.game-tile.disabled').forEach(el => {
  el.addEventListener('click', () => {
    showToast("Not built in this prototype — only Mushling Match is playable so far.");
  });
});

// ---------- boot ----------

syncUnlockUI();
