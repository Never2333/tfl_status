[file name]: pages/index.js
[file content begin]
import { useEffect, useState } from "react";
import DepartureBoard from "../components/DepartureBoard";
import StationSearch from "../components/StationSearch";
import axios from "axios";

export default function Home() {
  const [station, setStation] = useState(null);
  const [arrivals, setArrivals] = useState([]);
  const [lineStatuses, setLineStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchArrivals = async () => {
    if (!station) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/arrivals?station=${station.id}`);
      setArrivals(res.data.arrivals);
      setLineStatuses(res.data.statuses);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleStationSelect = (selectedStation) => {
    setStation(selectedStation);
  };

  useEffect(() => {
    if (station) {
      fetchArrivals();
      const interval = setInterval(() => {
        fetchArrivals();
      }, 30000); // 每30秒更新一次
      return () => clearInterval(interval);
    }
  }, [station]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">London Underground</h1>
          <p className="text-gray-300">Live Departure Information</p>
        </div>

        {/* 搜索框 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <StationSearch 
            onStationSelect={handleStationSelect} 
            currentStation={station}
          />
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
            <span className="ml-3 text-white text-lg">Loading departures...</span>
          </div>
        )}

        {/* 出发信息 */}
        {arrivals.length > 0 && (
          <DepartureBoard arrivals={arrivals} lineStatuses={lineStatuses} />
        )}

        {/* 欢迎信息 */}
        {!station && !loading && (
          <div className="bg-black text-white p-8 rounded-lg text-center">
            <div className="text-2xl mb-4">🚇 Welcome to TfL Departure Board</div>
            <p className="text-gray-300">
              Search for a London Underground station above to see live departure information
            </p>
          </div>
        )}

        {/* 最后更新时间 */}
        {lastUpdated && (
          <div className="text-center mt-4 text-gray-300 text-sm">
            Information updates every 30 seconds
          </div>
        )}
      </div>
    </div>
  );
}
[file content end]