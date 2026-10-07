// English interface text — the source every language pack translates from.
// Card and spread text lives in data.js; this file holds everything else the
// app says. Placeholders in {braces} are filled at runtime and must survive
// translation unchanged. A value that is an object ({one, other, …}) is a
// plural: the app picks the form with Intl.PluralRules for the active language.

const MUSHLING_LANGUAGES = [
  // code, native name, English name, text direction. `ready` = a finished pack exists in js/i18n/<code>.js
  // (the Settings picker lists only ready languages; flip the flag when a new pack passes tools/i18n-build.mjs)
  { code: 'en', name: 'English', english: 'English', dir: 'ltr', ready: true },
  { code: 'es', name: 'Español', english: 'Spanish', dir: 'ltr', ready: true },
  { code: 'fr', name: 'Français', english: 'French', dir: 'ltr', ready: true },
  { code: 'de', name: 'Deutsch', english: 'German', dir: 'ltr', ready: true },
  { code: 'it', name: 'Italiano', english: 'Italian', dir: 'ltr' },
  { code: 'pt', name: 'Português', english: 'Portuguese (Brazilian)', dir: 'ltr', ready: true },
  { code: 'pl', name: 'Polski', english: 'Polish', dir: 'ltr' },
  { code: 'ru', name: 'Русский', english: 'Russian', dir: 'ltr', ready: true },
  { code: 'uk', name: 'Українська', english: 'Ukrainian', dir: 'ltr', ready: true },
  { code: 'ja', name: '日本語', english: 'Japanese', dir: 'ltr' },
  { code: 'ko', name: '한국어', english: 'Korean', dir: 'ltr' },
  { code: 'zh', name: '简体中文', english: 'Chinese (Simplified)', dir: 'ltr' },
];

const MUSHLING_UI_EN = {
  appName: 'The Mushling Oracle',
  homeTagline: '49 small guides from the forest floor.',
  drawACard: 'Draw a Card',

  navHome: 'Home',
  navDraw: 'Draw',
  navGallery: 'Gallery',
  navJournal: 'Journal',
  navGames: 'Games',
  navSage: 'Glowcap',

  chooseSpread: 'Choose a Spread',
  cardCount: { one: '{count} card', other: '{count} cards' },
  drawButton: 'Draw',
  unlockToUse: 'Unlock to use →',

  drawDefaultLabel: "Today's Mushling",
  progress: '{spread} · Card {n} of {total}',
  tapToEnlarge: '🔍 tap to enlarge',
  tabMessage: 'Message',
  tabMeaning: 'Meaning',
  tabStory: '📖 Story',
  nextCard: 'Next Card →',
  prevCard: '← Previous',
  finishReading: 'Finish Reading',
  unknownCardName: "??? — a Mushling you haven't met yet",
  unknownCardMessage: "Unlock the Full Deck to reveal this Mushling's message.",
  lockedSee: 'Unlock the Full Deck to see this Mushling.',
  lockedStory: 'Unlock the Full Deck to read this story.',
  lockedMeet: 'Unlock the Full Deck to meet this Mushling.',

  storyTime: 'Story Time',
  storyBack: '‹ Back',
  storyNext: 'Next ›',
  storyEnd: '🍄 The End 🍄',
  storyMissing: "This Mushling's story is still being written.",

  galleryTitle: 'Gallery',
  galleryIntro: 'Forty-nine Mushlings. Meet them all, or let one find you.',

  journalTitle: 'Journal',
  journalSearch: '🔍 Search your journal…',
  journalEmptyTitle: 'Nothing here yet.',
  journalEmptyBody: 'Your first saved reading will start your journal.',
  journalNoMatch: 'No entries match “{query}”.',
  journalDefaultTitle: '{spread} reading',
  journalNoNote: 'No note added',
  journalSynthesis: "Glowcap's synthesis",
  journalConversation: { one: 'Full conversation ({count} message)', other: 'Full conversation ({count} messages)' },
  whoYou: 'You',
  whoSage: 'Glowcap',

  gamesTitle: 'Mini-Games',
  gameMatchTitle: 'Mushling Match',
  gameMatchDesc: 'Flip and pair up Mushling portraits.',
  gameQuizTitle: 'Which Mushling Are You?',
  gameQuizDesc: 'A 7-question personality quiz.',
  gameGardenTitle: 'Grow the Garden',
  gameGardenDesc: 'Plant seeds, build a streak.',
  gameHomeTitle: 'Walk Mushling Home',
  gameHomeDesc: 'A sliding-puzzle maze, 10 levels.',
  gameFireflyTitle: 'Firefly Catch',
  gameFireflyDesc: 'Tap fireflies at their bright peak.',
  comingSoon: 'Coming soon',
  gameNotBuilt: 'Not built in this prototype — only Mushling Match is playable so far.',
  matchLevel: 'Level {level}',
  matchMoves: 'Moves: {moves}',
  matchWin: 'Level {level} solved! Moves: {moves}',
  matchNextLevel: 'Next Level →',

  sageTitle: 'Glowcap',
  sageGateTitle: 'Finish a reading first',
  sageGateBody: 'Glowcap reflects on a whole reading, not one card in isolation. Pull a spread and see it through to the end; Glowcap will weave the cards together into a synthesis, then keep talking as long as you like.',
  sageGateButton: 'Draw a Reading',
  sageOpen: "Hello. What's on your mind today?",
  chatPlaceholder: 'Say something to Glowcap…',
  sageThinking: 'Thinking…',
  sageBusy: "Glowcap's getting a lot of visitors right now — try again in a moment.",
  sageLost: 'Glowcap lost their train of thought there — try asking again.',
  sageLimitFree: "That's your last free conversation with Glowcap for now. Want to keep talking? Subscribe for 300 a month.",
  sageLimitPaid: "You've used this month's Glowcap conversations. They refresh at the start of next month.",
  counterFree: 'Free conversations left: {left} of {max}',
  counterPaid: 'Conversations left this month: {left} of {max}',

  synthesisTitle: "Glowcap's Synthesis",
  synthesisWorking: 'Glowcap is reading the whole spread…',
  synthesisUsedOne: 'Used one Glowcap conversation',
  synthesisNoneLeft: "You're out of Glowcap conversations, so there's no synthesis this time. Your cards are all here, and you can still save the reading.",
  synthesisRetry: 'Try the synthesis again',
  synthesisOfflineIntro: 'Here is how your cards speak together:',
  synthesisOfflineCard: '{position} — {card}: “{message}”',
  synthesisOfflineOutro: 'Read them as one conversation rather than separate answers. Which card do you keep coming back to?',

  saveTitle: 'Save this reading to your journal?',
  saveTitlePlaceholder: 'Title this entry',
  saveNotePlaceholder: 'Add your own note, if you want (optional)',
  saveButton: 'Save to Journal',
  saveDismiss: 'Not now',
  savedToast: 'Saved to your journal.',

  settingsTitle: 'Settings',
  languageTitle: 'Language',
  languageBody: 'Cards, stories, spreads, and Glowcap will all speak this language.',
  languageLoading: 'Gathering the words…',
  languageFailed: "That language couldn't load just now. Staying in {language}.",
  languageChanged: 'Now speaking {language}.',
  unlockTitleLocked: 'Meet the rest of the forest',
  unlockCopyLocked: "You've met 13 Mushlings so far. There are 36 more waiting — plus every spread, every story, every game. Unlock the whole deck once, keep it forever.",
  unlockTitleUnlocked: 'The whole forest is yours',
  unlockCopyUnlocked: 'All 49 Mushlings, every spread, every story, every game — unlocked.',
  unlockButton: 'Unlock for $5',
  unlockedButton: 'Unlocked ✓',
  aiGuideTitle: 'Mushling AI Guide',
  aiGuideBody: "Up to 300 conversations a month with Glowcap, the Oracle's resident seer.",
  subscribeButton: 'Start for $5/month',
  aiGuideFine: "Resets monthly. Unused conversations don't carry over. Each reading's synthesis counts as one conversation.",
  demoTitle: 'Demo: Preview Free-Tier (Locked) View',
  demoBody: 'This prototype opens with everything unlocked so you can see the full app. Flip this to preview what a non-paying visitor sees instead.',
  toastDemoUnlocked: 'Demo: back to the full unlocked app',
  toastDemoLocked: 'Demo: now previewing the free-tier (locked) view — 5 of 5 Glowcap conversations',
  toastUnlocked: 'Unlocked! All 49 Mushlings are yours.',
  toastSubscribed: 'Subscribed (demo) — 300 Glowcap conversations this month.',
};

// Glowcap's offline voice — used only when real Claude isn't reachable from the
// page. Keyword topics give a loosely on-topic reply; `fallback` covers the rest.
const MUSHLING_SAGE_EN = {
  topics: [
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
  ],
  fallback: [
    "Say more about that — what's underneath it?",
    "That's worth sitting with. Does it feel more like a question or a decision?",
    "I hear that. What's the part of this you haven't said out loud yet?",
    "What does your gut say, before you start reasoning it out?",
  ],
};
