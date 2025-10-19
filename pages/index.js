import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import StationSearch from "../components/StationSearch";
import DepartureBoard from "../components/DepartureBoard";
import HeaderBar from "../components/HeaderBar";

export default function Home(){
  const [selected, setSelected] = useState(null);
  const [arrivals, setArrivals] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);

  // —— 新增：自动刷新频率（秒），带本地记忆 ——
  const [refreshInterval, setRefreshInterval] = useState(15); // 默认 15 秒
  const timerRef = useRef(null);

  // 预热搜索（加速首屏）
  useEffect(()=>{ 
    fetch('/api/search?q=ham');
    fetch('/api/search?q=king');
    fetch('/api/search?q=wat');
    fetch('/api/search?q=pad');
  },[]);

  // 初始化读取本地记忆的刷新频率
  useEffect(()=>{
    try{
      const saved = localStorage.getItem('tube_refresh_interval');
      if (saved) {
        const sec = Math.max(1, parseInt(saved, 10) || 15);
        setRefreshInterval(sec);
      }
    }catch{}
  },[]);

  // 频率变化时写回本地
  useEffect(()=>{
    try{ localStorage.setItem('tube_refresh_interval', String(refreshInterval)); }catch{}
  }, [refreshInterval]);

  // 拉取一次（手动/自动都会用它）
  async function fetchData(stopPointId, name){
    if (!stopPointId) return;
    setLoading(true);
    try{
      const r = await fetch(`/api/arrivals?id=${encodeURIComponent(stopPointId)}${name?`&name=${encodeURIComponent(name)}`:''}`);
      const json = await r.json();
      setArrivals(json.arrivals || []);
      setStatuses(json.statuses || []);
    }catch(e){
      console.error(e);
    }finally{
      setLoading(false);
    }
  }

  // 当站点或刷新频率变化时：重建定时器
  useEffect(()=>{
    // 清理旧定时器
    clearInterval(timerRef.current);

    if (!selected?.id) return;

    // 立即刷新一次
    fetchData(selected.id, selected.name);

    // 按频率自动刷新（最少 1s 防御）
    const intervalMs = Math.max(1000, (refreshInterval || 15) * 1000);
    timerRef.current = setInterval(()=>{
      fetchData(selected.id, selected.name);
    }, intervalMs);

    return ()=> clearInterval(timerRef.current);
  }, [selected?.id, selected?.name, refreshInterval]);

  return (
    <div>
      <Head><title>伦敦地铁状态</title></Head>

      <HeaderBar
        selected={selected}
        onRefresh={()=> selected && fetchData(selected.id, selected.name)}
        // —— 把刷新频率状态传给 HeaderBar（用于显示/修改） ——
        refreshInterval={refreshInterval}
        onChangeRefreshInterval={(sec)=> setRefreshInterval(Math.max(1, Number(sec) || 15))}
      />

      <main className="max-w-5xl mx-auto p-6">
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2">
            <div className="mb-2 text-sm text-neutral-400">搜索站名</div>
            <StationSearch onSelect={setSelected} />
          </div>

          <div className="board-card p-4">
            <div className="board-header mb-2">线路运行状态</div>
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => (
                <div key={s.id} className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-neutral-300">{s.statusSeverityDescription || 'Unknown'}</div>
                </div>
              ))}
              {!statuses.length && <div className="text-sm text-neutral-400">选择站点后将展示相关线路状态。</div>}
            </div>
          </div>
        </div>

        <DepartureBoard arrivals={arrivals} />
        {loading && <div className="mt-3 text-sm text-neutral-400">正在更新…</div>}
      </main>
    </div>
  );
}
