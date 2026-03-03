# 将项目部署到 Vercel — 逐步操作手册

本文档按顺序说明如何把「高校教务协作 SAAS」从本机部署到 Vercel，每一步都可直接照着做。

---

## 第一步：注册 / 登录 Vercel

1. 打开 [vercel.com](https://vercel.com)，点击 **Sign Up** 或 **Log In**。
2. 建议选择 **Continue with GitHub**（或 GitLab / Bitbucket），这样后面可以直接选仓库，无需单独配置。

---

## 第二步：从仓库导入项目

1. 登录后进入 Vercel 控制台，点击 **Add New…** → **Project**。
2. 若首次使用，按提示 **Import Git Repository**，授权 Vercel 访问你的 GitHub（或其它）账号。
3. 在仓库列表里找到本项目（如 `CDT516_3`），右侧点击 **Import**。

---

## 第三步：配置项目（Import 时的设置页）

在 **Configure Project** 页面，按下面检查即可，通常不用改：


| 项                    | 建议值                            | 说明                       |
| -------------------- | ------------------------------ | ------------------------ |
| **Framework Preset** | Next.js                        | 一般会自动识别，保持即可。            |
| **Root Directory**   | 留空（`.`）                        | 若项目就在仓库根目录，不要填子目录。       |
| **Build Command**    | `next build`                   | 默认即可。                    |
| **Output Directory** | 留空                             | Next.js 默认用 `.next`，无需填。 |
| **Install Command**  | `npm install` 或 `yarn install` | 按你本地用的包管理器。              |


然后点击 **Environment Variables** 旁的展开，进入第四步（先不要点 Deploy）。

---

## 第四步：添加环境变量

在 **Environment Variables** 区域：

1. **Name** 填：`NEXT_PUBLIC_SUPABASE_URL`
  **Value** 填：你的 Supabase **Project URL**（如 `https://xxxxx.supabase.co`）。  
   环境勾选：**Production**、**Preview**、**Development** 都勾上即可。
2. 再点 **Add** 添加第二条：
  **Name** 填：`NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   **Value** 填：Supabase 的 **anon public** key（一长串字符）。  
   同样勾选 Production、Preview、Development。
3. 确认两条变量都出现在列表中，再点击页面底部 **Deploy**。

---

## 第五步：等待部署完成

1. 部署开始后会出现 **Building** 和日志输出，通常 1～3 分钟。
2. 若出现 **Build Failed**：
  - 点开 **View Build Logs**，看报错行（常见：依赖安装失败、TypeScript/ESLint 报错）。
  - 在本地执行 `npm run build` 复现并修复后，再 `git push`，Vercel 会自动重新部署。
3. 状态变为 **Ready** 后，页面会显示 **Visit** 按钮和一个域名（如 `cdt516-3-xxx.vercel.app`）。

---

## 第六步：在浏览器中验证

1. 点击 **Visit** 或复制给出的域名，在浏览器打开。
2. 应能看到选用户/登录入口；选一个身份和用户进入。
3. 简单检查：
  - 教务处 / 教师 / 学生工作台是否正常；
  - 课程列表、课表、公告、任务等是否都能加载（说明 Supabase 连接正常）。
4. 若页面空白或报错「缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY」：
  - 回 Vercel → 本项目 → **Settings** → **Environment Variables**，确认两条变量存在且无多余空格。
  - 修改后需在 **Deployments** 里对最新部署点 **Redeploy** 才会生效。

---

## 后续：每次更新代码如何上线

- 代码推送到所连接的仓库分支（如 `main`）后，Vercel 会**自动**触发一次新部署。
- 在 Vercel 项目页的 **Deployments** 可看到每次提交对应的部署状态和预览链接。

---

## 可选操作

### 为预览环境单独配置（可选）

- 若希望 **Preview**（每次 PR 的预览）使用另一套 Supabase 项目，可在 **Settings → Environment Variables** 里为同一变量名再添加一条，环境只勾选 **Preview**，值填预览用项目的 URL 和 anon key。

### 自定义域名（可选）

- 在项目 **Settings** → **Domains** 中可添加自己的域名，按页面提示在域名服务商处添加 CNAME 或 A 记录即可。

### 部署失败时在本地排查

- 在项目根目录执行：
  ```bash
  npm run build
  ```
- 若本地 build 失败，Vercel 上也会失败；先修到本地 build 通过再推送。

---

## 检查清单（部署前自检）

- 代码已推送到 GitHub/GitLab/Bitbucket
- Supabase Cloud 项目已创建，且所有迁移已在 SQL Editor 中执行
- 已拿到 Supabase Project URL 和 anon public key
- 在 Vercel 导入项目时已添加 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 首次部署完成后用 Visit 链接打开站点，选用户并简单点击各端功能验证

按以上步骤做完，项目即可稳定运行在 Vercel 上；之后只需正常开发、提交、推送，即可自动发布。
