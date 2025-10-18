import axios from "axios";

export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Query required" });
  }

  console.log(`搜索车站: ${query}`);

  const apiKey = process.env.TFL_API_KEY;
  try {
    // 使用更精确的搜索端点，专门搜索地铁站
    const searchRes = await axios.get(
      `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(query)}?modes=tube&app_key=${apiKey}`
    );
    
    console.log(`搜索返回原始数据:`, searchRes.data);
    
    if (!searchRes.data.matches || searchRes.data.matches.length === 0) {
      return res.status(200).json([]);
    }

    // 处理搜索结果，获取详细的车站信息
    const stationPromises = searchRes.data.matches
      .filter(station => station.modes && station.modes.includes("tube"))
      .slice(0, 5) // 限制前5个结果
      .map(async (station) => {
        try {
          // 获取车站的详细信息，包含正确的ID
          const detailRes = await axios.get(
            `https://api.tfl.gov.uk/StopPoint/${station.id}?app_key=${apiKey}`
          );
          
          const stationDetail = detailRes.data;
          
          // 寻找正确的地铁站ID - 优先使用icsId
          let correctId = station.id;
          if (stationDetail.icsId && stationDetail.icsId.startsWith('940GZZLU')) {
            correctId = stationDetail.icsId;
          } else if (stationDetail.id && stationDetail.id.startsWith('940GZZLU')) {
            correctId = stationDetail.id;
          }
          
          return {
            id: correctId,
            name: stationDetail.commonName || station.name,
            lines: stationDetail.lines?.map(line => line.name) || []
          };
        } catch (detailErr) {
          console.error(`获取车站 ${station.id} 详情失败:`, detailErr.message);
          // 如果获取详情失败，使用原始数据
          return {
            id: station.id,
            name: station.name,
            lines: station.lines?.map(line => line.name) || []
          };
        }
      });

    const stations = (await Promise.all(stationPromises)).filter(Boolean);
    
    console.log(`处理后车站列表:`, stations);

    res.status(200).json(stations);
  } catch (err) {
    console.error("搜索车站错误详情:", {
      message: err.message,
      response: errResponse?.data,
      status: errResponse?.status
    });
    res.status(500).json({ error: "Failed to search stations" });
  }
}
