// Cloudflare Pages Function: GET /api/feedback/all
// 管理员页面使用：返回 D1 中全部反馈（无论 isPublic）。
//
// ⚠️ 安全风险注释：
//   此接口返回全部反馈数据（含未公开内容），当前通过 Authorization: Bearer {ADMIN_KEY} 鉴权。
//   密钥来自 Pages 项目环境变量 ADMIN_KEY，未硬编码。若环境变量未配置或密钥不匹配，返回 401。
//   建议：密钥使用随机长字符串；若担心泄露，可进一步限制只允许管理员来源 IP / 增加请求频率限制。

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

// 校验请求头 Authorization: Bearer {ADMIN_KEY}（密钥存于 Pages 环境变量，不在代码中）
function checkAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token !== "" && token === (env.ADMIN_KEY || "");
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) {
    return Response.json({ ok: false, error: "未授权：需要合法的 Authorization: Bearer 密钥" },
      { status: 401, headers: CORS_HEADERS });
  }
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, content, adminReply, isPublic, createTime FROM feedback " +
      "ORDER BY createTime DESC, id DESC"
    ).all();
    return Response.json({ ok: true, list: results },
      { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ ok: false, error: String((e && e.message) || e) },
      { status: 500, headers: CORS_HEADERS });
  }
}
