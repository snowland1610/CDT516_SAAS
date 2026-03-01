# UI 美化改动计划

> 作为后续改动的唯一依据。风格方向：Notion 式清晰与引导 + Linear 式简洁与克制用色；整体明亮、信息层次清楚、便于展示。

---

## 一、设计方向（不可偏离）

| 原则 | 说明 |
|------|------|
| **清晰** | 卡片分明、信息分块清楚；侧栏简洁但通过分组与选中态引导清楚。 |
| **简洁 / 色块少** | 主色仅用于强调（链接、主按钮、选中态）；背景以白/浅灰为主；无花哨渐变与多余装饰。 |
| **明亮** | 页面背景偏亮（白或极浅灰）；文字对比度足够，不灰到难以辨认。 |
| **便于展示** | 数字、状态、入口一目了然；适合投屏与演示。 |

---

## 二、设计基线（全局统一）

以下数值/约定在 **Tailwind 配置** 或 **globals.css** 中统一，全站复用。

### 2.1 色彩

| 用途 | 约定 | 示例（Tailwind） |
|------|------|------------------|
| 主色（强调） | 单一主色，用于主按钮、链接、选中态、关键数字 | 如 `blue-600` / `indigo-600`，hover 略深 |
| 背景 - 页面 | 明亮，与卡片区分 | 如 `gray-50` 或 `slate-50` |
| 背景 - 卡片/顶栏/侧栏 | 白或极浅灰 | `white` 或 `gray-50` |
| 边框 | 轻、不抢眼 | `gray-200` 或 `gray-100` |
| 正文 | 深灰，易读 | `gray-700` / `gray-800` |
| 次要/说明 | 中灰 | `gray-500` |
| 占位/禁用 | 浅灰 | `gray-400` |

### 2.2 圆角与阴影

| 元素 | 约定 |
|------|------|
| 卡片、输入框、按钮 | 统一圆角，如 `rounded-lg`（8px）或 `rounded-xl`（12px） |
| 卡片 | 轻阴影以区分层次，如 `shadow-sm` 或略强一档，避免过重 |
| 悬停/按下 | 可略微加强阴影或亮度，过渡柔和（如 `transition-colors` / `transition-shadow`） |

### 2.3 字体与层级

| 层级 | 约定 |
|------|------|
| 页面主标题 | 如 `text-xl` 或 `text-2xl`，`font-semibold`，深色 |
| 区块标题 | 如 `text-base`，`font-medium` |
| 正文 | `text-sm` 或 `text-base`，常规字重 |
| 辅助/说明 | `text-sm`，`text-gray-500` |

### 2.4 间距

- 主内容区内边距统一（如 `p-6`）。
- 卡片内部、表单项之间使用一致间距（如 `gap-4`、`space-y-3`）。

---

## 三、改动顺序与范围

### 阶段 1：设计基线（先定规矩，再改界面）

**目标**：在不改变现有页面视觉效果的前提下，把「主色、背景、圆角、阴影、字体」等写入配置，便于后续组件统一引用。

**涉及文件**：

- `tailwind.config.ts`：扩展 theme（颜色、圆角、阴影等，若需自定义）。
- `app/globals.css`：可增加 CSS 变量（如 `--color-primary`、`--radius-card`），与 Tailwind 保持一致。

**产出**：一套可在全站复用的设计 token，后续所有组件与页面只使用这些约定，不随意写死色值或阴影。

---

### 阶段 2：共用组件（改一次，全站生效）

**目标**：顶栏、侧栏符合「Notion + Linear」的简洁明亮风格；引导清楚、层次分明。

#### 2.1 Header（顶栏）

**文件**：`components/layout/Header.tsx`

**方向**：

- 高度与内边距适中（如保持 `h-14` 或略调）；背景白或极浅灰；底部分割线轻（如 `border-gray-200`）。
- 左侧：平台名可略加强字重/字号，主色或深灰。
- 右侧：角色与用户名层次清楚（如角色用次要色、姓名用正文色）；「退出」为文本按钮，hover 有反馈，不抢眼。
- 整体无大色块，保持简洁。

#### 2.2 Sidebar（侧栏）- 三端统一风格

**文件**：

- `components/layout/AdminSidebar.tsx`
- `components/layout/TeacherSidebar.tsx`
- `components/layout/StudentSidebar.tsx`

**方向**：

- 宽度统一（如保持 `w-52` 或 240px）；背景白或与主区有轻微区分；右边框轻。
- 导航项：分组清晰（若有逻辑分组可加小标题或间距）；选中态明确（如左侧竖条或浅底 + 主色/深字）；hover 有过渡（如 `bg-gray-50` 或浅底）。
- 可选：为每项增加小图标（后续可做），当前可先统一圆角与间距。
- 三端侧栏视觉风格一致，仅菜单项不同。

---

### 阶段 3：样板页（先做 1～2 页看整体效果）

**目标**：用「设计基线 + 新 Header/Sidebar」做 1～2 个完整页面，验证明亮、清晰、便于展示；确认后再推广到全站。

#### 3.1 首选样板页：教务处工作台

**文件**：`app/admin/page.tsx`

**方向**：

- 页面标题：符合「字体层级」约定。
- 统计卡片：统一圆角与轻阴影；标签与数字层次分明（标签次要色、数字突出）；卡片间距一致。
- 近期公告区：卡片化，空态文案简洁。
- 快捷入口：主按钮用主色、次按钮用浅底灰边或浅灰底；hover 有过渡。
- 整体留白与间距符合「设计基线」，不拥挤。

#### 3.2 次选样板页（二选一即可）

- **课程目录列表**：`app/admin/courses/page.tsx` — 列表/卡片化、表头或筛选区简洁。
- 或 **教师/学生工作台**：`app/teacher/page.tsx` / `app/student/page.tsx` — 与教务处工作台风格一致，仅内容不同。

**阶段 3 完成后的检查点**：在浏览器中查看上述 1～2 页，确认「明亮、简洁、层次清楚、便于展示」；若满意，进入阶段 4。

---

### 阶段 4：全站推广（沿用同一套，不重新发明）

**目标**：其余页面全部沿用「设计基线 + 已改的 Header/Sidebar + 阶段 3 中确立的卡片/按钮/间距用法」，只替换内容和布局，不引入新的风格。

**涉及范围**（按需逐页调整）：

- 教务处：`app/admin/announcements/page.tsx`、`app/admin/stats/page.tsx`、`app/admin/courses/[id]/page.tsx` 等。
- 教师端：`app/teacher/page.tsx`、`app/teacher/courses/page.tsx`、`app/teacher/courses/[id]/page.tsx`、`app/teacher/calendar/page.tsx`、`app/teacher/announcements/page.tsx`。
- 学生端：`app/student/page.tsx`、`app/student/courses/page.tsx`、`app/student/courses/[id]/page.tsx`、`app/student/calendar/page.tsx`、`app/student/announcements/page.tsx`。
- 入口与选用户：`app/page.tsx`、`app/select-user/page.tsx` — 风格与三端一致，简洁明亮。

**原则**：每页只做「应用已有组件与 class」，不新增一套新的配色或阴影；若有新组件（如表格、表单），也遵循「设计基线」中的色彩与圆角/阴影约定。

---

## 四、实施时的约定

1. **严格按阶段顺序**：先 1（基线）→ 2（Header + Sidebar）→ 3（样板页）→ 4（全站）。阶段 3 确认后再做阶段 4。
2. **组件优先**：能抽成共用组件或共用 class 的（如卡片、主/次按钮），在阶段 2 或 3 中定好，阶段 4 只复用。
3. **不改变交互与路由**：本次仅做视觉与样式调整，不删改功能、不改路由与数据结构。
4. **可逆与可调**：主色、圆角、阴影等尽量集中在配置或少量组件内，便于后续微调（如主色从蓝改为靛）。

---

## 五、文件清单速查

| 类型 | 路径 |
|------|------|
| 全局样式 | `app/globals.css` |
| Tailwind 配置 | `tailwind.config.ts` |
| 顶栏 | `components/layout/Header.tsx` |
| 侧栏 | `components/layout/AdminSidebar.tsx`、`TeacherSidebar.tsx`、`StudentSidebar.tsx` |
| 样板页 | `app/admin/page.tsx`（必做）；`app/admin/courses/page.tsx` 或 `app/teacher/page.tsx` 或 `app/student/page.tsx`（择一） |
| 三端 layout | `app/admin/layout.tsx`、`app/teacher/layout.tsx`、`app/student/layout.tsx`（主区背景等可在此统一） |

---

**文档版本**：v1  
**用途**：后续执行 UI 美化时，仅以此计划为准；若需调整范围或顺序，应先更新本文档再改代码。
