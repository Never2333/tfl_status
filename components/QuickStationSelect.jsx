export default function QuickStationSelect({ onStationSelect }) {
  const popularStations = [
    { id: "940GZZLUOXC", name: "Oxford Circus" },
    { id: "940GZZLUKSX", name: "King's Cross St. Pancras" },
    { id: "940GZZLUVIC", name: "Victoria" },
    { id: "940GZZLUWLO", name: "Waterloo" },
    { id: "940GZZLUBKG", name: "Bank" },
    { id: "940GZZLULNB", name: "London Bridge" }
  ];

  return (
    <div className="mt-4">
      <p className="text-gray-600 mb-2">或选择常用车站:</p>
      <div className="flex flex-wrap gap-2">
        {popularStations.map(station => (
          <button
            key={station.id}
            onClick={() => onStationSelect(station)}
            className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded text-sm"
          >
            {station.name}
          </button>
        ))}
      </div>
    </div>
  );
}
