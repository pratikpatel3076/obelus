async function json(r) {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export async function ingest({ file, text, plant, seed }) {
  const fd = new FormData();
  if (file) fd.append('file', file);
  if (text) fd.append('text', text);
  fd.append('plant', String(plant));
  fd.append('seed', String(seed));
  return json(await fetch('/api/ingest', { method: 'POST', body: fd }));
}

export async function getPrompt(stage, blocks, payload = null) {
  const r = await fetch('/api/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, blocks, payload }),
  });
  return (await json(r)).prompt;
}

export async function saveRun(run) {
  return json(await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) }));
}

export async function listRuns() {
  return json(await fetch('/api/runs'));
}
