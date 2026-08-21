// Cloudflare Pages Function: POST /api/push/subscribe
// 保存/更新设备推送订阅（Web Push）。用户端与管理端在授权通知后调用。
// body: { deviceId, role: 'admin'|'user', subscription: { endpoint, keys: { p256dh, auth } } }
//
// 鉴权说明：订阅接口无需鉴权（订阅由浏览器主动授权产生）。
// role='admin' 的订阅仅会收到"有新反馈"等不含敏感内容的通知，风险可控；
// role='user' 的订阅仅能收到"针对该 deviceId 提交的反馈的回复"，不会收到他人内容。

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = String((body && body.deviceId) || "").trim().slice(0, 128);
    const role = (body && body.role) === "admin" ? "admin" : "user";
    const sub = body && body.subscription;

    if (!deviceId || !sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return Response.json({ ok: false, error: "订阅参数不完整（需 deviceId / endpoint / p256dh / auth）" },
        { status: 400, headers: CORS_HEADERS });
    }

    await env.DB.prepare(
      "INSERT INTO push_subscriptions (deviceId, role, endpoint, p256dh, auth, createTime) " +
      "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(endpoint) DO UPDATE SET deviceId = excluded.deviceId, role = excluded.role, " +
      "  p256dh = excluded.p256dh, auth = excluded.auth"
    ).bind(deviceId, role, sub.endpoint, sub.keys.p256dh, sub.keys.auth).run();

    return Response.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ ok: false, error: String((e && e.message) || e) },
      { status: 500, headers: CORS_HEADERS });
  }
}
