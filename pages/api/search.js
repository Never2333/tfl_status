// Tube-only, fast, and filtered search
// - Excludes 910G (National Rail), 490 (Bus), etc.
// - Resolves to 940G tube station/platform and derives line badges from lineModeGroups
// - Caches StopPoint detail and search results for 60s
// - Requires q length >= 3 to reduce requests

const SEARCH_CACHE = global._SEARCH_CACHE_STRICT ||= new Map();
const SP_CACHE = global._SP_CACHE ||= new Map();
const TTL = 60 * 1000;

function setCache(map, key, value){ map.set(key, { value, ts: Date.now() }); }
function getCache(map, key){ const e = map.get(key); if(!e) return null; if(Date.now()-e.ts>TTL){ map.delete(key); return null; } return e.value; }

const LINES_MAP = {
  'bakerloo':'Bakerloo',
  'central':'Central',
  'circle':'Circle',
  'district':'District',
  'elizabeth':'Elizabeth',
  'hammersmith-city':'Hammersmith & City',
  'jubilee':'Jubilee',
  'metropolitan':'Metropolitan',
  'northern':'Northern',
  'piccadilly':'Piccadilly',
  'victoria':'Victoria',
  'waterloo-city':'Waterloo & City',
  'dlr':'DLR',
  'london-overground':'Overground'
};

function cleanName(name){
  if(!name) return name;
  return name.replace(/\s*\(?Underground Station\)?/gi, '').trim();
}

async function fetchStopPoint(id, params){
  const ck = `sp:${id}`;
  const cached = getCache(SP_CACHE, ck);
  if (cached) return cached;
  const url = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}${params.toString()?`?${params.toString()}`:''}`;
  const r = await fetch(url);
  const sp = await r.json();
  setCache(SP_CACHE, ck, sp);
  return sp;
}

function isTubeStationNode(node){
  const id = String(node.id||'');
  if (!id.startsWith('940G')) return false;
  const modes = (node.modes || []).map(x=>String(x).toLowerCase());
  const st = String(node.stopType||'').toLowerCase();
  return modes.includes('tube') && (st.includes('naptanmetrostation') || st.includes('naptanmetroplatform'));
}

function deriveTubeLinesFromSP(sp){
  const groups = Array.isArray(sp.lineModeGroups)? sp.lineModeGroups : [];
  const tubeGroupIds = groups.filter(g => String(g.modeName||'').toLowerCase()==='tube')
                             .flatMap(g => Array.isArray(g.lineIdentifier)? g.lineIdentifier : []);
  const uniq = Array.from(new Set(tubeGroupIds));
  const mapped = uniq.map(id => ({ id, name: LINES_MAP[id] || id }));
  return mapped;
}

export default async function handler(req, res){
  let q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error: 'missing q' });
  q = q.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (q.length < 3) return res.status(200).json({ results: [] });

  const cacheKey = `q:${q}`;
  const cached = getCache(SEARCH_CACHE, cacheKey);
  if (cached){
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    return res.status(200).json(cached);
  }

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  async function primary(){
    const url = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}${params.toString()?`?${params.toString()}`:''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('search failed');
    return r.json();
  }
  async function fallback(){
    const url = `https://api.tfl.gov.uk/StopPoint?query=${encodeURIComponent(q)}${params.toString()?`&${params.toString()}`:''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('fallback failed');
    const arr = await r.json();
    return { matches: (Array.isArray(arr)?arr:[]).map(x => ({ id: x.id, name: x.commonName || x.name, modes: x.modes, stopType: x.stopType })) };
  }

  try{
    let json;
    try { json = await primary(); } catch { json = await fallback(); }

    const matches = (json.matches || []).slice(0, 30);
    const candidates = [];
    for (const m of matches){
      const id = String(m.id||'');
      // Hard exclude obvious non-tube prefixes
      if (id.startsWith('910') || id.startsWith('490') || id.startsWith('HUB')) continue;

      if (id.startsWith('940G')){
        candidates.push({ id, name: cleanName(m.name) });
        continue;
      }
      // Need to resolve to tube station(s)
      try{
        const sp = await fetchStopPoint(id, params);
        // If the node itself is a tube station/platform, prefer its parent station (for richer lines)
        if (isTubeStationNode(sp)){
          const node = sp;
          if (String(node.stopType||'').toLowerCase().includes('naptanmetroplatform') && node.parentId){
            const parent = await fetchStopPoint(node.parentId, params);
            if (isTubeStationNode(parent)) candidates.push({ id: parent.id, name: cleanName(parent.commonName || parent.name) });
          }else{
            candidates.push({ id: node.id, name: cleanName(node.commonName || node.name) });
          }
        }else{
          // inspect children for tube stations
          const children = Array.isArray(sp.children)? sp.children : [];
          const stations = children.filter(isTubeStationNode);
          for (const s of stations){
            // If child is platform and parentId exists, elevate to parent station
            if (String(s.stopType||'').toLowerCase().includes('naptanmetroplatform') && s.parentId){
              const parent = await fetchStopPoint(s.parentId, params);
              if (isTubeStationNode(parent)) candidates.push({ id: parent.id, name: cleanName(parent.commonName || parent.name) });
            }else{
              candidates.push({ id: s.id, name: cleanName(s.commonName || s.name) });
            }
          }
        }
      }catch{ /* ignore */ }
    }

    // Deduplicate by id
    const uniq = new Map();
    for (const c of candidates) if (!uniq.has(c.id)) uniq.set(c.id, c);
    let list = Array.from(uniq.values());

    // Enrich with tube lines via lineModeGroups (fetch StopPoint detail, with cache)
    // Limit to top 12 for performance
    list = list.slice(0, 12);
    const enriched = [];
    await Promise.all(list.map(async (c)=>{
      try{
        const sp = await fetchStopPoint(c.id, params);
        const lines = deriveTubeLinesFromSP(sp);
        // If no tube lines after derivation, drop this candidate
        if (!lines.length) return;
        enriched.push({ ...c, lines });
      }catch{}
    }));

    const result = { results: enriched };
    setCache(SEARCH_CACHE, cacheKey, result);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    return res.status(200).json(result);
  }catch(e){
    return res.status(500).json({ error: String(e) });
  }
}
