# Pilot run: arXiv 2110.02206, seed 1

One paper, one run per approach, one rater. Treat the numbers as indicative only.

Paper: K.S. Naik (2021), *Predicting Credit Risk for Unsecured Lending: A Machine Learning Approach*, arXiv:2110.02206.
Raw data: `run_2110_02206v1_pdf_seed1.json` (planted errors, every finding from each approach, and the stage 4 analysis).

## Planted errors (seed 1)

| ID | Type | Original | Planted | Block |
| --- | --- | --- | --- | --- |
| T1 | numeric_mismatch | 100% | 114% | C08 |
| T2 | numeric_mismatch | 10.1007 | 10.4007 (DOI prefix in the reference list) | C18 |
| T3 | unsupported_claim | none | "Our approach outperforms every prior method on every benchmark..." | C02 |

## Results (strict matching: a finding must contain the planted content)

| Approach | Findings | Correct | Precision | Recall | F1 |
| --- | --- | --- | --- | --- | --- |
| Baseline (one prompt) | 17 | 2 | 11.8% | 66.7% | 20.0% |
| Chain after stage 2 | 21 | 2 | 9.5% | 66.7% | 16.7% |
| Chain after stage 3 (verified) | 10 | 2 | 20.0% | 66.7% | 30.8% |

- All approaches caught T1 and T3 and missed T2, which sat in the reference list. The planting code now skips references.
- Stage 3 removed 11 of 21 findings without losing a planted error or a real inconsistency.
- All approaches found the same two real inconsistencies in the paper: six versus seven models, and 95.35% in the text versus 0.9552716 in Table 3.
- Every quote returned was found in the paper (31/31, 46/46, 21/21), so the quote check did not separate the approaches.
- Stage 4 returned 25 statements. 20 were tagged disputed, which shows block-level badges are too coarse.
- The numbers saved inside the JSON (`metrics`) come from an earlier scorer that credited any finding citing the same block as a planted error. Re-score with the current code, as the All runs tab does.
