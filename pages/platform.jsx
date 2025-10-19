import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

function useDebounced(value, delay=300){
  const [v, setV] = useState(value);
  useEffect(()=>{ const t = setTimeout(()=>setV(value), delay); return ()=>clearTimeout(t); }, [value, delay]);
  return v;
}

export default function PlatformPage(){
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const [suggestions, setSuggestions] = useState([]);
  const [station, setStation] = useState(null); // { id, name }
  const [board, setBoard] = useState({ stationName:'', entries:[], availableLines:[], availablePlatforms:[] });
  const [loading, setLoading] = useState(false);

  // 筛选/数量
  const [line, setLine] = useState('');           // e.g. "circle"
  const [platform, setPlatform] = useState('');   // substring
  const [limit, setLimit] = useState(10);         // 3/5/8/10/15/20

  const timerRef = useRef(null);

  // 支持 /platform?id=940G... 直达
  useEffect(()=>{
    const { id } = router.query || {};
    if (id && typeof id === 'string'){
      setStation({ id, name: '' });
    }
  }, [router.query]);

  // 搜索联想
  useEffect(()=>{
    if (!debounced || debounced.length < 2){ setSuggestions([]); return; }
    (async ()=>{
      try{
        const r = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`);
        const j = await r.json();
        const list = (j?.results||[]).map(x => ({
          id: x.id,
          name: x.name,
          badge: (x.lines||[]).map(l=>l.name).join(' / ')
        }));
        setSuggestions(list);
      }catch{ setSuggestions([]); }
    })();
  }, [debounced]);

  async function loadBoard(id, opts={}){
    const q = new URLSearchParams();
    q.set('id', id);
    if (opts.line) q.set('line', opts.line);
    if (opts.platform) q.set('platform', opts.platform);
    q.set('limit', String(opts.limit || limit || 10));
    q.set('t', String(Date.now())); // 防缓存
    try{
      setLoading(true);
      const r = await fetch(`/api/platform?${q.toString()}`, { cache:'no-store' });
      const j = await r.json();
      setBoard({
        stationName: j.stationName || station?.name || '',
        entries: j.entries || [],
        availableLines: j.availableLines || [],
        availablePlatforms: j.availablePlatforms || []
      });
    }finally{
      setLoading(false);
    }
  }

  // 选站 → 加载 + 定时刷新
  useEffect(()=>{
    if (!station?.id) return;
    loadBoard(station.id, { line, platform, limit });
    clearInterval(timerRef.current);
    timerRef.current = setInterval(()=> loadBoard(station.id, { line, platform, limit }), 15000);
    return ()=> clearInterval(timerRef.current);
  }, [station?.id]);

  // 改变筛选/数量 → 立即刷新
  useEffect(()=>{
    if (!station?.id) return;
    loadBoard(station.id, { line, platform, limit });
  }, [line, platform, limit]);

  function toggleFullscreen(){
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  const [now, setNow] = useState(new Date());
  useEffect(()=>{ const t = setInterval(()=> setNow(new Date()), 1000); return ()=> clearInterval(t); }, []);

  // 选站界面
  if (!station?.id){
    return (
      <>
        <Head>
          {/* 引入你提供的字体 */}
          <style>{`
            @font-face{
              font-family: 'LURegular';
              src: url('/fonts/LondonUnderground-Regular.ttf') format('truetype');
              font-weight: normal;
              font-style: normal;
              font-display: swap;
            }
          `}</style>
          <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet" />
          <title>站台屏 · 伦敦地铁状态</title>
        </Head>

        <div className="screen">
          <div className="panel">
            <h1 className="led title">选择地铁站</h1>
            <input
              autoFocus
              className="search"
              placeholder="输入站名（如 Hammersmith, King's Cross, Waterloo）"
              value={query}
              onChange={e=>setQuery(e.target.value)}
            />
            <div className="suggest">
              {suggestions.map(s => (
                <button key={s.id} className="suggest-item" onClick={()=> setStation({ id: s.id, name: s.name })}>
                  <span className="led">{s.name}</span>
                  {s.badge && <span className="badge">{s.badge}</span>}
                </button>
              ))}
              {!suggestions.length && debounced?.length>=2 && <div className="muted">无结果</div>}
            </div>
          </div>

          <style jsx>{`
            .screen { min-height: 100vh; display:flex; align-items:center; justify-content:center; background:#000; color:#ff9a00; }
            .panel { width:min(720px, 90vw); }
            .title { text-align:center; margin-bottom:24px; }
            .search { width:100%; padding:12px 14px; background:#000; border:1px solid #333; border-radius:8px; color:#ff9a00; font-size:18px; }
            .suggest { margin-top:14px; display:flex; flex-direction:column; gap:8px; }
            .suggest-item { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#0a0a0a; border:1px solid #222; border-radius:8px; color:#ff9a00; }
            .suggest-item:hover { background:#111; }
            .badge { color:#ffcf7f; font-size:12px; margin-left:12px; }
            .muted { color:#777; margin-top:10px; text-align:center; }
            .led { font-family: 'LURegular', 'DotGothic16', ui-monospace, monospace; letter-spacing: 1px; text-shadow: 0 0 6px rgba(255,154,0,.35); }
          `}</style>
        </div>
      </>
    );
  }

  // 看板
  return (
    <>
      <Head>
        <style>{`
          @font-face{
            font-family: 'LURegular';
            src: url('/fonts/LondonUnderground-Regular.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
        `}</style>
        <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet" />
        <title>{(board.stationName || station?.name || 'Station')} · 站台屏</title>
      </Head>

      <div className="board">
        <div className="board-inner">
          <div className="top">
            <div className="left">
              <button className="btn" onClick={()=> setStation(null)} title="返回选站">⟵ 返回</button>
            </div>
            <div className="title led">{board.stationName || station?.name || ''}</div>
            <div className="right">
              {/* 筛选条 */}
              <div className="filters">
                <select className="ctrl" value={line} onChange={e=>setLine(e.target.value)}>
                  <option value="">全部线路</option>
                  {board.availableLines.map(l => <option key={l.id} value={l.id}>{l.name} ({l.count})</option>)}
                </select>
                <select className="ctrl" value={platform} onChange={e=>setPlatform(e.target.value)}>
                  <option value="">全部站台</option>
                  {board.availablePlatforms.map(p => <option key={p.name} value={p.name}>{p.name} ({p.count})</option>)}
                </select>
                <select className="ctrl" value={limit} onChange={e=>setLimit(parseInt(e.target.value,10))}>
                  {[3,5,8,10,15,20].map(n => <option key={n} value={n}>显示 {n} 趟</option>)}
                </select>
                <button className="btn" onClick={toggleFullscreen} title="全屏">⤢ 全屏</button>
              </div>
            </div>
          </div>

          <div className="rows">
            {loading && !board.entries.length && <div className="row led">加载中…</div>}
            {board.entries.map(item => (
              <div key={item.idx + item.towards + item.eta} className="row">
                <div className="col idx led">{String(item.idx).padStart(2,' ')}</div>
                <div className="col dest led">
                  {item.towards}{item.lineName ? `  (${item.lineName})` : ''}{item.platform ? ` — ${item.platform}` : ''}
                </div>
                <div className="col eta led">{item.eta}</div>
              </div>
            ))}
            {!loading && !board.entries.length && (
              <div className="row led">暂无到站信息</div>
            )}
          </div>

          <div className="clock led">
            {now.toLocaleTimeString('en-GB', { hour12:false })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .board { min-height: 100vh; background:#000; color:#ff9a00; }
        .board-inner { max-width:1280px; margin:0 auto; padding:24px 20px 40px; }
        .top { display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; margin-bottom:10px; }
        .left { text-align:left; }
        .right { text-align:right; }
        .title { font-size:56px; text-align:center; }
        .filters { display:flex; gap:8px; justify-content:flex-end; align-items:center; }
        .ctrl { background:#000; color:#ffcf7f; border:1px solid #333; border-radius:8px; padding:6px 10px; }
        .btn { font-size:14px; color:#ffcf7f; background:transparent; border:1px solid #333; padding:6px 10px; border-radius:8px; }
        .rows { margin-top:14px; }
        .row { display:grid; grid-template-columns: 60px 1fr 160px; align-items:center; padding:14px 6px; }
        .col.idx { font-size:36px; text-align:left; padding-left:6px; }
        .col.dest { font-size:36px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 8px; }
        .col.eta { font-size:36px; text-align:right; padding-right:6px; }
        .clock { margin-top:26px; text-align:center; font-size:42px; }
        .led { font-family: 'LURegular', 'DotGothic16', ui-monospace, monospace; letter-spacing: 1px; text-shadow: 0 0 6px rgba(255,154,0,.35); }
        @media (max-width: 900px){
          .title{ font-size:40px; }
          .col.idx, .col.dest, .col.eta { font-size:26px; }
          .col.eta{ width:120px; }
          .clock{ font-size:32px; }
          .row { grid-template-columns: 50px 1fr 120px; }
        }
      `}</style>
    </>
  );
}
