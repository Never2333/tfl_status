/**
 * 构建期离线索引生成（CommonJS 版，兼容 Node 16/18；无需 "type":"module"）
 * 顺序：
 *   1) GET /StopPoint/Mode/tube
 *   2) 若为空 → GET /Line/Mode/tube → for each id: GET /Line/{id}/StopPoints
 * 成功则写入 data/tube-stations.json（{ generatedAt, stations: [...] }）
 * 失败则保留现有文件（不会写成 0）。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.TFL_API_KEY;
const APP_ID = process.env.TFL_APP_ID || '';
if (!KEY) {
  console.error('❌ 缺少环境变量 TFL_API_KEY');
  process.exit(1);
}

const OUT_PATH = path.join(process.cwd(), 'data', 'tube-stations.json');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'tfl-offline-builder/1.0',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

function qs(obj) {
  const p = new URLSearchParams();
  if (APP_ID) p.set('app_id', APP_ID);
  p.set('app_key', KEY);
  return p.toString();
}

function cleanName(n) {
  return n ? n.replace(/\s*\(?Underground Station\)?/gi, '').trim() : n;
}
function isStation(sp) {
  const id = String(sp?.id || '');
  const t = String(sp?.stopType || '').toLowerCase();
  return id.startsWith('940G') && (t.includes('naptanmetrostation') || t.includes('metro'));
}
function deriveLines(sp) {
  let ids = [];
  if (Array.isArray(sp?.lineModeGroups)) {
    for (const g of sp.lineModeGroups) {
      if (String(g.modeName || '').toLowerCase() === 'tube') {
        const arr = Array.isArray(g.lineIdentifier) ? g.lineIdentifier : [];
        ids.push(...arr);
      }
    }
  }
  if (!ids.length && Array.isArray(sp?.lines)) ids = sp.lines.map(l => l.id);
  return Array.from(new Set(ids));
}
function dedupeSort(arr) {
  const m = new Map();
  for (const s of arr) if (!m.has(s.id)) m.set(s.id, s);
  return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function tryStopPointMode() {
  const url = `https://api.tfl.gov.uk/StopPoint/Mode/tube?${qs({})}`;
  console.log('⬇️  StopPoint/Mode/tube:', url);
  const data = await fetchJson(url);
  const arr = Array.isArray(data) ? data : [];
  const list = arr.filter(isStation).map(sp => ({
    id: sp.id,
    name: cleanName(sp.commonName || sp.name),
    lines: deriveLines(sp)
  }));
  console.log('➡️  命中：', list.length);
  return dedupeSort(list);
}

async function tryByLines() {
  const url = `https://api.tfl.gov.uk/Line/Mode/tube?${qs({})}`;
  console.log('⬇️  Line/Mode/tube:', url);
  const lines = await fetchJson(url);
  const ids = (Array.isArray(lines) ? lines : []).map(l => l.id).filter(Boolean);
  console.log('➡️  线路数：', ids.length);

  let out = [];
  for (const id of ids) {
    const u = `https://api.tfl.gov.uk/Line/${encodeURIComponent(id)}/StopPoints?${qs({})}`;
    try {
      const data = await fetchJson(u);
      const arr = Array.isArray(data) ? data : [];
      const list = arr.filter(isStation).map(sp => ({
        id: sp.id,
        name: cleanName(sp.commonName || sp.name),
        lines: deriveLines(sp)
      }));
      console.log(`   · ${id.padEnd(16)}: ${list.length}`);
      out = out.concat(list);
    } catch (e) {
      console.warn(`   · ${id}: 拉取失败 -> ${e.message}`);
    }
  }
  out = dedupeSort(out);
  console.log('➡️  逐线路聚合命中：', out.length);
  return out;
}

(async () => {
  let list = [];
  try {
    list = await tryStopPointMode();
    if (!list.length) list = await tryByLines();
  } catch (e) {
    console.warn('⚠️  拉取异常：', e.message);
  }

  if (!list.length) {
    console.warn('⚠️  未获取到任何站点，保留现有离线文件，不覆盖。');
    if (!fs.existsSync(OUT_PATH)) {
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
})().catch(e => {
  console.error('❌ 构建失败：', e);
  process.exit(1);
});
