// 强制 Node 运行时（Edge 对外部请求限制较多）
export const config = { runtime: 'nodejs' };

const LINE_NAME = {
  'bakerloo':'Bakerloo','central':'Central','circle':'Circle','district':'District',
  'elizabeth':'Elizabeth','hammersmith-city':'Hammersmith & City','jubilee':'Jubilee',
  'metropolitan':'Metropolitan','northern':'Northern','piccadilly':'Piccadilly',
  'victoria':'Victoria','waterloo-city':'Waterloo & City'
};
const titleCaseLine = (id) =>
  LINE_NAME[id] || (id || '').replace(/-/g,' ').replace(/\b\w/g, m=>m.toUpperCase());

const minutesFromSeconds = (sec) => {
  const m = Math.floor(Number(sec||0)/60);
  if (m <= 0) return 'Due';
  if (m === 1) return '1 min';
  return `${m} mins`;
};
const cleanDest = (name) => String(name||'').replace(/\s*\(?Underground Station\)?/gi,'').trim();

export default async function handler(req, res){
  try{
    const id = String(req.query.id||'').trim();
    if (!id) return res.status(400).json({ error:'missing id' });

    const lineFilter = (req.query.line||'').toString().trim().toLowerCase();     // e.g. "circle"
    const platformFilter = (req.query.platform||'').toString().trim().toLowerCase(); // substring match
    const limit = Math.max(1, Math.min(20, parseInt(req.query.limit||'10', 10)));

    const params = new URLSearchParams();
    if (process.env.TFL_APP_ID) params.set('app_id', process.env.TFL_APP_ID);
    if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

    const url = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}/Arrivals${params.toString()?`?${params.toString()}`:''}`;
    const r = await fetch(url, { cache:'no-store', headers:{'User-Agent':'tfl-platform-board/1.1'} });
    if (!r.ok) throw new Error(`TfL HTTP ${r.status}`);
    const raw = await r.json();
    const arr = Array.isArray(raw) ? raw : [];

    // Tube only
    let tube = arr.filter(x => String(x.modeName||'').toLowerCase()==='tube');

    // 统计可选项
    const lineMap = new Map();
    const platformMap = new Map();
    for (const t of tube){
      const lid = String(t.lineId||'').toLowerCase();
      if (lid) lineMap.set(lid, (lineMap.get(lid)||0)+1);
      const pn = String(t.platformName||'').trim();
      if (pn) platformMap.set(pn, (platformMap.get(pn)||0)+1);
    }
    const availableLines = Array.from(lineMap.entries())
      .map(([id,count]) => ({ id, name: titleCaseLine(id), count }))
      .sort((a,b)=> a.name.localeCompare(b.name));
    const availablePlatforms = Array.from(platformMap.entries())
      .map(([name,count]) => ({ name, count }))
      .sort((a,b)=> a.name.localeCompare(b.name));

    // 应用筛选
    if (lineFilter) tube = tube.filter(t => String(t.lineId||'').toLowerCase() === lineFilter);
    if (platformFilter) tube = tube.filter(t => String(t.platformName||'').toLowerCase().includes(platformFilter));

    // 按到站时间升序
    tube.sort((a,b)=> (a.timeToStation??9e9) - (b.timeToStation??9e9));

    const stationName = (tube[0]?.stationName) || (arr[0]?.stationName) || id;
    const sliced = tube.slice(0, limit);

    const list = sliced.map((t, i) => ({
      idx: i+1,
      lineId: t.lineId,
      lineName: titleCaseLine(t.lineId),
      platform: t.platformName || '',
      towards: cleanDest(t.towards || t.destinationName || ''),
      eta: minutesFromSeconds(Number(t.timeToStation||0)),
    }));

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({
      stationName,
      generatedAt: new Date().toISOString(),
      entries: list,
      availableLines,
      availablePlatforms
    });
  }catch(e){
    return res.status(200).json({
      stationName:'', generatedAt:null, entries:[],
      availableLines:[], availablePlatforms:[]
    });
  }
}
