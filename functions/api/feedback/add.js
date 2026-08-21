// Cloudflare Pages Function: POST /api/feedback/add
// 用户提交反馈（无需鉴权）：接收 {content, deviceId}，插入 D1 feedback 表。
// createTime 由数据库 CURRENT_TIMESTAMP 自动生成；adminReply 默认 ''；isPublic 默认 0。
// 提交成功后后台（waitUntil）给所有管理员设备推送系统通知。

import { sendPush } from "../push/webpush.js";

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
    const deviceId = String((body && body.deviceId) || "").slice(0, 128);
    if (!content) {
      return Response.json({ ok: false, error: "反馈内容不能为空" },
        { status: 400, headers: CORS_HEADERS });
    }
    if (content.length > 2000) {
      return Response.json({ ok: false, error: "反馈内容过长（上限2000字）" },
        { status: 400, headers: CORS_HEADERS });
    }
    const info = await env.DB.prepare(
      "INSERT INTO feedback (content, deviceId) VALUES (?, ?)"
    ).bind(content, deviceId).run();

    // 后台给所有管理员订阅推系统通知（不阻塞用户提交的响应）
    context.waitUntil(notifyAdmins(env, content));

    return Response.json({ ok: true, id: info.meta.last_row_id },
      { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ ok: false, error: String((e && e.message) || e) },
      { status: 500, headers: CORS_HEADERS });
  }
}

// 给所有 role='admin' 的设备发"有新反馈"通知
async function notifyAdmins(env, content) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE role = 'admin'"
    ).all();
    const preview = content.length > 40 ? content.slice(0, 40) + "…" : content;
    await Promise.allSettled((results || []).map((s) =>
      sendPush(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        { title: "📮 有新反馈", body: preview, tag: "feedback", url: "/admin.html" },
        env
      )
    ));
  } catch (e) {
    console.warn("[push] notifyAdmins 失败", String((e && e.message) || e));
  }
}

