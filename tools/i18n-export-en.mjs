// Builds the English translation source (i18n-src/en.json + i18n-src/parts/*)
// from the app's own data, so translators always work from what the app ships.
//   node tools/i18n-export-en.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {};
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/strings.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8') +
    '\n;this.MUSHLING_CARDS=typeof MUSHLING_CARDS!=="undefined"?MUSHLING_CARDS:this.MUSHLING_CARDS;' +
    'this.MUSHLING_SPREADS=typeof MUSHLING_SPREADS!=="undefined"?MUSHLING_SPREADS:this.MUSHLING_SPREADS;' +
    'this.MUSHLING_UI_EN=typeof MUSHLING_UI_EN!=="undefined"?MUSHLING_UI_EN:this.MUSHLING_UI_EN;' +
    'this.MUSHLING_SAGE_EN=typeof MUSHLING_SAGE_EN!=="undefined"?MUSHLING_SAGE_EN:this.MUSHLING_SAGE_EN;', ctx);
}

const spreads = {};
for (const s of ctx.MUSHLING_SPREADS) {
  spreads[s.id] = {
    name: s.name, description: s.description, longDescription: s.longDescription,
    positions: s.positions, positionMeanings: s.positionMeanings,
  };
}
const cards = {};
for (const c of ctx.MUSHLING_CARDS) {
  cards[String(c.number)] = { name: c.name, message: c.message, interpretation: c.interpretation, story: c.story };
}
const en = {
  meta: { code: 'en', name: 'English', english: 'English', dir: 'ltr' },
  ui: ctx.MUSHLING_UI_EN,
  sage: ctx.MUSHLING_SAGE_EN,
  spreads,
  cards,
};
const out = path.join(root, 'i18n-src');
fs.mkdirSync(path.join(out, 'parts'), { recursive: true });
fs.writeFileSync(path.join(out, 'en.json'), JSON.stringify(en, null, 2));
fs.writeFileSync(path.join(out, 'parts', 'core.json'), JSON.stringify({ meta: en.meta, ui: en.ui, sage: en.sage }, null, 2));
fs.writeFileSync(path.join(out, 'parts', 'spreads.json'), JSON.stringify(spreads, null, 2));
const nums = Object.keys(cards).map(Number).sort((a, b) => a - b);
for (let i = 0; i < 7; i++) {
  const chunk = {};
  for (const n of nums.slice(i * 7, i * 7 + 7)) chunk[String(n)] = cards[String(n)];
  fs.writeFileSync(path.join(out, 'parts', `cards-${i + 1}.json`), JSON.stringify(chunk, null, 2));
}
console.log(`exported: ${Object.keys(en.ui).length} ui strings, ${Object.keys(spreads).length} spreads, ${nums.length} cards`);
