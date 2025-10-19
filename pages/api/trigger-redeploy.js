// 强制 Node.js 运行时（不要 Edge）
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    const url = process.env.DEPLOY_HOOK_URL;
    if (!url) return res.status(500).json({ error: 'Missing DEPLOY_HOOK_URL' });

    // 触发一次“重新部署”，从而在构建期执行 prebuild（拉最新站点）
    const r = await fetch(url, { method: 'POST' });
    const text = await r.text();
    return res.status(200).json({ ok: r.ok, status: r.status, body: text.slice(0, 200) });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
