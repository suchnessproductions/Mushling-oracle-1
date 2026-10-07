// Turns flat translated entries into i18n-work/<code>/*.json (the shape i18n-build.mjs expects).
//   node tools/i18n-assemble.mjs <code> "<native name>" "<English name>" file1.md [file2.md ...]
// Later files override earlier ones for the same key.
import fs from 'node:fs';
import { parseMd } from './i18n-parse-md.mjs';
const [code, nativeName, englishName, ...files] = process.argv.slice(2);
const en = JSON.parse(fs.readFileSync('i18n-src/en.json', 'utf8'));
const keys = [];
const add = k => keys.push(k);
for (const [k, v] of Object.entries(en.ui)) { if (typeof v === 'object') { add(`ui.${k}.one`); add(`ui.${k}.other`); } else add(`ui.${k}`); }
for (const t of en.sage.topics) { add(`sage.${t.key}.words`); t.lines.forEach((_, i) => add(`sage.${t.key}.line${i + 1}`)); }
en.sage.fallback.forEach((_, i) => add(`sage.fallback${i + 1}`));
for (const [id, s] of Object.entries(en.spreads)) {
  ['name', 'description', 'longDescription'].forEach(f => add(`spread.${id}.${f}`));
  s.positions.forEach((_, i) => add(`spread.${id}.position${i + 1}`));
  s.positionMeanings.forEach((_, i) => add(`spread.${id}.meaning${i + 1}`));
}
for (const n of Object.keys(en.cards)) ['name', 'message', 'interpretation', 'story'].forEach(f => add(`card.${n}.${f}`));

const tr = {};
const optional = []; for (const [k, v] of Object.entries(en.ui)) if (typeof v === 'object') for (const c of ['zero', 'two', 'few', 'many']) optional.push(`ui.${k}.${c}`);
for (const f of files) Object.assign(tr, parseMd(f, keys.concat(optional)));
const missing = keys.filter(k => !tr[k]);
if (missing.length) { console.error('missing entries:\n  ' + missing.join('\n  ')); process.exit(1); }

const cats = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
const ui = {};
for (const [k, v] of Object.entries(en.ui)) {
  if (typeof v === 'object') { const o = {}; for (const c of cats) o[c] = tr[`ui.${k}.${c}`] || (c === 'one' ? tr[`ui.${k}.one`] : tr[`ui.${k}.other`]); ui[k] = o; }
  else ui[k] = tr[`ui.${k}`];
}
const sage = {
  topics: en.sage.topics.map(t => ({ key: t.key, words: tr[`sage.${t.key}.words`].split(',').map(s => s.trim().toLowerCase()).filter(Boolean), lines: t.lines.map((_, i) => tr[`sage.${t.key}.line${i + 1}`]) })),
  fallback: en.sage.fallback.map((_, i) => tr[`sage.fallback${i + 1}`]),
};
const spreads = {};
for (const [id, s] of Object.entries(en.spreads)) spreads[id] = {
  name: tr[`spread.${id}.name`], description: tr[`spread.${id}.description`], longDescription: tr[`spread.${id}.longDescription`],
  positions: s.positions.map((_, i) => tr[`spread.${id}.position${i + 1}`]), positionMeanings: s.positionMeanings.map((_, i) => tr[`spread.${id}.meaning${i + 1}`]),
};
const cards = {};
for (const n of Object.keys(en.cards)) cards[n] = { name: tr[`card.${n}.name`], message: tr[`card.${n}.message`], interpretation: tr[`card.${n}.interpretation`], story: tr[`card.${n}.story`] };
const dir = `i18n-work/${code}`; fs.mkdirSync(dir, { recursive: true });
const w = (n, o) => fs.writeFileSync(`${dir}/${n}.json`, JSON.stringify(o, null, 2));
w('core', { meta: { code, name: nativeName, english: englishName, dir: 'ltr' }, ui, sage });
w('spreads', spreads);
const nums = Object.keys(cards).map(Number).sort((a, b) => a - b);
for (let i = 0; i < 7; i++) { const c = {}; nums.slice(i * 7, i * 7 + 7).forEach(n => c[n] = cards[n]); w(`cards-${i + 1}`, c); }
console.log(`assembled ${keys.length} entries into ${dir}/`);
