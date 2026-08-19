// Cloudflare Pages Function: 处理 /api/admin-check（管理员密钥校验）
export async function onRequest(context) {
  const { request, env } = context;
  const key = request.headers.get("X-Admin-Key") || "";
  return Response.json({ ok: key === env.ADMIN_KEY });
}
