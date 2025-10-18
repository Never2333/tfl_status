// return lines serving a StopPoint id (tube-only)
export default async function handler(req, res){
  const id = req.query.id;
  if(!id) return res.status(400).json({ error:'missing id' });
  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);
  try{
    // Prefer /StopPoint/{id}/Lines if available; fallback to StopPoint detail
    const url = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}/Lines${params.toString()?`?${params.toString()}`:''}`;
    const r = await fetch(url);
    let lines = await r.json();

    if (!Array.isArray(lines)) {
      const durl = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}${params.toString()?`?${params.toString()}`:''}`;
      const dr = await fetch(durl);
      const dj = await dr.json();
      lines = dj.lines || [];
    }

    // Filter tube-only
    const filtered = (Array.isArray(lines)?lines:[]).filter(l => (l.modeName||'').toLowerCase()==='tube')
      .map(l => ({ id: l.id, name: l.name }));

    res.status(200).json({ lines: filtered });
  }catch(e){
    res.status(500).json({ error: String(e) });
  }
}
