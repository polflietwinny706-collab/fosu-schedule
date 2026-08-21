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
  isPublic    INTEGER DEFAULT 0                   -- D1无boolean：0=不公开 false；1=公开 true
);
