// Assembles and validates one language pack.
//   node tools/i18n-build.mjs <code>
// Reads i18n-work/<code>/{core,spreads,cards-1..7}.json (same shapes as
// i18n-src/parts/*), checks them against the English source, and on success
// writes js/i18n/<code>.js. Exits non-zero with a list of problems otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = process.argv[2];
if (!code) { console.error('usage: node tools/i18n-build.mjs <code>'); process.exit(2); }
const en = JSON.parse(fs.readFileSync(path.join(root, 'i18n-src', 'en.json'), 'utf8'));
const dir = path.join(root, 'i18n-work', code);
const errors = [];
const warnings = [];

function readPart(name) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) { errors.push(`missing file i18n-work/${code}/${name}`); return null; }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { errors.push(`i18n-work/${code}/${name} is not valid JSON: ${e.message}`); return null; }
}

const core = readPart('core.json') || {};
const spreads = readPart('spreads.json') || {};
const cards = {};
for (let i = 1; i <= 7; i++) Object.assign(cards, readPart(`cards-${i}.json`) || {});

const placeholders = s => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
const nonEmpty = (v, where) => {
  if (typeof v !== 'string' || !v.trim()) errors.push(`${where}: empty or not a string`);
};
const latinShare = s => {
  const letters = String(s).match(/\p{L}/gu) || [];
  if (!letters.length) return 0;
  return letters.filter(ch => /[A-Za-z]/.test(ch)).length / letters.length;
};
const nonLatin = ['ru', 'uk', 'ja', 'ko', 'zh'].includes(code);

// meta
const meta = core.meta || {};
if (meta.code !== code) errors.push(`meta.code should be "${code}"`);
['name', 'english', 'dir'].forEach(k => nonEmpty(meta[k], `meta.${k}`));

// ui
const ui = core.ui || {};
for (const [k, ev] of Object.entries(en.ui)) {
  const v = ui[k];
  if (v === undefined) { errors.push(`ui.${k}: missing`); continue; }
  if (typeof ev === 'object') {
    if (!v || typeof v !== 'object') { errors.push(`ui.${k}: must be a plural object like the English one`); continue; }
    if (!v.other) errors.push(`ui.${k}: plural object needs an "other" form`);
    const allowed = ['zero', 'one', 'two', 'few', 'many', 'other'];
    for (const [form, fv] of Object.entries(v)) {
      if (!allowed.includes(form)) errors.push(`ui.${k}.${form}: not a plural category (${allowed.join(', ')})`);
      nonEmpty(fv, `ui.${k}.${form}`);
      if (placeholders(fv) !== placeholders(ev.other)) errors.push(`ui.${k}.${form}: placeholders ${placeholders(fv) || '(none)'} ≠ English ${placeholders(ev.other)}`);
    }
    try {
      const needed = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
      for (const cat of needed) if (!v[cat] && cat !== 'other') warnings.push(`ui.${k}: no "${cat}" form (Intl.PluralRules("${code}") uses it; "other" will be used)`);
    } catch (e) { /* ignore */ }
  } else {
    nonEmpty(v, `ui.${k}`);
    if (placeholders(v) !== placeholders(ev)) errors.push(`ui.${k}: placeholders ${placeholders(v) || '(none)'} ≠ English ${placeholders(ev) || '(none)'}`);
    if (code !== 'en' && v === ev && ev.length > 12 && !/^[\p{P}\p{S}\s\d$]+$/u.test(ev)) warnings.push(`ui.${k}: identical to English`);
  }
}
for (const k of Object.keys(ui)) if (!(k in en.ui)) warnings.push(`ui.${k}: not in English source (ignored)`);

// sage
const sage = core.sage || {};
if (!Array.isArray(sage.topics) || sage.topics.length !== en.sage.topics.length) errors.push(`sage.topics: need ${en.sage.topics.length} topics`);
else en.sage.topics.forEach((et, i) => {
  const t = sage.topics[i];
  if (t.key !== et.key) errors.push(`sage.topics[${i}].key should be "${et.key}"`);
  if (!Array.isArray(t.words) || !t.words.length) errors.push(`sage.topics[${i}].words: need a non-empty list`);
  else t.words.forEach((w, j) => nonEmpty(w, `sage.topics[${i}].words[${j}]`));
  if (!Array.isArray(t.lines) || t.lines.length !== et.lines.length) errors.push(`sage.topics[${i}].lines: need ${et.lines.length}`);
  else t.lines.forEach((l, j) => nonEmpty(l, `sage.topics[${i}].lines[${j}]`));
});
if (!Array.isArray(sage.fallback) || sage.fallback.length !== en.sage.fallback.length) errors.push(`sage.fallback: need ${en.sage.fallback.length}`);
else sage.fallback.forEach((l, j) => nonEmpty(l, `sage.fallback[${j}]`));

// spreads
for (const [id, es] of Object.entries(en.spreads)) {
  const s = spreads[id];
  if (!s) { errors.push(`spreads.${id}: missing`); continue; }
  ['name', 'description', 'longDescription'].forEach(k => nonEmpty(s[k], `spreads.${id}.${k}`));
  ['positions', 'positionMeanings'].forEach(k => {
    if (!Array.isArray(s[k]) || s[k].length !== es[k].length) errors.push(`spreads.${id}.${k}: need ${es[k].length} entries`);
    else s[k].forEach((v, i) => nonEmpty(v, `spreads.${id}.${k}[${i}]`));
  });
  if (code !== 'en' && s.longDescription === es.longDescription) errors.push(`spreads.${id}.longDescription: untranslated`);
}

// cards
for (const [n, ec] of Object.entries(en.cards)) {
  const c = cards[n];
  if (!c) { errors.push(`cards.${n}: missing`); continue; }
  for (const k of ['name', 'message', 'interpretation', 'story']) {
    nonEmpty(c[k], `cards.${n}.${k}`);
    if (code !== 'en' && typeof c[k] === 'string' && k !== 'name' && c[k] === ec[k]) errors.push(`cards.${n}.${k}: untranslated (identical to English)`);
  }
  if (typeof c.story === 'string') {
    const ep = ec.story.split(/\n\s*\n/).length, tp = c.story.split(/\n\s*\n/).length;
    if (ep !== tp) errors.push(`cards.${n}.story: ${tp} paragraphs, English has ${ep} (keep the blank-line paragraph breaks)`);
    const ratio = c.story.length / ec.story.length;
    const [lo, hi] = ['ja', 'ko', 'zh'].includes(code) ? [0.18, 0.9] : [0.6, 1.8];
    if (ratio < lo) errors.push(`cards.${n}.story: looks too short (${Math.round(ratio * 100)}% of English length) — translate in full, don't summarize`);
    if (ratio > hi) warnings.push(`cards.${n}.story: unusually long (${Math.round(ratio * 100)}% of English length)`);
  }
  if (typeof c.interpretation === 'string') {
    const ratio = c.interpretation.length / ec.interpretation.length;
    const lo = ['ja', 'ko', 'zh'].includes(code) ? 0.18 : 0.6;
    if (ratio < lo) errors.push(`cards.${n}.interpretation: looks too short (${Math.round(ratio * 100)}% of English) — translate in full`);
  }
  if (nonLatin && typeof c.story === 'string' && latinShare(c.story) > 0.15) warnings.push(`cards.${n}.story: ${Math.round(latinShare(c.story) * 100)}% Latin letters — anything left in English?`);
}
for (const n of Object.keys(cards)) if (!(n in en.cards)) warnings.push(`cards.${n}: not in English source`);

if (warnings.length) console.log(`warnings (${warnings.length}):\n  ` + warnings.join('\n  '));
if (errors.length) {
  console.error(`\n${errors.length} problem(s) — nothing written:\n  ` + errors.join('\n  '));
  process.exit(1);
}
const pack = { meta, ui, sage, spreads, cards };
const outPath = path.join(root, 'js', 'i18n', `${code}.js`);
fs.writeFileSync(outPath,
  `// The Mushling Oracle — ${meta.english} language pack. Built by tools/i18n-build.mjs from i18n-work/${code}/; do not hand-edit.\n` +
  `window.MUSHLING_I18N = window.MUSHLING_I18N || {};\nwindow.MUSHLING_I18N[${JSON.stringify(code)}] = ${JSON.stringify(pack)};\n`);
console.log(`\nOK — wrote js/i18n/${code}.js (${Math.round(fs.statSync(outPath).size / 1024)} KB)`);
