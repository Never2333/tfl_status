// components/HeaderBar.jsx
import Clock from './Clock';
import FullscreenButton from './FullscreenButton';

export default function HeaderBar({
  selected,
  onRefresh,
  refreshInterval,          // 新增：当前刷新秒数
  onChangeRefreshInterval,  // 新增：修改回调
}) {
  const title = selected?.displayName || selected?.name || '未选择站点';
  return (
    <header className="sticky top-0 z-20 bg-neutral-900 bg-opacity-90 backdrop-blur mb-6">
      <div className="max-w-5xl mx-auto p-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">伦敦地铁状态</h1>
          <p className="board-header">按站名搜索并查看实时出发，支持按站台和线路筛选。</p>
          <div className="text-sm text-neutral-400 mt-1">{title}</div>
        </div>

        <div className="flex items-center gap-2">
          {/* 刷新频率选择器 */}
          <label className="text-xs text-neutral-400 mr-1">自动刷新</label>
          <select
            className="select text-sm"
            value={refreshInterval}
            onChange={(e)=> onChangeRefreshInterval?.(Number(e.target.value))}
            title="自动刷新频率（秒）"
          >
            {[5, 10, 15, 30, 60, 120].map(s => (
              <option key={s} value={s}>{s} 秒</option>
            ))}
          </select>

          <button className="btn" onClick={onRefresh} disabled={!selected}>刷新</button>
          <FullscreenButton />
          <Clock />
        </div>
      </div>
    </header>
  );
}
