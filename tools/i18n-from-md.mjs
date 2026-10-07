// Parses a translated Markdown file (## key / text) and reports against the English source.
//   node tools/i18n-from-md.mjs <file.md> [--json out.json]
import fs from 'node:fs';
const file = process.argv[2];
const en = JSON.parse(fs.readFileSync('i18n-src/en.json', 'utf8'));
// English flat map, same keys as i18n-to-md
const flat = {};
for (const [k, v] of Object.entries(en.ui)) {
  if (typeof v === 'object') { flat[`ui.${k}.one`] = v.one; flat[`ui.${k}.other`] = v.other; } else flat[`ui.${k}`] = v;
}
for (const t of en.sage.topics) { flat[`sage.${t.key}.words`] = t.words.join(', '); t.lines.forEach((l, i) => flat[`sage.${t.key}.line${i + 1}`] = l); }
en.sage.fallback.forEach((l, i) => flat[`sage.fallback${i + 1}`] = l);
for (const [id, s] of Object.entries(en.spreads)) {
  flat[`spread.${id}.name`] = s.name; flat[`spread.${id}.description`] = s.description; flat[`spread.${id}.longDescription`] = s.longDescription;
  s.positions.forEach((p, i) => flat[`spread.${id}.position${i + 1}`] = p);
  s.positionMeanings.forEach((p, i) => flat[`spread.${id}.meaning${i + 1}`] = p);
}
for (const [n, c] of Object.entries(en.cards)) for (const f of ['name', 'message', 'interpretation', 'story']) flat[`card.${n}.${f}`] = c[f];

const txt = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const tr = {}; const dupes = []; let cur = null, buf = [];
const flush = () => { if (cur) { const t = buf.join('\n').trim(); if (cur in tr) dupes.push(cur); tr[cur] = t; } };
for (const line of txt.split('\n')) {
  const m = line.match(/^## (\S+)\s*$/);
  if (m) { flush(); cur = m[1]; buf = []; }
  else if (/^# PART/.test(line) || /^---\s*$/.test(line)) { if (cur) { flush(); cur = null; buf = []; } }
  else if (cur) buf.push(line);
}
flush();

const ph = s => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
const missing = Object.keys(flat).filter(k => !(k in tr) || !tr[k]);
const extra = Object.keys(tr).filter(k => !(k in flat));
const problems = [];
for (const k of Object.keys(flat)) {
  if (!tr[k]) continue;
  if (ph(tr[k]) !== ph(flat[k])) problems.push(`${k}: placeholders ${ph(tr[k]) || '(none)'} vs English ${ph(flat[k]) || '(none)'}`);
  if (k.endsWith('.story')) {
    const a = flat[k].split(/\n\s*\n/).length, b = tr[k].split(/\n\s*\n/).length;
    if (a !== b) problems.push(`${k}: ${b} paragraphs, English has ${a}`);
  }
  if (/\.(story|interpretation|longDescription)$/.test(k)) {
    const r = tr[k].length / flat[k].length;
    if (r < 0.7) problems.push(`${k}: only ${Math.round(r * 100)}% of English length — shortened?`);
    if (tr[k] === flat[k]) problems.push(`${k}: identical to English`);
  }
  if (/·/.test(flat[k]) && /\.position\d+$/.test(k) && !/·/.test(tr[k])) problems.push(`${k}: lost the " · " separator → "${tr[k]}"`);
}
console.log(`parsed ${Object.keys(tr).length} entries; English has ${Object.keys(flat).length}`);
console.log(`missing (${missing.length}):\n  ` + (missing.join('\n  ') || 'none'));
console.log(`unknown keys (${extra.length}): ${extra.join(', ') || 'none'}`);
console.log(`duplicate keys: ${dupes.join(', ') || 'none'}`);
console.log(`problems (${problems.length}):\n  ` + (problems.join('\n  ') || 'none'));
if (process.argv[3] === '--json') fs.writeFileSync(process.argv[4], JSON.stringify({ tr, flat }, null, 1));
