// Text utilities: chunking into numbered blocks and planting known errors.

function chunk(text, target = 1500) {
  const raw = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  // split very long lines at sentence ends so one-line pastes still produce several blocks
  const lines = [];
  for (const l of raw) {
    if (l.length <= target * 1.5) { lines.push(l); continue; }
    let cur = '';
    for (const s of l.split(/(?<=[.!?])\s+/)) {
      if ((cur + ' ' + s).length > target && cur) { lines.push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s;
    }
    if (cur) lines.push(cur);
  }
  const blocks = [];
  let cur = [];
  let len = 0;
  const flush = () => {
    if (!cur.length) return;
    blocks.push({ id: 'C' + String(blocks.length + 1).padStart(2, '0'), text: cur.join('\n') });
    cur = []; len = 0;
  };
  for (const l of lines) { cur.push(l); len += l.length + 1; if (len >= target) flush(); }
  flush();
  return blocks;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NUM = /(?<![\d.])\d+\.\d+%?(?!\d)|(?<![\d.])\d{1,3}%/g;
const SKIP_LINE = /doi|arxiv|http|pp\.|vol\.|isbn|issn/i;
const INSERTED = 'Our approach outperforms every prior method on every benchmark and is the best-performing model reported to date.';

// Plants (a) numeric mismatches: a number that appears in 2+ places is altered in ONE place,
// and (b) one unsupported superlative claim. Returns the tampered text and the ground truth.
function plantErrors(text, seed = 1, numericCount = 2) {
  const r = rng(seed);
  const lines = text.replace(/\r/g, '').split('\n');
  const occ = new Map();
  lines.forEach((line, li) => {
    for (const m of line.matchAll(NUM)) {
      const tok = m[0];
      if (tok.length < 4) continue;
      if (!occ.has(tok)) occ.set(tok, []);
      occ.get(tok).push({ li, pos: m.index, skip: SKIP_LINE.test(line) });
    }
  });
  const cands = [...occ.entries()].filter(([, o]) => new Set(o.map((x) => x.li)).size >= 2 && o.some((x) => !x.skip));
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }

  const truth = [];
  const usedLines = new Set();
  for (const [tok, o] of cands) {
    if (truth.length >= numericCount) break;
    const targets = o.filter((x) => !x.skip && !usedLines.has(x.li));
    if (!targets.length) continue;
    const t = targets[Math.floor(r() * targets.length)];
    const dot = tok.indexOf('.');
    let tampered;
    if (dot >= 0) {
      const d = +tok[dot + 1];
      const nd = (d + 2 + Math.floor(r() * 6)) % 10; // 2..7 steps away, always different
      tampered = tok.slice(0, dot + 1) + nd + tok.slice(dot + 2);
    } else {
      const n = parseInt(tok, 10);
      tampered = Math.max(1, n + (r() < 0.5 ? -1 : 1) * (5 + Math.floor(r() * 10))) + '%';
    }
    const line = lines[t.li];
    lines[t.li] = line.slice(0, t.pos) + tampered + line.slice(t.pos + tok.length);
    usedLines.add(t.li);
    const a = Math.max(0, t.pos - 35);
    truth.push({
      id: 'T' + (truth.length + 1),
      type: 'numeric_mismatch',
      original: tok,
      tampered,
      snippet: lines[t.li].slice(a, t.pos + tampered.length + 35).trim(),
      description: `"${tok}" changed to "${tampered}" in one place; the original value still appears elsewhere.`,
    });
  }

  // insert only after a line that ends a sentence, so the planted claim never cuts a sentence in half
  let at = lines.findIndex((l, i) => i >= 3 && l.trim().length > 40 && /[.!?]["')\]]?$/.test(l.trim()) && !/abstract|keywords/i.test(l));
  if (at < 0) at = lines.findIndex((l) => /[.!?]$/.test(l.trim()));
  if (at < 0) at = 0;
  lines.splice(at + 1, 0, INSERTED);
  truth.push({
    id: 'T' + (truth.length + 1),
    type: 'unsupported_claim',
    original: '',
    tampered: INSERTED,
    snippet: INSERTED,
    description: 'Inserted a superlative claim that no experiment in the paper supports.',
  });
  return { text: lines.join('\n'), truth };
}

function blockOf(blocks, t) {
  const exact = blocks.find((b) => b.text.includes(t.snippet));
  if (exact) return exact.id;
  const tok = blocks.find((b) => t.tampered && b.text.includes(t.tampered));
  return tok ? tok.id : null;
}

module.exports = { chunk, plantErrors, blockOf };
