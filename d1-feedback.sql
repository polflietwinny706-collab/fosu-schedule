-- ============================================================
-- Cloudflare D1 建表：课表反馈系统
-- 执行方式：Cloudflare 控制台 → Workers 和 Pages → D1 → 选择你的数据库
--           → 控制台 Console 页 → 粘贴本段 SQL 执行（或使用 wrangler d1 execute）
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- 自增唯一ID
  content     TEXT    NOT NULL,                   -- 用户反馈内容
  createTime  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,-- 提交时间（数据库自动生成）
  adminReply  TEXT    DEFAULT '',                 -- 管理员回复
  isPublic    INTEGER DEFAULT 0,                  -- D1无boolean：0=不公开 false；1=公开 true
  deviceId    TEXT    DEFAULT ''                  -- 提交设备ID（用于回复时给提交者推系统通知）
);

-- 重要说明（用户端反馈窗口顶部展示，管理员可实时编辑）
CREATE TABLE IF NOT EXISTS notice (
  id          INTEGER PRIMARY KEY,                -- 固定单行 id=1
  content     TEXT    NOT NULL DEFAULT '',        -- 说明内容（多行文本）
  updatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 更新时间
);

-- 推送订阅（Web Push，系统级通知）：设备 ↔ 推送服务端点 的绑定
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceId    TEXT    NOT NULL,                   -- 设备ID（localStorage 生成，关联 feedback.deviceId）
  role        TEXT    NOT NULL DEFAULT 'user',    -- 'admin'（管理员设备）| 'user'（用户设备）
  endpoint    TEXT    NOT NULL UNIQUE,            -- 推送服务端点 URL
  p256dh      TEXT    NOT NULL,                   -- 订阅公钥
  auth        TEXT    NOT NULL,                   -- 订阅认证密钥
  createTime  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ⚠️ 已存在 feedback 表的旧部署，需手动执行下面这条（仅一次；若已含 deviceId 列会报错，忽略即可）：
-- ALTER TABLE feedback ADD COLUMN deviceId TEXT DEFAULT '';
