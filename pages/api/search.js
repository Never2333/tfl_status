// Faster & smarter search: caching + robust line resolution (handles Circle at Hammersmith)
const CACHE = global._SEARCH_CACHE ||= new Map();
const CACHE_TTL_MS = 60 * 1000; // 60s soft cache

function setCache(key, value){
  CACHE.set(key, { value, ts: Date.now() });
}
function getCache(key){
  const e = CACHE.get(key);
  if(!e) return null;
  if(Date.now() - e.ts > CACHE_TTL_MS){ CACHE.delete(key); return null; }
  return e.value;
}

async function resolveTubeChildren(id, params){
  const spUrl = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}${params.toString()?`?${params.toString()}`:''}`;
  const r = await fetch(spUrl);
  const sp = await r.json();

  // Prefer parent station if current is a platform
  const stopType = String(sp.stopType||'').toLowerCase();
  if (stopType.includes('naptanmetroplatform') && sp.parentId){
    const pr = await fetch(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(sp.parentId)}${params.toString()?`?${params.toString()}`:''}`);
    const parent = await pr.json();
    return [{ id: parent.id, name: parent.commonName || parent.name }];
  }

  const children = (sp.children || []).filter(c => {
    const modes = (c.modes || []).map(x=>String(x).toLowerCase());
    const st = String(c.stopType||'').toLowerCase();
    const idok = String(c.id||'').startsWith('940G');
    return idok && modes.includes('tube') && (st.includes('naptanmetrostation') || st.includes('naptanmetroplatform'));
  });
  // If there are proper station nodes among children, return those; else return original
  const stations = children.filter(c => String(c.stopType||'').toLowerCase().includes('naptanmetrostation'));
  if (stations.length) return stations.map(c => ({ id: c.id, name: c.commonName || c.name }));
  if (children.length) return children.map(c => ({ id: c.id, name: c.commonName || c.name }));
  return [{ id: sp.id, name: sp.commonName || sp.name }];
}

function cleanStationName(name){
  if(!name) return name;
  return name.replace(/\s*\(?Underground Station\)?/gi, '').trim();
}

async function fetchTubeLinesFor(stopId, params){
  // Cache
  const ck = `lines:${stopId}`;
  const cached = getCache(ck);
  if (cached) return cached;

  // Fetch detail first to detect parent & mode groups
  const du = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(stopId)}${params.toString()?`?${params.toString()}`:''}`;
  const dr = await fetch(du);
  const dj = await dr.json();

  // If it's a platform, resolve to parent station for broader line list
  let stationId = stopId;
  const st = String(dj.stopType||'').toLowerCase();
  if (st.includes('naptanmetroplatform') && dj.parentId) stationId = dj.parentId;

  // Primary: /Lines on station
  let lines = [];
  try{
    const lu = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(stationId)}/Lines${params.toString()?`?${params.toString()}`:''}`;
    const lr = await fetch(lu);
    const lj = await lr.json();
    if (Array.isArray(lj)) lines = lj;
  }catch{}

  // Fallback: lineModeGroups from detail (covers Circle/H&C at Hammersmith stations)
  if (!lines.length && Array.isArray(dj.lineModeGroups)){
    const ids = (dj.lineModeGroups||[]).flatMap(g=>g.lineIdentifier || []);
    // Map ids to {id,name} via /Line/{ids}
    if (ids.length){
      const liu = `https://api.tfl.gov.uk/Line/${ids.join(',')}${params.toString()?`?${params.toString()}`:''}`;
      try{
        const lir = await fetch(liu);
        const lis = await lir.json();
        lines = Array.isArray(lis)? lis : [];
      }catch{}
    }
  }

  const filtered = (lines||[]).filter(l => (l.modeName||'').toLowerCase()==='tube').map(l => ({ id: l.id, name: l.name }));
  setCache(ck, filtered);
  return filtered;
}

export default async function handler(req, res) {
  let q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error: 'missing q' });
  q = q.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

  const cacheKey = `search:${q}`;
  const cached = getCache(cacheKey);
  if (cached){ return res.status(200).json(cached); }

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  async function searchPrimary(){
    const url = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}${params.toString()?`?${params.toString()}`:''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('search failed');
    return r.json();
  }
  async function searchFallback(){
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

    // Enrich tube lines
    const enriched = [];
    await Promise.all(normalized.map(async (r)=>{
      const lines = await fetchTubeLinesFor(r.id, params);
      enriched.push({ ...r, lines });
    }));

    const result = { results: enriched };
    setCache(cacheKey, result);
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
