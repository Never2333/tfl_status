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
function cleanStationName(name){
  if(!name) return name;
  return name.replace(/\s*\(?Underground Station\)?/gi, '').trim();
}
async function fetchTubeLinesFor(stopId, params){
  // Try /Lines first, fallback to StopPoint detail
  const lu = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(stopId)}/Lines${params.toString()?`?${params.toString()}`:''}`;
  const lr = await fetch(lu);
  let lines = await lr.json();
  if (!Array.isArray(lines)) {
    const du = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(stopId)}${params.toString()?`?${params.toString()}`:''}`;
    const dr = await fetch(du);
    const dj = await dr.json();
    lines = dj.lines || [];
  }
  return (Array.isArray(lines)?lines:[]).filter(l => (l.modeName||'').toLowerCase()==='tube')
    .map(l => ({ id: l.id, name: l.name }));
}

export default async function handler(req, res){
  const id = req.query.id;
  if(!id) return res.status(400).json({ error:'missing id' });

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  async function fetchArrivalsFor(stopId){
    const url = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(stopId)}/Arrivals${params.toString()?`?${params.toString()}`:''}`;
    const r = await fetch(url);
    const data = await r.json();
    return (Array.isArray(data)?data:[]).filter(x => (x.modeName||'').toLowerCase() === 'tube');
  }

  try{
    let targetIds = [];
    if (String(id).startsWith('940G')) {
      targetIds = [id];
    } else {
      const kids = await resolveTubeChildren(id, params);
      targetIds = kids.map(k=>k.id);
    }

    let arrivals = [];
    for (const tid of targetIds) {
      const a = await fetchArrivalsFor(tid);
      arrivals = arrivals.concat(a);
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
      const rs = await fetch(statusUrl);
      const lines = await rs.json();
      statuses = (Array.isArray(lines)?lines:[]).map(l => ({ id: l.id, name: l.name, statusSeverityDescription: l.lineStatuses?.[0]?.statusSeverityDescription }));
    }

    res.status(200).json({ arrivals, statuses });
  }catch(e){
    res.status(500).json({ error: String(e) });
  }
}
