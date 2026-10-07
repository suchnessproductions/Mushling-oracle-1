// Shared: parse "## key\ntext" or bare "key\ntext" (card.N.story style) markdown into {key: text}.
import fs from 'node:fs';
export function parseMd(file, knownKeys) {
  const out = {}; const set = new Set(knownKeys);
  let cur = null, buf = [];
  const flush = () => { if (cur) out[cur] = buf.join('\n').trim(); };
  for (const raw of fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    const m = raw.match(/^(?:## )?(\S+)\s*$/);
    if (m && set.has(m[1])) { flush(); cur = m[1]; buf = []; }
    else if (/^# PART/.test(raw)) { flush(); cur = null; buf = []; }
    else if (cur) buf.push(raw);
  }
  flush();
  return out;
}
