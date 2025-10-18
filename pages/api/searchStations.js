import axios from "axios";

export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Query required" });
  }

  const apiKey = process.env.TFL_API_KEY;
  try {
    const searchRes = await axios.get(
      `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(query)}?app_key=${apiKey}`
    );
    
    // 过滤只显示地铁站
    const stations = searchRes.data.matches
      .filter(station => station.modes.includes("tube"))
      .map(station => ({
        id: station.icsId || station.id,
        name: station.name,
        lines: station.lines?.map(line => line.name) || []
      }));

    res.status(200).json(stations);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to search stations" });
  }
}