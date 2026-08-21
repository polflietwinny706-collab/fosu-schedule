// Cloudflare Pages Function: DELETE /api/feedback/delete/:id
// 管理员使用：根据 id 删除反馈条目。
// 鉴权：Authorization: Bearer {ADMIN_API_KEY}（环境变量，非硬编码），不合法返回 401。

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

function checkAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token !== "" && token === (env.ADMIN_API_KEY || "");
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!checkAuth(request, env)) {
    return Response.json({ ok: false, error: "未授权：需要合法的 Authorization: Bearer 密钥" },
      { status: 401, headers: CORS_HEADERS });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ ok: false, error: "无效的反馈ID" },
      { status: 400, headers: CORS_HEADERS });
  }

  try {
    const info = await env.DB.prepare("DELETE FROM feedback WHERE id = ?").bind(id).run();
    if (!info.meta.changes) {
      return Response.json({ ok: false, error: "反馈不存在" },
        { status: 404, headers: CORS_HEADERS });
    }
    return Response.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ ok: false, error: String((e && e.message) || e) },
      { status: 500, headers: CORS_HEADERS });
  }
}
