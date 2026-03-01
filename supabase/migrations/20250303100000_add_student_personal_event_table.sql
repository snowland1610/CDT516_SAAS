-- ============================================================
-- 学生个人事件表（我的日程：学生自建事件，可拖拽/拉伸）
-- 请将本文件内容复制到 Supabase 项目 → SQL Editor 中执行
-- 前提：已存在 student 表
-- ============================================================

-- ------------------------------------------------------------
-- 1. 建表
-- ------------------------------------------------------------
CREATE TABLE student_personal_event (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_student_personal_event_end_after_start CHECK (end_at >= start_at)
);

COMMENT ON TABLE student_personal_event IS '学生个人事件：我的日程中可创建/编辑/拖拽的日程项';
COMMENT ON COLUMN student_personal_event.title IS '事件标题';
COMMENT ON COLUMN student_personal_event.start_at IS '开始时间（含日期）';
COMMENT ON COLUMN student_personal_event.end_at IS '结束时间（含日期）';

-- ------------------------------------------------------------
-- 2. 索引（按学生、按时间范围查询）
-- ------------------------------------------------------------
CREATE INDEX idx_student_personal_event_student_id ON student_personal_event(student_id);
CREATE INDEX idx_student_personal_event_student_start ON student_personal_event(student_id, start_at);
