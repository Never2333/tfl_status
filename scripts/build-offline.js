/**
 * 构建期脚本（修正版 v2）：尽量避免拉取 0 站点
 * 1) 优先：/StopPoint/Mode/tube
 * 2) 失败或为空：/Line/Mode/tube/StopPoints
 * 3) 仍为空：按主线逐条 /Line/{id}/StopPoints 聚合
 * 4) 最终若仍为空：保留现有 data/tube-stations.json（不覆盖为 0）
 */
import fs from 'fs';
import path from 'path';

const KEY = process.env.TFL_API_KEY;
if (!KEY) {
  console.error('❌ 缺少环境变量 TFL_API_KEY，无法生成离线索引。');
  process.exit(1);
}
const params = new URLSearchParams({ app_key: KEY });

const OUT_PATH = path.join(process.cwd(), 'data', 'tube-stations.json');

const fetchJson = async (u)=>{
  const r = await fetch(u);
  if (!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
};

function cleanName(n){ return n? n.replace(/\s*\(?Underground Station\)?/gi, '').trim() : n; }
function isStation(sp){
  const stopType = String(sp?.stopType||'').toLowerCase();
  const id = String(sp?.id||'');
  // 只要是 940G 开头且含 metro station 关键词即可
  return id.startsWith('940G') && (stopType.includes('naptanmetrostation') || stopType.includes('metro'));
}
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
function dedupeSort(arr){
  const uniq = new Map();
  for (const s of arr){ if (!uniq.has(s.id)) uniq.set(s.id, s); }
  return Array.from(uniq.values()).sort((a,b)=> a.name.localeCompare(b.name));
}

async function fromStopPointMode(){
  const url = `https://api.tfl.gov.uk/StopPoint/Mode/tube?${params.toString()}`;
  console.log('⬇️  尝试 StopPoint/Mode/tube ...');
  const data = await fetchJson(url);
  const arr = Array.isArray(data)? data : [];
  const list = arr.filter(isStation).map(sp => ({
    id: sp.id, name: cleanName(sp.commonName||sp.name), lines: deriveLines(sp)
  }));
  console.log('➡️  StopPoint/Mode/tube 命中：', list.length);
  return dedupeSort(list);
}

async function fromLineMode(){
  const url = `https://api.tfl.gov.uk/Line/Mode/tube/StopPoints?${params.toString()}`;
  console.log('⬇️  尝试 Line/Mode/tube/StopPoints ...');
  const data = await fetchJson(url);
  const arr = Array.isArray(data)? data : [];
  const list = arr.filter(isStation).map(sp => ({
    id: sp.id, name: cleanName(sp.commonName||sp.name), lines: deriveLines(sp)
  }));
  console.log('➡️  Line/Mode/tube/StopPoints 命中：', list.length);
  return dedupeSort(list);
}

const TUBE_LINES = ['bakerloo','central','circle','district','hammersmith-city','jubilee','metropolitan','northern','piccadilly','victoria','waterloo-city','elizabeth'];

async function fromEachLine(){
  console.log('⬇️  尝试逐条线路聚合 ...');
  let out = [];
  for (const lid of TUBE_LINES){
    const url = `https://api.tfl.gov.uk/Line/${lid}/StopPoints?${params.toString()}`;
    try{
      const data = await fetchJson(url);
      const arr = Array.isArray(data)? data : [];
      const list = arr.filter(isStation).map(sp => ({
        id: sp.id, name: cleanName(sp.commonName||sp.name), lines: deriveLines(sp)
      }));
      console.log(`   · ${lid}: ${list.length}`);
      out = out.concat(list);
    }catch(e){
      console.warn(`   · ${lid}: 拉取失败`, e?.message||e);
    }
  }
  out = dedupeSort(out);
  console.log('➡️  逐条线路聚合命中：', out.length);
  return out;
}

const main = async ()=>{
  let list = [];
  try {
    list = await fromStopPointMode();
    if (list.length === 0) list = await fromLineMode();
    if (list.length === 0) list = await fromEachLine();
  } catch (e){
    console.warn('⚠️  上述拉取流程出现异常：', e?.message||e);
  }

  if (!list.length){
    console.warn('⚠️  本次未获取到任何站点，保留现有离线文件，不做覆盖。');
    if (!fs.existsSync(OUT_PATH)){
      console.error('❌ 同时不存在现有离线文件，无法生成。');
      process.exit(1);
    } else {
      process.exit(0);
    }
  } else {
    const payload = { generatedAt: new Date().toISOString(), stations: list };
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    console.log('✅ 写入完成：', OUT_PATH, '共', list.length, '个站点');
  }
};

main().catch(e=>{
  console.error('❌ 生成离线索引失败：', e?.message || e);
  process.exit(1);
});
