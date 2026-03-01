'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Section = { id: number; name: string; code: string | null; course_id: number }
type Course = { id: number; name: string; code: string | null; teacher_id: number }
type Teacher = { id: number; name: string; employee_no: string | null }
type EnrollmentRow = {
  id: number
  section_id: number
  section: (Section & { course_id: number; course: (Course & { teacher: Teacher | null }) | null }) | null
}

type MyCourseItem = { courseId: number; courseName: string; sectionName: string; teacherName: string }

export default function StudentPage() {
  const { user } = useAuth()
  const [myCourses, setMyCourses] = useState<MyCourseItem[]>([])
  const [recentAnnouncements, setRecentAnnouncements] = useState<{ id: number; title: string; created_at: string; published_at: string | null }[]>([])
  const [pendingTaskCount, setPendingTaskCount] = useState<number | null>(null)
  const [pendingGroupCount, setPendingGroupCount] = useState<number | null>(null)
  const [recentGrades, setRecentGrades] = useState<{ task_title: string; course_name: string; score: number | null; graded_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  function formatDate(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  useEffect(() => {
    if (!user || user.role !== 'student' || user.profile_id == null) {
      setLoading(false)
      return
    }
    let cancelled = false
    const supabase = createClient()
    async function fetchData() {
      try {
        const [enrollRes, recentRes] = await Promise.all([
          supabase
            .from('enrollment')
            .select(`
              id,
              section_id,
              section:section_id(
                name,
                code,
                course_id,
                course:course_id(id, name, code, teacher_id, teacher:teacher_id(name, employee_no))
              )
            `)
            .eq('student_id', user.profile_id),
          supabase
            .from('announcement')
            .select('id, title, created_at, published_at')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(5),
        ])
        if (cancelled) return
        if (enrollRes.error) throw enrollRes.error
        if (recentRes.error) throw recentRes.error
        const rows = (enrollRes.data ?? []) as EnrollmentRow[]
        const items: MyCourseItem[] = rows
          .filter((r) => r.section?.course)
          .map((r) => ({
            courseId: r.section!.course!.id,
            courseName: r.section!.course!.name,
            sectionName: r.section!.name,
            teacherName: r.section!.course!.teacher?.name ?? '—',
          }))
        setMyCourses(items)
        setRecentAnnouncements((recentRes.data ?? []) as { id: number; title: string; created_at: string; published_at: string | null }[])

        const courseIds = [...new Set(items.map((i) => i.courseId))]
        if (courseIds.length > 0) {
          const now = new Date().toISOString()
          const { data: taskData } = await supabase
            .from('task')
            .select('id, course_id, allow_group')
            .in('course_id', courseIds)
            .gt('due_at', now)
          const tasks = (taskData ?? []) as { id: number; course_id: number; allow_group: boolean }[]
          const taskIds = tasks.map((t) => t.id)

          let myGroupIds: number[] = []
          const { data: enrollSections } = await supabase
            .from('enrollment')
            .select('section_id')
            .eq('student_id', user.profile_id)
          const sectionIds = [...new Set((enrollSections ?? []).map((r: { section_id: number }) => r.section_id))]
          if (sectionIds.length > 0) {
            const { data: groupData } = await supabase.from('group').select('id').in('section_id', sectionIds)
            const allGroupIds = (groupData ?? []).map((g: { id: number }) => g.id)
            if (allGroupIds.length > 0) {
              const { data: memData } = await supabase
                .from('group_member')
                .select('group_id')
                .eq('student_id', user.profile_id)
                .in('group_id', allGroupIds)
              myGroupIds = (memData ?? []).map((m: { group_id: number }) => m.group_id)
            }
          }

          let submittedTaskIds = new Set<number>()
          if (taskIds.length > 0) {
            const { data: subByStudent } = await supabase
              .from('submission')
              .select('task_id')
              .in('task_id', taskIds)
              .eq('student_id', user.profile_id)
            for (const r of subByStudent ?? []) submittedTaskIds.add((r as { task_id: number }).task_id)
            if (myGroupIds.length > 0) {
              const { data: subByGroup } = await supabase
                .from('submission')
                .select('task_id')
                .in('task_id', taskIds)
                .in('group_id', myGroupIds)
              for (const r of subByGroup ?? []) submittedTaskIds.add((r as { task_id: number }).task_id)
            }
          }

          const pendingCount = tasks.filter((t) => !submittedTaskIds.has(t.id)).length
          setPendingTaskCount(pendingCount)

          const sectionToCourse: Record<number, number> = {}
          const { data: secData } = await supabase.from('section').select('id, course_id').in('id', sectionIds)
          for (const s of secData ?? []) {
            const row = s as { id: number; course_id: number }
            sectionToCourse[row.id] = row.course_id
          }
          const myGroupBySection: Record<number, number> = {}
          if (myGroupIds.length > 0) {
            const { data: gData } = await supabase.from('group').select('id, section_id').in('id', myGroupIds)
            for (const g of gData ?? []) {
              const row = g as { id: number; section_id: number }
              myGroupBySection[row.section_id] = row.id
            }
          }
          const courseHasGroup = (courseId: number) => {
            const sids = sectionIds.filter((sid) => sectionToCourse[sid] === courseId)
            return sids.some((sid) => myGroupBySection[sid])
          }
          const pendingGroup = tasks.filter(
            (t) => t.allow_group && !submittedTaskIds.has(t.id) && !courseHasGroup(t.course_id)
          ).length
          setPendingGroupCount(pendingGroup)

          const { data: gradedByStudent } = await supabase
            .from('submission')
            .select('task_id, score, graded_at')
            .eq('student_id', user.profile_id)
            .eq('status', 'graded')
            .not('graded_at', 'is', null)
            .order('graded_at', { ascending: false })
            .limit(5)
          let graded = (gradedByStudent ?? []) as { task_id: number; score: number | null; graded_at: string }[]
          if (myGroupIds.length > 0) {
            const { data: gradedByGroup } = await supabase
              .from('submission')
              .select('task_id, score, graded_at')
              .in('group_id', myGroupIds)
              .eq('status', 'graded')
              .not('graded_at', 'is', null)
              .order('graded_at', { ascending: false })
              .limit(5)
            const fromGroup = (gradedByGroup ?? []) as { task_id: number; score: number | null; graded_at: string }[]
            graded = [...graded, ...fromGroup]
              .sort((a, b) => new Date(b.graded_at).getTime() - new Date(a.graded_at).getTime())
              .slice(0, 5)
          }
          if (graded.length > 0) {
            const tids = [...new Set(graded.map((g) => g.task_id))]
            const { data: taskRows } = await supabase.from('task').select('id, title, course_id').in('id', tids)
            const taskMap = Object.fromEntries(
              ((taskRows ?? []) as { id: number; title: string; course_id: number }[]).map((t) => [t.id, t])
            )
            const cids = [...new Set(Object.values(taskMap).map((t) => t.course_id))]
            const { data: courseRows } = await supabase.from('course').select('id, name').in('id', cids)
            const courseMap = Object.fromEntries(
              ((courseRows ?? []) as { id: number; name: string }[]).map((c) => [c.id, c.name])
            )
            setRecentGrades(
              graded.map((g) => {
                const t = taskMap[g.task_id]
                return {
                  task_title: t?.title ?? '—',
                  course_name: t ? courseMap[t.course_id] ?? '—' : '—',
                  score: g.score,
                  graded_at: g.graded_at,
                }
              })
            )
          } else {
            setRecentGrades([])
          }
        } else {
          setPendingTaskCount(0)
          setPendingGroupCount(0)
          setRecentGrades([])
        }
      } catch {
        setMyCourses([])
        setRecentAnnouncements([])
        setPendingTaskCount(0)
        setPendingGroupCount(0)
        setRecentGrades([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [user])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">工作台</h1>

      {/* 我的课程 */}
      <section className="mb-8">
        <h2 className="text-base font-medium text-gray-900 mb-3">我的课程</h2>
        {loading ? (
          <p className="text-gray-500">加载中…</p>
        ) : myCourses.length === 0 ? (
          <div className="bg-white rounded-card shadow-card border border-gray-100 p-6 text-center text-sm text-gray-500">
            暂无选课
          </div>
        ) : (
          <ul className="space-y-2">
            {myCourses.map((item, i) => (
              <li key={`${item.courseId}-${item.sectionName}-${i}`}>
                <Link
                  href={`/student/courses/${item.courseId}`}
                  className="block bg-white rounded-card shadow-card border border-gray-100 p-4 hover:shadow-card-hover hover:bg-gray-50 transition-all"
                >
                  <span className="font-medium text-gray-900">{item.courseName}</span>
                  <span className="text-gray-500 text-sm ml-2">（{item.sectionName}）</span>
                  <span className="text-gray-400 text-sm ml-2">— {item.teacherName}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 待办提醒 */}
      <section className="mb-8">
        <h2 className="text-base font-medium text-gray-900 mb-3">待办提醒</h2>
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-5">
          {loading ? (
            <p className="text-sm text-gray-500">加载中…</p>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-500">待完成任务：</span>
                <span className="font-medium text-gray-900">{pendingTaskCount ?? 0}</span>
                <span className="text-gray-500 ml-1">（未提交且未过期）</span>
              </div>
              <div>
                <span className="text-gray-500">待组队：</span>
                <span className="font-medium text-gray-900">{pendingGroupCount ?? 0}</span>
                <span className="text-gray-500 ml-1">（需组队且未加入）</span>
              </div>
            </div>
          )}
          {(pendingTaskCount ?? 0) > 0 && (
            <Link
              href="/student/courses"
              className="inline-block mt-3 text-sm text-primary hover:text-primary-hover"
            >
              去我的课程查看任务 →
            </Link>
          )}
        </div>
      </section>

      {/* 最近成绩（可选） */}
      {recentGrades.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-gray-900">最近成绩</h2>
            <Link href="/student/courses" className="text-sm text-primary hover:text-primary-hover">
              我的课程
            </Link>
          </div>
          <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {recentGrades.map((g, i) => (
                <li key={i} className="px-4 py-3 flex justify-between items-center">
                  <span className="font-medium text-gray-900">{g.task_title}</span>
                  <span className="text-gray-500 text-sm">{g.course_name}</span>
                  <span className="text-primary font-medium">{g.score != null ? `${g.score} 分` : '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 教务处公告 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-gray-900">教务处公告</h2>
          <Link
            href="/student/announcements"
            className="text-sm text-primary hover:text-primary-hover transition-colors"
          >
            查看全部
          </Link>
        </div>
        <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
          {recentAnnouncements.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">暂无公告</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentAnnouncements.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/student/announcements/${a.id}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-900">{a.title}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      {formatDate(a.published_at ?? a.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 快捷入口 */}
      <section>
        <h2 className="text-base font-medium text-gray-900 mb-3">快捷入口</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/student/courses"
            className="inline-flex items-center px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover transition-colors"
          >
            我的课程
          </Link>
          <Link
            href="/student/announcements"
            className="inline-flex items-center px-4 py-2.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-card hover:bg-gray-200 transition-colors"
          >
            教务处公告
          </Link>
        </div>
      </section>
    </div>
  )
}
