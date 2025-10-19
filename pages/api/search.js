import fs from 'fs';
import path from 'path';

const STATE = global._TUBE_INDEX_PRO31 ||= { builtAt: 0, stations: [] };
const ONE_HOUR = 60 * 60 * 1000;

function norm(s){ return String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim(); }
function cleanName(n){ return n? n.replace(/\s*\(?Underground Station\)?/gi, '').trim() : n; }

const LINE_NAME_MAP = {
  'bakerloo':'Bakerloo','central':'Central','circle':'Circle','district':'District','elizabeth':'Elizabeth',
  'hammersmith-city':'Hammersmith & City','jubilee':'Jubilee','metropolitan':'Metropolitan','northern':'Northern',
  'piccadilly':'Piccadilly','victoria':'Victoria','waterloo-city':'Waterloo & City','dlr':'DLR','london-overground':'Overground'
};

async function fetchJSON(url){
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function isTubeStation(sp){
  return String(sp.id||'').startsWith('940G') && String(sp.stopType||'').toLowerCase().includes('naptanmetrostation');
}
function isPlatform(sp){
  return String(sp.id||'').startsWith('940G') && String(sp.stopType||'').toLowerCase().includes('naptanmetroplatform');
}

function deriveLines(sp){
  let ids = [];
  if (Array.isArray(sp.lineModeGroups)){
    for (const g of sp.lineModeGroups){
      if (String(g.modeName||'').toLowerCase()==='tube'){
        const arr = Array.isArray(g.lineIdentifier)? g.lineIdentifier : [];
        ids.push(...arr);
      }
    }
  }
  if (!ids.length && Array.isArray(sp.lines)) ids = sp.lines.map(l=>l.id);
  ids = Array.from(new Set(ids));
  return ids.map(id => ({ id, name: LINE_NAME_MAP[id] || id }));
}

function score(name, q){
  const an = norm(name), qn = norm(q);
  let s = 0;
  if (an.startsWith(qn)) s += 100;
  if (an.includes(qn)) s += 40;
  const qtokens = qn.split(' ').filter(Boolean);
  for (const t of qtokens){ if (an.includes(t)) s += 15; }
  s += Math.max(0, 20 - Math.min(20, an.length/2));
  return s;
}

async function buildIndex(params){
  const url = `https://api.tfl.gov.uk/StopPoint/Mode/tube${params.toString()?`?${params.toString()}`:''}`;
  const data = await fetchJSON(url);
  const arr = Array.isArray(data)? data : [];
  const stations = arr.filter(isTubeStation).map(sp => {
    const name = cleanName(sp.commonName || sp.name);
    return { id: sp.id, name, norm: norm(name), lines: deriveLines(sp) };
  });
  const uniq = new Map();
  for (const s of stations){ if (!uniq.has(s.id)) uniq.set(s.id, s); }
  STATE.stations = Array.from(uniq.values());
  STATE.builtAt = Date.now();
}

async function recursiveResolveIds(mid, params, acc, depth=0){
  if (depth>3 || acc.size>40) return;
  try{
    const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(mid)}${params.toString()?`?${params.toString()}`:''}`);
    if (isTubeStation(sp)){ acc.add(sp.id); return; }
    if (isPlatform(sp) && sp.parentId){ acc.add(sp.parentId); return; }
    if (Array.isArray(sp.children)){
      for (const k of sp.children){
        await recursiveResolveIds(k.id, params, acc, depth+1);
      }
    }
  }catch{}
}

export default async function handler(req, res){
  let q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error:'missing q' });
  q = q.replace(/[’‘]/g,"'").replace(/\s+/g, ' ').trim();
  if (q.length < 2) return res.status(200).json({ results: [] });

  const params = new URLSearchParams();
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  try{
    if (!STATE.builtAt || (Date.now()-STATE.builtAt)>ONE_HOUR){
      await buildIndex(params);
    }

    const qn = norm(q);
    let list = STATE.stations
      .map(s => ({ s, score: score(s.name, q) }))
      .filter(x => x.score>0)
      .sort((a,b)=> b.score - a.score)
      .slice(0, 12)
      .map(x => ({ id:x.s.id, name:x.s.name, lines:x.s.lines }));

    if (!list.length){
      const prim = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}${params.toString()?`?${params.toString()}`:''}`;
      const js = await fetchJSON(prim);
      const matches = Array.isArray(js.matches)? js.matches.slice(0,50) : [];
      const ids = new Set();
      for (const m of matches){
        await recursiveResolveIds(String(m.id||''), params, ids, 0);
      }
      const out = [];
      for (const id of ids){
        try{
          const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}${params.toString()?`?${params.toString()}`:''}`);
          if (isTubeStation(sp)){
            out.push({ id: sp.id, name: cleanName(sp.commonName || sp.name), lines: deriveLines(sp) });
          }
        }catch{}
      }
      out.sort((a,b)=>{
        const sa = score(a.name, q);
        const sb = score(b.name, q);
        if (sb!==sa) return sb-sa;
        return a.name.localeCompare(b.name);
      });
      list = out.slice(0,12);
    }

    res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=1800');
    return res.status(200).json({ results: list });
  }catch(e){
    return res.status(200).json({ results: [] });
  }
}
