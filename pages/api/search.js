// Tube Station Index Search (offline index built from TfL data)
// - On first call, fetches all tube StopPoints via /Line/Mode/tube/StopPoints
// - Builds an index of parent stations (940G…, stopType=NaptanMetroStation)
// - Derives tube lines from lineModeGroups/lines in the payload
// - Caches the index in-memory for 1 hour to avoid refetching
// - Performs local fuzzy match: prefix > token includes > substring
// - Cleans names to remove 'Underground Station'
// - Normalizes quotes and whitespace

const ONE_HOUR = 60 * 60 * 1000;
const STATE = global._TUBE_INDEX_STATE ||= { builtAt: 0, stations: [] };

function cleanName(name){
  if(!name) return name;
  return name.replace(/\s*\(?Underground Station\)?/gi, '').trim();
}
function norm(s){
  return String(s||'').toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'&()\-\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const LINE_NAME_MAP = {
  'bakerloo':'Bakerloo',
  'central':'Central',
  'circle':'Circle',
  'district':'District',
  'elizabeth':'Elizabeth',
  'hammersmith-city':'Hammersmith & City',
  'jubilee':'Jubilee',
  'metropolitan':'Metropolitan',
  'northern':'Northern',
  'piccadilly':'Piccadilly',
  'victoria':'Victoria',
  'waterloo-city':'Waterloo & City',
  'dlr':'DLR',
  'london-overground':'Overground'
};

function uniqBy(arr, keyFn){
  const m = new Map();
  for(const x of arr){ const k = keyFn(x); if(!m.has(k)) m.set(k, x); }
  return Array.from(m.values());
}

async function buildIndex(params){
  const url = `https://api.tfl.gov.uk/Line/Mode/tube/StopPoints${params.toString()?`?${params.toString()}`:''}`;
  const r = await fetch(url);
  const data = await r.json();
  const all = Array.isArray(data)? data : [];

  // Keep only 940G stations (not platforms), and modeName includes tube
  const stations = all.filter(sp => {
    const id = String(sp.id||'');
    const st = String(sp.stopType||'').toLowerCase();
    if (!id.startsWith('940G')) return false;
    return st.includes('naptanmetrostation');
  });

  // Derive lines: prefer lineModeGroups (tube), fallback to sp.lines
  const mapped = stations.map(sp => {
    const name = cleanName(sp.commonName || sp.name);
    let lineIds = [];
    if (Array.isArray(sp.lineModeGroups)){
      for(const g of sp.lineModeGroups){
        if(String(g.modeName||'').toLowerCase() === 'tube'){
          const ids = Array.isArray(g.lineIdentifier)? g.lineIdentifier : [];
          lineIds.push(...ids);
        }
      }
    }
    if (!lineIds.length && Array.isArray(sp.lines)){
      lineIds = sp.lines.map(l => l.id);
    }
    lineIds = Array.from(new Set(lineIds));
    const lines = lineIds.map(id => ({ id, name: LINE_NAME_MAP[id] || id }));
    return {
      id: sp.id,
      name,
      norm: norm(name),
      tokens: norm(name).split(' '),
      lines
    };
  });

  // Dedup by id
  STATE.stations = uniqBy(mapped, s => s.id);
  STATE.builtAt = Date.now();
}

function scoreStation(station, qnorm, qtokens){
  // higher is better
  const name = station.norm;
  let score = 0;
  if (name.startsWith(qnorm)) score += 100;
  if (name.includes(qnorm)) score += 40;
  // token coverage
  let covered = 0;
  for(const t of qtokens){
    if (!t) continue;
    if (name.includes(t)) covered += 1;
  }
  score += covered * 15;

  // slight boost for shorter names when equal
  score += Math.max(0, 20 - Math.min(20, name.length/2));
  return score;
}

export default async function handler(req, res){
  let q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error: 'missing q' });
  q = q.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (q.length < 2) return res.status(200).json({ results: [] });

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  try{
    if (!STATE.builtAt || (Date.now() - STATE.builtAt) > ONE_HOUR){
      await buildIndex(params);
    }

    const qnorm = norm(q);
    const qtokens = qnorm.split(' ');

    // rank
    const ranked = STATE.stations.map(s => ({ s, score: scoreStation(s, qnorm, qtokens) }))
      .filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score)
      .slice(0, 12)
      .map(x => ({ id: x.s.id, name: x.s.name, lines: x.s.lines }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json({ results: ranked });
  }catch(e){
    return res.status(500).json({ error: String(e) });
  }
}
