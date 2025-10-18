// Robust Tube Search with multi-source index + per-query fallback
// 1) Build index from StopPoint/Mode/tube (preferred), else Line/Mode/tube/StopPoints
// 2) If index unavailable, fallback to per-query Search + child resolution
// 3) Tube-only (940G + NaptanMetroStation), station names cleaned, lines from lineModeGroups/lines
// 4) 1-hour in-memory cache; handles smart quotes/whitespace

const ONE_HOUR = 60 * 60 * 1000;
const STATE = global._TUBE_INDEX_STATE2 ||= { builtAt: 0, stations: [] };

function cleanName(name){
  if(!name) return name;
  return name.replace(/\s*\(?Underground Station\)?/gi, '').trim();
}
function norm(s){
  return String(s||'').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}
const LINE_NAME_MAP = {
  'bakerloo':'Bakerloo','central':'Central','circle':'Circle','district':'District','elizabeth':'Elizabeth',
  'hammersmith-city':'Hammersmith & City','jubilee':'Jubilee','metropolitan':'Metropolitan','northern':'Northern',
  'piccadilly':'Piccadilly','victoria':'Victoria','waterloo-city':'Waterloo & City','dlr':'DLR','london-overground':'Overground'
};
function uniqBy(arr, keyFn){ const m=new Map(); for(const x of arr){ const k=keyFn(x); if(!m.has(k)) m.set(k,x);} return Array.from(m.values()); }

async function fetchJSON(url){
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function mapStation(sp){
  const name = cleanName(sp.commonName || sp.name);
  let lineIds = [];
  if (Array.isArray(sp.lineModeGroups)){
    for(const g of sp.lineModeGroups){
      if(String(g.modeName||'').toLowerCase()==='tube'){
        const ids = Array.isArray(g.lineIdentifier)? g.lineIdentifier : [];
        lineIds.push(...ids);
      }
    }
  }
  if (!lineIds.length && Array.isArray(sp.lines)){
    lineIds = sp.lines.map(l=>l.id);
  }
  lineIds = Array.from(new Set(lineIds));
  const lines = lineIds.map(id => ({ id, name: LINE_NAME_MAP[id] || id }));
  return { id: sp.id, name, norm: norm(name), tokens: norm(name).split(' '), lines };
}

async function buildIndex(params){
  // Try StopPoint/Mode/tube first
  try{
    const u1 = `https://api.tfl.gov.uk/StopPoint/Mode/tube${params.toString()?`?${params.toString()}`:''}`;
    const data1 = await fetchJSON(u1);
    const arr1 = Array.isArray(data1)? data1 : [];
    const st1 = arr1.filter(sp => String(sp.id||'').startsWith('940G') && String(sp.stopType||'').toLowerCase().includes('naptanmetrostation'));
    const mapped1 = st1.map(mapStation);
    if (mapped1.length){ STATE.stations = uniqBy(mapped1, s=>s.id); STATE.builtAt = Date.now(); return; }
  }catch(e){ /* continue */ }

  // Fallback to Line/Mode/tube/StopPoints
  try{
    const u2 = `https://api.tfl.gov.uk/Line/Mode/tube/StopPoints${params.toString()?`?${params.toString()}`:''}`;
    const data2 = await fetchJSON(u2);
    const arr2 = Array.isArray(data2)? data2 : [];
    const st2 = arr2.filter(sp => String(sp.id||'').startsWith('940G') && String(sp.stopType||'').toLowerCase().includes('naptanmetrostation'));
    const mapped2 = st2.map(mapStation);
    if (mapped2.length){ STATE.stations = uniqBy(mapped2, s=>s.id); STATE.builtAt = Date.now(); return; }
  }catch(e){ /* continue */ }
}

function scoreStation(station, qnorm, qtokens){
  let score = 0;
  if (station.norm.startsWith(qnorm)) score += 100;
  if (station.norm.includes(qnorm)) score += 40;
  let covered = 0;
  for(const t of qtokens){ if (t && station.norm.includes(t)) covered++; }
  score += covered * 15;
  score += Math.max(0, 20 - Math.min(20, station.norm.length/2));
  return score;
}

async function resolveTubeChildren(id, params){
  const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}${params.toString()?`?${params.toString()}`:''}`);
  const children = Array.isArray(sp.children)? sp.children : [];
  const stations = children.filter(c => String(c.id||'').startsWith('940G') && String(c.stopType||'').toLowerCase().includes('naptanmetrostation'));
  if (stations.length) return stations.map(mapStation);
  if (String(sp.id||'').startsWith('940G') && String(sp.stopType||'').toLowerCase().includes('naptanmetrostation')) return [mapStation(sp)];
  return [];
}

export default async function handler(req, res){
  let q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error: 'missing q' });
  q = q.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (q.length < 2) return res.status(200).json({ results: [] });

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  try{
    if (!STATE.builtAt || (Date.now()-STATE.builtAt) > ONE_HOUR){
      await buildIndex(params);
    }

    const qnorm = norm(q);
    let candidates = [];
    if (STATE.stations.length){
      const qtokens = qnorm.split(' ');
      candidates = STATE.stations.map(s => ({ s, score: scoreStation(s, qnorm, qtokens) }))
                    .filter(x => x.score > 0)
                    .sort((a,b)=> b.score - a.score)
                    .slice(0, 12)
                    .map(x => ({ id: x.s.id, name: x.s.name, lines: x.s.lines }));
    }

    // Per-query fallback if index empty or no hits
    if (!candidates.length){
      // Use StopPoint/Search then resolve only tube stations
      let json = null;
      try{
        const url = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}${params.toString()?`?${params.toString()}`:''}`;
        json = await fetchJSON(url);
      }catch{ /* ignore */ }
      const matches = (json && Array.isArray(json.matches)) ? json.matches.slice(0,20) : [];
      const out = [];
      for (const m of matches){
        const id = String(m.id||'');
        if (id.startsWith('910') || id.startsWith('490') || id.startsWith('HUB')) continue;
        if (id.startsWith('940G')){ out.push({ id, name: cleanName(m.name), lines: [] }); continue; }
        const kids = await resolveTubeChildren(id, params);
        out.push(...kids);
      }
      // Dedup
      const uniq = new Map();
      for (const c of out){ if (!uniq.has(c.id)) uniq.set(c.id, c); }
      candidates = Array.from(uniq.values()).slice(0,12);
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json({ results: candidates });
  }catch(e){
    return res.status(200).json({ results: [] });
  }
}
