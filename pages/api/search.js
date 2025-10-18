// Robust tube station search (works for Hammersmith / King's Cross)
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
  return children.map(c => ({ id: c.id, name: c.commonName || c.name }));
}
function cleanStationName(name){
  if(!name) return name;
  return name.replace(/\s*\(?Underground Station\)?/gi, '').trim();
}
export default async function handler(req, res) {
  let q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error: 'missing q' });
  // Normalize quotes/whitespace to help "king’s" etc.
  q = q.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  async function searchPrimary(){
    // DO NOT append modes here; TfL may ignore or reject on this endpoint
    const url = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}${params.toString()?`?${params.toString()}`:''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('search failed');
    return r.json();
  }
  async function searchFallback(){
    // Generic query endpoint
    const url = `https://api.tfl.gov.uk/StopPoint?query=${encodeURIComponent(q)}${params.toString()?`&${params.toString()}`:''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('fallback failed');
    const arr = await r.json();
    return { matches: (Array.isArray(arr)?arr:[]).map(x => ({ id: x.id, name: x.commonName || x.name })) };
  }

  try {
    let json;
    try { json = await searchPrimary(); } catch { json = await searchFallback(); }
    const matches = (json.matches || []).slice(0, 25);

    const out = [];
    for (const m of matches) {
      const id = String(m.id || '');
      if (id.startsWith('940G')) {
        out.push({ id: m.id, name: cleanStationName(m.name) });
      } else {
        const kids = await resolveTubeChildren(m.id, params);
        for (const k of kids) out.push({ id: k.id, name: cleanStationName(k.name) });
      }
    }

    // Deduplicate
    const uniq = new Map();
    for (const r of out) if (!uniq.has(r.id)) uniq.set(r.id, r);
    const normalized = Array.from(uniq.values());

    // Enrich tube lines from TfL
    const enriched = [];
    for (const r of normalized) {
      try {
        const lu = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(r.id)}/Lines${params.toString()?`?${params.toString()}`:''}`;
        const rr = await fetch(lu);
        let lines = await rr.json();
        if (!Array.isArray(lines)) lines = [];
        const filtered = lines.filter(l => (l.modeName||'').toLowerCase()==='tube').map(l => ({ id: l.id, name: l.name }));
        enriched.push({ ...r, lines: filtered });
      } catch { enriched.push({ ...r, lines: [] }); }
    }

    res.status(200).json({ results: enriched });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
