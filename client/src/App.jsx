import React, { useMemo, useRef, useState } from 'react';
import { ingest, getPrompt, saveRun, listRuns } from './api.js';
import { extractJson, score, pct, normId } from './score.js';

const MODES = [
  { key: 'baseline', label: 'Baseline (1 prompt)' },
  { key: 'chainRaw', label: 'Chain after stage 2' },
  { key: 'chainFinal', label: 'Chain after stage 3 (verified)' },
];

export default function App() {
  const [tab, setTab] = useState('load');
  const [paper, setPaper] = useState(null);
  const [data, setData] = useState({ baseline: null, claims: null, chainRaw: null, chainFinal: null });
  const [excluded, setExcluded] = useState({ baseline: [], chainRaw: [], chainFinal: [] });
  const [active, setActive] = useState([]);
  const [reveal, setReveal] = useState(false);
  const [mode, setMode] = useState('chainFinal');
  const [msg, setMsg] = useState('');
  const paperRef = useRef(null);

  const truth = paper?.truth || [];
  const metrics = useMemo(() => {
    const out = {};
    for (const m of MODES) {
      const f = data[m.key]?.findings;
      out[m.key] = f ? score(f, truth, new Set(excluded[m.key])) : null;
    }
    return out;
  }, [data, truth, excluded]);

  function focusBlocks(ids) {
    const norm = ids.map(normId);
    setActive(norm);
    const el = norm[0] && document.getElementById('blk-' + norm[0]);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function onSave() {
    const run = {
      paper: paper.name, seed: paper.seed, planted: paper.planted, truth,
      baseline: data.baseline?.findings || [], chainRaw: data.chainRaw?.findings || [], chainFinal: data.chainFinal?.findings || [],
      excluded, metrics: Object.fromEntries(MODES.map((m) => [m.key, metrics[m.key] && { ...metrics[m.key], labels: undefined }])),
      savedAt: new Date().toISOString(),
    };
    try {
      const r = await saveRun(run);
      setMsg('Saved ' + r.saved);
    } catch (e) { setMsg(e.message); }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }));
    a.download = `run_${paper.name.replace(/\W+/g, '_')}_seed${paper.seed}.json`;
    a.click();
  }

  return (
    <div className="app">
      <header>
        <h1>Claim Auditor</h1>
        <span className="sub">Finds where a research paper disagrees with itself. Evidence highlights in the paper on the left.</span>
      </header>
      <div className="grid">
        <section className="paper" ref={paperRef}>
          <h2>{paper ? paper.name : 'Paper'} {paper && <small>{paper.blocks.length} blocks</small>}</h2>
          {!paper && <p className="muted">Load a paper to see its numbered blocks here.</p>}
          {paper?.blocks.map((b) => {
            const isTruth = reveal && truth.some((t) => t.block === b.id);
            return (
              <div key={b.id} id={'blk-' + b.id} className={'block' + (active.includes(b.id) ? ' active' : '') + (isTruth ? ' planted' : '')}>
                <span className="bid">[{b.id}]</span>{isTruth && <span className="tag">planted</span>}
                <pre>{b.text}</pre>
              </div>
            );
          })}
        </section>
        <section className="work">
          <nav>
            {[['load', '1 Load'], ['baseline', '2 Baseline'], ['chain', '3 Chain'], ['score', '4 Findings & score'], ['results', '5 All runs']].map(([k, l]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
            ))}
          </nav>
          {msg && <div className="msg" onClick={() => setMsg('')}>{msg}</div>}
          {tab === 'load' && <Load onLoaded={(p) => { setPaper(p); setData({ baseline: null, claims: null, chainRaw: null, chainFinal: null }); setExcluded({ baseline: [], chainRaw: [], chainFinal: [] }); setActive([]); setTab('baseline'); }} setMsg={setMsg} paper={paper} reveal={reveal} setReveal={setReveal} />}
          {tab === 'baseline' && <Baseline paper={paper} value={data.baseline} onChange={(v) => setData({ ...data, baseline: v })} setMsg={setMsg} />}
          {tab === 'chain' && <Chain paper={paper} data={data} setData={setData} setMsg={setMsg} />}
          {tab === 'score' && <Score paper={paper} data={data} metrics={metrics} mode={mode} setMode={setMode} excluded={excluded} setExcluded={setExcluded} focusBlocks={focusBlocks} active={active} onSave={onSave} reveal={reveal} />}
          {tab === 'results' && <Results />}
        </section>
      </div>
    </div>
  );
}

function Load({ onLoaded, setMsg, paper, reveal, setReveal }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [plant, setPlant] = useState(true);
  const [seed, setSeed] = useState(1);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try { onLoaded(await ingest({ file, text, plant, seed })); } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  return (
    <div>
      <h3>Load a paper</h3>
      <p className="muted">Upload a text-based PDF or .txt, or paste text. Planting adds known errors so the audit can be scored.</p>
      <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files[0])} />
      <textarea rows={4} placeholder="...or paste the paper text here" value={text} onChange={(e) => setText(e.target.value)} />
      <label><input type="checkbox" checked={plant} onChange={(e) => setPlant(e.target.checked)} /> Plant errors (2 numeric mismatches + 1 unsupported claim)</label>
      <label>Seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={{ width: 70 }} /></label>
      <button className="primary" disabled={busy || (!file && !text.trim())} onClick={go}>{busy ? 'Loading...' : 'Load paper'}</button>
      {paper?.planted && (
        <div className="truth">
          <label><input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Reveal planted errors ({paper.truth.length})</label>
          {reveal && paper.truth.map((t) => <p key={t.id}><b>{t.id}</b> in [{t.block}]: {t.description}</p>)}
        </div>
      )}
    </div>
  );
}

function PromptStep({ title, desc, stage, blocks, payload, disabled, value, onParse, setMsg, label }) {
  const [raw, setRaw] = useState(value?.raw || '');
  async function copy() {
    try {
      const p = await getPrompt(stage, blocks, payload);
      await navigator.clipboard.writeText(p);
      setMsg(`${label} prompt copied (${p.length.toLocaleString()} characters). Paste it into a NEW claude.ai chat.`);
    } catch (e) { setMsg(e.message); }
  }
  function parse() {
    try { onParse(raw, extractJson(raw)); setMsg(label + ' parsed.'); } catch (e) { setMsg('Parse failed: ' + e.message); }
  }
  return (
    <div className={'step' + (disabled ? ' off' : '')}>
      <h3>{title} {value && <span className="ok">parsed</span>}</h3>
      <p className="muted">{desc}</p>
      <button disabled={disabled} onClick={copy}>Copy prompt</button>
      <textarea rows={5} disabled={disabled} placeholder="Paste Claude's JSON reply here" value={raw} onChange={(e) => setRaw(e.target.value)} />
      <button className="primary" disabled={disabled || !raw.trim()} onClick={parse}>Parse reply</button>
    </div>
  );
}

function Baseline({ paper, value, onChange, setMsg }) {
  if (!paper) return <p className="muted">Load a paper first.</p>;
  return (
    <PromptStep label="Baseline" title="Baseline: one plain prompt" stage="baseline" blocks={paper.blocks} disabled={false} value={value}
      desc="Open a new claude.ai chat, paste the prompt, and paste the reply back. Use the same Claude model for every run."
      onParse={(raw, j) => onChange({ raw, findings: j.findings || [] })} setMsg={setMsg} />
  );
}

function Chain({ paper, data, setData, setMsg }) {
  if (!paper) return <p className="muted">Load a paper first.</p>;
  const b = paper.blocks;
  return (
    <div>
      <PromptStep label="Stage 1" title="Stage 1: extract claims" stage="stage1" blocks={b} disabled={false} value={data.claims}
        desc="Persona + few-shot + structured output. New chat."
        onParse={(raw, j) => setData({ ...data, claims: { raw, json: j }, chainRaw: null, chainFinal: null })} setMsg={setMsg} />
      <PromptStep label="Stage 2" title="Stage 2: red-team the claims" stage="stage2" blocks={b} payload={data.claims && JSON.stringify(data.claims.json)} disabled={!data.claims} value={data.chainRaw}
        desc="Reviewer persona searches every block for conflicts. New chat."
        onParse={(raw, j) => setData({ ...data, chainRaw: { raw, findings: j.findings || [] }, chainFinal: null })} setMsg={setMsg} />
      <PromptStep label="Stage 3" title="Stage 3: verify the findings" stage="stage3" blocks={b} payload={data.chainRaw && JSON.stringify({ findings: data.chainRaw.findings })} disabled={!data.chainRaw} value={data.chainFinal}
        desc="Independent verifier confirms or rejects each finding. New chat."
        onParse={(raw, j) => setData({ ...data, chainFinal: { raw, findings: j.findings || [], rejected: j.rejected || [] } })} setMsg={setMsg} />
    </div>
  );
}

function Score({ paper, data, metrics, mode, setMode, excluded, setExcluded, focusBlocks, active, onSave, reveal }) {
  if (!paper) return <p className="muted">Load a paper first.</p>;
  const findings = data[mode]?.findings || [];
  const labels = metrics[mode]?.labels || {};
  const toggle = (id) => setExcluded({ ...excluded, [mode]: excluded[mode].includes(id) ? excluded[mode].filter((x) => x !== id) : [...excluded[mode], id] });
  return (
    <div>
      <table className="metrics">
        <thead><tr><th></th><th>Found</th><th>Correct</th><th>False</th><th>Caught / planted</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
        <tbody>
          {MODES.map((m) => { const s = metrics[m.key]; return (
            <tr key={m.key} className={mode === m.key ? 'sel' : ''} onClick={() => setMode(m.key)}>
              <td>{m.label}</td>
              {s ? <><td>{s.found}</td><td>{s.tp}</td><td>{s.fp}</td><td>{s.caught}/{s.planted}</td><td>{pct(s.precision)}</td><td>{pct(s.recall)}</td><td>{pct(s.f1)}</td></> : <td colSpan={7} className="muted">not run yet</td>}
            </tr>); })}
        </tbody>
      </table>
      <p className="muted">Click a row to list its findings. Click a finding to highlight its evidence in the paper. Tick "genuine" for a real problem in the original paper so it is not counted as a false alarm.</p>
      <h3>{MODES.find((m) => m.key === mode).label}: {findings.length} findings</h3>
      {findings.map((f) => (
        <div key={f.id} className={'finding ' + (labels[f.id] || '')} onClick={() => focusBlocks(f.evidence_blocks || [])}>
          <div className="top">
            <b>{f.id}</b> <span className="chip">{f.type}</span> <span className="chip">{f.confidence}</span>
            {(f.evidence_blocks || []).map((e) => <span key={e} className={'chip blk' + (active.includes(normId(e)) ? ' on' : '')}>{normId(e)}</span>)}
            {paper.planted && <span className={'badge ' + labels[f.id]}>{labels[f.id]}</span>}
          </div>
          <p>{f.claim}</p>
          {(f.quotes || []).map((q, i) => <blockquote key={i}>{q}</blockquote>)}
          <label onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={excluded[mode].includes(f.id)} onChange={() => toggle(f.id)} /> genuine problem in the original paper</label>
        </div>
      ))}
      {mode === 'chainFinal' && data.chainFinal?.rejected?.length > 0 && (
        <details><summary>{data.chainFinal.rejected.length} rejected by the verifier</summary>
          {data.chainFinal.rejected.map((r) => <p key={r.id}><b>{r.id}</b> {r.reason}</p>)}
        </details>
      )}
      <button className="primary" onClick={onSave}>Save run + download JSON</button>
    </div>
  );
}

function Results() {
  const [runs, setRuns] = useState(null);
  const [err, setErr] = useState('');
  React.useEffect(() => { listRuns().then(setRuns).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="muted">{err}</p>;
  if (!runs) return <p className="muted">Loading...</p>;
  if (!runs.length) return <p className="muted">No saved runs yet. Save one from tab 4.</p>;
  const avg = (key, field) => {
    const v = runs.map((r) => r.metrics?.[key]?.[field]).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  return (
    <div>
      <h3>{runs.length} saved run(s)</h3>
      <table className="metrics">
        <thead><tr><th>Paper (seed)</th><th>Mode</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
        <tbody>
          {runs.flatMap((r) => MODES.map((m) => (
            <tr key={r.paper + r.seed + m.key}><td>{r.paper} ({r.seed})</td><td>{m.label}</td>
              <td>{pct(r.metrics?.[m.key]?.precision)}</td><td>{pct(r.metrics?.[m.key]?.recall)}</td><td>{pct(r.metrics?.[m.key]?.f1)}</td></tr>
          )))}
          {MODES.map((m) => (
            <tr key={'avg' + m.key} className="sel"><td><b>Average</b></td><td>{m.label}</td>
              <td>{pct(avg(m.key, 'precision'))}</td><td>{pct(avg(m.key, 'recall'))}</td><td>{pct(avg(m.key, 'f1'))}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
