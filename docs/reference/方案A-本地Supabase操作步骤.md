# 方案 A：Supabase 本地开发 — 操作步骤

按顺序完成以下步骤即可在本地跑 Supabase，并随时改 SQL、加表、推送到云端。

---

## 前置条件（需要你本机完成）

### 1. 安装 Docker Desktop

本地 Supabase 依赖 Docker，请先安装并启动：

- 下载：<https://www.docker.com/products/docker-desktop/>
- 安装后**启动 Docker Desktop**，保持运行（托盘里能看到 Docker 图标）。

### 2. 安装 Node.js

若尚未安装，请安装 **Node.js 18 或 20+**：

- 下载：<https://nodejs.org/>
- 安装后在终端执行 `node -v`、`npm -v` 能显示版本即可。

---

## 第一步：安装项目依赖（已由脚本准备）

项目已包含 `package.json` 和 Supabase 相关配置，在项目根目录执行：

```bash
cd f:\FOR_STUDY_ONLY\LU\Project\CDT516_3
npm install
```

完成后可用 `npx supabase` 调用 CLI（无需全局安装 Supabase）。

---

## 第二步：启动本地 Supabase

在项目根目录执行：

```bash
npx supabase start
```

首次会拉取 Docker 镜像，可能需要几分钟。成功后会输出一屏信息，包含：

- **API URL**：如 `http://127.0.0.1:54321`
- **anon key**：一长串 JWT
- **Studio URL**：如 `http://127.0.0.1:54323`（本地 Supabase 管理界面）
- **DB URL**：PostgreSQL 连接串

请把 **API URL** 和 **anon key** 记下来（或保存到 `.env.local`），前端连接本地 Supabase 时要用。

---

## 第三步：确认表结构和数据已就绪

`npx supabase start` 会自动执行 `supabase/migrations/` 下的迁移；**seed 数据**需要在「重置数据库」时才会写入。执行一次重置即可建表并灌入演示数据：

```bash
npx supabase db reset
```

这会：

1. 按顺序执行 `supabase/migrations/*.sql`（建表）
2. 执行 `supabase/seed.sql`（插入演示数据）

完成后可打开 **Studio URL**（如 http://127.0.0.1:54323），在 Table Editor 里查看 `major`、`user`、`course`、`enrollment` 等表是否有数据。

---

## 第四步：日常开发流程

### 只改数据（不改表结构）

- 直接改 `supabase/seed.sql`，然后执行：
  ```bash
  npx supabase db reset
  ```
- 或在 Studio 里手动改数据（仅本地，不会同步到迁移文件）。

### 新增或修改表（新需求如公告、任务、组队）

1. 在 `supabase/migrations/` 下**新增**一个迁移文件，例如：
   ```text
   supabase/migrations/20250102000000_add_announcement.sql
   ```
2. 在文件里写 `CREATE TABLE ...` 或 `ALTER TABLE ...`（不要写 `DROP TABLE`，迁移是增量执行的）。
3. 执行：
   ```bash
   npx supabase db reset
   ```
   本地会按新迁移重建库并重新跑 seed。
4. 若 seed 里也要为新表加演示数据，在 `supabase/seed.sql` 里追加对应 `INSERT`。

### 前端连接本地 Supabase

在项目里建 `.env.local`（不要提交到 Git），例如：

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<npx supabase start 输出里的 anon key>
```

前端用这两项初始化 Supabase Client，即可连到本地库。

---

## 第五步：推送到云端 Supabase（部署前）

当需要把当前表结构同步到你在 Supabase 网页上创建的项目时：

1. **登录 Supabase CLI**（仅首次需要）：
   ```bash
   npx supabase login
   ```
   会打开浏览器完成登录。

2. **关联远程项目**（仅首次需要）：
   ```bash
   npx supabase link --project-ref <你的项目 ref>
   ```
   项目 ref 在 Supabase 控制台 → Project Settings → General → Reference ID。

3. **推送迁移**：
   ```bash
   npx supabase db push
   ```
   会把 `supabase/migrations/` 里尚未在远程执行过的迁移应用到云端。

4. **云端灌入演示数据**（可选）：  
   若云端是空库，可在 Supabase 网页 → SQL Editor 里打开并执行 `supabase/seed.sql` 的内容；或使用 Supabase 提供的 seed 机制（若已配置）。

之后部署前端时，把环境变量改为**云端**的 Project URL 和 anon key，用户访问的就是云端数据。

---

## 常用命令速查

| 命令 | 说明 |
|------|------|
| `npx supabase start` | 启动本地 Supabase（需 Docker 已运行） |
| `npx supabase stop` | 停止本地 Supabase |
| `npx supabase db reset` | 按 migrations 重建库并执行 seed.sql |
| `npx supabase db push` | 将本地迁移推送到已 link 的云端项目 |
| `npx supabase link --project-ref <ref>` | 关联远程 Supabase 项目 |
| `npx supabase login` | 登录 Supabase 账号 |

---

## 当前项目里已为你准备好的内容

- `supabase/config.toml`：本地 Supabase 配置
- `supabase/migrations/20250101000000_initial_schema.sql`：初始表结构（major, user, teacher, student, course, section, section_schedule, enrollment）
- `supabase/seed.sql`：与 mock-data.json 一致的演示数据
- `package.json`：含 `supabase` 依赖与 `db:start`、`db:reset` 等脚本

你只需完成「前置条件」并执行第二步、第三步，即可在本地使用 Supabase；后续按第四步改 SQL、加表，按第五步推送到云端。
