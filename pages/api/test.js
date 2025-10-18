import axios from "axios";

export default async function handler(req, res) {
  const apiKey = process.env.TFL_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "TFL_API_KEY environment variable is not set" });
  }

  try {
    // 测试一个已知的车站
    const testStationId = "940GZZLUOXC"; // Oxford Circus
    const testRes = await axios.get(
      `https://api.tfl.gov.uk/StopPoint/${testStationId}/Arrivals?app_key=${apiKey}`
    );
    
    res.status(200).json({
      message: "API test successful",
      apiKey: `${apiKey.substring(0, 10)}...`, // 只显示前10个字符
      station: "Oxford Circus (940GZZLUOXC)",
      arrivalsCount: testRes.data.length,
      sampleArrival: testRes.data.length > 0 ? {
        lineName: testRes.data[0].lineName,
        destinationName: testRes.data[0].destinationName,
        timeToStation: testRes.data[0].timeToStation
      } : null
    });
  } catch (err) {
    res.status(500).json({
      error: "API test failed",
      message: err.message,
      details: err.response?.data
    });
  }
}
