const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const pdf = require('pdf-parse');
const { chunk, plantErrors, blockOf } = require('./lib/text');
const prompts = require('./lib/prompts');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const RUNS_DIR = path.join(__dirname, 'runs');
fs.mkdirSync(RUNS_DIR, { recursive: true });

// Optional MongoDB persistence: set MONGODB_URI to also store runs in Mongo.
let RunModel = null;
if (process.env.MONGODB_URI) {
  try {
    const mongoose = require('mongoose');
    mongoose.connect(process.env.MONGODB_URI).then(() => console.log('MongoDB connected')).catch((e) => console.error('MongoDB:', e.message));
    RunModel = mongoose.model('Run', new mongoose.Schema({}, { strict: false, timestamps: true }));
  } catch (e) {
    console.error('mongoose not installed, using files only');
  }
}

// Some PDFs break the bundled parser ("bad XRef entry"); fall back to poppler's pdftotext if installed.
async function pdfToText(buffer) {
  try {
    return (await pdf(buffer)).text;
  } catch (first) {
    const tmp = path.join(os.tmpdir(), `ca_${Date.now()}.pdf`);
    try {
      fs.writeFileSync(tmp, buffer);
      return execFileSync('pdftotext', [tmp, '-'], { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
    } catch {
      throw new Error(`Could not read this PDF (${first.message}). Run "qpdf in.pdf out.pdf" and upload out.pdf, or paste the text instead.`);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
}

app.post('/api/ingest', upload.single('file'), async (req, res) => {
  try {
    let text = req.body.text || '';
    let name = req.body.name || 'pasted-text';
    if (req.file) {
      name = req.file.originalname;
      text = name.toLowerCase().endsWith('.pdf')
        ? await pdfToText(req.file.buffer)
        : req.file.buffer.toString('utf8');
    }
    if (!text.trim()) return res.status(400).json({ error: 'No text found. Scanned PDFs need OCR first.' });
    const plant = req.body.plant === 'true';
    const seed = Number(req.body.seed || 1);
    let truth = [];
    if (plant) ({ text, truth } = plantErrors(text, seed));
    const blocks = chunk(text);
    truth = truth.map((t) => ({ ...t, block: blockOf(blocks, t) }));
    res.json({ name, blocks, truth, planted: plant, seed, chars: text.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/prompt', (req, res) => {
  const { stage, blocks, payload } = req.body;
  const build = { baseline: prompts.baseline, stage1: prompts.stage1, stage2: prompts.stage2, stage3: prompts.stage3 }[stage];
  if (!build || !Array.isArray(blocks)) return res.status(400).json({ error: 'Bad request' });
  res.json({ prompt: build(blocks, payload) });
});

app.post('/api/runs', async (req, res) => {
  const run = req.body;
  const safe = String(run.paper || 'run').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 60);
  const file = path.join(RUNS_DIR, `${safe}_seed${run.seed ?? 0}.json`);
  fs.writeFileSync(file, JSON.stringify(run, null, 2));
  if (RunModel) RunModel.create(run).catch((e) => console.error('Mongo save:', e.message));
  res.json({ saved: path.basename(file) });
});

app.get('/api/runs', (req, res) => {
  const runs = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8')));
  res.json(runs);
});

const PORT = process.env.PORT || 5000;
if (require.main === module) app.listen(PORT, () => console.log(`Claim Auditor API on http://localhost:${PORT}`));
module.exports = app;
