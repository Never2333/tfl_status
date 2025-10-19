// 强稳：本地别名优先 + 在线兜底（失败也不返回空）
const CACHE = global._SEARCH_CACHE_SAFE ||= new Map();
const TTL = 60 * 1000;

function setCache(k,v){ CACHE.set(k,{v,ts:Date.now()}); }
function getCache(k){ const e=CACHE.get(k); if(!e) return null; if(Date.now()-e.ts>TTL){ CACHE.delete(k); return null; } return e.v; }

function norm(s){ return String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim(); }
function cleanName(n){ return n? n.replace(/\s*\(?Underground Station\)?/gi,'').trim() : n; }

const LINE_NAME_MAP = {
  'bakerloo':'Bakerloo','central':'Central','circle':'Circle','district':'District','elizabeth':'Elizabeth',
  'hammersmith-city':'Hammersmith & City','jubilee':'Jubilee','metropolitan':'Metropolitan','northern':'Northern',
  'piccadilly':'Piccadilly','victoria':'Victoria','waterloo-city':'Waterloo & City','dlr':'DLR','london-overground':'Overground'
};

// —— 本地别名表：关键枢纽“永远有结果”（无需访问 TfL）
const LOCAL = [
  { id:'940GZZLUHSC', name:'Hammersmith', lines:['circle','hammersmith-city'] },
  { id:'940GZZLUHSD', name:'Hammersmith', lines:['piccadilly','district'] },
  { id:'940GZZLUKSX', name:"King's Cross St. Pancras", lines:['circle','hammersmith-city','metropolitan','northern','piccadilly','victoria'] },
  { id:'940GZZLUWLO', name:'Waterloo', lines:['bakerloo','jubilee','northern','waterloo-city'] },
  { id:'940GZZLUPAC', name:'Paddington', lines:['bakerloo','circle','district','elizabeth','hammersmith-city'] },
  { id:'940GZZLUVIC', name:'Victoria', lines:['circle','district','victoria'] },
  { id:'940GZZLUOXC', name:'Oxford Circus', lines:['bakerloo','central','victoria'] },
  { id:'940GZZLUBST', name:'Baker Street', lines:['bakerloo','circle','hammersmith-city','jubilee','metropolitan'] },
  { id:'940GZZLULVT', name:'Liverpool Street', lines:['central','circle','hammersmith-city','metropolitan','elizabeth'] },
  { id:'940GZZLUEUS', name:'Euston', lines:['northern','victoria'] },
  { id:'940GZZLUGPK', name:'Green Park', lines:['jubilee','piccadilly','victoria'] },
  // 可按需继续扩充
];

function withLineObjects(st){ return { id: st.id, name: st.name, lines: st.lines.map(id=>({ id, name: LINE_NAME_MAP[id]||id })) }; }

// —— 在线部分 —— //
async function fetchJSON(url){
  const r = await fetch(url, { cache:'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function isStation(sp){
  return String(sp?.id||'').startsWith('940G') && String(sp?.stopType||'').toLowerCase().includes('naptanmetrostation');
}
function isPlatform(sp){
  return String(sp?.id||'').startsWith('940G') && String(sp?.stopType||'').toLowerCase().includes('naptanmetroplatform');
}
function deriveLines(sp){
  let ids=[];
  if (Array.isArray(sp?.lineModeGroups)){
    for (const g of sp.lineModeGroups){
      if (String(g.modeName||'').toLowerCase()==='tube'){
        const arr = Array.isArray(g.lineIdentifier)? g.lineIdentifier : [];
        ids.push(...arr);
      }
    }
  }
  if (!ids.length && Array.isArray(sp?.lines)) ids = sp.lines.map(l=>l.id);
  ids = Array.from(new Set(ids));
  return ids.map(id => ({ id, name: LINE_NAME_MAP[id]||id }));
}
async function stationIdsFromDetail(sp, params){
  const out = new Set();
  if (isStation(sp)) out.add(sp.id);
  else if (isPlatform(sp) && sp.parentId) out.add(sp.parentId);
  const kids = Array.isArray(sp?.children)? sp.children : [];
  for (const k of kids){
    if (isStation(k)) out.add(k.id);
    else if (isPlatform(k) && k.parentId) out.add(k.parentId);
  }
  return Array.from(out);
}

export default async function handler(req, res){
  let q = String(req.query.q||''); if(!q) return res.status(400).json({ error:'missing q' });
  q = q.replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
  if (q.length < 2) return res.status(200).json({ results: [] });

  const key = norm(q);
  const cached = getCache(key);
  if (cached) return res.status(200).json(cached);

  // 1) 本地别名优先（不访问 TfL）
  let localHits = LOCAL.filter(st => norm(st.name).includes(key) || key.includes('king') && st.id==='940GZZLUKSX' || key.includes('ham') && st.name==='Hammersmith' || key.includes('water') && st.id==='940GZZLUWLO' || key.includes('padd') && st.id==='940GZZLUPAC');
  // 排序：前缀>包含>长度
  localHits = localHits.sort((a,b)=>{
    const an = norm(a.name), bn = norm(b.name);
    const ap = an.startsWith(key)?0:1, bp = bn.startsWith(key)?0:1;
    if (ap!==bp) return ap-bp;
    if (an.length!==bn.length) return an.length-bn.length;
    return an.localeCompare(bn);
  }).map(withLineObjects);

  // 2) 在线 TfL 兜底（可选，失败也不影响本地结果）
  const params = new URLSearchParams();
  if (process.env.TFL_APP_ID) params.set('app_id', process.env.TFL_APP_ID);
  if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

  let live = [];
  try{
    const prim = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(q)}${params.toString()?`?${params.toString()}`:''}`;
    const js = await fetchJSON(prim);
    const matches = Array.isArray(js.matches)? js.matches.slice(0,50) : [];
    const ids = new Set();
    for (const m of matches){
      try{
        const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(m.id)}${params.toString()?`?${params.toString()}`:''}`);
        const stids = await stationIdsFromDetail(sp, params);
        for (const id of stids) ids.add(id);
      }catch{}
    }
    const arr = [];
    for (const id of ids){
      try{
        const sp = await fetchJSON(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}${params.toString()?`?${params.toString()}`:''}`);
        if (isStation(sp)) arr.push({ id: sp.id, name: cleanName(sp.commonName||sp.name), lines: deriveLines(sp) });
      }catch{}
    }
    // 排序
    arr.sort((a,b)=>{
      const an = norm(a.name), bn = norm(b.name);
      const ap = an.startsWith(key)?0:1, bp = bn.startsWith(key)?0:1;
      if (ap!==bp) return ap-bp;
      if (an.length!==bn.length) return an.length-bn.length;
      return an.localeCompare(bn);
    });
    live = arr;
  }catch{
    // 在线失败就算了，保留本地命中
  }

  // 合并去重：在线优先，再补本地
  const uniq = new Map();
  for (const r of live) uniq.set(r.id, r);
  for (const r of localHits) if (!uniq.has(r.id)) uniq.set(r.id, r);
  const results = Array.from(uniq.values()).slice(0,12);

  const payload = { results };
  setCache(key, payload);
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=600');
  return res.status(200).json(payload);
}
