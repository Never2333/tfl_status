import { useMemo, useState } from "react";
import LineBadge from "./LineBadge";

function secondsToText(s){ if(!isFinite(s)) return '-'; if(s<60) return `${s}s`; const m=Math.floor(s/60), r=s%60; return r?`${m}m ${r}s`:`${m}m`; }

export default function DepartureBoard({ arrivals }){
  const [lineFilter, setLineFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");

  const lines = useMemo(()=> Array.from(new Set(arrivals.map(a=>a.lineId))).sort(), [arrivals]);
  const platforms = useMemo(()=> Array.from(new Set(arrivals.map(a=>a.platformName || 'Platform ?'))).sort(), [arrivals]);

  const filtered = arrivals.filter(a => {
    if (lineFilter && a.lineId !== lineFilter) return false;
    if (platformFilter && (a.platformName || 'Platform ?') !== platformFilter) return false;
    return true;
  });

  const grouped = filtered.reduce((acc, a) => {
    const key = a.platformName || 'Platform ?';
    (acc[key] ||= []).push(a);
    return acc;
  }, {});
  const platformKeys = Object.keys(grouped).sort();

  return (
    <div className="board-card p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="board-header">实时出发</div>
        <div className="flex items-center gap-2">
          <select className="select" value={lineFilter} onChange={e=>setLineFilter(e.target.value)}>
            <option value="">全部线路</option>
            {lines.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="select" value={platformFilter} onChange={e=>setPlatformFilter(e.target.value)}>
            <option value="">全部站台</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="btn" onClick={()=>{ setLineFilter(""); setPlatformFilter(""); }}>清除筛选</button>
        </div>
      </div>

      {platformKeys.map(p => {
        const list = grouped[p].slice().sort((a,b)=>{ const ta = typeof a.timeToStation==='number'?a.timeToStation:Infinity; const tb = typeof b.timeToStation==='number'?b.timeToStation:Infinity; return ta - tb; });
        return (
          <div key={p} className="mb-4">
            <div className="platform-title mb-2">{p}</div>
            <div className="table-head">
              <div className="col-span-2">线路名称</div>
              <div className="col-span-4">方向（目的地）</div>
              <div className="col-span-3">车辆当前位置</div>
              <div className="col-span-2 text-right">预计到达时间</div>
              <div className="col-span-1 text-right">倒计时</div>
            </div>
            <div className="divide-y divide-neutral-800">
              {list.map(item => (
                <div key={item.id} className="row">
                  <div className="col-span-2"><LineBadge id={item.lineId} name={item.lineName || item.lineId} /></div>
                  <div className="col-span-4 truncate font-semibold">{item.destinationName}</div>
                  <div className="col-span-3 text-neutral-300 truncate">{item.currentLocation || item.towards || '—'}</div>
                  <div className="col-span-2 text-right text-neutral-300">{item.expectedArrival ? new Date(item.expectedArrival).toLocaleTimeString('zh-CN') : '-'}</div>
                  <div className="col-span-1 text-right countdown">{secondsToText(typeof item.timeToStation==='number'?item.timeToStation:Infinity)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {platformKeys.length===0 && <div className="text-sm text-neutral-400">当前筛选下暂无出发信息。</div>}
    </div>
  );
}
