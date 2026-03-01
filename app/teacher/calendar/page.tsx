'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { getCourseColorClasses } from '@/lib/calendarColors'
import { GRID_SLOT_COUNT, getSlotLabel, eventToGridRow } from '@/lib/calendarGrid'

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
    course: { name: string } | null
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

function getDayOfWeek(d: Date): number {
  const day = d.getDay()
  return day === 0 ? 7 : day
}

function formatDateFull(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${DAY_NAMES[getDayOfWeek(d)]}`
}

function getMonthStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}

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
    })
  }
  list.sort((a, b) => a.start_time.localeCompare(b.start_time))
  return list
}

export default function TeacherCalendarPage() {
  const { user } = useAuth()
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'month'>('week')
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

  useEffect(() => {
    if (!user || user.role !== 'teacher' || user.profile_id == null) {
      setLoading(false)
      return
    }
    const teacherId = user.profile_id
    let cancelled = false
    const supabase = createClient()
    async function fetchSchedules() {
      try {
        const { data: courseData, error: e0 } = await supabase
          .from('course')
          .select('id')
          .eq('teacher_id', teacherId)
        if (cancelled || e0) throw e0
        const courseIds = (courseData ?? []).map((r: { id: number }) => r.id)
        if (courseIds.length === 0) {
          setScheduleRows([])
          setLoading(false)
          return
        }
        const { data: sectionData, error: e1 } = await supabase
          .from('section')
          .select('id')
          .in('course_id', courseIds)
        if (cancelled || e1) throw e1
        const sectionIds = (sectionData ?? []).map((r: { id: number }) => r.id)
        if (sectionIds.length === 0) {
          setScheduleRows([])
          setLoading(false)
          return
        }
        const { data: schedData, error: e2 } = await supabase
          .from('section_schedule')
          .select(`
            id, section_id, day_of_week, start_time, end_time, room, valid_from, valid_to,
            section:section_id(name, course_id, course:course_id(name))
          `)
          .in('section_id', sectionIds)
        if (cancelled || e2) throw e2
        setScheduleRows((schedData ?? []) as unknown as ScheduleRow[])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchSchedules()
    return () => { cancelled = true }
  }, [user])

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
      })
    }
    list.sort((a, b) => a.start_time.localeCompare(b.start_time))
    return list
  }, [scheduleRows, selectedDate])

  const monthGridDates = useMemo(() => getMonthGridDates(monthStart), [monthStart])
  const monthGridEvents = useMemo(() => {
    const map: Record<string, { count: number; courseIds: number[] }> = {}
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
        map[dateStr] = { count, courseIds }
      }
    }
    return map
  }, [scheduleRows, monthGridDates])

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

  const goPrevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d)
  }
  const goNextDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d)
  }
  const goToday = () => {
    setSelectedDate(new Date())
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
  const openDayViewFromCell = () => {
    if (!selectedCellDate) return
    setSelectedDate(new Date(selectedCellDate.getFullYear(), selectedCellDate.getMonth(), selectedCellDate.getDate()))
    setViewMode('day')
    setSelectedCellDate(null)
  }

  if (!user || user.role !== 'teacher') return null

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">我的课表</h1>
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">我的课表</h1>
        <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">我的课表</h1>
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
          onClick={() => setViewMode('day')}
          className={`px-3 py-1.5 text-sm border rounded ${viewMode === 'day' ? 'bg-gray-200 border-gray-400' : 'border-gray-300 hover:bg-gray-50'}`}
        >
          日
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
        {viewMode === 'day' && (
          <>
            <button
              type="button"
              onClick={goPrevDay}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              上一日
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              今天
            </button>
            <button
              type="button"
              onClick={goNextDay}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              下一日
            </button>
            <span className="text-sm font-medium text-gray-700">{formatDateFull(selectedDate)}</span>
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
            <div key={`h-${i}`} className="bg-gray-50 p-2 text-sm font-medium text-gray-700 z-0" style={{ gridColumn: i + 2, gridRow: 1 }}>
              {DAY_NAMES[i + 1]} {formatDateLabel(d)}
            </div>
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
                key={ev.id}
                className={`relative z-10 rounded border p-1.5 text-xs cursor-pointer transition-colors overflow-hidden min-h-0 ${getCourseColorClasses(ev.courseId)}`}
                style={{
                  gridColumn: day + 1,
                  gridRow: `${gridRowStart} / ${gridRowEnd}`,
                }}
                title={`${ev.courseName} ${ev.sectionName} ${ev.start_time}-${ev.end_time} ${ev.room}`}
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
        </div>
      )}

      {viewMode === 'day' && (
        <div
          className="grid gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200 min-h-[480px]"
          style={{
            gridTemplateColumns: '48px 1fr',
            gridTemplateRows: `auto repeat(${GRID_SLOT_COUNT}, minmax(24px, 1fr))`,
          }}
        >
          {Array.from({ length: GRID_SLOT_COUNT }, (_, row) => (
            <div
              key={`day-grid-${row}`}
              className="z-0 border-b border-gray-200 bg-white"
              style={{ gridColumn: 2, gridRow: row + 2 }}
            />
          ))}
          <div className="bg-gray-50 p-2 text-xs font-medium text-gray-500 z-0" style={{ gridColumn: 1, gridRow: 1 }} />
          <div className="bg-gray-50 p-2 text-sm font-medium text-gray-700 z-0" style={{ gridColumn: 2, gridRow: 1 }}>
            {formatDateFull(selectedDate)}
          </div>
          {Array.from({ length: GRID_SLOT_COUNT }, (_, row) => (
            <div
              key={`day-t-${row}`}
              className="bg-white p-1 text-xs text-gray-500 z-0"
              style={{ gridColumn: 1, gridRow: row + 2 }}
            >
              {getSlotLabel(row)}
            </div>
          ))}
          {dayEvents.length === 0 ? (
            <div className="z-10 flex items-center justify-center text-gray-500 text-sm bg-white" style={{ gridColumn: 2, gridRow: `2 / ${GRID_SLOT_COUNT + 2}` }}>
              当日暂无课程
            </div>
          ) : (
            dayEvents.map((ev) => {
              const { gridRowStart, gridRowEnd } = eventToGridRow(ev.start_time, ev.end_time)
              return (
                <div
                  key={ev.id}
                  className={`relative z-10 rounded border p-1.5 text-xs cursor-pointer transition-colors overflow-hidden min-h-0 ${getCourseColorClasses(ev.courseId)}`}
                  style={{
                    gridColumn: 2,
                    gridRow: `${gridRowStart} / ${gridRowEnd}`,
                  }}
                  title={`${ev.courseName} ${ev.sectionName} ${ev.start_time}-${ev.end_time} ${ev.room}`}
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
            })
          )}
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
              const info = monthGridEvents[dateStr] ?? { count: 0, courseIds: [] }
              const isCurrentMonth = cellDate.getMonth() === monthStart.getMonth()
              const isToday =
                cellDate.getDate() === new Date().getDate() &&
                cellDate.getMonth() === new Date().getMonth() &&
                cellDate.getFullYear() === new Date().getFullYear()
              const hasEvents = info.count > 0
              return (
                <div
                  key={idx}
                  role={hasEvents ? 'button' : undefined}
                  tabIndex={hasEvents ? 0 : undefined}
                  onClick={hasEvents ? () => setSelectedCellDate(cellDate) : undefined}
                  onKeyDown={hasEvents ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCellDate(cellDate) } } : undefined}
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
                  {info.count > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5 items-center">
                      {info.courseIds.slice(0, 4).map((cid) => (
                        <span
                          key={cid}
                          className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${getCourseColorClasses(cid).split(' ')[0]}`}
                          title={`${info.count} 节`}
                        />
                      ))}
                      {info.courseIds.length > 4 && (
                        <span className="text-xs text-gray-500">+{info.courseIds.length - 4}</span>
                      )}
                      <span className="text-xs text-gray-500 ml-0.5">{info.count} 节</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {viewMode === 'month' && hoverCellDate && (
        <div
          className="fixed z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded shadow-lg pointer-events-none max-w-xs"
          style={{ left: hoverCellPos.x + 12, top: hoverCellPos.y + 8 }}
        >
          <p className="font-medium text-gray-100 mb-1">{formatDateFull(hoverCellDate)}</p>
          {getDayEventsForDate(scheduleRows, hoverCellDate).length === 0 ? (
            <p className="text-gray-400">当日暂无课程</p>
          ) : (
            <ul className="space-y-0.5">
              {getDayEventsForDate(scheduleRows, hoverCellDate).map((ev) => (
                <li key={ev.id}>{ev.courseName} {ev.start_time}～{ev.end_time}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {viewMode === 'month' && selectedCellDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedCellDate(null)}
        >
          <div
            className="bg-white rounded-card shadow-card p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{formatDateFull(selectedCellDate)}</h3>
            {getDayEventsForDate(scheduleRows, selectedCellDate).length === 0 ? (
              <p className="text-gray-500 text-sm">当日暂无课程</p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-800 mb-4">
                {getDayEventsForDate(scheduleRows, selectedCellDate).map((ev) => (
                  <li key={ev.id} className="flex justify-between gap-2">
                    <span className="font-medium">{ev.courseName}</span>
                    <span className="text-gray-600">{ev.start_time}～{ev.end_time}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedCellDate(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                关闭
              </button>
              {getDayEventsForDate(scheduleRows, selectedCellDate).length > 0 && (
                <button
                  type="button"
                  onClick={openDayViewFromCell}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-card hover:bg-primary-hover transition-colors"
                >
                  进入日视图
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {hoverEvent && (
        <div
          className="fixed z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded shadow-lg pointer-events-none max-w-xs"
          style={{ left: hoverPos.x + 12, top: hoverPos.y + 8 }}
        >
          <p className="font-medium">{hoverEvent.courseName}</p>
          <p>{hoverEvent.sectionName} · {hoverEvent.room}</p>
          <p>{hoverEvent.start_time}～{hoverEvent.end_time}</p>
          <p className="text-gray-400 text-xs">有效期：{hoverEvent.valid_from} 至 {hoverEvent.valid_to}</p>
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
