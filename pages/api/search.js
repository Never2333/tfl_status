// tube-only search to avoid HUB/bus stops
export default async function handler(req, res) {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'missing q' });

  const params = new URLSearchParams();
  params.set('modes', 'tube');
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);
  const url = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}?${params.toString()}`;

  try {
    const r = await fetch(url);
    const json = await r.json();
    const matches = (json.matches || []).filter(m => {
      const id = String(m.id || '');
      const modes = (m.modes || []).map(x=>String(x).toLowerCase());
      const isTubeMode = modes.includes('tube');
      return isTubeMode || id.startsWith('940GZZLU') || id.startsWith('940GZZ');
    }).slice(0, 12);

    res.status(200).json({ matches });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
