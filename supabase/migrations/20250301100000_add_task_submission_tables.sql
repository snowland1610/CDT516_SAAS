-- ============================================================
-- 任务与提交表（阶段 7：教师发布任务、学生组队/个人提交、教师批改）
-- 请将本文件内容复制到 Supabase 项目 → SQL Editor 中执行
-- 前提：已存在 course、section、student、group、group_member 等表及演示数据
-- ============================================================

-- ------------------------------------------------------------
-- 1. task 表
-- ------------------------------------------------------------
-- 任务以课程为单位发布，同一课程下所有 section 共用同一批任务
CREATE TABLE task (
  id              BIGSERIAL PRIMARY KEY,
  course_id       BIGINT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  title           VARCHAR(256) NOT NULL,
  description     TEXT,
  due_at          TIMESTAMPTZ NOT NULL,
  allow_group     BOOLEAN NOT NULL DEFAULT true,
  group_min       INT,
  group_max       INT,
  group_deadline  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE task IS '课程任务，教师发布；allow_group=true 时学生以组为单位提交，否则以个人提交';
COMMENT ON COLUMN task.group_deadline IS '组队截止时间，NULL 表示与 due_at 一致或不做限制';

CREATE INDEX idx_task_course_id ON task(course_id);
CREATE INDEX idx_task_due_at ON task(due_at);

-- ------------------------------------------------------------
-- 2. submission 表
-- ------------------------------------------------------------
-- 小组提交时 group_id 必填、student_id 为空；个人提交时 student_id 必填、group_id 为空
CREATE TABLE submission (
  id            BIGSERIAL PRIMARY KEY,
  task_id       BIGINT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  group_id      BIGINT REFERENCES "group"(id) ON DELETE CASCADE,
  student_id    BIGINT REFERENCES student(id) ON DELETE CASCADE,
  content       TEXT,
  attachment_url VARCHAR(512),
  score         NUMERIC(5,2),
  feedback      TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'graded')),
  submitted_at  TIMESTAMPTZ DEFAULT now(),
  graded_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT submission_group_or_student CHECK (
    (group_id IS NOT NULL AND student_id IS NULL) OR
    (group_id IS NULL AND student_id IS NOT NULL)
  )
);

COMMENT ON TABLE submission IS '任务提交：组提交填 group_id，个人提交填 student_id';
COMMENT ON COLUMN submission.status IS 'submitted=已提交, graded=已批改';

CREATE INDEX idx_submission_task_id ON submission(task_id);
CREATE INDEX idx_submission_group_id ON submission(group_id);
CREATE INDEX idx_submission_student_id ON submission(student_id);
CREATE INDEX idx_submission_status ON submission(status);

-- 每组/每人每任务只能提交一次：部分唯一索引
CREATE UNIQUE INDEX idx_submission_unique_group
  ON submission(task_id, group_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX idx_submission_unique_student
  ON submission(task_id, student_id) WHERE student_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. 可选 seed（便于联调与演示）
-- ------------------------------------------------------------
-- 假设 course_id=1 存在，为「程序设计基础」等；section 1 有 group 1「第一组」
INSERT INTO task (id, course_id, title, description, due_at, allow_group, group_min, group_max, group_deadline) VALUES
  (1, 1, '第一次小组作业：需求分析文档', '请以小组为单位提交一份需求分析文档，包含功能列表与用例描述。', now() + interval '14 days', true, 4, 6, now() + interval '7 days'),
  (2, 1, '第一次个人作业：环境搭建', '提交本机开发环境截图（IDE + 运行成功界面）。', now() + interval '7 days', false, NULL, NULL, NULL);

SELECT setval(pg_get_serial_sequence('task', 'id'), (SELECT COALESCE(MAX(id), 1) FROM task));

-- 可选：为任务 1 插入一条小组提交示例（group_id=1 即「第一组」）
-- INSERT INTO submission (task_id, group_id, content, status) VALUES
--   (1, 1, '本组需求分析文档链接：https://example.com/doc', 'submitted');
-- SELECT setval(pg_get_serial_sequence('submission', 'id'), (SELECT COALESCE(MAX(id), 1) FROM submission));
