// Cloudflare Pages Function: 处理 /api/schedule
// GET  -> 从 D1 读取课表（无数据时回退内置默认，保证首次部署即可显示）
// POST -> 校验 X-Admin-Key 后写入 D1（UPSERT，rev+1 触发用户端同步）

const DEFAULT_DATA = {"rev":54,"edited":true,"title":"26 级数学专业 研究生周课表","subtitle":"佛山大学 · 2026 年秋季学期","notes":{"3":"常微分方程本周停课（仅第2周、5-13周上课）","4":"常微分方程本周停课（仅第2周、5-13周上课）","6":"自然辩证法概论本周停课（第6周跳过）","8":"自然辩证法概论本周仅第3节，改至会通楼404","12":"多门课程缩减：新时代/泛函8-9节、抽象代数11-12节、线性系统理论8-9节","14":"高级综合英语调至周三；常微分方程缩减为3-4节（最后一周）","15":"本周仅拓扑学基础在上课","16":"本周仅拓扑学基础在上课","17":"本周仅拓扑学基础在上课","18":"本周仅拓扑学基础在上课"},"courses":[{"id":1,"name":"自然辩证法概论","code":"217502","teacher":"赵春妮","cls":"c1","pub":true,"credit":1,"hours":null,"slots":[{"weeks":[[2,5],[7,7]],"day":4,"slot":[3,4,5],"loc":"会通楼 405"},{"weeks":[[8,8]],"day":4,"slot":[3],"loc":"会通楼 404"}]},{"id":2,"name":"高级综合英语","code":"217001","teacher":"钟艳","cls":"c2","pub":true,"credit":3,"hours":null,"slots":[{"weeks":[[2,13]],"day":2,"slot":[3,4,5],"loc":"信息楼 102"},{"weeks":[[2,4]],"day":1,"slot":[3,4,5],"loc":"信息楼 102"},{"weeks":[[14,14]],"day":3,"slot":[3,4,5],"loc":"信息楼 102"}]},{"id":3,"name":"新时代中国特色社会主义理论与实践","code":"","teacher":"卿向忠","cls":"c3","pub":true,"credit":2,"hours":null,"slots":[{"weeks":[[2,11]],"day":4,"slot":[8,9,10],"loc":"信息楼 102"},{"weeks":[[12,12]],"day":4,"slot":[8,9],"loc":"信息楼 102"}]},{"id":4,"name":"泛函分析","code":"254101","teacher":"赵仁熙","cls":"c4","pub":false,"credit":2,"hours":null,"slots":[{"weeks":[[2,11]],"day":2,"slot":[8,9,10],"loc":"会通楼 518"},{"weeks":[[12,12]],"day":2,"slot":[8,9],"loc":"会通楼 518"}]},{"id":5,"name":"拓扑学基础","code":"254129","teacher":"张志朗","cls":"c5","pub":false,"credit":2,"hours":null,"slots":[{"weeks":[[2,18]],"day":4,"slot":[6,7],"loc":"会通楼 517"}]},{"id":6,"name":"抽象代数","code":"254127","teacher":"梁洪雪","cls":"c6","pub":false,"credit":2,"hours":null,"slots":[{"weeks":[[2,11]],"day":3,"slot":[11,12,13],"loc":"励耘楼 524"},{"weeks":[[12,12]],"day":3,"slot":[11,12],"loc":"励耘楼 524"}]},{"id":7,"name":"线性系统理论","code":"254103","teacher":"吴泽浩","cls":"c7","pub":false,"credit":2,"hours":32,"slots":[{"weeks":[[2,11]],"day":1,"slot":[8,9,10],"loc":"微格室 524"},{"weeks":[[12,12]],"day":1,"slot":[8,9],"loc":"微格室 524"}]},{"id":8,"name":"常微分方程","code":"254122","teacher":"唐耀彬","cls":"c8","pub":false,"credit":2,"hours":32,"slots":[{"weeks":[[2,2],[5,13]],"day":5,"slot":[3,4,5],"loc":"微格室 524"},{"weeks":[[14,14]],"day":4,"slot":[3,4],"loc":"微格室 524"}]}]};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "GET") {
    try {
      const row = await env.DB.prepare("SELECT data, rev FROM schedule WHERE id = 1").first();
      if (row && row.data) return Response.json(JSON.parse(row.data));
    } catch (e) { /* D1 未绑定或表不存在时回退默认 */ }
    return Response.json(DEFAULT_DATA);
  }
  if (request.method === "POST") {
    const key = request.headers.get("X-Admin-Key") || "";
    if (key !== env.ADMIN_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "管理密钥缺失或不正确，写入被拒绝（403）" }),
        { status: 403, headers: { "Content-Type": "application/json" } });
    }
    try {
      const payload = await request.json();
      if (!Array.isArray(payload.courses)) throw new Error("courses 必须是数组");
      const cur = await env.DB.prepare("SELECT rev FROM schedule WHERE id = 1").first();
      const newRev = (cur ? cur.rev : 0) + 1;
      const body = JSON.stringify(payload);
      await env.DB.prepare(
        "INSERT INTO schedule (id, data, rev) VALUES (1, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET data = excluded.data, rev = excluded.rev"
      ).bind(body, newRev).run();
      return Response.json({ ok: true, rev: newRev });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }),
        { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }
  return new Response("Method Not Allowed", { status: 405 });
}
