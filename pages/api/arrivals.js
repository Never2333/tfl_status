import axios from "axios";

export default async function handler(req, res) {
  const { station } = req.query;
  if (!station) {
    return res.status(400).json({ error: "Station ID required" });
  }

  const apiKey = process.env.TFL_API_KEY;
  try {
    const arrivalsRes = await axios.get(
      `https://api.tfl.gov.uk/StopPoint/${station}/Arrivals?app_key=${apiKey}`
    );
    const arrivals = arrivalsRes.data;

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
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch data from TfL" });
  }
}
