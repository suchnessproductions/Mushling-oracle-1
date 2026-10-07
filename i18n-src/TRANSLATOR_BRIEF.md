# Translating The Mushling Oracle

The Mushling Oracle is a whimsical 49-card oracle-deck app. Each card is a Mushling — a tiny mushroom-capped forest creature with a name (Pippin, Berry, Fern…), a short message, a longer "meaning" (interpretation), and a bedtime-story-length tale that ends by turning to the human reader. There are eight spreads (card layouts) and a resident guide called Sage who chats about readings. Readers are all ages, younger readers included. The voice is warm, plain, a little wry, never clinical, preachy or therapist-sounding.

You are producing one complete language pack. Quality matters more than speed: this ships to real people in their own language, so it should read as if it were written in that language, not translated into it.

All paths below are relative to `MUSHLING=/tmp/claude-0/-home-claude/35ec294c-08bc-594e-87fe-5141b9cc732d/scratchpad/mushling` — use absolute paths with your tools.

## Files

Source (English, read-only): `i18n-src/parts/`

- `core.json` — `{ meta, ui, sage }`: interface strings and Sage's offline lines
- `spreads.json` — the eight spreads keyed by id
- `cards-1.json` … `cards-7.json` — seven cards each, keyed by card number

Your output: `i18n-work/<code>/` with **the same nine file names and exactly the same JSON shape** — same keys, same nesting, same array lengths; only the string values change. Then run:

    node $MUSHLING/tools/i18n-build.mjs <code>

It validates your files against the English source and, when everything passes, writes `js/i18n/<code>.js`. Fix every reported problem and run it again until it prints `OK`. Read the warnings too and fix any that point at a real issue. Touch no other files.

## Workflow

1. Read `core.json` and `spreads.json`, and skim a couple of card chunks so you know the world. Before translating, decide your renderings for the recurring names (see "Names") and write them to `i18n-work/<code>/names.md`. Keep adding each Mushling's personal name to it as you meet them, so the same name is rendered identically in every chunk.
2. Write `core.json`, then `spreads.json`.
3. For each of `cards-1.json` … `cards-7.json`: read the source chunk, write the translated chunk with one Write call. Don't carry on to the next chunk until the current one is written.
4. Run the build script; fix; re-run until OK.
5. Reply with a short report (under 150 words): the build result and file size, your renderings of "Mushling", "Sage" and the app name, and anything a reviewer should know.

## Rules

**Structure**
- Never change keys: `ui` keys, spread ids, card numbers, `sage.topics[].key`, and `meta.dir` stay exactly as they are. Set `meta.code` to your code, `meta.name` to the language's own name for itself, `meta.english` to its English name.
- Placeholders in braces — `{count}`, `{spread}`, `{n}`, `{total}`, `{query}`, `{level}`, `{moves}`, `{left}`, `{max}`, `{position}`, `{card}`, `{message}`, `{language}` — must appear unchanged in your string. You may move them wherever your grammar needs them.
- Plural strings (`cardCount`, `journalConversation`) are objects keyed by `Intl.PluralRules` category. Provide every category your language uses, always including `other`: Russian/Ukrainian/Polish → `one`, `few`, `many`, `other`; Japanese/Korean/Chinese → only `other`; Spanish/French/Italian/Portuguese → `one`, `many`, `other` (`many` is only used for very large round numbers — give it the same text as `other`); German → `one`, `other`.
- Keep emoji, arrows and symbols exactly as in the English (🔍 📖 🍄 ✓ → ‹ › ·). Keep prices as written ("$5", "$5/month").
- Position labels keep the "Image · Meaning" shape with the middle dot ` · ` (e.g. "The Moss · What Is"). "Today's Mushling" (the single-card position) has no dot.
- Valid JSON: escape any straight double quote inside a value as `\"` — better, use your language's typographic quotes (« », „ ", 「」, “ ”), which need no escaping. Paragraph breaks inside stories are `\n\n` in the JSON.

**Completeness**
- Translate every sentence of every story and interpretation in full. Do not summarize, shorten, merge or skip. Keep the same number of paragraphs in each story (the build checks this, and checks length).
- Card titles ("The Acorn Wanderer", "The Dewdrop Dreamer") are translated for meaning and charm, not transliterated.

**Names**
- Mushlings' personal names (Pippin, Berry, Fern, Elder Moss, Juniper, Flint…): Latin-script languages keep them as written; Russian, Ukrainian, Japanese, Korean and Chinese render them phonetically in the native script (Japanese in katakana). Where a name is also an English word with meaning that the story plays on (Fern sits by a fern, Berry, Moss, Willow, Ash…), you may translate it into a native name that keeps the wordplay — your call, but decide once and stay consistent.
- "Mushling / Mushlings" is the creature's name. Latin-script languages keep "Mushling" and inflect it naturally if the grammar requires (e.g. Polish/German plurals). Non-Latin languages choose one charming rendering — a transliteration or a native coinage — and use it everywhere.
- "Sage" is the guide's name. Keep it as a name in Latin-script languages; non-Latin languages render it once and keep it.
- The app name ("The Mushling Oracle") is translated naturally ("El Oráculo Mushling", "Das Mushling-Orakel"…).

**Voice**
- Address the reader in the warm, informal singular: tú (es), tu (fr), du (de), tu (it), você (pt-BR), ty (pl), ты (ru), ти (uk). Japanese: gentle です・ます. Korean: soft 해요체. Chinese: natural, warm, 你.
- Keep the stories' storybook cadence; the closing turn to the reader ("dear reader…", "In your human life…") should feel tender, not formal.
- Interface strings are short and natural for an app in your language (buttons read like buttons there).
- Sage's offline `words` are keyword triggers: lowercase words or stems a person would actually type in your language when talking about that topic (stems catch more forms — e.g. "estres" catches "estresado/estresada"). Give 6–14 per topic. Japanese and Chinese have no spaces; short words match fine. The `lines` are Sage's replies — translate them in Sage's voice.
