'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

type Major = { id: number; name: string; code: string | null }
type Teacher = { id: number; name: string; employee_no: string | null }
type Course = {
  id: number
  name: string
  code: string | null
  description: string | null
  major_id: number
  teacher_id: number
  major: Major | null
  teacher: Teacher | null
}
type Section = {
  id: number
  name: string
  code: string | null
  course_id: number
}
type Schedule = {
  id: number
  section_id: number
  day_of_week: number
  start_time: string
  end_time: string
  room: string
  valid_from: string
  valid_to: string
}
type Student = { id: number; name: string; student_no: string }
type EnrollmentWithStudent = { id: number; section_id: number; student: Student | null }

type GroupWithMembers = { id: number; name: string; leader_id: number; members: Student[] }

type Task = {
  id: number
  course_id: number
  title: string
  description: string | null
  due_at: string
  allow_group: boolean
  group_min: number | null
  group_max: number | null
  group_deadline: string | null
  created_at: string
  updated_at: string
}

type TabKey = 'sections' | 'students' | 'tasks' | 'groups'

export default function TeacherCourseDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [schedulesBySection, setSchedulesBySection] = useState<Record<number, Schedule[]>>({})
  const [enrollmentCountBySection, setEnrollmentCountBySection] = useState<Record<number, number>>({})
  const [studentsBySection, setStudentsBySection] = useState<Record<number, { id: number; name: string; student_no: string }[]>>({})
  const [groupsBySection, setGroupsBySection] = useState<Record<number, GroupWithMembers[]>>({})
  const [tasks, setTasks] = useState<Task[]>([])
  const [submissionCountByTaskId, setSubmissionCountByTaskId] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('sections')

  // 支持 ?tab=tasks 从发布任务页跳回时定位到任务列表
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'tasks' || tab === 'groups' || tab === 'sections' || tab === 'students') {
      setActiveTab(tab as TabKey)
    }
  }, [searchParams])

  useEffect(() => {
    const courseId = parseInt(id, 10)
    if (Number.isNaN(courseId)) {
      setError('无效的课程 ID')
      setLoading(false)
      return
    }
    if (!user || user.role !== 'teacher' || user.profile_id == null) {
      setLoading(false)
      return
    }

    const teacherId = user.profile_id
    let cancelled = false
    const supabase = createClient()

    async function fetchDetail() {
      try {
        const { data: courseData, error: courseErr } = await supabase
          .from('course')
          .select('id, name, code, description, major_id, teacher_id, major:major_id(id, name, code), teacher:teacher_id(id, name, employee_no)')
          .eq('id', courseId)
          .eq('teacher_id', teacherId)
          .single()
        if (cancelled) return
        if (courseErr || !courseData) {
          if (courseErr?.code === 'PGRST116') setError('课程不存在或您无权限查看')
          else setError(courseErr?.message ?? '加载失败')
          setLoading(false)
          return
        }
        setCourse(courseData as unknown as Course)

        const { data: sectionData, error: sectionErr } = await supabase
          .from('section')
          .select('id, name, code, course_id')
          .eq('course_id', courseId)
          .order('id')
        if (cancelled) return
        if (sectionErr) throw sectionErr
        const sectionList = (sectionData ?? []) as Section[]
        setSections(sectionList)

        if (sectionList.length === 0) {
          setSchedulesBySection({})
          setEnrollmentCountBySection({})
          setStudentsBySection({})
          setLoading(false)
          return
        }

        const sectionIds = sectionList.map((s) => s.id)
        const [schedRes, enrollRes] = await Promise.all([
          supabase
            .from('section_schedule')
            .select('id, section_id, day_of_week, start_time, end_time, room, valid_from, valid_to')
            .in('section_id', sectionIds)
            .order('day_of_week')
            .order('start_time'),
          supabase
            .from('enrollment')
            .select('id, section_id, student:student_id(id, name, student_no)')
            .in('section_id', sectionIds),
        ])
        if (cancelled) return
        if (schedRes.error) throw schedRes.error
        if (enrollRes.error) throw enrollRes.error

        const schedules = (schedRes.data ?? []) as Schedule[]
        const bySection: Record<number, Schedule[]> = {}
        for (const s of schedules) {
          if (!bySection[s.section_id]) bySection[s.section_id] = []
          bySection[s.section_id].push(s)
        }
        setSchedulesBySection(bySection)

        const enrollments = (enrollRes.data ?? []) as unknown as EnrollmentWithStudent[]
        const countBySection: Record<number, number> = {}
        const studentsBySectionMap: Record<number, { id: number; name: string; student_no: string }[]> = {}
        for (const sid of sectionIds) {
          countBySection[sid] = 0
          studentsBySectionMap[sid] = []
        }
        for (const e of enrollments) {
          countBySection[e.section_id] = (countBySection[e.section_id] ?? 0) + 1
          if (e.student) {
            studentsBySectionMap[e.section_id].push({
              id: e.student.id,
              name: e.student.name,
              student_no: e.student.student_no,
            })
          }
        }
        setEnrollmentCountBySection(countBySection)
        setStudentsBySection(studentsBySectionMap)

        const groupsRes = await supabase
          .from('group')
          .select('id, name, leader_id, section_id')
          .in('section_id', sectionIds)
        if (!cancelled && groupsRes.error) throw groupsRes.error
        const groups = (groupsRes.data ?? []) as { id: number; name: string; leader_id: number; section_id: number }[]
        if (groups.length > 0) {
          const groupIds = groups.map((g) => g.id)
          const membersRes = await supabase
            .from('group_member')
            .select('group_id, student:student_id(id, name, student_no)')
            .in('group_id', groupIds)
          if (!cancelled && membersRes.error) throw membersRes.error
          const membersRaw = (membersRes.data ?? []) as unknown as { group_id: number; student: Student | null }[]
          const membersByGroup: Record<number, Student[]> = {}
          for (const g of groups) membersByGroup[g.id] = []
          for (const m of membersRaw) {
            if (m.student) membersByGroup[m.group_id].push(m.student)
          }
          const bySection: Record<number, GroupWithMembers[]> = {}
          for (const g of groups) {
            if (!bySection[g.section_id]) bySection[g.section_id] = []
            bySection[g.section_id].push({
              id: g.id,
              name: g.name,
              leader_id: g.leader_id,
              members: membersByGroup[g.id] ?? [],
            })
          }
          setGroupsBySection(bySection)
        } else {
          setGroupsBySection({})
        }

        const { data: taskData, error: taskErr } = await supabase
          .from('task')
          .select('id, course_id, title, description, due_at, allow_group, group_min, group_max, group_deadline, created_at, updated_at')
          .eq('course_id', courseId)
          .order('due_at', { ascending: true })
        if (!cancelled && taskErr) throw taskErr
        const taskList = (taskData ?? []) as Task[]
        setTasks(taskList)

        if (taskList.length > 0) {
          const taskIds = taskList.map((t) => t.id)
          const { data: subData, error: subErr } = await supabase
            .from('submission')
            .select('task_id')
            .in('task_id', taskIds)
          if (!cancelled && subErr) throw subErr
          const countByTask: Record<number, number> = {}
          for (const tid of taskIds) countByTask[tid] = 0
          for (const row of subData ?? []) {
            const r = row as { task_id: number }
            countByTask[r.task_id] = (countByTask[r.task_id] ?? 0) + 1
          }
          setSubmissionCountByTaskId(countByTask)
        } else {
          setSubmissionCountByTaskId({})
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchDetail()
    return () => { cancelled = true }
  }, [id, user])

  if (!user || user.role !== 'teacher') {
    return null
  }

  if (loading) {
    return (
      <div>
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }
  if (error || !course) {
    return (
      <div>
        <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error ?? '未知错误'}</div>
        <Link href="/teacher/courses" className="text-primary hover:text-primary-hover text-sm transition-colors">
          ← 返回我的课程
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/teacher/courses" className="text-gray-500 hover:text-gray-700 text-sm">
            ← 返回我的课程
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{course.name}</h1>
        </div>
        <Link
          href={`/teacher/courses/${course.id}/tasks/new`}
          className="inline-flex items-center px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover transition-colors"
        >
          发布任务
        </Link>
      </div>

      {/* 基本信息 */}
      <section className="bg-white rounded-card shadow-card border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">基本信息</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">课程名称</dt>
            <dd className="font-medium text-gray-900">{course.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">课程代码</dt>
            <dd className="text-gray-900">{course.code ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">所属专业</dt>
            <dd className="text-gray-900">{course.major?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">负责教师</dt>
            <dd className="text-gray-900">
              {course.teacher?.name ?? '—'}
              {course.teacher?.employee_no && (
                <span className="text-gray-400 ml-1">({course.teacher.employee_no})</span>
              )}
            </dd>
          </div>
          {course.description && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">简介</dt>
              <dd className="text-gray-700 mt-0.5">{course.description}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Tab：班级与课表 / 学生名单 / 组队情况 / 任务列表 */}
      <div className="mb-3 flex gap-2 border-b border-gray-200">
        {(['sections', 'students', 'groups', 'tasks'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'sections' && '班级与课表'}
            {tab === 'students' && '学生名单'}
            {tab === 'groups' && '组队情况'}
            {tab === 'tasks' && '任务列表'}
          </button>
        ))}
      </div>

      {activeTab === 'sections' && (
        <section className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {sections.length === 0 ? (
              <div className="p-8 text-center text-gray-500">暂无班级</div>
            ) : (
              sections.map((sec) => (
                <div key={sec.id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">
                      {sec.name}
                      {sec.code && (
                        <span className="text-gray-500 font-normal ml-2">({sec.code})</span>
                      )}
                    </h3>
                    <span className="text-sm text-gray-500">
                      选课人数：{enrollmentCountBySection[sec.id] ?? 0}
                    </span>
                  </div>
                  <h4 className="text-xs font-medium text-gray-500 mb-2">课表</h4>
                  {(schedulesBySection[sec.id] ?? []).length === 0 ? (
                    <p className="text-sm text-gray-400">暂无排课</p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-1 pr-4">星期</th>
                          <th className="py-1 pr-4">时间</th>
                          <th className="py-1 pr-4">教室</th>
                          <th className="py-1">有效期</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        {(schedulesBySection[sec.id] ?? []).map((s) => (
                          <tr key={s.id}>
                            <td className="py-1.5 pr-4">{DAY_NAMES[s.day_of_week]}</td>
                            <td className="py-1.5 pr-4">
                              {s.start_time} — {s.end_time}
                            </td>
                            <td className="py-1.5 pr-4">{s.room}</td>
                            <td className="py-1.5">
                              {s.valid_from} 至 {s.valid_to}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === 'students' && (
        <section className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {sections.length === 0 ? (
              <div className="p-8 text-center text-gray-500">暂无班级</div>
            ) : (
              sections.map((sec) => {
                const students = studentsBySection[sec.id] ?? []
                return (
                  <div key={sec.id} className="p-5">
                    <h3 className="font-medium text-gray-900 mb-3">
                      {sec.name}
                      <span className="text-gray-500 font-normal text-sm ml-2">
                        （{students.length} 人）
                      </span>
                    </h3>
                    {students.length === 0 ? (
                      <p className="text-sm text-gray-400">暂无选课学生</p>
                    ) : (
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="py-1.5 pr-4">姓名</th>
                            <th className="py-1.5">学号</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-700">
                          {students.map((st) => (
                            <tr key={st.id}>
                              <td className="py-1.5 pr-4">{st.name}</td>
                              <td className="py-1.5">{st.student_no}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {activeTab === 'groups' && (
        <section className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {sections.map((sec) => {
              const groups = groupsBySection[sec.id] ?? []
              const allStudents = studentsBySection[sec.id] ?? []
              const groupedIds = new Set<number>()
              for (const g of groups) {
                for (const m of g.members) groupedIds.add(m.id)
              }
              const ungrouped = allStudents.filter((s) => !groupedIds.has(s.id))
              return (
                <div key={sec.id} className="p-5">
                  <h3 className="font-medium text-gray-900 mb-3">{sec.name}</h3>
                  {groups.length > 0 && (
                    <div className="mb-4 space-y-3">
                      {groups.map((g) => (
                        <div key={g.id} className="p-3 border border-gray-200 rounded-card">
                          <p className="font-medium text-gray-900 mb-2">
                            {g.name}
                            <span className="text-gray-500 font-normal text-sm ml-2">
                              （{g.members.length} 人）
                            </span>
                          </p>
                          <ul className="text-sm text-gray-700">
                            {g.members.map((m) => (
                              <li key={m.id}>
                                {m.name}（{m.student_no}）
                                {m.id === g.leader_id && (
                                  <span className="text-primary ml-1">组长</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {ungrouped.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">
                        未组队（{ungrouped.length} 人）
                      </p>
                      <ul className="text-sm text-gray-600">
                        {ungrouped.map((s) => (
                          <li key={s.id}>
                            {s.name}（{s.student_no}）
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {groups.length === 0 && ungrouped.length === 0 && (
                    <p className="text-sm text-gray-400">该班级暂无选课学生</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {activeTab === 'tasks' && (
        <section className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
          {tasks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">暂无任务</p>
              <p className="text-sm text-gray-400 mt-2 mb-4">
                可通过上方「发布任务」按钮发布新任务。
              </p>
              <Link
                href={`/teacher/courses/${course.id}/tasks/new`}
                className="inline-flex items-center px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover transition-colors"
              >
                发布任务
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50/50">
                    <th className="py-3 px-4 font-medium">任务标题</th>
                    <th className="py-3 px-4 font-medium">截止时间</th>
                    <th className="py-3 px-4 font-medium">是否组队</th>
                    <th className="py-3 px-4 font-medium">已提交</th>
                    <th className="py-3 px-4 font-medium w-24">操作</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 divide-y divide-gray-100">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-medium text-gray-900">{task.title}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(task.due_at).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">{task.allow_group ? `是（${task.group_min}～${task.group_max} 人）` : '否'}</td>
                      <td className="py-3 px-4">{submissionCountByTaskId[task.id] ?? 0} 份</td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/teacher/courses/${course.id}/tasks/${task.id}`}
                          className="text-primary hover:text-primary-hover font-medium"
                        >
                          查看
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
