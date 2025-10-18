import axios from "axios";

export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Query required" });
  }

  console.log(`搜索车站: ${query}`);

  const apiKey = process.env.TFL_API_KEY;
  try {
    // 使用更精确的搜索端点
    const searchRes = await axios.get(
      `https://api.tfl.gov.uk/StopPoint/Search?query=${encodeURIComponent(query)}&modes=tube&app_key=${apiKey}`
    );
    
    console.log(`搜索返回结果:`, searchRes.data);
    
    // 处理搜索结果
    const stations = searchRes.data.matches
      .filter(station => station.modes && station.modes.includes("tube"))
      .map(station => ({
        id: station.icsId || station.id, // 优先使用icsId，它是地铁站的标准ID格式
        name: station.name,
        lines: station.lines?.map(line => line.name) || []
      }))
      .filter(station => station.id) // 确保有ID
      .slice(0, 10); // 限制结果数量

    console.log(`处理后车站列表:`, stations);

    res.status(200).json(stations);
  } catch (err) {
    console.error("搜索车站错误详情:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
    res.status(500).json({ error: "Failed to search stations" });
  }
}
