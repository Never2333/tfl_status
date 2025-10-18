async function fetchJSON(url){ const r=await fetch(url); try{ return await r.json(); }catch{ return null; } }
function tubeOnly(arr){ return (Array.isArray(arr)?arr:[]).filter(x => (x.modeName||'').toLowerCase()==='tube'); }

export default async function handler(req, res){
  let id = req.query.id;
  const name = req.query.name || '';
  if (!id && !name) return res.status(400).json({ error:'missing id or name' });

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  async function resolveByName(qname){
    try{
      const u = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(qname)}${params.toString()?`?${params.toString()}`:''}`;
      const js = await fetchJSON(u);
      const matches = (js && Array.isArray(js.matches)) ? js.matches : [];
      for (const m of matches){
        const mid = String(m.id||'');
        if (mid.startsWith('940G')) return [mid];
        const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(mid)}${params.toString()?`?${params.toString()}`:''}`);
        const kids = (sp && Array.isArray(sp.children))? sp.children : [];
        const stations = kids.filter(c => String(c.id||'').startsWith('940G') && String(c.stopType||'').toLowerCase().includes('naptanmetrostation'));
        if (stations.length) return stations.map(s => s.id);
      }
    }catch{}
    return [];
  }

  try{
    let targetIds = [];
    if (id && String(id).startsWith('940G')){
      targetIds = [id];
    }else if (!id && name){
      targetIds = await resolveByName(name);
    }

    if (!targetIds.length && id){ targetIds = [id]; }

    let arrivals = [];
    for (const tid of targetIds){
      const url = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(tid)}/Arrivals${params.toString()?`?${params.toString()}`:''}`;
      const data = await fetchJSON(url);
      arrivals = arrivals.concat(tubeOnly(data));
    }

    arrivals.sort((a,b)=>{
      const ta = typeof a.timeToStation==='number'?a.timeToStation:Number.MAX_SAFE_INTEGER;
      const tb = typeof b.timeToStation==='number'?b.timeToStation:Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });

    const lineIds = Array.from(new Set(arrivals.map(a=>a.lineId))).filter(Boolean);
    let statuses = [];
    if (lineIds.length){
      const statusUrl = `https://api.tfl.gov.uk/Line/${lineIds.join(',')}/Status${params.toString()?`?${params.toString()}`:''}`;
      const lines = await fetchJSON(statusUrl);
      statuses = (Array.isArray(lines)?lines:[]).map(l => ({ id: l.id, name: l.name, statusSeverityDescription: l.lineStatuses?.[0]?.statusSeverityDescription }));
    }

    return res.status(200).json({ arrivals, statuses });
  }catch(e){
    return res.status(500).json({ error: String(e) });
  }
}
