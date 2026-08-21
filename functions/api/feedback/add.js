// Cloudflare Pages Function: POST /api/feedback/add
// 用户提交反馈（无需鉴权）：接收 {content}，插入 D1 feedback 表。
// createTime 由数据库 CURRENT_TIMESTAMP 自动生成；adminReply 默认 ''；isPublic 默认 0。

// 通用 CORS 响应头（前端与 Functions 同域时本不需要，但为跨域调试/未来分离部署保留）
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 预检请求：浏览器跨域 POST(application/json) 前会先发 OPTIONS，直接放行
export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const content = (body && body.content ? String(body.content) : "").trim();
    if (!content) {
      return Response.json({ ok: false, error: "反馈内容不能为空" },
        { status: 400, headers: CORS_HEADERS });
    }
    if (content.length > 2000) {
      return Response.json({ ok: false, error: "反馈内容过长（上限2000字）" },
        { status: 400, headers: CORS_HEADERS });
    }
    const info = await env.DB.prepare(
      "INSERT INTO feedback (content) VALUES (?)"
    ).bind(content).run();
    return Response.json({ ok: true, id: info.meta.last_row_id },
      { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ ok: false, error: String((e && e.message) || e) },
      { status: 500, headers: CORS_HEADERS });
  }
}
