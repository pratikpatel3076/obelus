import assert from 'assert';
import { score, extractJson, normId } from './score.js';

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
  { id: 'F4', evidence_blocks: ['C02'], quotes: [] },                                          // TP T3 again (dup)
  { id: 'F5', evidence_blocks: ['C11'], quotes: [] },                                          // genuine, excluded
];
const s = score(findings, truth, new Set(['F5']));
assert.strictEqual(s.found, 4);
assert.strictEqual(s.tp, 3);
assert.strictEqual(s.fp, 1);
assert.strictEqual(s.caught, 2);
assert.ok(Math.abs(s.precision - 0.75) < 1e-9);
assert.ok(Math.abs(s.recall - 2 / 3) < 1e-9);
assert.strictEqual(s.labels.F5, 'genuine');
assert.strictEqual(score([], truth).precision, null);
console.log('score tests OK', s);
