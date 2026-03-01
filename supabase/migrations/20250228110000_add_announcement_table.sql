-- ============================================================
-- 公告表（阶段 6：教务处发布/编辑，教师与学生只读）
-- 请将本文件内容复制到 Supabase 项目 → SQL Editor 中执行
-- 前提：已存在现有表（major, user, course, section 等）及演示数据
-- ============================================================

-- ------------------------------------------------------------
-- 1. 建表
-- ------------------------------------------------------------
-- announcement：公告，标题、正文、状态、时间
-- 状态：published 已发布（教师/学生可见），archived 已下架（仅列表展示，可选过滤）
CREATE TABLE announcement (
  id           BIGSERIAL PRIMARY KEY,
  title        VARCHAR(256) NOT NULL,
  body         TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'archived')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN announcement.status IS 'published=已发布, archived=已下架';
COMMENT ON COLUMN announcement.published_at IS '发布时间，可与 created_at 一致；后续可支持定时发布';

CREATE INDEX idx_announcement_created_at ON announcement(created_at DESC);
CREATE INDEX idx_announcement_status ON announcement(status);

-- ------------------------------------------------------------
-- 2. 可选 seed（便于联调与演示）
-- ------------------------------------------------------------
INSERT INTO announcement (title, body, status) VALUES
  ('2024-2025 学年第二学期选课通知', '各位同学：\n本学期选课将于 3 月 1 日 9:00 开放，截止时间 3 月 7 日 17:00。请登录教务系统完成选课。\n教务处', 'published'),
  ('期末考试安排说明', '各院系、各位教师：\n期末笔试时间已排定，请按教务系统内课表执行。考查课由任课教师自行安排并报备。\n教务处', 'published');
