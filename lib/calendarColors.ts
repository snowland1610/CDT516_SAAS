/**
 * 日历事件配色：按事件类型区分色环与饱和度
 *
 * 规范：
 * - course（上课）：较高饱和度（200/400 档），学生不可编辑
 * - personal（个人）：同色环较低饱和度（100/300 档），可编辑/拖拽
 * - 后续新增类型（如 group）在此配置中增加色环与饱和度即可
 */

/** 日历事件类型；新增类型在此扩展并 below 增加对应色板 */
export type CalendarEventType = 'course' | 'personal'

// ---------------------------------------------------------------------------
// 上课事件：较高饱和度（200/400）
// ---------------------------------------------------------------------------
const COURSE_COLOR_CLASSES = [
  'bg-blue-200 border-blue-400 hover:bg-blue-300',
  'bg-green-200 border-green-400 hover:bg-green-300',
  'bg-amber-200 border-amber-400 hover:bg-amber-300',
  'bg-violet-200 border-violet-400 hover:bg-violet-300',
  'bg-rose-200 border-rose-400 hover:bg-rose-300',
  'bg-sky-200 border-sky-400 hover:bg-sky-300',
  'bg-emerald-200 border-emerald-400 hover:bg-emerald-300',
  'bg-orange-200 border-orange-400 hover:bg-orange-300',
]

// ---------------------------------------------------------------------------
// 个人事件：同色环较低饱和度（100/300），与课程区分且协调
// ---------------------------------------------------------------------------
const PERSONAL_COLOR_CLASSES = [
  'bg-blue-100 border-blue-300 hover:bg-blue-200',
  'bg-green-100 border-green-300 hover:bg-green-200',
  'bg-violet-100 border-violet-300 hover:bg-violet-200',
  'bg-amber-100 border-amber-300 hover:bg-amber-200',
  'bg-sky-100 border-sky-300 hover:bg-sky-200',
  'bg-rose-100 border-rose-300 hover:bg-rose-200',
]

/** 无有效 id 时的降级样式 */
const FALLBACK_COLOR_CLASSES = 'bg-gray-200 border-gray-400 hover:bg-gray-300'

/** 个人事件无 id 时的默认色（固定一种） */
const PERSONAL_DEFAULT_COLOR_CLASSES = 'bg-slate-100 border-slate-300 hover:bg-slate-200'

/**
 * 按事件类型与可选 id 返回日历色块 Tailwind 类名
 * @param eventType - 事件类型：course 上课 / personal 个人
 * @param id - course 时传 courseId 按课程区分颜色；personal 时传 eventId 可区分多条，不传则用默认色
 */
export function getEventColorClasses(
  eventType: CalendarEventType,
  id?: number | null
): string {
  if (eventType === 'course') {
    return getCourseColorClasses(id ?? undefined)
  }
  if (eventType === 'personal') {
    if (id != null && Number.isFinite(Number(id))) {
      const index = Math.abs(Number(id)) % PERSONAL_COLOR_CLASSES.length
      return PERSONAL_COLOR_CLASSES[index]
    }
    return PERSONAL_DEFAULT_COLOR_CLASSES
  }
  return FALLBACK_COLOR_CLASSES
}

/**
 * 课表日历：按课程区分颜色（上课事件，高饱和度）
 * 同一 courseId 在所有视图中使用相同颜色
 * @deprecated 新代码请用 getEventColorClasses('course', courseId)
 */
export function getCourseColorClasses(courseId: number | undefined | null): string {
  const id = courseId != null && Number.isFinite(Number(courseId)) ? Number(courseId) : null
  if (id === null) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn('[calendarColors] courseId 缺失或无效，使用降级颜色')
    }
    return FALLBACK_COLOR_CLASSES
  }
  const index = Math.abs(id) % COURSE_COLOR_CLASSES.length
  return COURSE_COLOR_CLASSES[index]
}
