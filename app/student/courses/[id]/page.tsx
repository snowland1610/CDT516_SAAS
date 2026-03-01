'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MIN_GROUP = 4
const MAX_GROUP = 6

type Teacher = { id: number; name: string; employee_no: string | null }
type Course = {
  id: number
  name: string
  code: string | null
  description: string | null
  teacher_id: number
  teacher: Teacher | null
}
type Section = { id: number; name: string; code: string | null; course_id: number }
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
type StudentInfo = { id: number; name: string; student_no: string }
type GroupWithMembers = {
  id: number
  name: string
  leader_id: number
  members: StudentInfo[]
}

type Task = {
  id: number
  course_id: number
  title: string
  due_at: string
  allow_group: boolean
  group_min: number | null
  group_max: number | null
}

export default function StudentCourseDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [mySections, setMySections] = useState<Section[]>([])
  const [schedulesBySection, setSchedulesBySection] = useState<Record<number, Schedule[]>>({})
  const [groupsBySection, setGroupsBySection] = useState<Record<number, GroupWithMembers[]>>({})
  const [myGroupBySection, setMyGroupBySection] = useState<Record<number, number>>({}) // sectionId -> groupId
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [submissionStatusByTaskId, setSubmissionStatusByTaskId] = useState<Record<number, 'submitted' | 'graded'>>({})

  const refreshGroups = useCallback(async (supabase: ReturnType<typeof createClient>, sectionIds: number[], studentId: number) => {
    const groupsRes = await supabase
      .from('group')
      .select('id, name, leader_id, section_id')
      .in('section_id', sectionIds)
    if (groupsRes.error) throw groupsRes.error
    const groups = (groupsRes.data ?? []) as { id: number; name: string; leader_id: number; section_id: number }[]
    if (groups.length === 0) {
      setGroupsBySection((prev) => {
        const next = { ...prev }
        for (const sid of sectionIds) next[sid] = []
        return next
      })
      setMyGroupBySection((prev) => {
        const next = { ...prev }
        for (const sid of sectionIds) next[sid] = 0
        return next
      })
      return
    }
    const groupIds = groups.map((g) => g.id)
    const membersRes = await supabase
      .from('group_member')
      .select('group_id, student:student_id(id, name, student_no)')
      .in('group_id', groupIds)
    if (membersRes.error) throw membersRes.error
    const membersRaw = (membersRes.data ?? []) as unknown as { group_id: number; student: StudentInfo | null }[]
    const membersByGroup: Record<number, StudentInfo[]> = {}
    for (const g of groups) membersByGroup[g.id] = []
    for (const m of membersRaw) {
      if (m.student) membersByGroup[m.group_id].push(m.student)
    }
    const groupList: GroupWithMembers[] = groups.map((g) => ({
      id: g.id,
      name: g.name,
      leader_id: g.leader_id,
      members: membersByGroup[g.id] ?? [],
    }))
    const bySection: Record<number, GroupWithMembers[]> = {}
    for (const g of groups) {
      if (!bySection[g.section_id]) bySection[g.section_id] = []
      bySection[g.section_id].push(groupList.find((x) => x.id === g.id)!)
    }
    setGroupsBySection((prev) => ({ ...prev, ...bySection }))
    const myRes = await supabase
      .from('group_member')
      .select('group_id, group:group_id(section_id)')
      .eq('student_id', studentId)
      .in('group_id', groupIds)
    if (myRes.error) throw myRes.error
    const myMap: Record<number, number> = {}
    for (const sid of sectionIds) myMap[sid] = 0
    for (const r of myRes.data ?? []) {
      const row = r as unknown as { group_id: number; group: { section_id: number } | null }
      if (row.group) myMap[row.group.section_id] = row.group_id
    }
    setMyGroupBySection((prev) => ({ ...prev, ...myMap }))
  }, [])

  useEffect(() => {
    const courseId = parseInt(id, 10)
    if (Number.isNaN(courseId)) {
      setError('无效的课程 ID')
      setLoading(false)
      return
    }
    if (!user || user.role !== 'student' || user.profile_id == null) {
      setLoading(false)
      return
    }

    const studentId = user.profile_id
    let cancelled = false
    const supabase = createClient()

    async function fetchDetail() {
      try {
        const { data: courseData, error: courseErr } = await supabase
          .from('course')
          .select('id, name, code, description, teacher_id, teacher:teacher_id(id, name, employee_no)')
          .eq('id', courseId)
          .single()
        if (cancelled) return
        if (courseErr || !courseData) {
          if (courseErr?.code === 'PGRST116') setError('课程不存在')
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
        const allSections = (sectionData ?? []) as Section[]
        const sectionIds = allSections.map((s) => s.id)

        if (sectionIds.length === 0) {
          setMySections([])
          setSchedulesBySection({})
          setLoading(false)
          return
        }

        const { data: enrollData, error: enrollErr } = await supabase
          .from('enrollment')
          .select('section_id')
          .eq('student_id', studentId)
          .in('section_id', sectionIds)
        if (cancelled) return
        if (enrollErr) throw enrollErr
        const enrolledSectionIds = new Set((enrollData ?? []).map((r: { section_id: number }) => r.section_id))
        const mySectionList = allSections.filter((s) => enrolledSectionIds.has(s.id))
        setMySections(mySectionList)

        if (mySectionList.length === 0) {
          setSchedulesBySection({})
          setLoading(false)
          return
        }

        const mySectionIds = mySectionList.map((s) => s.id)
        const { data: schedData, error: schedErr } = await supabase
          .from('section_schedule')
          .select('id, section_id, day_of_week, start_time, end_time, room, valid_from, valid_to')
          .in('section_id', mySectionIds)
          .order('day_of_week')
          .order('start_time')
        if (cancelled) return
        if (schedErr) throw schedErr
        const schedules = (schedData ?? []) as Schedule[]
        const bySection: Record<number, Schedule[]> = {}
        for (const s of schedules) {
          if (!bySection[s.section_id]) bySection[s.section_id] = []
          bySection[s.section_id].push(s)
        }
        setSchedulesBySection(bySection)
        await refreshGroups(supabase, mySectionIds, studentId)

        const firstSectionId = mySectionIds[0]
        let myGroupIdForCourse: number | null = null
        if (firstSectionId) {
          const { data: groupsInFirst } = await supabase
            .from('group')
            .select('id')
            .eq('section_id', firstSectionId)
          const groupIdsInFirst = (groupsInFirst ?? []).map((g: { id: number }) => g.id)
          if (groupIdsInFirst.length > 0) {
            const { data: mem } = await supabase
              .from('group_member')
              .select('group_id')
              .eq('student_id', studentId)
              .in('group_id', groupIdsInFirst)
              .maybeSingle()
            if (mem && (mem as { group_id: number }).group_id)
              myGroupIdForCourse = (mem as { group_id: number }).group_id
          }
        }

        const { data: taskData, error: taskErr } = await supabase
          .from('task')
          .select('id, course_id, title, due_at, allow_group, group_min, group_max')
          .eq('course_id', courseId)
          .order('due_at', { ascending: true })
        if (!cancelled && taskErr) throw taskErr
        const taskList = (taskData ?? []) as Task[]
        setTasks(taskList)

        if (taskList.length > 0) {
          const taskIds = taskList.map((t) => t.id)
          let subData: { task_id: number; group_id: number | null; student_id: number | null; status: string }[] = []
          if (myGroupIdForCourse != null) {
            const { data, error: subErr } = await supabase
              .from('submission')
              .select('task_id, group_id, student_id, status')
              .in('task_id', taskIds)
              .or(`student_id.eq.${studentId},group_id.eq.${myGroupIdForCourse}`)
            if (!cancelled && !subErr) subData = (data ?? []) as typeof subData
          } else {
            const { data, error: subErr } = await supabase
              .from('submission')
              .select('task_id, group_id, student_id, status')
              .in('task_id', taskIds)
              .eq('student_id', studentId)
            if (!cancelled && !subErr) subData = (data ?? []) as typeof subData
          }
          const statusMap: Record<number, 'submitted' | 'graded'> = {}
          for (const row of subData) {
            if (row.status !== 'graded' && row.status !== 'submitted') continue
            const task = taskList.find((t) => t.id === row.task_id)
            if (task?.allow_group && row.group_id != null) statusMap[row.task_id] = row.status as 'submitted' | 'graded'
            if (task && !task.allow_group && row.student_id != null) statusMap[row.task_id] = row.status as 'submitted' | 'graded'
          }
          setSubmissionStatusByTaskId(statusMap)
        } else {
          setSubmissionStatusByTaskId({})
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchDetail()
    return () => { cancelled = true }
  }, [id, user, refreshGroups])

  if (!user || user.role !== 'student') {
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
        <Link href="/student/courses" className="text-primary hover:text-primary-hover text-sm transition-colors">
          ← 返回我的课程
        </Link>
      </div>
    )
  }

  if (mySections.length === 0) {
    return (
      <div>
        <div className="rounded-card bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-4">
          您未选读该课程，无法查看详情
        </div>
        <Link href="/student/courses" className="text-primary hover:text-primary-hover text-sm transition-colors">
          ← 返回我的课程
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/student/courses" className="text-gray-500 hover:text-gray-700 text-sm">
          ← 返回我的课程
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{course.name}</h1>
      </div>

      {/* 课程信息 */}
      <section className="bg-white rounded-card shadow-card border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">课程信息</h2>
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
            <dt className="text-gray-500">授课教师</dt>
            <dd className="text-gray-900">
              {course.teacher?.name ?? '—'}
              {course.teacher?.employee_no && (
                <span className="text-gray-400 ml-1">({course.teacher.employee_no})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">你所在的班级</dt>
            <dd className="text-gray-900">
              {mySections.map((s) => s.name).join('、')}
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

      {/* 课表 */}
      <section className="mb-6">
        <h2 className="text-base font-medium text-gray-900 mb-3">课表</h2>
        <div className="bg-white rounded-card shadow-card border border-gray-100 divide-y divide-gray-200">
          {mySections.map((sec) => (
            <div key={sec.id} className="p-5">
              <h3 className="font-medium text-gray-900 mb-3">
                {sec.name}
                {sec.code && (
                  <span className="text-gray-500 font-normal ml-2">({sec.code})</span>
                )}
              </h3>
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
          ))}
        </div>
      </section>

      {/* 组队信息（仅查看，更多操作请至组队大厅） */}
      <section className="mb-6">
        <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
          <div className="p-5 pb-4">
            <h2 className="text-base font-medium text-gray-900 mb-1">组队信息</h2>
            <p className="text-sm text-gray-500 mb-4">当前课程下您的组队情况（仅查看）。小组人数 4～6 人，按班级组队。</p>
            {mySections.map((sec) => {
              const groups = groupsBySection[sec.id] ?? []
              const myGroupId = myGroupBySection[sec.id]
              const myGroup = myGroupId ? groups.find((g) => g.id === myGroupId) : null
              const otherGroups = groups.filter((g) => g.id !== myGroupId)
              return (
                <div key={sec.id} className="mb-6 last:mb-0">
                  <h3 className="font-medium text-gray-900 mb-2">
                    {sec.name}
                    {sec.code && <span className="text-gray-500 font-normal ml-2">({sec.code})</span>}
                  </h3>
                  {myGroup ? (
                    <div className="mb-3 p-3 bg-primary/5 rounded-card border border-primary/20">
                      <p className="text-sm font-medium text-gray-900 mb-1">我的小组：{myGroup.name}</p>
                      <ul className="text-sm text-gray-700">
                        {myGroup.members.map((m) => (
                          <li key={m.id}>
                            {m.name}（{m.student_no}）
                            {m.id === myGroup.leader_id && <span className="text-primary ml-1">组长</span>}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-gray-500 mt-1">{myGroup.members.length}/{MAX_GROUP} 人</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mb-2">未加入小组</p>
                  )}
                  {otherGroups.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500">其他小组</p>
                      {otherGroups.map((g) => (
                        <div key={g.id} className="p-2 border border-gray-100 rounded-card text-sm">
                          <span className="font-medium text-gray-900">{g.name}</span>
                          <span className="text-gray-500 ml-2">（{g.members.map((m) => m.name).join('、')}）</span>
                          <span className="text-gray-400 ml-2">{g.members.length}/{MAX_GROUP} 人</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {otherGroups.length === 0 && !myGroup && (
                    <p className="text-sm text-gray-400">暂无其他小组。</p>
                  )}
                </div>
              )
            })}
          </div>
          <div className="px-5 pb-5 pt-0">
            <Link
              href={`/student/group-hall?courseId=${course.id}`}
              title="去组队大厅管理"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-card hover:bg-gray-200 transition-colors"
            >
              更多操作
            </Link>
          </div>
        </div>
      </section>

      {/* 任务列表 */}
      <section>
        <h2 className="text-base font-medium text-gray-900 mb-3">任务列表</h2>
        {tasks.length === 0 ? (
          <div className="bg-white rounded-card shadow-card border border-gray-100 p-8 text-center">
            <p className="text-sm text-gray-500">暂无任务</p>
          </div>
        ) : (
          <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50/50">
                    <th className="py-3 px-4 font-medium">任务标题</th>
                    <th className="py-3 px-4 font-medium">截止时间</th>
                    <th className="py-3 px-4 font-medium">是否组队</th>
                    <th className="py-3 px-4 font-medium">提交状态</th>
                    <th className="py-3 px-4 font-medium w-20">操作</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 divide-y divide-gray-100">
                  {tasks.map((task) => {
                    const status = submissionStatusByTaskId[task.id]
                    const statusText = status === 'graded' ? '已批改' : status === 'submitted' ? '已提交' : '未提交'
                    return (
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
                        <td className="py-3 px-4">
                          <span className={status === 'graded' ? 'text-green-600' : status === 'submitted' ? 'text-gray-600' : 'text-amber-600'}>
                            {statusText}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/student/courses/${course.id}/tasks/${task.id}`}
                            className="text-primary hover:text-primary-hover font-medium"
                          >
                            查看
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
