import Clock from './Clock';
import FullscreenButton from './FullscreenButton';

export default function HeaderBar({ selected, onRefresh }){
  return (
    <header className="sticky top-0 z-20 bg-neutral-900/90 backdrop-blur mb-6">
      <div className="max-w-5xl mx-auto p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">伦敦地铁状态</h1>
          <p className="board-header">按站名搜索并查看实时出发，支持按站台和线路筛选。</p>
          <div className="text-sm text-neutral-400 mt-1">{selected? selected.name : '未选择站点'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={onRefresh} disabled={!selected}>刷新</button>
          <FullscreenButton />
          <Clock />
        </div>
      </div>
    </header>
  );
}
