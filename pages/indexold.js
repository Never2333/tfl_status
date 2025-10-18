import { useEffect, useState } from "react";
import DepartureBoard from "../components/DepartureBoard";
import axios from "axios";

export default function Home() {
  const [station, setStation] = useState("");
  const [arrivals, setArrivals] = useState([]);
  const [lineStatuses, setLineStatuses] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchArrivals = async () => {
    if (!station) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/arrivals?station=${station}`);
      setArrivals(res.data.arrivals);
      setLineStatuses(res.data.statuses);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (station) fetchArrivals();
    const interval = setInterval(() => {
      if (station) fetchArrivals();
    }, 30000);
    return () => clearInterval(interval);
  }, [station]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">TfL Departure Board</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Enter station ID (e.g., 940GZZLUOXC for Oxford Circus)"
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="flex-1 border p-2 rounded"
        />
        <button
          onClick={fetchArrivals}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Search
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {lineStatuses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Line Status</h2>
          <ul className="space-y-1">
            {lineStatuses.map((ls) => (
              <li key={ls.id} className="bg-white p-2 rounded shadow">
                <span className="font-bold">{ls.name}</span>:{" "}
                {ls.statusSeverityDescription}
              </li>
            ))}
          </ul>
        </div>
      )}

      {arrivals.length > 0 && <DepartureBoard arrivals={arrivals} />}
    </div>
  );
}
