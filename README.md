# Obelus

*Marks the doubtful passages.*

An obelus is the mark that ancient scribes and scholars put beside a passage in a manuscript to flag it as doubtful. This app does the same for a research paper: it marks the passages that disagree with each other or that nothing in the paper supports, and shows the evidence.

A MERN-style app (React + Express, optional MongoDB) that audits a research paper for places where it
disagrees with itself, and scores the audit against errors planted in the paper.

No API key is needed. The app builds each prompt, you paste it into claude.ai, and you paste Claude's
JSON reply back. The app parses it, highlights the evidence in the paper, and computes precision and recall.

## Setup (once)
```bash
npm run install:all      # installs root, server and client dependencies
npm run dev              # API on :5000, app on http://localhost:5173
```
Optional: `MONGODB_URI=mongodb://localhost:27017/claimauditor npm run server` also stores runs in MongoDB.
Runs are always saved as JSON files in `server/runs/`.

If a PDF fails with "Could not read this PDF", run `qpdf in.pdf out.pdf` and upload `out.pdf`, or paste the text.

## Per paper (about 20 minutes)
1. Tab 1: upload the PDF, keep "Plant errors" ticked, pick a seed, click Load.
2. Tab 2: Copy prompt, paste in a NEW claude.ai chat, paste the JSON reply back, click Parse.
3. Tab 3: do stage 1, then stage 2, then stage 3, then stage 4, each in a NEW chat. Use the same Claude model as the baseline.
4. Tab 4 (Audited analysis): the 8 fields from the course brief (problem, objectives, methodology, dataset, algorithms,
   results, limitations, future work). Every sentence carries a badge set by code: DISPUTED if it cites a block that a
   confirmed finding also cites, "not stated" if the paper is silent, otherwise "no conflict found". Click a sentence to
   highlight its source block.
5. Tab 5 (Findings & score): click a finding to highlight its evidence. A finding counts as catching a planted error only if its text contains the planted content (block overlap alone no longer counts). Each finding has a code-checked quote badge
   (is every quote really in the paper?). Tick "genuine problem in the original paper" for real inconsistencies you
   confirm in the PDF so they are not counted as false alarms. Click "Save run".
6. Tab 6 shows per-paper and average precision, recall, F1 and quote-found rate for baseline vs chain.

## Tests
```bash
npm test --prefix server    # chunking, error planting, prompts
npm test --prefix client    # scoring
```

## How scoring works
- Planted: 2 numeric mismatches (a number that appears twice is altered in one place) + 1 unsupported superlative claim.
- A finding is correct only if its quotes, claim or explanation contain the planted content (the changed number or the inserted sentence). Citing the same 1,500-character block is not enough.
- The planter never edits the reference list or DOI-like numbers.
- Tab 6 re-scores every saved run with this strict rule and no "genuine" exclusions, so all runs are comparable.
- Precision = correct findings / all findings. Recall = planted errors caught / planted errors.
- Several findings pointing at the same planted error each count as correct, so precision can be slightly generous.
- Quotes found in paper = share of quoted snippets that really occur in the paper text (checked by code, ignoring case and
  punctuation). A low value means the model invented or altered quotes.
