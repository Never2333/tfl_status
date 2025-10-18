import { useEffect, useRef, useState } from "react";

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
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.matches || []);
      setOpen(true);
    }, 250);
  }, [q]);

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="w-full p-3 rounded-lg border border-neutral-800 bg-neutral-950 placeholder-neutral-500"
        placeholder="Search station name (e.g. Waterloo)"
        value={q}
        onChange={e=>setQ(e.target.value)}
        onFocus={()=>{ if(results.length>0) setOpen(true); }}
      />
      {open && results.length>0 && (
        <ul className="absolute z-10 mt-2 w-full max-h-72 overflow-auto bg-neutral-900 border border-neutral-800 rounded-lg">
          {results.map(r => (
            <li key={r.id}
                className="px-3 py-2 hover:bg-neutral-800 cursor-pointer"
                onClick={()=>{ onSelect({ id:r.id, name:r.name }); setQ(r.name); setOpen(false); }}>
              <div className="font-medium">{r.name}</div>
              {r.additionalProperties && (
                <div className="text-xs text-neutral-400">{(r.additionalProperties.find(p=>p.key==='StopAreaName')||{}).value || ""}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
