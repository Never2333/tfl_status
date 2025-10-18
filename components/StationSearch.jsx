import { useEffect, useRef, useState } from "react";
import LineBadge from "./LineBadge";

export default function StationSearch({ onSelect }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef();
  const timer = useRef();

  useEffect(() => {
    function onClick(e){ if(boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  },[]);

  useEffect(() => {
    if (!q || q.length < 2) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      // 1) base search (tube only)
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const matches = (data.matches || []).slice(0, 8);
      // 2) fetch lines for each stop
      const enriched = await Promise.all(matches.map(async m => {
        try{
          const lr = await fetch(`/api/stop-lines?id=${encodeURIComponent(m.id)}`);
          const lj = await lr.json();
          return { ...m, _lines: lj.lines || [] };
        }catch(e){ return { ...m, _lines: [] }; }
      }));
      setResults(enriched);
      setOpen(true);
    }, 250);
  }, [q]);

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="w-full"
        placeholder="Search station name (e.g. Hammersmith, King's Cross St. Pancras)"
        value={q}
        onChange={e=>setQ(e.target.value)}
        onFocus={()=>{ if(results.length>0) setOpen(true); }}
      />
      {open && results.length>0 && (
        <ul className="absolute z-10 mt-2 w-full max-h-96 overflow-auto bg-neutral-900 border border-neutral-800 rounded-lg">
          {results.map(r => (
            <li key={r.id}
                className="px-3 py-2 hover:bg-neutral-800 cursor-pointer"
                onClick={()=>{ onSelect({ id:r.id, name:r.name }); setQ(r.name); setOpen(false); }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-[11px] text-neutral-400 truncate">ID: {r.id}</div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {(r._lines || []).map(l => (<LineBadge key={l.id} id={l.id} name={l.name} small />))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
