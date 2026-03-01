-- 高校教务协作 SAAS - 初始表结构（方案 A 迁移）
-- 仅 DDL，无 DROP；seed 数据在 supabase/seed.sql

CREATE TABLE major (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(64) NOT NULL,
  code       VARCHAR(32) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "user" (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  display_name  VARCHAR(64),
  email         VARCHAR(128),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE teacher (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name        VARCHAR(64) NOT NULL,
  employee_no VARCHAR(32),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE student (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name        VARCHAR(64) NOT NULL,
  student_no  VARCHAR(32) NOT NULL,
  major_id    BIGINT REFERENCES major(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE course (
  id          BIGSERIAL PRIMARY KEY,
  major_id    BIGINT NOT NULL REFERENCES major(id) ON DELETE CASCADE,
  teacher_id  BIGINT NOT NULL REFERENCES teacher(id) ON DELETE CASCADE,
  name        VARCHAR(128) NOT NULL,
  code        VARCHAR(32),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE section (
  id         BIGSERIAL PRIMARY KEY,
  course_id  BIGINT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  name       VARCHAR(64) NOT NULL,
  code       VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, name)
);

CREATE TABLE section_schedule (
  id          BIGSERIAL PRIMARY KEY,
  section_id  BIGINT NOT NULL REFERENCES section(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  room        VARCHAR(64) NOT NULL,
  valid_from  DATE NOT NULL,
  valid_to    DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE enrollment (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  section_id  BIGINT NOT NULL REFERENCES section(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, section_id)
);
