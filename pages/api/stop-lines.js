// Smarter stop-lines: resolve parent station + use lineModeGroups; cache for 60s
const CACHE = global._LINES_CACHE ||= new Map();
const CACHE_TTL_MS = 60 * 1000;
function setCache(key, value){ CACHE.set(key, { value, ts: Date.now() }); }
function getCache(key){ const e = CACHE.get(key); if(!e) return null; if(Date.now()-e.ts>CACHE_TTL_MS){ CACHE.delete(key); return null; } return e.value; }

export default async function handler(req, res){
  const id = req.query.id;
  if(!id) return res.status(400).json({ error:'missing id' });
  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  const ck = `lines:${id}`;
  const cached = getCache(ck);
  if (cached) return res.status(200).json({ lines: cached });

  try{
    // detail
    const du = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}${params.toString()?`?${params.toString()}`:''}`;
    const dr = await fetch(du);
    const dj = await dr.json();

    let stationId = id;
    const st = String(dj.stopType||'').toLowerCase();
    if (st.includes('naptanmetroplatform') && dj.parentId) stationId = dj.parentId;

    let lines = [];
    try{
      const lu = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(stationId)}/Lines${params.toString()?`?${params.toString()}`:''}`;
      const lr = await fetch(lu);
      const lj = await lr.json();
      if (Array.isArray(lj)) lines = lj;
    }catch{}

    if (!lines.length && Array.isArray(dj.lineModeGroups)){
      const ids = (dj.lineModeGroups||[]).flatMap(g=>g.lineIdentifier || []);
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
    res.status(200).json({ lines: filtered });
  }catch(e){
    res.status(500).json({ error: String(e) });
  }
}
