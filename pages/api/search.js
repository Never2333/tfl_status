export default async function handler(req, res) {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'missing q' });
  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);
  const url = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}${params.toString()?`?${params.toString()}`:''}`;
  try{
    const r = await fetch(url);
    const json = await r.json();
    res.status(200).json(json);
  }catch(e){
    res.status(500).json({ error: String(e) });
  }
}
