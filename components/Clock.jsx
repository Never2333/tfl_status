import { useEffect, useState } from "react";
export default function Clock(){
  const [now, setNow] = useState(new Date());
  useEffect(()=>{
    const t = setInterval(()=> setNow(new Date()), 1000);
    return ()=> clearInterval(t);
  },[]);
  const dateStr = now.toLocaleDateString(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' });
  const timeStr = now.toLocaleTimeString();
  return <div className="text-right"><div className="text-xs text-neutral-400">{dateStr}</div><div className="font-mono text-lg">{timeStr}</div></div>;
}
