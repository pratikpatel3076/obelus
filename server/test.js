// Offline sanity tests for chunking, error planting and prompts.
const assert = require('assert');
const { chunk, plantErrors, blockOf } = require('./lib/text');
const prompts = require('./lib/prompts');

const sample = [
  'Credit Default Prediction for Micro Lenders',
  'Abstract',
  'We study loan default using gradient boosting on 12,400 borrowers and reach an AUC of 0.8213 with accuracy of 79.53 percent overall.',
  'Keywords: credit, default, boosting',
  '1 Introduction',
  'Credit scoring is important for lenders because defaults cause large losses across the whole portfolio of the lender.',
  '4 Results',
  'Table 3. XGBoost achieves AUC 0.8213 on the test sample.',
  'The accuracy was 79.53 percent and the F1 score was 0.7144 on the held-out data.',
  'Logistic regression reached an AUC of 0.7410 on the same split.',
  '5 Conclusion',
  'The boosted model reached an AUC of 0.8213 and an F1 score of 0.7144, an improvement over logistic regression.',
  'References',
  '[1] Smith, J. Lecture Notes in Computer Science. 3408. 345-359. 10.1007/978-3-540-31865-1_25.',
  '[2] Jones, K. Lecture Notes in Computer Science. 3409. 100-110. 10.1007/978-3-540-31865-1_26.',
].join('\n');

const a = plantErrors(sample, 7);
const b = plantErrors(sample, 7);
assert.deepStrictEqual(a, b, 'planting must be deterministic for a seed');
assert.ok(a.truth.length >= 2, 'should plant at least one numeric and one unsupported claim');
assert.ok(a.truth.some((t) => t.type === 'unsupported_claim'));
const num = a.truth.filter((t) => t.type === 'numeric_mismatch');
assert.ok(num.length >= 1);
for (let seed = 1; seed <= 30; seed++) {
  plantErrors(sample, seed).truth.filter((t) => t.type === 'numeric_mismatch').forEach((t) => {
    assert.ok(!t.original.startsWith('10.1007'), 'must not plant in a DOI or the reference list');
  });
}
num.forEach((t) => {
  assert.notStrictEqual(t.original, t.tampered);
  assert.ok(a.text.includes(t.tampered));
});
const blocks = chunk(a.text, 200);
assert.ok(blocks.length > 1 && blocks[0].id === 'C01');
a.truth.forEach((t) => assert.ok(blockOf(blocks, t), 'every planted error maps to a block: ' + t.id));
assert.ok(prompts.stage2(blocks, '{"claims":[]}').includes('[C01]'));
assert.ok(prompts.stage4(blocks, '{"findings":[]}').includes('future_work'));
// the planted sentence must follow a line that ends a sentence
const ls = a.text.split('\n');
const k = ls.findIndex((l) => l.includes('best-performing model reported to date'));
assert.ok(/[.!?]$/.test(ls[k - 1].trim()), 'planted claim must not cut a sentence');
console.log('OK:', a.truth.map((t) => `${t.id} ${t.type} ${t.original}->${t.tampered}`).join(' | '));
