// 管理员端 Service Worker：离线缓存外壳 + 接收系统推送通知
const CACHE = "fosu-admin-v2";
const APP_SHELL = "/admin"; // 干净地址（/admin.html 会 308 重定向，不能直接预缓存）
const PRECACHE = [APP_SHELL, "/admin-manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 逐个缓存，单个失败（如重定向/404）不影响整体安装，避免 SW 装不上导致安卓“无法访问此页”
    await Promise.allSettled(PRECACHE.map((u) => cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // API：网络优先，失败回退缓存（离线时看到上次快照）
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => { const c = res.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, c)); return res; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 导航请求：网络优先，失败回退到已缓存的应用外壳（/admin），避免“无法访问此页”
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(APP_SHELL))
    );
    return;
  }

  // 静态资源：缓存优先，回退网络
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});

// 收到推送 → 弹系统通知
self.addEventListener("push", (e) => {
  let data = { title: "新通知", body: "" };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title || "新通知", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "default",
      data: { url: data.url || "/admin" }
    })
  );
});

// 点击通知 → 聚焦/打开对应页面
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url && c.url.indexOf(new URL(url, self.location.origin).pathname) === 0) return c.focus();
      return self.clients.openWindow(url);
    })
  );
});
