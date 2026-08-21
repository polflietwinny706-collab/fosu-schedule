// Cloudflare Pages Function: /api/notice
// 管理端可实时编辑「用户端反馈窗口的重要说明」。
//   GET /api/notice -> 公开读取说明内容（用户端弹窗显示，无需鉴权；表缺失/异常回退默认文案）
//   PUT /api/notice -> 管理员更新说明内容（需 Authorization: Bearer {ADMIN_KEY}，UPSERT 单行 id=1）
// 实时同步：用户端弹窗打开期间每 3 秒轮询 GET /api/notice（与课表 3 秒同步同一模式）。

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 默认重要说明（与 user.html 内置兜底文案一致；管理员未设置时展示）
const DEFAULT_NOTICE =
  "重要说明：\n1. 本课程表仅供参考，请以学校教务系统课表为准。\n2. 反馈不会即时回复，管理员定期查看。\n3. 请勿提交身份证、手机号等隐私信息。";

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

function checkAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token !== "" && token === (env.ADMIN_KEY || "");
}

// GET /api/notice —— 公开读取
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const row = await env.DB.prepare("SELECT content FROM notice WHERE id = 1").first();
    return Response.json({ ok: true, content: (row && row.content != null) ? row.content : DEFAULT_NOTICE },
      { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    // notice 表不存在（尚未建表）等异常 → 回退默认文案，保证用户端永远可用
    return Response.json({ ok: true, content: DEFAULT_NOTICE },
      { status: 200, headers: CORS_HEADERS });
  }
}

// PUT /api/notice —— 管理员更新（鉴权）
export async function onRequestPut(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) {
    return Response.json({ ok: false, error: "未授权：需要合法的 Authorization: Bearer 密钥" },
      { status: 401, headers: CORS_HEADERS });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const content = (body && typeof body.content === "string" ? body.content : "");
    if (content.length > 500) {
      return Response.json({ ok: false, error: "重要说明过长（上限500字）" },
        { status: 400, headers: CORS_HEADERS });
    }
    await env.DB.prepare(
      "INSERT INTO notice (id, content) VALUES (1, ?) " +
      "ON CONFLICT(id) DO UPDATE SET content = excluded.content"
    ).bind(content).run();
    return Response.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ ok: false, error: String((e && e.message) || e) },
      { status: 500, headers: CORS_HEADERS });
  }
}
