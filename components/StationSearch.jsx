import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function StationSearch({ onStationSelect, currentStation }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (currentStation?.name) {
      setQuery(currentStation.name);
    }
  }, [currentStation]);

  const searchStations = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`/api/searchStations?query=${encodeURIComponent(searchQuery)}`);
      setSuggestions(res.data);
      setShowSuggestions(true);
    } catch (err) {
      console.error(err);
      setSuggestions([]);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // 防抖搜索
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      searchStations(value);
    }, 300);
  };

  const handleSuggestionClick = (station) => {
    setQuery(station.name);
    setShowSuggestions(false);
    onStationSelect(station);
  };

  const handleBlur = () => {
    // 延迟隐藏以便点击选项
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        placeholder="搜索地铁站 (例如: Oxford Circus)"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={handleBlur}
        className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
      />
      
      {loading && (
        <div className="absolute right-3 top-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((station) => (
            <div
              key={station.id}
              className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
              onClick={() => handleSuggestionClick(station)}
            >
              <div className="font-semibold">{station.name}</div>
              {station.lines && station.lines.length > 0 && (
                <div className="text-sm text-gray-600">
                  线路: {station.lines.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}