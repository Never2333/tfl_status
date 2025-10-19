/**
 * 构建期脚本：从 TfL 拉取全量地铁“车站级”节点，生成 data/tube-stations.json
 */
import fs from 'fs';
import path from 'path';

const KEY = process.env.TFL_API_KEY;
if (!KEY) {
  console.error('缺少环境变量 TFL_API_KEY，无法生成离线索引。');
  process.exit(1);
}
const params = new URLSearchParams({ app_key: KEY });

function isStation(sp){
  return String(sp?.id||'').startsWith('940G') && String(sp?.stopType||'').toLowerCase().includes('naptanmetrostation');
}
function cleanName(n){ return n? n.replace(/\s*\(?Underground Station\)?/gi, '').trim() : n; }
function deriveLines(sp){
  let ids = [];
  if (Array.isArray(sp?.lineModeGroups)){
    for (const g of sp.lineModeGroups){
      if ((g.modeName||'').toLowerCase()==='tube'){
        const arr = Array.isArray(g.lineIdentifier) ? g.lineIdentifier : [];
        ids.push(...arr);
      }
    }
  }
  if (!ids.length && Array.isArray(sp?.lines)) ids = sp.lines.map(l=>l.id);
  return Array.from(new Set(ids));
}
const fetchJson = async (u)=>{
  const r = await fetch(u);
  if (!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
};

const main = async ()=>{
  const url = `https://api.tfl.gov.uk/StopPoint/Mode/tube?${params.toString()}`;
  console.log('拉取：', url);
  const data = await fetchJson(url);
  const arr = Array.isArray(data)? data : [];
  const stations = arr.filter(isStation).map(sp => ({
    id: sp.id,
    name: cleanName(sp.commonName || sp.name),
    lines: deriveLines(sp)
  }));
  const uniq = new Map(); for (const s of stations){ if (!uniq.has(s.id)) uniq.set(s.id, s); }
  const list = Array.from(uniq.values()).sort((a,b)=> a.name.localeCompare(b.name));
  const outPath = path.join(process.cwd(), 'data', 'tube-stations.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = { generatedAt: new Date().toISOString(), stations: list };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('写入完成：', outPath, '共', list.length, '个站点');
};

main().catch(e=>{
  console.error('生成离线索引失败：', e?.message || e);
  process.exit(1);
});
