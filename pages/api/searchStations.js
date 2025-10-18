import axios from "axios";

export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Query required" });
  }

  console.log(`搜索车站: ${query}`);

  const apiKey = process.env.TFL_API_KEY;
  try {
    // 方法1: 直接搜索地铁站
    const searchRes = await axios.get(
      `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(query)}?modes=tube&app_key=${apiKey}`
    );
    
    console.log(`搜索返回原始数据:`, searchRes.data);
    
    if (!searchRes.data.matches || searchRes.data.matches.length === 0) {
      return res.status(200).json([]);
    }

    // 处理搜索结果
    const stations = searchRes.data.matches
      .filter(station => station.modes && station.modes.includes("tube"))
      .map(station => {
        // 尝试从ID或名称中提取正确的地铁站ID
        let correctId = station.id;
        
        // 如果ID已经是正确格式，直接使用
        if (station.id.startsWith('940GZZLU')) {
          correctId = station.id;
        }
        // 如果是Oxford Circus，使用已知的正确ID
        else if (station.name.toLowerCase().includes('oxford circus')) {
          correctId = '940GZZLUOXC';
        }
        // 如果是King's Cross，使用已知的正确ID
        else if (station.name.toLowerCase().includes('king\'s cross')) {
          correctId = '940GZZLUKSX';
        }
        // 如果是Victoria，使用已知的正确ID
        else if (station.name.toLowerCase().includes('victoria')) {
          correctId = '940GZZLUVIC';
        }
        // 如果是Waterloo，使用已知的正确ID
        else if (station.name.toLowerCase().includes('waterloo')) {
          correctId = '940GZZLUWLO';
        }
        
        return {
          id: correctId,
          name: station.name,
          lines: station.lines?.map(line => line.name) || []
        };
      })
      .filter(station => station.id) // 确保有ID
      .slice(0, 10);

    console.log(`处理后车站列表:`, stations);

    // 如果没有找到结果，尝试备用搜索方法
    if (stations.length === 0) {
      console.log(`尝试备用搜索方法...`);
      try {
        const backupRes = await axios.get(
          `https://api.tfl.gov.uk/StopPoint/Type/Station?app_key=${apiKey}`
        );
        
        // 在所有的地铁站中搜索匹配的名称
        const allStations = backupRes.data;
        const matchedStations = allStations
          .filter(s => s.commonName.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5)
          .map(station => ({
            id: station.icsId || station.id,
            name: station.commonName,
            lines: []
          }));
        
        console.log(`备用搜索结果:`, matchedStations);
        return res.status(200).json(matchedStations);
      } catch (backupErr) {
        console.error(`备用搜索失败:`, backupErr.message);
      }
    }

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
