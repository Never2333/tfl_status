import fs from 'fs';
import path from 'path';

const ONE_HOUR = 60 * 60 * 1000;
const STATE = global._TUBE_INDEX_STATE3 ||= { builtAt: 0, stations: [] };

function cleanName(name){ return name? name.replace(/\s*\(?Underground Station\)?/gi, '').trim() : name; }
function norm(s){ return String(s||'').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim(); }
const LINE_NAME_MAP = { 'bakerloo':'Bakerloo','central':'Central','circle':'Circle','district':'District','elizabeth':'Elizabeth','hammersmith-city':'Hammersmith & City','jubilee':'Jubilee','metropolitan':'Metropolitan','northern':'Northern','piccadilly':'Piccadilly','victoria':'Victoria','waterloo-city':'Waterloo & City','dlr':'DLR','london-overground':'Overground' };
function uniqBy(arr, keyFn){ const m=new Map(); for(const x of arr){ const k=keyFn(x); if(!m.has(k)) m.set(k,x);} return Array.from(m.values()); }
async function fetchJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
function mapStation(sp){ const name=cleanName(sp.commonName||sp.name); let lineIds=[]; if(Array.isArray(sp.lineModeGroups)){ for(const g of sp.lineModeGroups){ if(String(g.modeName||'').toLowerCase()==='tube'){ const ids=Array.isArray(g.lineIdentifier)?g.lineIdentifier:[]; lineIds.push(...ids);} } } if(!lineIds.length && Array.isArray(sp.lines)){ lineIds = sp.lines.map(l=>l.id); } lineIds = Array.from(new Set(lineIds)); const lines = lineIds.map(id=>({id, name: LINE_NAME_MAP[id] || id})); return { id: sp.id, name, norm: norm(name), tokens: norm(name).split(' '), lines }; }
async function buildIndex(params){
  try{ const u1 = `https://api.tfl.gov.uk/StopPoint/Mode/tube${params.toString()?`?${params.toString()}`:''}`; const data1 = await fetchJSON(u1); const arr1 = Array.isArray(data1)? data1 : []; const st1 = arr1.filter(sp => String(sp.id||'').startsWith('940G') && String(sp.stopType||'').toLowerCase().includes('naptanmetrostation')); const mapped1 = st1.map(mapStation); if (mapped1.length){ STATE.stations = uniqBy(mapped1, s=>s.id); STATE.builtAt = Date.now(); return; } }catch(e){}
  try{ const u2 = `https://api.tfl.gov.uk/Line/Mode/tube/StopPoints${params.toString()?`?${params.toString()}`:''}`; const data2 = await fetchJSON(u2); const arr2 = Array.isArray(data2)? data2 : []; const st2 = arr2.filter(sp => String(sp.id||'').startsWith('940G') && String(sp.stopType||'').toLowerCase().includes('naptanmetrostation')); const mapped2 = st2.map(mapStation); if (mapped2.length){ STATE.stations = uniqBy(mapped2, s=>s.id); STATE.builtAt = Date.now(); return; } }catch(e){}
  try{ const p = path.join(process.cwd(), 'data', 'tube-index.json'); const raw = fs.readFileSync(p, 'utf-8'); const json = JSON.parse(raw); const mapped = (json.stations||[]).map(x => ({ id:x.id, name:x.name, norm:norm(x.name), tokens:norm(x.name).split(' '), lines: x.lines||[] })); if (mapped.length){ STATE.stations = uniqBy(mapped, s=>s.id); STATE.builtAt = Date.now(); return; } }catch(e){}
}
function scoreStation(st, qnorm, qtokens){ let score = 0; if (st.norm.startsWith(qnorm)) score += 100; if (st.norm.includes(qnorm)) score += 40; let covered=0; for(const t of qtokens){ if(t && st.norm.includes(t)) covered++; } score += covered*15; score += Math.max(0, 20 - Math.min(20, st.norm.length/2)); return score; }

export default async function handler(req, res){
  let q = String(req.query.q || ''); if (!q) return res.status(400).json({ error: 'missing q' });
  q = q.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (q.length < 2) return res.status(200).json({ results: [] });

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  try{
    if (!STATE.builtAt || (Date.now()-STATE.builtAt) > ONE_HOUR){ await buildIndex(params); }
    const qnorm = norm(q); const qtokens = qnorm.split(' ');
    let list = (STATE.stations||[]).map(s => ({ s, score: scoreStation(s, qnorm, qtokens) }))
      .filter(x => x.score > 0).sort((a,b)=> b.score - a.score).slice(0, 12)
      .map(x => ({ id: x.s.id, name: x.s.name, lines: x.s.lines }));

    if (!list.length){
      const p = path.join(process.cwd(), 'data', 'tube-index.json');
      try{
        const raw = fs.readFileSync(p, 'utf-8'); const json = JSON.parse(raw);
        const all = (json.stations||[]).map(x => ({id:x.id, name:x.name, lines:x.lines||[]}));
        const qn = qnorm;
        list = all.filter(x => norm(x.name).includes(qn)).slice(0, 12);
      }catch{}
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json({ results: list });
  }catch(e){
    try{
      const p = path.join(process.cwd(), 'data', 'tube-index.json');
      const raw = fs.readFileSync(p, 'utf-8'); const json = JSON.parse(raw);
      const qn = qnorm;
      const list = (json.stations||[]).filter(x => norm(x.name).includes(qn)).slice(0, 12);
      return res.status(200).json({ results: list });
    }catch(err){
      return res.status(200).json({ results: [] });
    }
  }
}
