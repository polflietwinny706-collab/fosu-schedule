/* Web Push 客户端库（user.html / admin.html 共用）
 * 职责：生成/读取设备ID、注册 Service Worker、请求通知权限、订阅 Push、上报后端。
 * 用法：window.initPush(swPath, role) —— 如 initPush('/user-sw.js', 'user')
 *       window.getDeviceId() —— 获取本机设备ID（提交反馈时带上）
 */
(function () {
  var VAPID_PUBLIC_KEY = "BDhZ-H242GSmFI8CL_L4PVhb1XE3cZSihy2sFM6R0jYi78rbBXosJX0_rkVDZ_MR_joag8RRUSt6hrRsEbEWZG4";

  function b64url(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlToUint8(str) {
    var b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    var pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    var bin = atob(b64 + pad);
    var a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }

  // 设备ID：localStorage 持久化，跨会话稳定（用于"回复推送给提交者本人"）
  function getDeviceId() {
    var KEY = "fosu_device_id";
    try {
      var v = localStorage.getItem(KEY);
      if (v) return v;
      v = "dev-" + (window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(KEY, v);
      return v;
    } catch (e) { return "dev-unknown"; }
  }
  window.getDeviceId = getDeviceId;

  // 注册 SW + 授权 + 订阅 + 上报后端
  async function initPush(swPath, role) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("[push] 当前浏览器不支持 Web Push（iOS 需安装到主屏幕，Safari 16.4+）");
      return false;
    }
    try {
      var reg = await navigator.serviceWorker.register(swPath);
      var permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") { console.warn("[push] 通知权限未授予"); return false; }

      var vapidKey = b64urlToUint8(VAPID_PUBLIC_KEY);
      var sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey });

      var resp = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          role: role,
          subscription: {
            endpoint: sub.endpoint,
            keys: { p256dh: b64url(sub.getKey("p256dh")), auth: b64url(sub.getKey("auth")) }
          }
        })
      });
      if (!resp.ok) { console.warn("[push] 订阅上报失败", resp.status); return false; }
      console.log("[push] 订阅成功 role=" + role);
      return true;
    } catch (e) {
      console.warn("[push] 订阅失败", e);
      return false;
    }
  }
  window.initPush = initPush;
})();
