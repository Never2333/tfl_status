import { useEffect, useRef, useState } from "react";
import LineBadge from "./LineBadge";

// client cache (only caches non-empty results to avoid sticky empties)
const CACHE = new Map();
const TTL = 2 * 60 * 1000;
function setCache(key, value){ CACHE.set(key, { value, ts: Date.now() }); }
function getCache(key){ const e=CACHE.get(key); if(!e) return null; if(Date.now()-e.ts>TTL){ CACHE.delete(key); return null; } return e.value; }
function norm(s){ return String(s||'').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim(); }
function cleanName(n){ return n? n.replace(/\s*\(?Underground Station\)?/gi, '').trim() : n; }
const ABBR = { "Hammersmith & City":"H&C","Waterloo & City":"W&C","Metropolitan":"Met","Elizabeth":"Elizabeth","Bakerloo":"Bakerloo","Central":"Central","Circle":"Circle","District":"District","Jubilee":"Jubilee","Northern":"Northern","Piccadilly":"Piccadilly","Victoria":"Victoria","DLR":"DLR","Overground":"Overground" };
function short(lines){ if(!Array.isArray(lines)||!lines.length) return ''; const names=lines.map(l=>ABBR[l.name]||l.name); const out=names.slice(0,5).join('/'); return names.length>5? out+'/…': out; }
function long(lines){ if(!Array.isArray(lines)||!lines.length) return ''; return lines.map(l=>l.name).join(' / '); }

export default function StationSearch({ onSelect }){
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(); const timer = useRef();

  useEffect(()=>{ function onClick(e){ if(boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); } window.addEventListener('click', onClick); return ()=> window.removeEventListener('click', onClick); },[]);

  useEffect(()=>{
    const qq = q;
    if (!qq || qq.length < 2){ setResults([]); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async ()=>{
      const key = norm(qq);
      const cached = getCache(key);
      setLoading(true);
      setOpen(true);
      setResults([]); // clear old to avoid stale visual
      try{
        if (cached){
          setResults(cached);
        }else{
          const res = await fetch(`/api/search?q=${encodeURIComponent(qq)}`);
          const data = await res.json();
          const listRaw = (data.results||[]).map(r => {
            const name = cleanName(r.name);
            const s = short(r.lines);
            const l = long(r.lines);
            const displayName = s? `${name} (${s})` : name;
            return { ...r, name, _short:s, _long:l, displayName };
          });
          const qn = norm(qq);
          const list = listRaw.slice().sort((a,b)=>{
            const an = norm(a.displayName), bn = norm(b.displayName);
            const ap = an.startsWith(qn)?0:1, bp = bn.startsWith(qn)?0:1;
            if (ap!==bp) return ap-bp;
            if (an.length!==bn.length) return an.length-bn.length;
            return an.localeCompare(bn);
          }).slice(0,12);
          if (list.length) setCache(key, list); // only cache non-empty
          setResults(list);
        }
      }catch(e){
        setResults([]);
      }finally{
        setLoading(false);
        if (results.length===0 && !cached) setOpen(false);
      }
    }, 300);
  }, [q]);

  return (
    <div className="relative" ref={boxRef}>
      <input className="w-full" placeholder="例如：Waterloo、Oxford Circus" value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>{ if(results.length>0) setOpen(true); }} />
      {open && (
        <ul className="absolute z-10 mt-2 w-full max-h-96 overflow-auto bg-neutral-900 border border-neutral-800 rounded-lg">
          {loading && <li className="px-3 py-2 text-sm text-neutral-400">正在搜索…</li>}
          {!loading && results.length===0 && <li className="px-3 py-2 text-sm text-neutral-400">无结果</li>}
          {!loading && results.map(r=> (
            <li key={r.id}
                className="px-3 py-2 hover:bg-neutral-800 cursor-pointer"
                onClick={()=>{ onSelect({ id:r.id, name:r.name, displayName:r.displayName }); setQ(r.displayName); setOpen(false); }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.displayName}</div>
                  <div className="text-[11px] text-neutral-400 truncate" title={r._long || r.id}>{r.id}</div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {(r.lines||[]).map(l => (<LineBadge key={l.id} id={l.id} name={l.name} small />))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
