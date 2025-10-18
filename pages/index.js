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
  const [error, setError] = useState(null);

  const fetchArrivals = async () => {
    if (!station) return;
    
    setLoading(true);
    setError(null);
    try {
      console.log("正在获取车站数据:", station.id); // 调试信息
      const res = await axios.get(`/api/arrivals?station=${station.id}`);
      console.log("获取到的数据:", res.data); // 调试信息
      setArrivals(res.data.arrivals || []);
      setLineStatuses(res.data.statuses || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("获取车辆信息失败:", err);
      setError("无法获取该车站的实时信息，请稍后重试");
      setArrivals([]);
      setLineStatuses([]);
    }
    setLoading(false);
  };

  const handleStationSelect = (selectedStation) => {
    console.log("车站选择:", selectedStation); // 调试信息
    setStation(selectedStation);
    // 立即获取数据，不需要等待useEffect
    setTimeout(() => {
      fetchArrivals();
    }, 0);
  };

  useEffect(() => {
    if (station) {
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

        {/* 错误信息 */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
            <span className="ml-3 text-white text-lg">Loading departures...</span>
          </div>
        )}

        {/* 出发信息 */}
        {!loading && arrivals.length > 0 && (
          <DepartureBoard arrivals={arrivals} lineStatuses={lineStatuses} />
        )}

        {/* 没有数据时的提示 */}
        {!loading && station && arrivals.length === 0 && !error && (
          <div className="bg-black text-white p-8 rounded-lg text-center">
            <div className="text-2xl mb-4">ℹ️ No Departures Found</div>
            <p className="text-gray-300">
              No upcoming departures found for {station.name}. This station might be closed or have no scheduled services at the moment.
            </p>
          </div>
        )}

        {/* 欢迎信息 */}
        {!station && !loading && (
          <div className="bg-black text-white p-8 rounded-lg text-center">
            <div className="text-2xl mb-4">🚇 Welcome to TfL Departure Board</div>
            <p className="text-gray-300">
              Search for a London Underground station above to see live departure information
            </p>
            <div className="mt-4 text-sm text-gray-400">
              <p>试试搜索: Oxford Circus, King's Cross, Victoria, Waterloo</p>
            </div>
          </div>
        )}

        {/* 最后更新时间 */}
        {lastUpdated && (
          <div className="text-center mt-4 text-gray-300 text-sm">
            Last updated: {lastUpdated.toLocaleTimeString()} • Updates every 30 seconds
          </div>
        )}
      </div>
    </div>
  );
}
