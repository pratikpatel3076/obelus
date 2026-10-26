// Scoring: compare model findings with the planted ground truth.

export function normId(s) {
  const m = /C\s*0*(\d+)/i.exec(String(s));
  return m ? 'C' + String(Number(m[1])).padStart(2, '0') : String(s).trim();
}

// Pull the first JSON object out of pasted chat text (handles ```json fences and chatter).
export function extractJson(text) {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('No JSON object found in the pasted text.');
  return JSON.parse(text.slice(a, b + 1));
}

export function matchTruth(finding, truth) {
  const blocks = (finding.evidence_blocks || []).map(normId);
  const quotes = (finding.quotes || []).join(' ');
  return truth.findIndex((t) => {
    if (t.block && blocks.includes(t.block)) return true;
    if (t.type === 'numeric_mismatch' && t.tampered && quotes.includes(t.tampered)) return true;
    if (t.type === 'unsupported_claim' && quotes.includes(t.snippet.slice(0, 30))) return true;
    return false;
  });
}

// excluded: Set of finding ids the user marked as genuine problems in the original paper
export function score(findings, truth, excluded = new Set()) {
  const considered = findings.filter((f) => !excluded.has(f.id));
  const hit = new Set();
  let tp = 0;
  const labels = {};
  for (const f of findings) {
    if (excluded.has(f.id)) { labels[f.id] = 'genuine'; continue; }
    const i = matchTruth(f, truth);
    if (i >= 0) { tp++; hit.add(i); labels[f.id] = 'TP'; } else labels[f.id] = 'FP';
  }
  const precision = considered.length ? tp / considered.length : null;
  const recall = truth.length ? hit.size / truth.length : null;
  const f1 = precision && recall ? (2 * precision * recall) / (precision + recall) : precision === 0 || recall === 0 ? 0 : null;
  return { found: considered.length, tp, fp: considered.length - tp, caught: hit.size, planted: truth.length, precision, recall, f1, labels };
}

export const pct = (x) => (x == null ? 'n/a' : (x * 100).toFixed(0) + '%');

const flat = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Code-level evidence check: does each quote in a finding really appear in the paper?
// Looks in the cited blocks first, then anywhere in the paper.
export function quoteCheck(finding, blocks) {
  const quotes = (finding.quotes || []).filter((q) => flat(q));
  if (!quotes.length) return { total: 0, found: 0, inCited: 0 };
  const cited = (finding.evidence_blocks || []).map(normId);
  const citedText = flat(blocks.filter((b) => cited.includes(b.id)).map((b) => b.text).join(' '));
  const allText = flat(blocks.map((b) => b.text).join(' '));
  let found = 0;
  let inCited = 0;
  for (const q of quotes) {
    const n = flat(q);
    if (citedText.includes(n)) { found++; inCited++; } else if (allText.includes(n)) found++;
  }
  return { total: quotes.length, found, inCited };
}

export function quoteStats(findings, blocks) {
  let total = 0;
  let found = 0;
  for (const f of findings) { const q = quoteCheck(f, blocks); total += q.total; found += q.found; }
  return { total, found, rate: total ? found / total : null };
}

// Audit badge for one item of the structured analysis.
// disputed = the item cites a block that a confirmed finding also cites.
export function auditStatus(item, confirmedFindings) {
  const blocks = (item.blocks || []).map(normId);
  if (!blocks.length) return String(item.text || '').trim().toUpperCase() === 'NOT STATED' ? 'not_stated' : 'unsourced';
  const set = new Set(blocks);
  const hit = confirmedFindings.some((f) => (f.evidence_blocks || []).map(normId).some((b) => set.has(b)));
  return hit ? 'disputed' : 'clean';
}
