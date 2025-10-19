// 强制 Node 运行时（Edge 在部分环境 fetch 限制较多）
export const config = { runtime: 'nodejs' };

const LINE_NAME = {
  'bakerloo':'Bakerloo','central':'Central','circle':'Circle','district':'District',
  'elizabeth':'Elizabeth','hammersmith-city':'Hammersmith & City','jubilee':'Jubilee',
  'metropolitan':'Metropolitan','northern':'Northern','piccadilly':'Piccadilly',
  'victoria':'Victoria','waterloo-city':'Waterloo & City'
};

function titleCaseLine(id){ return LINE_NAME[id] || id?.replace(/-/g,' ').replace(/\b\w/g, m=>m.toUpperCase()); }

function minutesFromSeconds(sec){
  const m = Math.floor(sec/60);
  if (m <= 0) return 'Due';
  if (m === 1) return '1 min';
  return `${m} mins`;
}

function cleanDest(name){
  // 去掉 "Underground Station" 等冗余
  return String(name||'').replace(/\s*\(?Underground Station\)?/gi,'').trim();
}

export default async function handler(req, res){
  try{
    const id = String(req.query.id||'').trim();
    if (!id) return res.status(400).json({ error:'missing id' });

    const params = new URLSearchParams();
    if (process.env.TFL_APP_ID) params.set('app_id', process.env.TFL_APP_ID);
    if (process.env.TFL_API_KEY) params.set('app_key', process.env.TFL_API_KEY);

    // 1) 拉取到站（Arrivals）
    const url = `https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(id)}/Arrivals${params.toString()?`?${params.toString()}`:''}`;
    const r = await fetch(url, { cache:'no-store', headers:{'User-Agent':'tfl-platform-board/1.0'} });
    if (!r.ok) throw new Error(`TfL HTTP ${r.status}`);
    const raw = await r.json();
    const arr = Array.isArray(raw) ? raw : [];

    // 2) 只要 Tube；时间升序
    const tube = arr
      .filter(x => String(x.modeName||'').toLowerCase()==='tube')
      .sort((a,b)=> (a.timeToStation??9e9) - (b.timeToStation??9e9));

    // 3) 规整输出
    const stationName = (tube[0]?.stationName) || (tube[0]?.naptanId) || id;

    // 取前 10 条做“站台屏”
    const list = tube.slice(0,10).map((t, i) => ({
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
      entries: list
    });
  }catch(e){
    return res.status(200).json({ stationName:'', generatedAt:null, entries:[] });
  }
}
