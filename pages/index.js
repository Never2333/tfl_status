import { useEffect, useRef, useState } from "react";
import StationSearch from "../components/StationSearch";
import DepartureBoard from "../components/DepartureBoard";
import HeaderBar from "../components/HeaderBar";

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
    <div>
      <HeaderBar selected={selected} onRefresh={()=> selected && fetchData(selected.id)} />
      <main className="max-w-5xl mx-auto p-6">
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2">
            <StationSearch onSelect={setSelected} />
          </div>
          <div className="board-card p-4">
            <div className="board-header mb-2">Line Status</div>
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => (
                <div key={s.id} className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-neutral-300">{s.statusSeverityDescription || 'Unknown'}</div>
                </div>
              ))}
              {!statuses.length && <div className="text-sm text-neutral-400">Select a station to load line status.</div>}
            </div>
          </div>
        </div>

        <DepartureBoard arrivals={arrivals} />
        {loading && <div className="mt-3 text-sm text-neutral-400">Updating…</div>}
      </main>
    </div>
  );
}
