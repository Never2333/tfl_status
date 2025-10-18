import LineBadge from "./LineBadge";

function groupByPlatform(arrivals){
  const map = {};
  for(const a of arrivals){
    const key = a.platformName || 'Platform ?';
    (map[key] ||= []).push(a);
  }
  return map;
}
function secondsToText(s){ if(!isFinite(s)) return '-'; if(s<60) return `${s}s`; const m=Math.floor(s/60), r=s%60; return r?`${m}m ${r}s`:`${m}m`; }

export default function DepartureBoard({ arrivals }){
  const grouped = groupByPlatform(arrivals);
  const platforms = Object.keys(grouped).sort();

  return (
    <div className="board-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="board-header">Departures (live)</div>
        <div className="board-header">{arrivals.length} services</div>
      </div>

      {platforms.map(p => {
        const list = grouped[p].slice().sort((a,b)=>{
          const ta = typeof a.timeToStation==='number'?a.timeToStation:Infinity;
          const tb = typeof b.timeToStation==='number'?b.timeToStation:Infinity;
          return ta - tb;
        });
        return (
          <div key={p} className="mb-4">
            <div className="platform-title mb-2">{p}</div>
            <div className="divide-y divide-neutral-800">
              {list.map(item => (
                <div key={item.id} className="row">
                  <div className="col-span-2"><LineBadge id={item.lineId} name={item.lineName || item.lineId} /></div>
                  <div className="col-span-4 truncate font-semibold">{item.destinationName}</div>
                  <div className="col-span-3 text-neutral-300 truncate">{item.currentLocation || item.towards || '—'}</div>
                  <div className="col-span-2 text-right text-neutral-300">{item.expectedArrival ? new Date(item.expectedArrival).toLocaleTimeString() : '-'}</div>
                  <div className="col-span-1 text-right countdown">{secondsToText(typeof item.timeToStation==='number'?item.timeToStation:Infinity)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
