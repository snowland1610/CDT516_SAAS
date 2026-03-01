# 演示 Mock 数据结构与数据库设计

> 层级：专业 → 课程 → 班级(Section) → 学生；计算机专业填充，商科留空；50 名学生、2 门课、每课 2 个班级；每班配备课表（排课信息）。

---

## 一、需求整理

### 1.1 层级关系

```
专业 (Major)
  └── 课程 (Course) — 每门课 1 名负责教师
        └── 班级 (Section) — 每门课 2 个班：section1, section2
              ├── 课表 (SectionSchedule) — 该班的排课（周几、时段、教室、有效期）
              └── 学生 (Student) — 通过「选课」关联到某个 Section
```

- **专业**：计算机、商科（2 个，仅填充计算机）。
- **课程**：计算机下 2 门课——「SAAS设计」「python编程」，各 1 名教师。
- **班级**：每门课 2 个班，即 section1、section2（共 4 个 Section）。
- **课表**：每个 Section 有排课信息；时间范围 2026-01-04 ～ 2026-05-01；按「每周固定星期 + 开始/结束时间 + 教室」存储，实际上课日期由该规则在有效期内展开得出。
- **学生**：50 人；每人至少选 1 门课的 1 个班，可选 2 门课（即最多在 2 个 Section 中，每个 Section 属不同课程）。

### 1.2 用户与数量

| 角色     | 数量 | 说明 |
|----------|------|------|
| 教务处管理员 | 1  | admin，系统级 |
| 教师     | 2   | 分别负责「SAAS设计」「python编程」 |
| 学生     | 50  | 需分布在 4 个 Section 中，每人至少 1 个 Section |

### 1.3 课表（排课）需求

- **时间范围**：2026-01-04 ～ 2026-05-01（同一学期内）。
- **粒度**：以「每周固定星期 + 开始/结束时间 + 教室」为一条排课规则，在有效期内按周展开即得到具体上课日期。
- **示例（SAAS设计 section1）**：每周一 08:30～11:30，教室 01；有效期 2026-01-04 ～ 2026-05-01。
- **适用范围**：SAAS设计 section1、SAAS设计 section2、python编程 section1、python编程 section2 四个班均采用同一套数据结构，每个 Section 至少一条排课规则（可不同星期/时段/教室）。

### 1.4 业务约束（用于 Mock 与校验）

- 一个**课程**只属于一个**专业**，且只有一个**负责教师**。
- 一个**班级(Section)** 只属于一门**课程**。
- 一个**班级**可有若干条**课表规则**（同一班多时段如周一+周三，或仅单一时段）；每条规则在有效期内按周生成实际上课日期。
- 一个**学生**通过「选课记录」与多个 **Section** 关联；同一门课只能选一个 Section（**每门课至多选一个班**）。
- 教师与课程：一对一（每门课一个老师）；若后续扩展为多教师助教，可再加关联表。

---

## 二、实体与关系梳理

### 2.1 核心实体

| 实体       | 说明 |
|------------|------|
| **User**   | 登录账号，含角色（admin / teacher / student） |
| **Major**  | 专业 |
| **Teacher**| 教师档案，关联 User |
| **Student**| 学生档案，关联 User，可关联 Major |
| **Course** | 课程，关联 Major + Teacher |
| **Section**| 班级，关联 Course |
| **SectionSchedule** | 课表/排课规则：按 Section、星期、时段、教室、有效期存储，可展开为具体上课日期 |
| **Enrollment** | 选课记录：学生 × Section（多对多，带时间等） |

### 2.2 关系一览

- **Major** 1 → n **Course**
- **Course** n → 1 **Teacher**，1 → n **Section**
- **Section** 1 → n **SectionSchedule**（一个班可有多条排课，如周一+周三）
- **Section** 1 → n **Enrollment**，**Student** 1 → n **Enrollment**
- **User** 1 → 1 **Teacher** 或 1 → 1 **Student**（按角色）
- **Student** n → 1 **Major**（可选，本 Mock 中 50 人可均属计算机）

### 2.3 为后续「任务 / 小组」预留的实体（表结构可后续再建）

- **Task**：任务，关联 Course。
- **Group**：小组，关联 Task；有组长（Student）。
- **GroupMember**：小组成员，Group × Student。
- **Submission**：提交记录，Task × Group（或个人），含分数、评语。

当前文档只展开到「选课」为止的 Mock 所需表结构；Task/Group/Submission 仅列名字，便于后续扩展。

---

## 三、数据库表设计

### 3.1 用户与角色

#### 表：`user`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | BIGINT / UUID | PK, 自增或 UUID | 主键 |
| username | VARCHAR(64) | UNIQUE, NOT NULL | 登录名 |
| password_hash | VARCHAR(255) | NOT NULL | 密码哈希 |
| role | VARCHAR(20) | NOT NULL | admin \| teacher \| student |
| display_name | VARCHAR(64) | | 显示名 |
| email | VARCHAR(128) | | 邮箱（可选） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |

#### 表：`teacher`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK, 自增 | |
| user_id | BIGINT | UNIQUE, FK → user.id, NOT NULL | 一对一 |
| name | VARCHAR(64) | NOT NULL | 教师姓名 |
| employee_no | VARCHAR(32) | | 工号（可选） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |

#### 表：`student`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK, 自增 | |
| user_id | BIGINT | UNIQUE, FK → user.id, NOT NULL | 一对一 |
| name | VARCHAR(64) | NOT NULL | 学生姓名 |
| student_no | VARCHAR(32) | NOT NULL | 学号 |
| major_id | BIGINT | FK → major.id, 可 NULL | 所属专业（Mock 中可均为计算机） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |

---

### 3.2 专业、课程、班级

#### 表：`major`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK, 自增 | |
| name | VARCHAR(64) | NOT NULL | 专业名称 |
| code | VARCHAR(32) | UNIQUE | 专业代码（如 CS、BUS） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |

#### 表：`course`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK, 自增 | |
| major_id | BIGINT | FK → major.id, NOT NULL | 所属专业 |
| teacher_id | BIGINT | FK → teacher.id, UNIQUE（若 1 师 1 课）, NOT NULL | 负责教师 |
| name | VARCHAR(128) | NOT NULL | 课程名称 |
| code | VARCHAR(32) | | 课程代码（可选） |
| description | TEXT | | 课程简介（可选） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |

#### 表：`section`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK, 自增 | |
| course_id | BIGINT | FK → course.id, NOT NULL | 所属课程 |
| name | VARCHAR(64) | NOT NULL | 班级名（如 section1, section2） |
| code | VARCHAR(32) | | 班号（可选） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |

**唯一约束建议**：`(course_id, name)` 或 `(course_id, code)` 唯一，保证同一课程下班级名不重复。

---

### 3.3 课表（排课）

每条记录表示「某班级在有效期内、每周固定某天的固定时段、在固定教室上课」的规则；前端或服务端可根据该规则在 `valid_from` ～ `valid_to` 范围内按周展开得到具体上课日期（如 2026-01-05、2026-01-12…）。

#### 表：`section_schedule`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK, 自增 | 主键 |
| section_id | BIGINT | FK → section.id, NOT NULL | 所属班级 |
| day_of_week | TINYINT | NOT NULL, 1–7 | 星期几（1=周一 … 7=周日） |
| start_time | TIME | NOT NULL | 开始时间（如 08:30） |
| end_time | TIME | NOT NULL | 结束时间（如 11:30） |
| room | VARCHAR(64) | NOT NULL | 教室（如 01、A101） |
| valid_from | DATE | NOT NULL | 排课有效期起（如 2026-01-04） |
| valid_to | DATE | NOT NULL | 排课有效期止（如 2026-05-01） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |

**说明**：同一 `section_id` 可有多条记录（如周一 + 周三两节）；具体某天的上课日期 = 在 `[valid_from, valid_to]` 内、星期几等于 `day_of_week` 的所有日期。

---

### 3.4 选课

#### 表：`enrollment`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK, 自增 | |
| student_id | BIGINT | FK → student.id, NOT NULL | 学生 |
| section_id | BIGINT | FK → section.id, NOT NULL | 班级 |
| enrolled_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 选课时间 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |

**唯一约束**：`(student_id, section_id)` UNIQUE，避免同一学生在同一 Section 重复选课。  
**业务约束**：同一 `student_id` 在同一 `course_id` 下只能有一条 enrollment（即只能选该课的某一个 section）。可在应用层校验，或在 DB 用触发器/唯一索引配合 section→course 实现。

---

### 3.5 后续扩展（任务 / 小组 / 提交）— 仅列名

| 表名 | 用途 |
|------|------|
| task | 任务，course_id、标题、截止时间、是否组队、人数范围等 |
| `group` | 小组，task_id、组长 student_id、小组名 |
| group_member | 小组成员，group_id、student_id |
| submission | 提交记录，task_id、group_id（或 student_id）、分数、评语等 |

具体字段在实现「小组组队 + 任务管理」时再补全。

---

## 3.6 模拟数据格式规范（单文件 JSON）

**建议顺序**：先按本规范生成一份完整模拟数据（见项目内 `mock-data.json`），再据此建表并写入；演示从头到尾只使用这一份数据，不做多条 Seed 或环境区分。

- **文件**：单文件 JSON，顶层 key 与表名一致，value 为对象数组；每条记录字段与上表字段对应，便于与建表语句 1:1 映射。
- **ID 约定**：所有 id 为数字，从 1 起连续；关联字段（如 `user_id`、`section_id`）使用同一套 id，插入时按依赖顺序（major → user → teacher/student → course → section → section_schedule → enrollment）即可。
- **时间格式**：`date` 用 `YYYY-MM-DD`，`time` 用 `HH:mm`，`datetime` 用 `YYYY-MM-DDTHH:mm:ss`（ISO8601 局部）。
- **顶层结构示例**：
  ```json
  {
    "majors": [...],
    "users": [...],
    "teachers": [...],
    "students": [...],
    "courses": [...],
    "sections": [...],
    "section_schedules": [...],
    "enrollments": [...]
  }
  ```

---

## 四、Mock 数据规模汇总

| 实体 | 数量 | 说明 |
|------|------|------|
| user | 53 | 1 admin + 2 teacher + 50 student |
| major | 2 | 计算机、商科（商科下无课程/无选课） |
| teacher | 2 | 教师 1 → SAAS设计，教师 2 → python编程 |
| student | 50 | 均属计算机专业（major_id = 计算机） |
| course | 2 | SAAS设计、python编程，均属计算机 |
| section | 4 | 每门课 section1、section2 |
| section_schedule | 4 | 每班 1 条排课规则（可扩展为每班多条），共 4 条；有效期 2026-01-04～2026-05-01 |
| enrollment | 50～100 条 | 每人至少 1 条、最多 2 条（2 门课各 1 个班） |

---

## 五、Mock 数据设计要点（供生成脚本/Seed 使用）

### 5.1 专业

- **计算机**：id=1, name=计算机, code=CS  
- **商科**：id=2, name=商科, code=BUS（无课程、无选课）

### 5.2 用户与教师 / 学生

- **admin**：user.role=admin，无 teacher/student 记录。
- **教师 1**：user + teacher，负责「SAAS设计」；**教师 2**：user + teacher，负责「python编程」。
- **50 个学生**：50 个 user（role=student）+ 50 条 student（name、student_no、major_id=1）。

### 5.3 课程与班级

- **SAAS设计**：course.major_id=1, course.teacher_id=教师1；section：section1, section2。
- **python编程**：course.major_id=1, course.teacher_id=教师2；section：section1, section2。

### 5.4 课表（排课）Mock 规则

时间范围统一：**valid_from = 2026-01-04，valid_to = 2026-05-01**。四个班均采用同一数据结构，每班 1 条排课记录；时段可错开以避免教室冲突（示例见下表）。

| Section | 课程 | 班级 | 星期 | 开始时间 | 结束时间 | 教室 |
|---------|------|------|------|----------|----------|------|
| SAAS设计 section1 | SAAS设计 | section1 | 周一 (1) | 08:30 | 11:30 | 01 |
| SAAS设计 section2 | SAAS设计 | section2 | 周二 (2) | 08:30 | 11:30 | 02 |
| python编程 section1 | python编程 | section1 | 周三 (3) | 08:30 | 11:30 | 03 |
| python编程 section2 | python编程 | section2 | 周四 (4) | 08:30 | 11:30 | 04 |

- **实际上课日期**：由上述规则在 2026-01-04～2026-05-01 内按周展开。例如 SAAS设计 section1 为每周一，则具体日期为 2026-01-05、2026-01-12、… 直至 2026-05-01 前的所有周一（2026-01-04 为周日，首个周一为 01-05）。

### 5.5 选课分布（示例策略）

- 保证每人至少 1 个 Section：
  - 例如：前 25 人只选「SAAS设计」的 section1 或 section2，后 25 人只选「python编程」的 section1 或 section2；或
  - 部分人只选一门课的一个班，部分人两门课各选一个班（共 2 条 enrollment）。
- 约束：同一学生在一门课下只出现一次（只在一个 section 中）。

### 5.6 建议的 Seed 顺序

1. major  
2. user（53 条）  
3. teacher（2 条，绑定 user）  
4. student（50 条，绑定 user，major_id=1）  
5. course（2 条，major_id=1，分别绑定 2 个 teacher）  
6. section（4 条，2 条 per course）  
7. **section_schedule**（4 条，每班 1 条：SAAS section1 周一 08:30–11:30 教室01；SAAS section2 周二 08:30–11:30 教室02；python section1 周三 08:30–11:30 教室03；python section2 周四 08:30–11:30 教室04；valid_from=2026-01-04, valid_to=2026-05-01）  
8. enrollment（按上述策略生成 50～100 条）

---

## 六、ER 关系简图（文字版）

```
user 1──1 teacher
user 1──1 student

major 1──n course
teacher 1──n course
course 1──n section
section 1──n section_schedule  (课表：星期、时段、教室、有效期)

student n──n section  (通过 enrollment)
         enrollment (student_id, section_id)
```

---

## 七、文档说明与后续

- 本文档覆盖「专业–课程–班级–课表–学生」及选课，用于演示 Mock 与建表；课表按「每班排课规则 + 有效期」设计，可在 2026-01-04～2026-05-01 内按周展开为具体上课日期。
- **推荐实施顺序**：  
  1. **先**按第三节表结构确定数据格式规范（见 3.6），生成**一份**完整模拟数据（如 `mock-data.json`）；  
  2. **再**编写建表 SQL（或 ORM schema）；  
  3. **最后**按 mock 文件中的顺序插入数据（major → user → teacher/student → course → section → section_schedule → enrollment）。  
  演示全程只使用这一份数据，无需多条 Seed 或按环境切换。
- 若采用 ORM（如 Prisma、TypeORM、Sequelize），可先由 `mock-data.json` 反推 schema，再写导入脚本。
