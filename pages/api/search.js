// pro8: Always return 940G *station* IDs (no HUB, no platform)
const CACHE = global._SEARCH_CACHE_P8 ||= new Map();
const TTL = 60 * 1000;

function setCache(key, value){ CACHE.set(key, { value, ts: Date.now() }); }
function getCache(key){
  const e = CACHE.get(key);
  if(!e) return null;
  if(Date.now() - e.ts > TTL){ CACHE.delete(key); return null; }
  return e.value;
}

function norm(s){ return String(s||'').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g,' ').trim(); }
function cleanName(n){ return n? n.replace(/\s*\(?Underground Station\)?/gi, '').trim() : n; }

const LINE_NAME_MAP = {
  'bakerloo':'Bakerloo','central':'Central','circle':'Circle','district':'District','elizabeth':'Elizabeth',
  'hammersmith-city':'Hammersmith & City','jubilee':'Jubilee','metropolitan':'Metropolitan','northern':'Northern',
  'piccadilly':'Piccadilly','victoria':'Victoria','waterloo-city':'Waterloo & City','dlr':'DLR','london-overground':'Overground'
};

async function fetchJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function isStation(sp){
  return String(sp.id||'').startsWith('940G') && String(sp.stopType||'').toLowerCase().includes('naptanmetrostation');
}
function isPlatform(sp){
  return String(sp.id||'').startsWith('940G') && String(sp.stopType||'').toLowerCase().includes('naptanmetroplatform');
}
function deriveLines(sp){
  let ids = [];
  if (Array.isArray(sp.lineModeGroups)){
    for (const g of sp.lineModeGroups){
      if (String(g.modeName||'').toLowerCase()==='tube'){
        const arr = Array.isArray(g.lineIdentifier)? g.lineIdentifier : [];
        ids.push(...arr);
      }
    }
  }
  if (!ids.length && Array.isArray(sp.lines)) ids = sp.lines.map(l=>l.id);
  ids = Array.from(new Set(ids));
  return ids.map(id => ({ id, name: LINE_NAME_MAP[id] || id }));
}

// Given any StopPoint detail `sp`, return a set of 940G *station* IDs derived from it
async function stationIdsFromDetail(sp, params){
  const out = new Set();
  if (isStation(sp)){ out.add(sp.id); }
  else if (isPlatform(sp) && sp.parentId){
    try{
      const pd = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(sp.parentId)}${params.toString()?`?${params.toString()}`:''}`);
      if (isStation(pd)) out.add(pd.id);
    }catch{}
  }
  // inspect children
  const kids = Array.isArray(sp.children)? sp.children : [];
  for (const k of kids){
    if (isStation(k)) out.add(k.id);
    else if (isPlatform(k) && k.parentId){ out.add(k.parentId); }
  }
  return Array.from(out);
}

function score(name, q){
  const an = norm(name), qn = norm(q);
  let s = 0;
  if (an.startsWith(qn)) s += 100;
  if (an.includes(qn)) s += 40;
  const qtokens = qn.split(' ').filter(Boolean);
  let covered = 0;
  for (const t of qtokens){ if (an.includes(t)) covered++; }
  s += covered * 15;
  s += Math.max(0, 20 - Math.min(20, an.length/2));
  return s;
}

export default async function handler(req, res){
  let q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error: 'missing q' });
  q = q.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (q.length < 2) return res.status(200).json({ results: [] });

  const cacheKey = norm(q);
  const cached = getCache(cacheKey);
  if (cached){
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    return res.status(200).json(cached);
  }

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  try{
    const url = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}${params.toString()?`?${params.toString()}`:''}`;
    const js = await fetchJSON(url);
    const matches = Array.isArray(js.matches)? js.matches.slice(0, 30) : [];
    const stationIds = new Set();

    for (const m of matches){
      const mid = String(m.id||'');
      try{
        const detail = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(mid)}${params.toString()?`?${params.toString()}`:''}`);
        const ids = await stationIdsFromDetail(detail, params);
        for (const id of ids) stationIds.add(id);
      }catch{}
    }

    // For each station id, fetch its detail to get clean name + lines
    const results = [];
    for (const id of stationIds){
      try{
        const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}${params.toString()?`?${params.toString()}`:''}`);
        if (!isStation(sp)) continue;
        results.push({ id: sp.id, name: cleanName(sp.commonName || sp.name), lines: deriveLines(sp) });
      }catch{}
    }

    // Dedup and sort
    const uniq = new Map();
    for (const r of results){ if (!uniq.has(r.id)) uniq.set(r.id, r); }
    let list = Array.from(uniq.values());
    list.sort((a,b)=>{
      const sa = score(a.name, q);
      const sb = score(b.name, q);
      if (sb !== sa) return sb - sa;
      return a.name.localeCompare(b.name);
    });

    // Final payload
    const payload = { results: list.slice(0, 12) };
    setCache(cacheKey, payload);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    return res.status(200).json(payload);
  }catch(e){
    return res.status(200).json({ results: [] });
  }
}
