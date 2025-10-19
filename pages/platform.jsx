import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

// 简单的 debounce
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
  const [board, setBoard] = useState({ stationName:'', entries:[] });
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  // 从 ?id=940G... 直接打开
  useEffect(()=>{
    const { id } = router.query || {};
    if (id && typeof id === 'string'){
      setStation({ id, name: '' });
    }
  }, [router.query]);

  // 搜索联想（复用你已有的 /api/search）
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

  // 拉取站台屏数据
  async function loadBoard(id){
    try{
      setLoading(true);
      const r = await fetch(`/api/platform?id=${encodeURIComponent(id)}&t=${Date.now()}`, { cache:'no-store' });
      const j = await r.json();
      setBoard({ stationName: j.stationName || station?.name || '', entries: j.entries || [] });
    }finally{
      setLoading(false);
    }
  }

  // 选择站点后，进入看板并定时刷新
  useEffect(()=>{
    if (!station?.id) return;
    loadBoard(station.id);
    // 15 秒刷新一次
    clearInterval(timerRef.current);
    timerRef.current = setInterval(()=> loadBoard(station.id), 15000);
    return ()=> clearInterval(timerRef.current);
  }, [station?.id]);

  // 全屏
  function toggleFullscreen(){
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // 时钟
  const [now, setNow] = useState(new Date());
  useEffect(()=>{
    const t = setInterval(()=> setNow(new Date()), 1000);
    return ()=> clearInterval(t);
  }, []);

  // 初始态：选站
  if (!station?.id){
    return (
      <>
        <Head>
          {/* DotGothic16 更接近“点阵风格”，可直接用 Google Fonts */}
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
            .led { font-family: 'DotGothic16', ui-monospace, monospace; letter-spacing: 1px; text-shadow: 0 0 6px rgba(255,154,0,.4); }
          `}</style>
        </div>
      </>
    );
  }

  // 看板态
  return (
    <>
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet" />
        <title>{(board.stationName || station?.name || 'Station')} · 站台屏</title>
      </Head>

      <div className="board">
        <div className="board-inner">
          <div className="top">
            <div className="corner left" onClick={()=> setStation(null)} title="返回选站">⟵</div>
            <div className="title led">{board.stationName || station?.name || ''}</div>
            <div className="corner right">
              <button className="btn" onClick={toggleFullscreen} title="全屏">⤢</button>
            </div>
          </div>

          <div className="rows">
            {loading && !board.entries.length && <div className="row led">加载中…</div>}
            {board.entries.map(item => (
              <div key={item.idx + item.towards} className="row">
                <div className="col idx led">{String(item.idx).padStart(2,' ')}</div>
                <div className="col dest led">
                  {item.towards}{item.lineName ? `  (${item.lineName})` : ''}
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
        .board-inner { max-width:1200px; margin:0 auto; padding:24px 20px 40px; }
        .top { display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; margin-bottom:28px; }
        .title { font-size:56px; text-align:center; }
        .corner { color:#ffcf7f; }
        .corner.right { text-align:right; }
        .btn { font-size:20px; color:#ffcf7f; background:transparent; border:1px solid #333; padding:6px 10px; border-radius:8px; }
        .rows { margin-top:20px; }
        .row { display:grid; grid-template-columns: 60px 1fr 140px; align-items:center; padding:14px 6px; }
        .col.idx { font-size:36px; text-align:left; padding-left:6px; }
        .col.dest { font-size:36px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 8px; }
        .col.eta { font-size:36px; text-align:right; padding-right:6px; }
        .clock { margin-top:40px; text-align:center; font-size:42px; }
        .led { font-family: 'DotGothic16', ui-monospace, monospace; letter-spacing: 1px; text-shadow: 0 0 6px rgba(255,154,0,.4); }
        @media (max-width: 768px){
          .title{ font-size:40px; }
          .col.idx, .col.dest, .col.eta { font-size:26px; }
          .col.eta{ width:120px; }
          .clock{ font-size:32px; }
        }
      `}</style>
    </>
  );
}
