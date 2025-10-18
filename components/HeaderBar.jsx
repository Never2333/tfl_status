import Clock from './Clock';
import FullscreenButton from './FullscreenButton';

export default function HeaderBar({ selected, onRefresh }){
  return (
    <header className="sticky top-0 z-20 bg-neutral-900/90 backdrop-blur mb-6">
      <div className="max-w-5xl mx-auto p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">London Underground — Live Departures</h1>
          <p className="board-header">Search a station by name, then view departures grouped by platform.</p>
          <div className="text-sm text-neutral-400 mt-1">{selected? selected.name : 'No station selected'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={onRefresh} disabled={!selected}>Refresh</button>
          <FullscreenButton />
          <Clock />
        </div>
      </div>
    </header>
  );
}
