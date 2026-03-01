/**
 * 周视图时间网格：08:00～18:00，30 分钟一格，共 20 行
 */
export const GRID_SLOT_COUNT = 20
const SLOT_START_MINUTES = 8 * 60 // 08:00
const SLOT_STEP_MINUTES = 30

/** 解析时间字符串 "HH:MM"、"HH:MM:SS" 或 ISO "…T11:30:00…"，返回 [时, 分] */
function parseTime(timeStr: string): { h: number; m: number } {
  let s = String(timeStr ?? '').trim()
  // 兼容 ISO 时间片段（如 1970-01-01T11:30:00.000Z）
  const tMatch = s.match(/T(\d{1,2}):(\d{1,2})/)
  if (tMatch) {
    return { h: parseInt(tMatch[1], 10) || 0, m: parseInt(tMatch[2], 10) || 0 }
  }
  const parts = s.split(':')
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  return { h, m }
}

/** 将 "HH:MM" / "HH:MM:SS" 转为槽位下标 (0～19)，超出范围则夹紧 */
export function timeToSlotIndex(timeStr: string): number {
  const { h, m } = parseTime(timeStr)
  const totalMin = h * 60 + m
  const index = Math.floor((totalMin - SLOT_START_MINUTES) / SLOT_STEP_MINUTES)
  return Math.max(0, Math.min(GRID_SLOT_COUNT, index))
}

/** 槽位下标对应的开始时间字符串，如 "08:00" */
export function getSlotLabel(slotIndex: number): string {
  const totalMin = SLOT_START_MINUTES + slotIndex * SLOT_STEP_MINUTES
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 事件占用的行范围：按「开始时间」定位行，按「持续分钟数」算占几格。
 * - 结束时间为整点(:00)时，视为到下一半点（11:00 → 11:30），补足最后一格。
 * - 若按上面算出的时长为 2.5 小时且开始为半点（如 8:30-11:00），视为 3 小时，避免少画一格。
 */
export function eventToGridRow(start_time: string, end_time: string): { gridRowStart: number; gridRowEnd: number } {
  const startParsed = parseTime(start_time)
  const endParsed = parseTime(end_time)
  let startMin = startParsed.h * 60 + startParsed.m
  let endMin = endParsed.h * 60 + endParsed.m
  if (endParsed.m === 0) endMin += 30
  let durationMin = Math.max(0, endMin - startMin)
  // 2.5 小时且从半点开始 → 常见为 8:30-11:30 被存成 11:00，按 3 小时算
  if (durationMin === 150 && startParsed.m === 30) durationMin = 180
  const span = Math.max(1, Math.ceil(durationMin / SLOT_STEP_MINUTES))
  const startSlot = timeToSlotIndex(start_time)
  return {
    gridRowStart: startSlot + 2, // +2 因第 1 行为表头
    gridRowEnd: startSlot + 2 + span,
  }
}
