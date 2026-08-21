// 管理员端 Service Worker：离线缓存外壳 + 接收系统推送通知
const CACHE = "fosu-admin-v1";
const PRECACHE = ["/admin.html", "/admin-manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
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
  // 静态：缓存优先，回退网络
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
      data: { url: data.url || "/admin.html" }
    })
  );
});

// 点击通知 → 聚焦/打开对应页面
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin.html";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url && c.url.indexOf(new URL(url, self.location.origin).pathname) === 0) return c.focus();
      return self.clients.openWindow(url);
    })
  );
});
