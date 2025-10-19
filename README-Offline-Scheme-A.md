# 方案 A 覆盖包（可直接部署）

把本压缩包内容拷贝到你的项目根目录，保持目录结构。

## Vercel 配置
1) Project → Environment Variables：新增
   - TFL_API_KEY = 你的 TfL key
2) Project → Deploy Hooks：建一个 hook（例如 offline-refresh），复制 URL
3) Project → Cron Jobs：
   - URL：上一步的 Hook
   - Schedule：0 3 */3 * *  （每 3 天 03:00 Europe/London）

## 验证
- 重新部署后，构建日志会显示拉取与写入的日志；
- 部署完成后访问：/api/offline-meta 看到 { generatedAt, stationCount }；
- 前端联想访问：/api/search?q=ham&debug=1。
