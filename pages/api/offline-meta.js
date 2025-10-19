// 查看离线文件的信息：时间戳 + 站点数量
export const config = { runtime: 'nodejs' };

import fs from 'fs';
import path from 'path';

export default async function handler(req, res){
  try{
    const p = path.join(process.cwd(), 'data', 'tube-stations.json');
    const raw = fs.readFileSync(p, 'utf-8');
    const json = JSON.parse(raw);
    const stations = Array.isArray(json)? json : json.stations || [];
    const generatedAt = Array.isArray(json)? null : json.generatedAt || null;
    return res.status(200).json({ generatedAt, stationCount: stations.length });
  }catch(e){
    return res.status(200).json({ generatedAt: null, stationCount: 0 });
  }
}
