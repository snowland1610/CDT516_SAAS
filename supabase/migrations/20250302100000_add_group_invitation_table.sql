-- ============================================================
-- 组队邀请表（组长邀请未组队同学加入小组）
-- 请将本文件内容复制到 Supabase 项目 → SQL Editor 中执行
-- 前提：已存在 group、group_member、student 等表
-- ============================================================

-- ------------------------------------------------------------
-- 1. 建表
-- ------------------------------------------------------------
-- group_invitation：邀请记录，同一 (group_id, invitee_id) 仅允许一条 pending
CREATE TABLE group_invitation (
  id          BIGSERIAL PRIMARY KEY,
  group_id    BIGINT NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  inviter_id  BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  invitee_id  BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE group_invitation IS '小组邀请：组长邀请未组队同学，被邀请人可接受或拒绝';
COMMENT ON COLUMN group_invitation.status IS 'pending=待处理, accepted=已接受, rejected=已拒绝';

CREATE INDEX idx_group_invitation_invitee_id ON group_invitation(invitee_id);
CREATE INDEX idx_group_invitation_group_id ON group_invitation(group_id);
CREATE INDEX idx_group_invitation_invitee_status ON group_invitation(invitee_id, status);
CREATE INDEX idx_group_invitation_created_at ON group_invitation(created_at DESC);

-- 同一小组对同一被邀请人仅允许一条待处理邀请
CREATE UNIQUE INDEX idx_group_invitation_unique_pending
  ON group_invitation(group_id, invitee_id) WHERE status = 'pending';
