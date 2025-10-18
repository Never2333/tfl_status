import { useEffect, useRef, useState } from "react";
import StationSearch from "../components/StationSearch";
import DepartureBoard from "../components/DepartureBoard";

export default function Home(){
  const [selected, setSelected] = useState(null);
  const [arrivals, setArrivals] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const refreshRef = useRef();

  useEffect(()=>{
    if(!selected) return;
    fetchData(selected.id);
    refreshRef.current = setInterval(()=> fetchData(selected.id), 30_000);
    return ()=> clearInterval(refreshRef.current);
  }, [selected]);

  async function fetchData(stopPointId){
    setLoading(true);
    try{
      const r = await fetch(`/api/arrivals?id=${encodeURIComponent(stopPointId)}`);
      const json = await r.json();
      setArrivals(json.arrivals || []);
      setStatuses(json.statuses || []);
    }catch(e){console.error(e)}
    finally{ setLoading(false); }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">London Underground — Live Departures</h1>
        <p className="board-header">Search a station by name, then view departures grouped by platform.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <StationSearch onSelect={setSelected} />
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 border border-neutral-700 rounded-lg" onClick={()=> selected && fetchData(selected.id)} disabled={!selected}>Refresh</button>
          <div className="text-sm text-neutral-400">{selected? selected.name : 'No station selected'}</div>
        </div>
      </div>

      {statuses.length>0 && (
        <div className="board-card p-4 mb-6">
          <div className="board-header mb-2">Line Status</div>
          <div className="flex flex-wrap gap-2">
            {statuses.map(s => (
              <div key={s.id} className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
                <div className="font-semibold">{s.name}</div>
                <div className="text-sm text-neutral-300">{s.statusSeverityDescription || 'Unknown'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DepartureBoard arrivals={arrivals} />

      {loading && <div className="mt-3 text-sm text-neutral-400">Updating…</div>}
    </div>
  );
}
