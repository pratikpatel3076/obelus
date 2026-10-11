// Prompt builders for the manual (copy-paste) workflow. Each returns one string
// to paste into claude.ai. Nothing here calls an API.

const FINDINGS_SCHEMA = `{"findings":[{"id":"F1","type":"numeric_mismatch | unsupported_claim | contradiction | other",
"claim":"one-sentence description of the problem","evidence_blocks":["C03","C12"],
"quotes":["exact quote from first block (under 25 words)","exact quote from second block"],
"explanation":"why these conflict or why nothing supports the claim","confidence":"high | medium | low"}]}`;

const paper = (blocks) => blocks.map((b) => `[${b.id}] ${b.text}`).join('\n\n');

function baseline(blocks) {
  return `Below is a research paper split into numbered blocks. Find errors or inconsistencies in the paper.

Return only JSON in this format:
${FINDINGS_SCHEMA}

PAPER:
${paper(blocks)}`;
}

function stage1(blocks) {
  return `ROLE
You are a forensic research auditor. In this step you do NOT judge anything. You only list the claims that can be checked.

TASK
Read the numbered blocks and extract every checkable claim:
- kind "number": any reported result, metric, dataset size, split, or hyperparameter value
- kind "comparison": any statement that something is better, best, faster, or outperforms something else
- kind "dataset": any fact about the data source, time period, or sample
Copy numbers exactly as written. Record the block ID where each claim appears and where in the paper it sits (abstract, table, body, conclusion).

OUTPUT
Return only JSON:
{"claims":[{"id":"K1","kind":"number | comparison | dataset","text":"the claim in one sentence","value":"exact number or empty","metric":"what it measures or empty","blocks":["C02"],"where":"abstract | table | body | conclusion"}]}

EXAMPLE
Block: [C01] Our model reaches an AUC of 0.81 on 12,000 loans and beats logistic regression.
Output: {"claims":[{"id":"K1","kind":"number","text":"AUC of 0.81","value":"0.81","metric":"AUC","blocks":["C01"],"where":"abstract"},
{"id":"K2","kind":"dataset","text":"12,000 loans","value":"12,000","metric":"sample size","blocks":["C01"],"where":"abstract"},
{"id":"K3","kind":"comparison","text":"beats logistic regression","value":"","metric":"","blocks":["C01"],"where":"abstract"}]}

PAPER:
${paper(blocks)}`;
}

function stage2(blocks, claimsJson) {
  return `ROLE
You are a skeptical peer reviewer whose job is to find places where this paper disagrees with itself. Assume errors exist and look for them, but never report something you cannot quote.

INPUT
CLAIMS (extracted in the previous step):
${claimsJson}

PAPER:
${paper(blocks)}

TASK
For each claim:
1. Search every block for other mentions of the same quantity or fact (abstract, tables, body, conclusion).
2. If two mentions give different values, report a "numeric_mismatch". Ignore differences that are only rounding or formatting (for example 0.75 and 0.7521), but report anything larger.
3. If a claim says something is best, better, or outperforms others, check that some block actually reports an experiment or table that supports it. If none does, report an "unsupported_claim".
4. Report other self-contradictions as "contradiction".

RULES
- Every finding must cite at least one block ID and quote under 25 words from each cited block, copied exactly.
- If you are unsure, report it with confidence "low" instead of dropping it.
- If you find nothing, return {"findings":[]}.

OUTPUT
Return only JSON in this format:
${FINDINGS_SCHEMA}`;
}

function stage3(blocks, findingsJson) {
  return `ROLE
You are an independent verifier. You did not write the findings below. Your job is to reject weak ones.

INPUT
CANDIDATE FINDINGS:
${findingsJson}

PAPER:
${paper(blocks)}

TASK
For each candidate finding, re-read the cited blocks and decide:
- CONFIRMED: the quotes really appear in the cited blocks and really conflict, or the superlative claim really has no supporting experiment anywhere in the paper.
- REJECTED: the quote is not in the block, the difference is only rounding, the two numbers measure different things (different dataset, model or metric), or the claim is supported somewhere in the paper.

OUTPUT
Return only JSON:
{"findings":[ ...only the CONFIRMED findings, same fields as the input, plus "verdict_reason": "one sentence" ...],
"rejected":[{"id":"F2","reason":"one sentence"}]}`;
}

module.exports = { baseline, stage1, stage2, stage3 };
