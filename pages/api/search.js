async function resolveTubeChildren(id, params){
  const spUrl = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}${params.toString()?`?${params.toString()}`:''}`;
  const spRes = await fetch(spUrl);
  const sp = await spRes.json();
  const children = (sp.children || []).filter(c => {
    const modes = (c.modes || []).map(x=>String(x).toLowerCase());
    const stopType = String(c.stopType||'').toLowerCase();
    const idok = String(c.id||'').startsWith('940G');
    return idok && modes.includes('tube') && (stopType.includes('naptanmetrostation') || stopType.includes('naptanmetroplatform'));
  });
  return children.map(c => ({ id: c.id, name: c.commonName || c.name, raw: c }));
}

export default async function handler(req, res) {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'missing q' });

  const params = new URLSearchParams();
  params.set('modes', 'tube');
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);
  const url = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}?${params.toString()}`;

  try {
    const r = await fetch(url);
    const json = await r.json();
    const matches = (json.matches || []).slice(0, 12);

    const out = [];
    for (const m of matches) {
      const id = String(m.id || '');
      if (id.startsWith('940G')) {
        out.push({ id: m.id, name: m.name });
      } else {
        const kids = await resolveTubeChildren(m.id, params);
        for (const k of kids) out.push({ id: k.id, name: k.name });
      }
    }

    const uniqMap = new Map();
    for (const r of out) { if (!uniqMap.has(r.id)) uniqMap.set(r.id, r); }
    const normalized = Array.from(uniqMap.values());

    const enriched = [];
    for (const r of normalized) {
      try {
        const lr = await fetch(`/api/stop-lines?id=${encodeURIComponent(r.id)}`);
        const lj = await lr.json();
        enriched.push({ ...r, lines: lj.lines || [] });
      } catch { enriched.push(r); }
    }

    res.status(200).json({ results: enriched });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
