// Cloudflare Pages Function: GET /api/feedback/public
// 用户弹窗使用：返回所有 isPublic = 1 的公开反馈（无需鉴权），
// 供普通用户查看"用户原文 + 管理员回复"，只读不可编辑。

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, content, adminReply, createTime FROM feedback " +
      "WHERE isPublic = 1 ORDER BY createTime DESC, id DESC"
    ).all();
    return Response.json({ ok: true, list: results },
      { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ ok: false, error: String((e && e.message) || e) },
      { status: 500, headers: CORS_HEADERS });
  }
}
