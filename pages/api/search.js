// pro7: live-search-first with strict tube filtering and correct sorting
const CACHE = global._LIVE_SEARCH_CACHE ||= new Map();
const TTL = 60 * 1000;

function setCache(key, value){ CACHE.set(key, { value, ts: Date.now() }); }
function getCache(key){
  const e = CACHE.get(key);
  if(!e) return null;
  if(Date.now() - e.ts > TTL){ CACHE.delete(key); return null; }
  return e.value;
}

function norm(s){ return String(s||'').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim(); }
function cleanName(name){ return name? name.replace(/\s*\(?Underground Station\)?/gi, '').trim() : name; }

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

function isTubeStation(sp){
  const id = String(sp.id||'');
  if (!id.startsWith('940G')) return false;
  const st = String(sp.stopType||'').toLowerCase();
  return st.includes('naptanmetrostation');
}
function deriveLines(sp){
  let ids = [];
  if (Array.isArray(sp.lineModeGroups)){
    for(const g of sp.lineModeGroups){
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
    const matches = Array.isArray(js.matches)? js.matches.slice(0, 25) : [];
    const out = [];
    for (const m of matches){
      const mid = String(m.id||'');
      if (mid.startsWith('910') || mid.startsWith('490') || mid.startsWith('HUB')){
        // resolve children and keep only tube stations
        try{
          const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(mid)}${params.toString()?`?${params.toString()}`:''}`);
          const kids = Array.isArray(sp.children)? sp.children : [];
          for (const k of kids){
            if (isTubeStation(k)){
              // elevate to the station detail to derive lines properly
              const kd = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(k.id)}${params.toString()?`?${params.toString()}`:''}`);
              out.push({ id: kd.id, name: cleanName(kd.commonName || kd.name), lines: deriveLines(kd) });
            }
          }
        }catch{}
      }else if (mid.startsWith('940G')){
        // already a tube station or platform; if platform, fetch parent?
        try{
          const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(mid)}${params.toString()?`?${params.toString()}`:''}`);
          if (isTubeStation(sp)){
            out.push({ id: sp.id, name: cleanName(sp.commonName || sp.name), lines: deriveLines(sp) });
          }else if (String(sp.stopType||'').toLowerCase().includes('naptanmetroplatform') && sp.parentId){
            const parent = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(sp.parentId)}${params.toString()?`?${params.toString()}`:''}`);
            if (isTubeStation(parent)){
              out.push({ id: parent.id, name: cleanName(parent.commonName || parent.name), lines: deriveLines(parent) });
            }
          }
        }catch{}
      }else{
        // other ids; try resolving children once
        try{
          const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(mid)}${params.toString()?`?${params.toString()}`:''}`);
          const kids = Array.isArray(sp.children)? sp.children : [];
          for (const k of kids){
            if (isTubeStation(k)){
              const kd = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(k.id)}${params.toString()?`?${params.toString()}`:''}`);
              out.push({ id: kd.id, name: cleanName(kd.commonName || kd.name), lines: deriveLines(kd) });
            }
          }
        }catch{}
      }
    }

    // Dedup by id
    const uniq = new Map();
    for (const r of out){ if (!uniq.has(r.id)) uniq.set(r.id, r); }
    let list = Array.from(uniq.values());

    // Sort by prefix priority etc.
    list.sort((a,b)=>{
      const sa = score(a.name, q);
      const sb = score(b.name, q);
      if (sb !== sa) return sb - sa;
      return a.name.localeCompare(b.name);
    });

    // If nothing found, return [] (do not fall back to unrelated static)
    list = list.slice(0, 12);
    const payload = { results: list };
    setCache(cacheKey, payload);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    return res.status(200).json(payload);
  }catch(e){
    // On network/API error, return empty to avoid misleading fixed list
    return res.status(200).json({ results: [] });
  }
}
