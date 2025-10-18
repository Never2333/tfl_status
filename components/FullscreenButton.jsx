import { useEffect, useState } from 'react';
export default function FullscreenButton(){
  const [fs, setFs] = useState(false);
  useEffect(()=>{ function onChange(){ setFs(!!document.fullscreenElement); } document.addEventListener('fullscreenchange', onChange); return ()=> document.removeEventListener('fullscreenchange', onChange); },[]);
  const enter = async ()=>{ try{ await document.documentElement.requestFullscreen(); }catch(e){} };
  const exit = async ()=>{ try{ await document.exitFullscreen(); }catch(e){} };
  return (<button className="btn" onClick={()=> fs?exit():enter()}>{fs? '退出全屏':'全屏显示'}</button>);
}
