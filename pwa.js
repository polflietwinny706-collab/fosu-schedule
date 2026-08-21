/* =========================================================================
 * PWA 增量逻辑（仅此文件，不改动 user.html 内任何原有课表代码）
 * -------------------------------------------------------------------------
 * 设计原则（严格遵循需求）：
 *  1. 不做任何手机/电脑系统判断，不做 UA 识别；只做「浏览器特性检测」。
 *  2. 仅当浏览器支持 launchQueue（Chrome / Edge 桌面及安卓）才启用高级能力；
 *     不支持（如 iOS / iPadOS / macOS Safari）则整段不执行，保留网页原生默认表现。
 *  3. 不新增任何定时器（无 setInterval / setTimeout 轮询），不自动周期性刷新；
 *     仅由「用户单击桌面 PWA 图标唤起」这一事件触发一次页面刷新。
 *  4. 单实例策略由 manifest.json 的 launch_handler.client_mode="focus-existing" 负责；
 *     本文件只负责「唤起时自动刷新页面」，从而重新计算当前时间、更新高光状态。
 * ========================================================================= */
(function () {
  "use strict";

  // 特性检测：不支持 launchQueue 的浏览器（含所有苹果系 Safari）直接 return，
  // 不注册任何逻辑、不添加任何降级/防多开代码，完全保持系统默认行为。
  if (!("launchQueue" in window) || !window.launchQueue || typeof window.launchQueue.setConsumer !== "function") {
    return;
  }

  // 仅 PWA（独立窗口 / 桌面图标启动）上下文会触发 setConsumer 回调；
  // 普通浏览器标签页打开不会触发，因此「浏览器标签页打开不刷新」天然满足。
  // client_mode="focus-existing" 保证：已存在窗口时复用旧窗口，绝不重复新建窗口。
  window.launchQueue.setConsumer(function (/* launchParams */) {
    // 自动刷新：等价用户手动刷新，重新执行页面加载时的今日星期/节次时间窗口/高光计算。
    // 注意：此刷新仅由「图标唤起」事件驱动，非定时器，符合"仅手动刷新更新状态"原约束。
    window.location.reload();
  });
})();
