-- ============================================================
-- 小组组队表（按 section 班级维度，4～6 人）
-- 请将本文件内容复制到 Supabase SQL Editor 中执行
-- 前提：已存在 section、student、enrollment 等表及演示数据
-- ============================================================

-- ------------------------------------------------------------
-- 1. 建表
-- ------------------------------------------------------------
-- group：小组，归属某个 section（班级），组长为 leader_id
-- 业务约束：同一 section 内每组 4～6 人，由应用层校验
CREATE TABLE "group" (
  id          BIGSERIAL PRIMARY KEY,
  section_id  BIGINT NOT NULL REFERENCES section(id) ON DELETE CASCADE,
  name        VARCHAR(64) NOT NULL,
  leader_id   BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- group_member：小组成员，组长也在其中（组长由 group.leader_id 标识）
-- 业务约束：同一学生在同一 section 内只能加入一个小组，由应用层校验
CREATE TABLE group_member (
  id          BIGSERIAL PRIMARY KEY,
  group_id    BIGINT NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  student_id  BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, student_id)
);

CREATE INDEX idx_group_section_id ON "group"(section_id);
CREATE INDEX idx_group_member_group_id ON group_member(group_id);
CREATE INDEX idx_group_member_student_id ON group_member(student_id);

-- ------------------------------------------------------------
-- 2. 示例 seed（与现有 enrollment 对应）
-- ------------------------------------------------------------
-- section 1: 学生 1～20 → 第一组 4 人满、第二组 3 人未满，其余未组队
-- section 2: 学生 21～30 → A 组 6 人满，其余未组队
-- section 3: 学生 31～40 → Python 组 4 人满，其余未组队
-- section 4: 学生 41～50 → 无小组，全部未组队

INSERT INTO "group" (id, section_id, name, leader_id) VALUES
  (1, 1, '第一组', 1),
  (2, 1, '第二组', 5),
  (3, 2, 'A组', 21),
  (4, 3, 'Python组', 31);

INSERT INTO group_member (group_id, student_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4),
  (2, 5), (2, 6), (2, 7),
  (3, 21), (3, 22), (3, 23), (3, 24), (3, 25), (3, 26),
  (4, 31), (4, 32), (4, 33), (4, 34);

-- ------------------------------------------------------------
-- 3. 重置自增序列
-- ------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('"group"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "group"));
SELECT setval(pg_get_serial_sequence('group_member', 'id'), (SELECT COALESCE(MAX(id), 1) FROM group_member));
