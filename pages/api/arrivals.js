export default async function handler(req, res){
  const id = req.query.id;
  if(!id) return res.status(400).json({ error:'missing id' });
  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);
  try{
    const arrivalsUrl = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}/Arrivals${params.toString()?`?${params.toString()}`:''}`;
    const r = await fetch(arrivalsUrl);
    const arrivals = await r.json();

    const lineIds = Array.from(new Set((arrivals||[]).map(a=>a.lineId))).filter(Boolean);
    let statuses = [];
    if (lineIds.length){
      const statusUrl = `https://api.tfl.gov.uk/Line/${lineIds.join(',')}/Status${params.toString()?`?${params.toString()}`:''}`;
      const rs = await fetch(statusUrl);
      const lines = await rs.json();
      statuses = (lines||[]).map(l => ({
        id: l.id,
        name: l.name,
        statusSeverityDescription: l.lineStatuses?.[0]?.statusSeverityDescription
      }));
    }
    res.status(200).json({ arrivals, statuses });
  }catch(e){
    res.status(500).json({ error: String(e) });
  }
}
