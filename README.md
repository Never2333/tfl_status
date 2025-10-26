# 伦敦地铁状态
Next.js + Tailwind + TfL API 的地铁出发板，支持站名联想、线路/站台筛选、线路状态。

## 开发
```bash
npm install
echo "TFL_API_KEY=你的tfl_api_key" > .env.local
npm run dev
```

## 部署（Vercel）
- Project → Settings → Environment Variables：`TFL_API_KEY=你的tfl_api_key`
- Redeploy

## 说明
- `/api/search`：2 字符起查，实时检索 TfL，并 **只返回 940G 的车站级 ID**；对 HUB/平台会做提升/下钻；内置常见枢纽站别名。
- `/api/arrivals`：用 940G ID 拉取 `/Arrivals` 并返回相关线路 `Status`。
- 本项目使用ChatGPT创建。
