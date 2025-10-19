// 强制 Node.js 运行时（要读本地文件）
export const config = { runtime: 'nodejs' };

import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'data', 'tube-stations.json');
let OFFLINE = { generatedAt: null, stations: [] };
try {
  const raw = fs.readFileSync(FILE_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    OFFLINE.stations = parsed;
  } else {
    OFFLINE = parsed;
  }
} catch {}

function norm(s){ return String(s||'').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim(); }
function cleanName(n){ return n? n.replace(/\s*\(?Underground Station\)?/gi, '').trim() : n; }
function score(name, q){
  const an = norm(name), qn = norm(q);
  let s=0; if(an.startsWith(qn)) s+=100; if(an.includes(qn)) s+=40;
  for(const t of qn.split(' ').filter(Boolean)){ if(an.includes(t)) s+=15; }
  s += Math.max(0, 20 - Math.min(20, an.length/2));
  return s;
}
function titleCase(id){
  const map={
    'hammersmith-city':'Hammersmith & City',
    'waterloo-city':'Waterloo & City',
    'london-overground':'Overground'
  };
  if (map[id]) return map[id];
  return id.split(/-/g).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
}

export default async function handler(req, res){
  let q = String(req.query.q||''); if(!q) return res.status(400).json({ error:'missing q' });
  q = q.replace(/[’‘]/g, "'").replace(/\s+/g,' ').trim();
  if (q.length < 2){ res.setHeader('Cache-Control','no-store'); return res.status(200).json({ results: [] }); }

  const src = (OFFLINE.stations||OFFLINE||[]);
  const list = src.map(s => ({ ...s, name: cleanName(s.name) }));

  const ranked = list
    .map(s => ({ s, sc: score(s.name, q) }))
    .filter(x => x.sc>0)
    .sort((a,b)=> b.sc-a.sc)
    .slice(0, 20)
    .map(x => ({
      id: x.s.id,
      name: x.s.name,
      lines: (x.s.lines||[]).map(id => ({ id, name: titleCase(id) }))
    }));

  if (req.query.debug === '1'){
    return res.status(200).json({
      debug: {
        offlineGeneratedAt: OFFLINE.generatedAt || null,
        stationCount: list.length
      },
      results: ranked
    });
  }

  res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).json({ results: ranked });
}
