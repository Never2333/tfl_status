import axios from "axios";

export default async function handler(req, res) {
  const { station } = req.query;
  if (!station) {
    return res.status(400).json({ error: "Station ID required" });
  }

  const apiKey = process.env.TFL_API_KEY;
  try {
    console.log(`Fetching arrivals for station: ${station}`); // 调试信息
    
    const arrivalsRes = await axios.get(
      `https://api.tfl.gov.uk/StopPoint/${station}/Arrivals?app_key=${apiKey}`
    );
    const arrivals = arrivalsRes.data;

    // 如果没有到达信息，返回空数组
    if (!arrivals || arrivals.length === 0) {
      return res.status(200).json({ arrivals: [], statuses: [] });
    }

    const lineIds = [...new Set(arrivals.map((a) => a.lineId))];

    const statusRes = await axios.get(
      `https://api.tfl.gov.uk/Line/${lineIds.join(",")}/Status?app_key=${apiKey}`
    );
    const statuses = statusRes.data.map((line) => ({
      id: line.id,
      name: line.name,
      statusSeverityDescription: line.lineStatuses[0]?.statusSeverityDescription,
    }));

    res.status(200).json({ arrivals, statuses });
  } catch (err) {
    console.error("TfL API Error:", err.response?.data || err.message);
    
    // 提供更详细的错误信息
    if (err.response?.status === 404) {
      return res.status(404).json({ error: "Station not found" });
    }
    
    res.status(500).json({ error: "Failed to fetch data from TfL" });
  }
}
