import assert from 'assert';
import { score, extractJson, normId, quoteCheck, quoteStats, auditStatus } from './score.js';

assert.strictEqual(normId('[C3]'), 'C03');
assert.strictEqual(normId('c12'), 'C12');
assert.deepStrictEqual(extractJson('Sure!\n```json\n{"findings":[]}\n```'), { findings: [] });

const truth = [
  { id: 'T1', type: 'numeric_mismatch', original: '0.8213', tampered: '0.2213', snippet: 'AUC of 0.2213', block: 'C01' },
  { id: 'T2', type: 'numeric_mismatch', original: '0.7144', tampered: '0.3144', snippet: 'F1 of 0.3144', block: 'C05' },
  { id: 'T3', type: 'unsupported_claim', original: '', tampered: 'Our approach outperforms every prior method', snippet: 'Our approach outperforms every prior method on every benchmark', block: 'C02' },
];
const findings = [
  { id: 'F1', evidence_blocks: ['C01', 'C04'], quotes: ['AUC of 0.2213', 'AUC 0.8213'] },   // TP T1
  { id: 'F2', evidence_blocks: ['[C09]'], quotes: ['something else'] },                       // FP
  { id: 'F3', evidence_blocks: ['C20'], quotes: ['Our approach outperforms every prior method on every'] }, // TP T3 via quote
  { id: 'F4', evidence_blocks: ['C02'], quotes: [], claim: 'cites the same block but says nothing about the planted text' }, // FP: block overlap alone no longer counts
  { id: 'F5', evidence_blocks: ['C11'], quotes: [] },                                          // genuine, excluded
];
const s = score(findings, truth, new Set(['F5']));
assert.strictEqual(s.found, 4);
assert.strictEqual(s.tp, 2);
assert.strictEqual(s.fp, 2);
assert.strictEqual(s.caught, 2);
assert.ok(Math.abs(s.precision - 0.5) < 1e-9);
assert.ok(Math.abs(s.recall - 2 / 3) < 1e-9);
assert.strictEqual(s.labels.F5, 'genuine');
assert.strictEqual(score([], truth).precision, null);
// 114% must not match 1114% or 114.5%, but must match inside a sentence
const t114 = [{ id: 'T1', type: 'numeric_mismatch', original: '100%', tampered: '114%', block: 'C08' }];
assert.strictEqual(score([{ id: 'A', quotes: ['a precision of 114% means'] }], t114).tp, 1);
assert.strictEqual(score([{ id: 'B', quotes: ['a precision of 1114% means'] }], t114).tp, 0);
assert.strictEqual(score([{ id: 'C', evidence_blocks: ['C08'], quotes: ['unrelated text'] }], t114).tp, 0);
console.log('score tests OK', s);

const blocks = [
  { id: 'C01', text: 'The model reaches an AUC of 0.2213 on the\ntest sample.' },
  { id: 'C02', text: 'Logistic regression reached 0.7410.' },
];
assert.deepStrictEqual(quoteCheck({ evidence_blocks: ['C01'], quotes: ['AUC of 0.2213 on the test sample'] }, blocks), { total: 1, found: 1, inCited: 1 });
assert.strictEqual(quoteCheck({ evidence_blocks: ['C01'], quotes: ['AUC of 0.9999'] }, blocks).found, 0);       // invented quote
assert.deepStrictEqual(quoteCheck({ evidence_blocks: ['C01'], quotes: ['reached 0.7410'] }, blocks), { total: 1, found: 1, inCited: 0 }); // real quote, wrong block
assert.strictEqual(quoteStats([{ evidence_blocks: ['C01'], quotes: ['AUC of 0.9999', 'test sample'] }], blocks).rate, 0.5);
const conf = [{ evidence_blocks: ['C02'] }];
assert.strictEqual(auditStatus({ text: 'x', blocks: ['C02'] }, conf), 'disputed');
assert.strictEqual(auditStatus({ text: 'x', blocks: ['C01'] }, conf), 'clean');
assert.strictEqual(auditStatus({ text: 'NOT STATED', blocks: [] }, conf), 'not_stated');
assert.strictEqual(auditStatus({ text: 'no source', blocks: [] }, conf), 'unsourced');
console.log('quote + audit tests OK');
