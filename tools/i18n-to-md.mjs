// Flattens i18n-src/en.json into one translatable Markdown file.
// Each entry is "## key" followed by its English text. Translators replace the text only.
import fs from 'node:fs';
const en = JSON.parse(fs.readFileSync('i18n-src/en.json', 'utf8'));
const out = [];
let n = 0, words = 0;
const add = (key, text) => { out.push(`## ${key}\n${text}\n`); n++; words += text.split(/\s+/).filter(Boolean).length; };
const section = t => out.push(`\n# ${t}\n`);

section('PART 1 — APP INTERFACE (buttons, labels, messages)');
for (const [k, v] of Object.entries(en.ui)) {
  if (typeof v === 'object') for (const [f, t] of Object.entries(v)) { if (f === 'other' || f === 'one') add(`ui.${k}.${f}`, t); }
  else add(`ui.${k}`, v);
}
section("PART 2 — SAGE'S OFFLINE REPLIES");
for (const t of en.sage.topics) {
  add(`sage.${t.key}.words`, t.words.join(', '));
  t.lines.forEach((l, i) => add(`sage.${t.key}.line${i + 1}`, l));
}
en.sage.fallback.forEach((l, i) => add(`sage.fallback${i + 1}`, l));
section('PART 3 — THE EIGHT SPREADS');
for (const [id, s] of Object.entries(en.spreads)) {
  add(`spread.${id}.name`, s.name);
  add(`spread.${id}.description`, s.description);
  add(`spread.${id}.longDescription`, s.longDescription);
  s.positions.forEach((p, i) => add(`spread.${id}.position${i + 1}`, p));
  s.positionMeanings.forEach((p, i) => add(`spread.${id}.meaning${i + 1}`, p));
}
section('PART 4 — THE 49 MUSHLING CARDS');
for (const [num, c] of Object.entries(en.cards)) {
  add(`card.${num}.name`, c.name);
  add(`card.${num}.message`, c.message);
  add(`card.${num}.interpretation`, c.interpretation);
  add(`card.${num}.story`, c.story);
}
const head = `# The Mushling Oracle — Text to Translate into Spanish

**Everything the app says is in this file:** buttons and labels, Sage's replies, the eight spreads, and all 49 Mushlings (name, message, meaning, story). ${n} entries, about ${words.toLocaleString('en')} English words.

## How to translate

1. Each entry is a line starting with \`## \` and a key, followed by the English text. **Translate only the text under each key.** Leave every \`## key\` line exactly as it is, so I can put each piece back in the right place.
2. Send the whole file back (or in chunks, whichever is easier), with the Spanish text under each key.
3. Anything in curly braces — \`{count}\`, \`{spread}\`, \`{n}\`, \`{total}\`, \`{query}\`, \`{level}\`, \`{moves}\`, \`{left}\`, \`{max}\`, \`{position}\`, \`{card}\`, \`{message}\`, \`{language}\` — is filled in by the app. Keep it exactly as written; move it anywhere in the sentence.
4. Keep emoji and symbols (🔍 📖 🍄 ✓ → ‹ › ·) and prices ("$5", "$5/month").
5. Position names like "The Moss · What Is" keep the middle dot ( · ) between the image and its meaning.
6. Stories have paragraphs separated by a blank line. Keep the same number of paragraphs.
7. Names: Mushling names (Pippin, Berry, Fern…) stay as they are. "Mushling" and "Sage" stay. Card titles ("The Acorn Wanderer") get translated.
8. Entries ending in \`.one\` and \`.other\` are singular and plural forms (for example "1 card" and "{count} cards").
9. Entries ending in \`.words\` (in Part 2) are comma-separated keywords a person might type in Spanish when talking about that topic (stress, work, love, feeling stuck, sadness, good news, greetings, thanks). Give 6–14 of them, lowercase.
10. Use the informal "tú". Warm, plain, a little wry, like a storybook.

---
`;
fs.writeFileSync('../handoff/Mushling-Oracle-ALL-TEXT-to-translate-ES.md', head + out.join('\n'));
console.log(n, 'entries,', words, 'words');
