'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { getCourseColorClasses, getEventColorClasses } from '@/lib/calendarColors'
import { GRID_SLOT_COUNT, getSlotLabel, eventToGridRow, timeToSlotIndex } from '@/lib/calendarGrid'

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

type ScheduleRow = {
  id: number
  section_id: number
  day_of_week: number
  start_time: string
  end_time: string
  room: string
  valid_from: string
  valid_to: string
  section: {
    name: string
    course_id: number
    course: { name: string; teacher_id: number; teacher: { name: string } | null } | null
  } | null
}

type WeekEvent = {
  id: number
  courseId: number
  courseName: string
  sectionName: string
  room: string
  start_time: string
  end_time: string
  valid_from: string
  valid_to: string
  teacherName: string
}

/** 个人事件（student_personal_event） */
type PersonalEvent = {
  id: number
  student_id: number
  title: string
  start_at: string
  end_at: string
  created_at?: string
  updated_at?: string
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateLabel(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 日期 → 星期几 1=周一 … 7=周日，与后端 day_of_week 一致 */
function getDayOfWeek(d: Date): number {
  const day = d.getDay()
  return day === 0 ? 7 : day
}

function formatDateFull(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${DAY_NAMES[getDayOfWeek(d)]}`
}

/** 当月 1 日 0 点 */
function getMonthStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}

/** 月视图网格：6 周 × 7 天，从当月 1 日所在周的周一开始 */
function getMonthGridDates(monthStart: Date): Date[][] {
  const firstMonday = getMonday(monthStart)
  const grid: Date[][] = []
  for (let row = 0; row < 6; row++) {
    const week: Date[] = []
    for (let col = 0; col < 7; col++) {
      const d = new Date(firstMonday)
      d.setDate(firstMonday.getDate() + row * 7 + col)
      week.push(d)
    }
    grid.push(week)
  }
  return grid
}

function formatMonthTitle(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

/** 从 ISO 时间取本地 "HH:MM" */
function timeStrFromISO(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 根据日期计算当日排课列表（与 dayEvents 逻辑一致），用于月视图悬停/弹窗 */
function getDayEventsForDate(rows: ScheduleRow[], date: Date): WeekEvent[] {
  const dayOfWeek = getDayOfWeek(date)
  const dateStr = formatDate(date)
  const list: WeekEvent[] = []
  for (const row of rows) {
    if (!row.section?.course) continue
    if (row.day_of_week !== dayOfWeek) continue
    if (dateStr < row.valid_from || dateStr > row.valid_to) continue
    list.push({
      id: row.id,
      courseId: row.section.course_id,
      courseName: row.section.course.name,
      sectionName: row.section.name,
      room: row.room,
      start_time: row.start_time,
      end_time: row.end_time,
      valid_from: row.valid_from,
      valid_to: row.valid_to,
      teacherName: row.section.course.teacher?.name ?? '—',
    })
  }
  list.sort((a, b) => a.start_time.localeCompare(b.start_time))
  return list
}

export default function StudentCalendarPage() {
  const { user } = useAuth()
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [monthStart, setMonthStart] = useState<Date>(() => getMonthStart(new Date()))
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<WeekEvent | null>(null)
  const [hoverEvent, setHoverEvent] = useState<WeekEvent | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [hoverCellDate, setHoverCellDate] = useState<Date | null>(null)
  const [hoverCellPos, setHoverCellPos] = useState({ x: 0, y: 0 })
  const [selectedCellDate, setSelectedCellDate] = useState<Date | null>(null)
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([])
  const [selectedPersonalEvent, setSelectedPersonalEvent] = useState<PersonalEvent | null>(null)
  const [personalEventFormOpen, setPersonalEventFormOpen] = useState<'new' | 'edit' | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formStartTime, setFormStartTime] = useState('09:00')
  const [formEndTime, setFormEndTime] = useState('10:00')
  const weekGridRef = useRef<HTMLDivElement | null>(null)
  const openEditPersonalRef = useRef<((ev: PersonalEvent) => void) | null>(null)
  const [dragPersonal, setDragPersonal] = useState<{
    ev: PersonalEvent
    day: number
    start_time: string
    end_time: string
    startX: number
    startY: number
  } | null>(null)
  const [resizePersonal, setResizePersonal] = useState<{
    ev: PersonalEvent
    edge: 'top' | 'bottom'
    day: number
    start_time: string
    end_time: string
  } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ day: number; slot: number } | null>(null)
  const [resizePreview, setResizePreview] = useState<{ start_time: string; end_time: string } | null>(null)
  const dragPreviewRef = useRef<{ day: number; slot: number } | null>(null)
  const resizePreviewRef = useRef<{ start_time: string; end_time: string } | null>(null)

  /** 根据鼠标位置计算落在周视图网格的 (dayIndex 0-6, slotIndex 0-19)，无 ref 或越界返回 null。列 1=时间，列 2-8=周一～周日 */
  const mouseToDaySlot = useCallback((clientX: number, clientY: number): { day: number; slot: number } | null => {
    const el = weekGridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const headerHeight = 48
    const timeColWidth = 48
    const bodyTop = rect.top + headerHeight
    const bodyHeight = rect.height - headerHeight
    if (bodyHeight <= 0) return null
    if (clientY < bodyTop || clientY >= rect.bottom) return null
    const dayAreaLeft = rect.left + timeColWidth
    const dayAreaWidth = rect.width - timeColWidth
    if (clientX < dayAreaLeft || clientX >= rect.right) return null
    const dayColWidth = dayAreaWidth / 7
    const xInDayArea = clientX - dayAreaLeft
    const dayIndex = Math.min(6, Math.floor(xInDayArea / dayColWidth))
    const slotIndex = Math.floor((clientY - bodyTop) / (bodyHeight / GRID_SLOT_COUNT))
    return {
      day: Math.max(0, Math.min(6, dayIndex)),
      slot: Math.max(0, Math.min(GRID_SLOT_COUNT - 1, slotIndex)),
    }
  }, [])

  useEffect(() => {
    if (!user || user.role !== 'student' || user.profile_id == null) {
      setLoading(false)
      return
    }
    let cancelled = false
    const supabase = createClient()
    async function fetchSchedules() {
      try {
        const { data: enrollData, error: e1 } = await supabase
          .from('enrollment')
          .select('section_id')
          .eq('student_id', user.profile_id)
        if (cancelled || e1) throw e1
        const sectionIds = [...new Set((enrollData ?? []).map((r: { section_id: number }) => r.section_id))]
        if (sectionIds.length === 0) {
          setScheduleRows([])
          setLoading(false)
          return
        }
        const { data: schedData, error: e2 } = await supabase
          .from('section_schedule')
          .select(`
            id, section_id, day_of_week, start_time, end_time, room, valid_from, valid_to,
            section:section_id(name, course_id, course:course_id(name, teacher_id, teacher:teacher_id(name)))
          `)
          .in('section_id', sectionIds)
        if (cancelled || e2) throw e2
        setScheduleRows((schedData ?? []) as ScheduleRow[])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchSchedules()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'student' || user.profile_id == null) {
      setPersonalEvents([])
      return
    }
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const monthGridFirst = getMonday(monthStart)
    const monthGridLast = new Date(monthGridFirst)
    monthGridLast.setDate(monthGridLast.getDate() + 6 * 7 - 1)
    const rangeStart = weekStart < monthGridFirst ? weekStart : monthGridFirst
    const rangeEnd = weekEnd > monthGridLast ? weekEnd : monthGridLast
    const startISO = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).toISOString()
    const endISO = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59, 999).toISOString()

    let cancelled = false
    const supabase = createClient()
    async function fetchPersonal() {
      const { data, error } = await supabase
        .from('student_personal_event')
        .select('id, student_id, title, start_at, end_at, created_at, updated_at')
        .eq('student_id', user.profile_id!)
        .gte('end_at', startISO)
        .lte('start_at', endISO)
        .order('start_at')
      if (!cancelled && !error) setPersonalEvents((data ?? []) as PersonalEvent[])
      if (!cancelled && error) setPersonalEvents([])
    }
    fetchPersonal()
    return () => { cancelled = true }
  }, [user, weekStart, monthStart])

  const weekEventsByDay = useMemo(() => {
    const byDay: Record<number, WeekEvent[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }
    for (const row of scheduleRows) {
      if (!row.section?.course) continue
      const dayDate = new Date(weekStart)
      dayDate.setDate(weekStart.getDate() + (row.day_of_week - 1))
      const dateStr = formatDate(dayDate)
      if (dateStr < row.valid_from || dateStr > row.valid_to) continue
      const ev: WeekEvent = {
        id: row.id,
        courseId: row.section.course_id,
        courseName: row.section.course.name,
        sectionName: row.section.name,
        room: row.room,
        start_time: row.start_time,
        end_time: row.end_time,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        teacherName: row.section.course.teacher?.name ?? '—',
      }
      byDay[row.day_of_week].push(ev)
    }
    for (const d of [1, 2, 3, 4, 5, 6, 7]) {
      byDay[d].sort((a, b) => a.start_time.localeCompare(b.start_time))
    }
    return byDay
  }, [scheduleRows, weekStart])

  const weekDates = useMemo(() => {
    const dates: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      dates.push(d)
    }
    return dates
  }, [weekStart])

  const weekEventsFlat = useMemo(() => {
    const arr: { day: number; ev: WeekEvent }[] = []
    for (let d = 1; d <= 7; d++) {
      for (const ev of weekEventsByDay[d] ?? []) {
        arr.push({ day: d, ev })
      }
    }
    return arr
  }, [weekEventsByDay])

  /** 周视图内个人事件：按开始日落在本周的日期，转为 day(1-7) + start_time/end_time */
  const weekPersonalEventsFlat = useMemo(() => {
    const arr: { day: number; ev: PersonalEvent; start_time: string; end_time: string }[] = []
    const weekDateStrs = weekDates.map((d) => formatDate(d))
    for (const pe of personalEvents) {
      const startD = formatDate(new Date(pe.start_at))
      const dayIdx = weekDateStrs.indexOf(startD)
      if (dayIdx < 0) continue
      arr.push({
        day: dayIdx + 1,
        ev: pe,
        start_time: timeStrFromISO(pe.start_at),
        end_time: timeStrFromISO(pe.end_at),
      })
    }
    return arr
  }, [personalEvents, weekDates])

  /** 日视图：选中日期当天的排课，复用 valid_from/valid_to */
  const dayEvents = useMemo(() => {
    const dayOfWeek = getDayOfWeek(selectedDate)
    const dateStr = formatDate(selectedDate)
    const list: WeekEvent[] = []
    for (const row of scheduleRows) {
      if (!row.section?.course) continue
      if (row.day_of_week !== dayOfWeek) continue
      if (dateStr < row.valid_from || dateStr > row.valid_to) continue
      list.push({
        id: row.id,
        courseId: row.section.course_id,
        courseName: row.section.course.name,
        sectionName: row.section.name,
        room: row.room,
        start_time: row.start_time,
        end_time: row.end_time,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        teacherName: row.section.course.teacher?.name ?? '—',
      })
    }
    list.sort((a, b) => a.start_time.localeCompare(b.start_time))
    return list
  }, [scheduleRows, selectedDate])

  /** 当日事件板块：课程 + 个人事件合并，按开始时间排序 */
  type DayPanelItem = { type: 'course'; ev: WeekEvent } | { type: 'personal'; ev: PersonalEvent; start_time: string; end_time: string }
  const dayPanelItems = useMemo((): DayPanelItem[] => {
    const selectedStr = formatDate(selectedDate)
    const courseItems: DayPanelItem[] = dayEvents.map((ev) => ({ type: 'course', ev }))
    const personalItems: DayPanelItem[] = personalEvents
      .filter((pe) => {
        const startD = formatDate(new Date(pe.start_at))
        const endD = formatDate(new Date(pe.end_at))
        return selectedStr >= startD && selectedStr <= endD
      })
      .map((pe) => ({
        type: 'personal' as const,
        ev: pe,
        start_time: timeStrFromISO(pe.start_at),
        end_time: timeStrFromISO(pe.end_at),
      }))
    const merged = [...courseItems, ...personalItems]
    merged.sort((a, b) => {
      const ta = a.type === 'course' ? a.ev.start_time : a.start_time
      const tb = b.type === 'course' ? b.ev.start_time : b.start_time
      return ta.localeCompare(tb)
    })
    return merged
  }, [dayEvents, personalEvents, selectedDate])

  /** 月视图：网格内每个日期对应的有课数及课程 ID 列表（用于数量/色块） */
  const monthGridDates = useMemo(() => getMonthGridDates(monthStart), [monthStart])
  const monthGridEvents = useMemo(() => {
    const map: Record<string, { count: number; courseIds: number[]; personalEventIds: number[] }> = {}
    for (let r = 0; r < monthGridDates.length; r++) {
      for (let col = 0; col < 7; col++) {
        const d = monthGridDates[r][col]
        const dateStr = formatDate(d)
        const dayOfWeek = getDayOfWeek(d)
        const courseIds: number[] = []
        let count = 0
        for (const sr of scheduleRows) {
          if (!sr.section?.course) continue
          if (sr.day_of_week !== dayOfWeek) continue
          if (dateStr < sr.valid_from || dateStr > sr.valid_to) continue
          count++
          if (!courseIds.includes(sr.section.course_id)) courseIds.push(sr.section.course_id)
        }
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
        const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1
        const personalEventIds = personalEvents
          .filter((pe) => {
            const s = new Date(pe.start_at).getTime()
            const e = new Date(pe.end_at).getTime()
            return s <= dayEnd && e >= dayStart
          })
          .map((pe) => pe.id)
        map[dateStr] = { count, courseIds, personalEventIds }
      }
    }
    return map
  }, [scheduleRows, monthGridDates, personalEvents])

  const goPrevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }
  const goNextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }
  const goThisWeek = () => {
    setWeekStart(getMonday(new Date()))
  }

  const goPrevMonth = () => {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1)
    setMonthStart(d)
  }
  const goNextMonth = () => {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
    setMonthStart(d)
  }
  const goThisMonth = () => {
    setMonthStart(getMonthStart(new Date()))
  }

  const switchToMonthView = () => {
    setMonthStart(getMonthStart(selectedDate))
    setViewMode('month')
  }
  /** 月视图点击格子：始终同步选中日期（供当日事件板块联动）；有事件时打开弹窗 */
  const onMonthCellClick = (cellDate: Date, hasEvents: boolean) => {
    setSelectedDate(new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate()))
    if (hasEvents) setSelectedCellDate(cellDate)
  }

  const refreshPersonalEvents = useCallback(async () => {
    if (!user?.profile_id) return
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const monthGridFirst = getMonday(monthStart)
    const monthGridLast = new Date(monthGridFirst)
    monthGridLast.setDate(monthGridLast.getDate() + 6 * 7 - 1)
    const rangeStart = weekStart < monthGridFirst ? weekStart : monthGridFirst
    const rangeEnd = weekEnd > monthGridLast ? weekEnd : monthGridLast
    const startISO = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).toISOString()
    const endISO = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59, 999).toISOString()
    const supabase = createClient()
    const { data, error } = await supabase
      .from('student_personal_event')
      .select('id, student_id, title, start_at, end_at, created_at, updated_at')
      .eq('student_id', user.profile_id)
      .gte('end_at', startISO)
      .lte('start_at', endISO)
      .order('start_at')
    if (!error) setPersonalEvents((data ?? []) as PersonalEvent[])
  }, [user?.profile_id, weekStart, monthStart])

  openEditPersonalRef.current = (ev: PersonalEvent) => {
    setSelectedPersonalEvent(ev)
    setFormTitle(ev.title)
    setFormDate(formatDate(new Date(ev.start_at)))
    setFormStartTime(timeStrFromISO(ev.start_at))
    setFormEndTime(timeStrFromISO(ev.end_at))
    setPersonalEventFormOpen('edit')
  }

  useEffect(() => {
    if (!dragPersonal && !resizePersonal) return
    const supabase = createClient()
    const handleMove = (e: MouseEvent) => {
      if (dragPersonal) {
        const pos = mouseToDaySlot(e.clientX, e.clientY)
        const next = pos ? { day: pos.day, slot: pos.slot } : null
        dragPreviewRef.current = next
        setDragPreview(next)
      }
      if (resizePersonal) {
        const pos = mouseToDaySlot(e.clientX, e.clientY)
        if (pos) {
          const startSlot = timeToSlotIndex(resizePersonal.start_time)
          const endSlot = timeToSlotIndex(resizePersonal.end_time)
          const next =
            resizePersonal.edge === 'top'
              ? { start_time: getSlotLabel(Math.max(0, Math.min(pos.slot, endSlot - 1))), end_time: resizePersonal.end_time }
              : { start_time: resizePersonal.start_time, end_time: getSlotLabel(Math.min(GRID_SLOT_COUNT, Math.max(startSlot + 1, pos.slot + 1))) }
          resizePreviewRef.current = next
          setResizePreview(next)
        }
      }
    }
    const handleUp = async (e: MouseEvent) => {
      if (dragPersonal) {
        const pos = dragPreviewRef.current ?? mouseToDaySlot(e.clientX, e.clientY)
        const moved = Math.abs(e.clientX - dragPersonal.startX) > 5 || Math.abs(e.clientY - dragPersonal.startY) > 5
        setDragPersonal(null)
        dragPreviewRef.current = null
        setDragPreview(null)
        if (!moved && openEditPersonalRef.current) {
          openEditPersonalRef.current(dragPersonal.ev)
          return
        }
        if (pos && weekDates.length === 7) {
          const newDate = weekDates[pos.day]
          const durationSlots = timeToSlotIndex(dragPersonal.end_time) - timeToSlotIndex(dragPersonal.start_time)
          const newStartSlot = Math.max(0, Math.min(GRID_SLOT_COUNT - 1, pos.slot))
          const newEndSlot = Math.max(newStartSlot + 1, Math.min(GRID_SLOT_COUNT, newStartSlot + Math.max(1, durationSlots)))
          const newStartTime = getSlotLabel(newStartSlot)
          const newEndTime = getSlotLabel(newEndSlot)
          const startAt = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), parseInt(newStartTime.slice(0, 2), 10), parseInt(newStartTime.slice(3, 5), 10), 0)
          const endAt = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), parseInt(newEndTime.slice(0, 2), 10), parseInt(newEndTime.slice(3, 5), 10), 0)
          await supabase
            .from('student_personal_event')
            .update({ start_at: startAt.toISOString(), end_at: endAt.toISOString() })
            .eq('id', dragPersonal.ev.id)
          await refreshPersonalEvents()
        }
        return
      }
      if (resizePersonal) {
        const ev = resizePersonal.ev
        const evStart = new Date(ev.start_at)
        const dateStr = formatDate(evStart)
        const [y, m, d] = dateStr.split('-').map(Number)
        if (resizePreviewRef.current) {
          const resizePreview = resizePreviewRef.current
          if (resizePersonal.edge === 'top') {
            const startAt = new Date(y, m - 1, d, parseInt(resizePreview.start_time.slice(0, 2), 10), parseInt(resizePreview.start_time.slice(3, 5), 10), 0)
            await supabase.from('student_personal_event').update({ start_at: startAt.toISOString() }).eq('id', ev.id)
          } else {
            const endAt = new Date(y, m - 1, d, parseInt(resizePreview.end_time.slice(0, 2), 10), parseInt(resizePreview.end_time.slice(3, 5), 10), 0)
            await supabase.from('student_personal_event').update({ end_at: endAt.toISOString() }).eq('id', ev.id)
          }
          await refreshPersonalEvents()
        } else {
          const pos = mouseToDaySlot(e.clientX, e.clientY)
          if (pos) {
            if (resizePersonal.edge === 'top') {
              const newStartSlot = Math.max(0, Math.min(pos.slot, timeToSlotIndex(resizePersonal.end_time) - 1))
              const newStartTime = getSlotLabel(newStartSlot)
              const startAt = new Date(y, m - 1, d, parseInt(newStartTime.slice(0, 2), 10), parseInt(newStartTime.slice(3, 5), 10), 0)
              await supabase.from('student_personal_event').update({ start_at: startAt.toISOString() }).eq('id', ev.id)
            } else {
              const minEndSlot = timeToSlotIndex(resizePersonal.start_time) + 1
              const newEndSlot = Math.min(GRID_SLOT_COUNT, Math.max(minEndSlot, pos.slot + 1))
              const newEndTime = getSlotLabel(newEndSlot)
              const endAt = new Date(y, m - 1, d, parseInt(newEndTime.slice(0, 2), 10), parseInt(newEndTime.slice(3, 5), 10), 0)
              await supabase.from('student_personal_event').update({ end_at: endAt.toISOString() }).eq('id', ev.id)
            }
            await refreshPersonalEvents()
          }
        }
        setResizePersonal(null)
        resizePreviewRef.current = null
        setResizePreview(null)
      }
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [dragPersonal, resizePersonal, mouseToDaySlot, weekDates, refreshPersonalEvents])

  if (!user || user.role !== 'student') return null

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">我的日程</h1>
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">我的日程</h1>
        <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">我的日程</h1>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-sm font-medium text-gray-700">视图：</span>
        <button
          type="button"
          onClick={() => setViewMode('week')}
          className={`px-3 py-1.5 text-sm border rounded ${viewMode === 'week' ? 'bg-gray-200 border-gray-400' : 'border-gray-300 hover:bg-gray-50'}`}
        >
          周
        </button>
        <button
          type="button"
          onClick={switchToMonthView}
          className={`px-3 py-1.5 text-sm border rounded ${viewMode === 'month' ? 'bg-gray-200 border-gray-400' : 'border-gray-300 hover:bg-gray-50'}`}
        >
          月
        </button>
        {viewMode === 'week' && (
          <>
            <button
              type="button"
              onClick={goPrevWeek}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              上一周
            </button>
            <button
              type="button"
              onClick={goThisWeek}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              本周
            </button>
            <button
              type="button"
              onClick={goNextWeek}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              下一周
            </button>
            <span className="text-sm text-gray-600">
              {formatDate(weekDates[0])} ～ {formatDate(weekDates[6])}
            </span>
          </>
        )}
        {viewMode === 'month' && (
          <>
            <button
              type="button"
              onClick={goPrevMonth}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              上一月
            </button>
            <button
              type="button"
              onClick={goThisMonth}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              本月
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              下一月
            </button>
            <span className="text-sm font-medium text-gray-700">{formatMonthTitle(monthStart)}</span>
          </>
        )}
      </div>

      {viewMode === 'week' && (
        <div
          ref={weekGridRef}
          className="grid gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200 min-h-[480px]"
          style={{
            gridTemplateColumns: '48px repeat(7, 1fr)',
            gridTemplateRows: `auto repeat(${GRID_SLOT_COUNT}, minmax(24px, 1fr))`,
          }}
        >
          {Array.from({ length: GRID_SLOT_COUNT }, (_, row) => (
            <div
              key={`grid-${row}`}
              className="z-0 border-b border-gray-200 bg-white"
              style={{
                gridColumn: '2 / -1',
                gridRow: row + 2,
                backgroundImage: 'repeating-linear-gradient(to right, transparent 0, transparent calc(100%/7 - 1px), rgb(229 231 235) calc(100%/7 - 1px), rgb(229 231 235) calc(100%/7))',
              }}
            />
          ))}
          <div className="bg-gray-50 p-2 text-xs font-medium text-gray-500 z-0" style={{ gridColumn: 1, gridRow: 1 }} />
          {weekDates.map((d, i) => (
            <button
              key={`h-${i}`}
              type="button"
              onClick={() => setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}
              className="bg-gray-50 p-2 text-sm font-medium text-gray-700 z-0 text-left w-full hover:bg-gray-100 rounded-t border-b border-transparent hover:border-gray-200 transition-colors"
              style={{ gridColumn: i + 2, gridRow: 1 }}
              title="点击设为当日"
            >
              {DAY_NAMES[i + 1]} {formatDateLabel(d)}
            </button>
          ))}
          {Array.from({ length: GRID_SLOT_COUNT }, (_, row) => (
            <div
              key={`t-${row}`}
              className="bg-white p-1 text-xs text-gray-500 z-0"
              style={{ gridColumn: 1, gridRow: row + 2 }}
            >
              {getSlotLabel(row)}
            </div>
          ))}
          {weekEventsFlat.map(({ day, ev }) => {
            const { gridRowStart, gridRowEnd } = eventToGridRow(ev.start_time, ev.end_time)
            return (
              <div
                key={`c-${ev.id}`}
                className={`relative z-10 rounded border p-1.5 text-xs cursor-pointer transition-colors overflow-hidden min-h-0 ${getCourseColorClasses(ev.courseId)}`}
                style={{
                  gridColumn: day + 1,
                  gridRow: `${gridRowStart} / ${gridRowEnd}`,
                }}
                title={`${ev.courseName} ${ev.sectionName} ${ev.start_time}-${ev.end_time} ${ev.room} 教师: ${ev.teacherName}`}
                onMouseEnter={(e) => {
                  setHoverEvent(ev)
                  setHoverPos({ x: e.clientX, y: e.clientY })
                }}
                onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoverEvent(null)}
                onClick={() => setSelectedEvent(ev)}
              >
                <p className="font-medium text-gray-900 truncate">{ev.courseName}</p>
                <p className="text-gray-600 truncate">{ev.sectionName}</p>
                <p className="text-gray-500 truncate">{ev.start_time}～{ev.end_time} {ev.room}</p>
              </div>
            )
          })}
          {weekPersonalEventsFlat.map(({ day, ev, start_time, end_time }) => {
            const isDragging = dragPersonal?.ev.id === ev.id
            const isResizing = resizePersonal?.ev.id === ev.id
            const showStart = resizePreview && isResizing ? resizePreview.start_time : start_time
            const showEnd = resizePreview && isResizing ? resizePreview.end_time : end_time
            const showDay = isDragging && dragPreview != null ? dragPreview.day + 2 : day + 1
            const showRow = isDragging && dragPreview != null
              ? (() => {
                  const startSlot = dragPreview.slot
                  const durationSlots = Math.max(1, timeToSlotIndex(end_time) - timeToSlotIndex(start_time))
                  const gridRowStart = startSlot + 2
                  const gridRowEnd = Math.min(startSlot + 2 + durationSlots, GRID_SLOT_COUNT + 2)
                  return { gridRowStart, gridRowEnd }
                })()
              : eventToGridRow(showStart, showEnd)
            return (
              <div
                key={`p-${ev.id}`}
                className={`relative z-10 rounded border p-1.5 text-xs cursor-grab active:cursor-grabbing transition-colors overflow-hidden min-h-0 select-none ${getEventColorClasses('personal', ev.id)} ${isDragging ? 'opacity-90 ring-1 ring-primary' : ''} ${isResizing ? 'opacity-90 ring-1 ring-primary/50' : ''}`}
                style={{
                  gridColumn: showDay,
                  gridRow: `${showRow.gridRowStart} / ${showRow.gridRowEnd}`,
                }}
                title={`${ev.title} ${start_time}～${end_time}（可拖拽或拖动边缘调整时间）`}
                onMouseDown={(e) => {
                  if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
                  e.preventDefault()
                  setDragPersonal({
                    ev,
                    day,
                    start_time,
                    end_time,
                    startX: e.clientX,
                    startY: e.clientY,
                  })
                }}
              >
                <div
                  data-resize-handle
                  className="absolute left-0 right-0 top-0 h-2 cursor-n-resize hover:bg-black/10 rounded-t z-10"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setResizePersonal({ ev, edge: 'top', day, start_time, end_time })
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute left-0 right-0 bottom-0 h-2 cursor-s-resize hover:bg-black/10 rounded-b z-10"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setResizePersonal({ ev, edge: 'bottom', day, start_time, end_time })
                  }}
                />
                <p className="font-medium text-gray-900 truncate pt-1">{ev.title}</p>
                <p className="text-gray-500 truncate">{start_time}～{end_time}</p>
              </div>
            )
          })}
        </div>
      )}

      {viewMode === 'month' && (
        <div className="rounded-card shadow-card border border-gray-100 overflow-hidden bg-white">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-medium text-gray-600">
                {DAY_NAMES[d]}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGridDates.flat().map((cellDate, idx) => {
              const dateStr = formatDate(cellDate)
              const info = monthGridEvents[dateStr] ?? { count: 0, courseIds: [], personalEventIds: [] }
              const isCurrentMonth = cellDate.getMonth() === monthStart.getMonth()
              const isToday =
                cellDate.getDate() === new Date().getDate() &&
                cellDate.getMonth() === new Date().getMonth() &&
                cellDate.getFullYear() === new Date().getFullYear()
              const hasEvents = info.count > 0 || (info.personalEventIds?.length ?? 0) > 0
              return (
                <div
                  key={idx}
                  role={hasEvents ? 'button' : undefined}
                  tabIndex={hasEvents ? 0 : undefined}
                  onClick={() => onMonthCellClick(cellDate, hasEvents)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMonthCellClick(cellDate, hasEvents) } }}
                  onMouseEnter={(e) => {
                    setHoverCellDate(cellDate)
                    setHoverCellPos({ x: e.clientX, y: e.clientY })
                  }}
                  onMouseMove={(e) => setHoverCellPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoverCellDate(null)}
                  className={`min-h-[80px] p-2 text-left border-b border-r border-gray-200 transition-colors ${
                    hasEvents ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
                  } ${!isCurrentMonth ? 'bg-gray-50/50 text-gray-400' : 'text-gray-900'} ${isToday ? 'ring-1 ring-primary ring-inset bg-primary-light/30' : ''}`}
                >
                  <span className="text-sm font-medium">{cellDate.getDate()}</span>
                  {(info.count > 0 || (info.personalEventIds?.length ?? 0) > 0) && (
                    <div className="mt-1 flex flex-wrap gap-0.5 items-center">
                      {info.courseIds.slice(0, 4).map((cid) => (
                        <span
                          key={`c-${cid}`}
                          className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${getCourseColorClasses(cid).split(' ')[0]}`}
                          title="课程"
                        />
                      ))}
                      {(info.personalEventIds ?? []).slice(0, 3).map((pid) => (
                        <span
                          key={`p-${pid}`}
                          className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${getEventColorClasses('personal', pid).split(' ')[0]}`}
                          title="个人"
                        />
                      ))}
                      <span className="text-xs text-gray-500 ml-0.5">
                        {[info.count > 0 && `${info.count} 节`, (info.personalEventIds?.length ?? 0) > 0 && `${info.personalEventIds!.length} 项`].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 当日事件：课程 + 个人事件，与 selectedDate 联动 */}
      <section className="mt-6 bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-medium text-gray-900">
            {formatDateFull(selectedDate)} 当日事件
          </h2>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFormTitle('')
                setFormDate(formatDate(selectedDate))
                setFormStartTime('09:00')
                setFormEndTime('10:00')
                setSelectedPersonalEvent(null)
                setPersonalEventFormOpen('new')
              }}
              className="text-sm text-primary hover:text-primary-hover font-medium"
            >
              新建事件
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              今天
            </button>
          </span>
        </div>
        {dayPanelItems.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-500">
            当日暂无课程或事件
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {dayPanelItems.map((item) =>
              item.type === 'course' ? (
                <li
                  key={`c-${item.ev.id}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedEvent(item.ev)}
                >
                  <span className="text-sm font-medium text-gray-600 shrink-0 w-20">
                    {item.ev.start_time}～{item.ev.end_time}
                  </span>
                  <span className="font-medium text-gray-900">{item.ev.courseName}</span>
                  <span className="text-sm text-gray-500">{item.ev.sectionName}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">课程</span>
                </li>
              ) : (
                <li
                  key={`p-${item.ev.id}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors group"
                >
                  <button
                    type="button"
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => {
                      setSelectedPersonalEvent(item.ev)
                      setFormTitle(item.ev.title)
                      setFormDate(formatDate(new Date(item.ev.start_at)))
                      setFormStartTime(timeStrFromISO(item.ev.start_at))
                      setFormEndTime(timeStrFromISO(item.ev.end_at))
                      setPersonalEventFormOpen('edit')
                    }}
                  >
                    <span className="text-sm font-medium text-gray-600 shrink-0 w-20">
                      {item.start_time}～{item.end_time}
                    </span>
                    <span className="font-medium text-gray-900 truncate">{item.ev.title}</span>
                    <span className="text-xs text-gray-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">个人</span>
                  </button>
                  <span className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="text-primary text-xs font-medium hover:underline"
                      onClick={() => {
                        setSelectedPersonalEvent(item.ev)
                        setFormTitle(item.ev.title)
                        setFormDate(formatDate(new Date(item.ev.start_at)))
                        setFormStartTime(timeStrFromISO(item.ev.start_at))
                        setFormEndTime(timeStrFromISO(item.ev.end_at))
                        setPersonalEventFormOpen('edit')
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="text-red-600 text-xs font-medium hover:underline"
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm('确定删除该事件？')) return
                        await createClient().from('student_personal_event').delete().eq('id', item.ev.id)
                        await refreshPersonalEvents()
                      }}
                    >
                      删除
                    </button>
                  </span>
                </li>
              )
            )}
          </ul>
        )}
      </section>

      {viewMode === 'month' && hoverCellDate && (() => {
        const courseList = getDayEventsForDate(scheduleRows, hoverCellDate)
        const hoverStr = formatDate(hoverCellDate)
        const personalList = personalEvents.filter((pe) => {
          const startD = formatDate(new Date(pe.start_at))
          const endD = formatDate(new Date(pe.end_at))
          return hoverStr >= startD && hoverStr <= endD
        })
        const hasAny = courseList.length > 0 || personalList.length > 0
        return (
          <div
            className="fixed z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded shadow-lg pointer-events-none max-w-xs"
            style={{ left: hoverCellPos.x + 12, top: hoverCellPos.y + 8 }}
          >
            <p className="font-medium text-gray-100 mb-1">{formatDateFull(hoverCellDate)}</p>
            {!hasAny ? (
              <p className="text-gray-400">当日暂无课程或事件</p>
            ) : (
              <ul className="space-y-0.5">
                {courseList.map((ev) => (
                  <li key={`c-${ev.id}`}>{ev.courseName} {ev.start_time}～{ev.end_time}</li>
                ))}
                {personalList.map((pe) => (
                  <li key={`p-${pe.id}`}>{pe.title} {timeStrFromISO(pe.start_at)}～{timeStrFromISO(pe.end_at)}</li>
                ))}
              </ul>
            )}
          </div>
        )
      })()}

      {viewMode === 'month' && selectedCellDate && (() => {
        const courseList = getDayEventsForDate(scheduleRows, selectedCellDate)
        const cellStr = formatDate(selectedCellDate)
        const personalList = personalEvents.filter((pe) => {
          const startD = formatDate(new Date(pe.start_at))
          const endD = formatDate(new Date(pe.end_at))
          return cellStr >= startD && cellStr <= endD
        })
        const hasAny = courseList.length > 0 || personalList.length > 0
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setSelectedCellDate(null)}
          >
            <div
              className="bg-white rounded-card shadow-card p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{formatDateFull(selectedCellDate)}</h3>
              {!hasAny ? (
                <p className="text-gray-500 text-sm">当日暂无课程或事件</p>
              ) : (
                <ul className="space-y-2 text-sm text-gray-800 mb-4">
                  {courseList.map((ev) => (
                    <li key={`c-${ev.id}`} className="flex justify-between gap-2">
                      <span className="font-medium">{ev.courseName}</span>
                      <span className="text-gray-600">{ev.start_time}～{ev.end_time}</span>
                    </li>
                  ))}
                  {personalList.map((pe) => (
                    <li key={`p-${pe.id}`} className="flex justify-between gap-2 items-center">
                      <span className="font-medium">{pe.title}</span>
                      <span className="text-gray-600">{timeStrFromISO(pe.start_at)}～{timeStrFromISO(pe.end_at)}</span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          className="text-primary text-xs font-medium hover:underline"
                          onClick={() => {
                            setSelectedCellDate(null)
                            setSelectedPersonalEvent(pe)
                            setFormTitle(pe.title)
                            setFormDate(formatDate(new Date(pe.start_at)))
                            setFormStartTime(timeStrFromISO(pe.start_at))
                            setFormEndTime(timeStrFromISO(pe.end_at))
                            setPersonalEventFormOpen('edit')
                          }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="text-red-600 text-xs font-medium hover:underline"
                          onClick={async () => {
                            if (!confirm('确定删除该事件？')) return
                            await createClient().from('student_personal_event').delete().eq('id', pe.id)
                            await refreshPersonalEvents()
                            setSelectedCellDate(null)
                          }}
                        >
                          删除
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCellDate(null)
                    setFormTitle('')
                    setFormDate(formatDate(selectedCellDate))
                    setFormStartTime('09:00')
                    setFormEndTime('10:00')
                    setSelectedPersonalEvent(null)
                    setPersonalEventFormOpen('new')
                  }}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-card hover:bg-primary-hover"
                >
                  新建事件
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCellDate(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {hoverEvent && (
        <div
          className="fixed z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded shadow-lg pointer-events-none max-w-xs"
          style={{ left: hoverPos.x + 12, top: hoverPos.y + 8 }}
        >
          <p className="font-medium">{hoverEvent.courseName}</p>
          <p>{hoverEvent.sectionName} · {hoverEvent.room}</p>
          <p>{hoverEvent.start_time}～{hoverEvent.end_time}</p>
          <p className="text-gray-300">教师：{hoverEvent.teacherName}</p>
          <p className="text-gray-400 text-xs">有效期：{hoverEvent.valid_from} 至 {hoverEvent.valid_to}</p>
        </div>
      )}

      {personalEventFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPersonalEventFormOpen(null)}
        >
          <div
            className="bg-white rounded-card shadow-card p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {personalEventFormOpen === 'new' ? '新建个人事件' : '编辑个人事件'}
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-gray-600 mb-1">标题</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-card"
                  placeholder="事件标题"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">日期</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-card"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">开始时间</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-card"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">结束时间</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-card"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 flex-wrap">
              {personalEventFormOpen === 'edit' && selectedPersonalEvent && (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-red-700 bg-red-100 rounded-card hover:bg-red-200"
                  onClick={async () => {
                    if (!confirm('确定删除该事件？')) return
                    await createClient().from('student_personal_event').delete().eq('id', selectedPersonalEvent.id)
                    await refreshPersonalEvents()
                    setPersonalEventFormOpen(null)
                    setSelectedPersonalEvent(null)
                  }}
                >
                  删除
                </button>
              )}
              <button
                type="button"
                className="px-4 py-2 text-sm border border-gray-300 rounded-card hover:bg-gray-50"
                onClick={() => setPersonalEventFormOpen(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm bg-primary text-white rounded-card hover:bg-primary-hover"
                onClick={async () => {
                  const title = formTitle.trim()
                  if (!title) {
                    alert('请输入标题')
                    return
                  }
                  const startAt = new Date(formDate + 'T' + formStartTime + ':00')
                  const endAt = new Date(formDate + 'T' + formEndTime + ':00')
                  if (endAt <= startAt) {
                    alert('结束时间须晚于开始时间')
                    return
                  }
                  const supabase = createClient()
                  if (personalEventFormOpen === 'new' && user?.profile_id) {
                    const { error: e } = await supabase
                      .from('student_personal_event')
                      .insert({ student_id: user.profile_id, title, start_at: startAt.toISOString(), end_at: endAt.toISOString() })
                    if (e) {
                      alert(e.message || '创建失败')
                      return
                    }
                  } else if (personalEventFormOpen === 'edit' && selectedPersonalEvent) {
                    const { error: e } = await supabase
                      .from('student_personal_event')
                      .update({ title, start_at: startAt.toISOString(), end_at: endAt.toISOString() })
                      .eq('id', selectedPersonalEvent.id)
                    if (e) {
                      alert(e.message || '保存失败')
                      return
                    }
                  }
                  await refreshPersonalEvents()
                  setPersonalEventFormOpen(null)
                  setSelectedPersonalEvent(null)
                }}
              >
                {personalEventFormOpen === 'new' ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-card shadow-card p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">课程详情</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">课程</dt>
                <dd className="font-medium text-gray-900">{selectedEvent.courseName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">班级</dt>
                <dd className="text-gray-900">{selectedEvent.sectionName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">时间</dt>
                <dd className="text-gray-900">{selectedEvent.start_time}～{selectedEvent.end_time}</dd>
              </div>
              <div>
                <dt className="text-gray-500">教室</dt>
                <dd className="text-gray-900">{selectedEvent.room}</dd>
              </div>
              <div>
                <dt className="text-gray-500">授课教师</dt>
                <dd className="text-gray-900">{selectedEvent.teacherName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">有效期</dt>
                <dd className="text-gray-900">{selectedEvent.valid_from} 至 {selectedEvent.valid_to}</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
