'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

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

type Course = { id: number; name: string; teacher_id: number }

type SubmissionRow = {
  id: number
  task_id: number
  group_id: number | null
  student_id: number | null
  content: string | null
  status: string
  submitted_at: string
  graded_at: string | null
  score: number | null
  feedback: string | null
  group: { id: number; name: string } | null
  student: { id: number; name: string; student_no: string } | null
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TeacherTaskDetailPage() {
  const params = useParams()
  const courseId = params.id as string
  const taskIdParam = params.taskId as string
  const courseIdNum = parseInt(courseId, 10)
  const taskIdNum = parseInt(taskIdParam, 10)
  const { user } = useAuth()

  const [task, setTask] = useState<Task | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [totalExpected, setTotalExpected] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (Number.isNaN(courseIdNum) || Number.isNaN(taskIdNum)) {
      setError('无效的课程或任务 ID')
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

    async function fetchData() {
      try {
        const { data: taskData, error: taskErr } = await supabase
          .from('task')
          .select('id, course_id, title, description, due_at, allow_group, group_min, group_max, group_deadline, created_at, updated_at')
          .eq('id', taskIdNum)
          .eq('course_id', courseIdNum)
          .single()
        if (cancelled) return
        if (taskErr || !taskData) {
          if (taskErr?.code === 'PGRST116') setError('任务不存在')
          else setError(taskErr?.message ?? '加载失败')
          setLoading(false)
          return
        }
        const taskObj = taskData as Task
        setTask(taskObj)

        const { data: courseData, error: courseErr } = await supabase
          .from('course')
          .select('id, name, teacher_id')
          .eq('id', taskObj.course_id)
          .single()
        if (cancelled) return
        if (courseErr || !courseData || (courseData as Course).teacher_id !== teacherId) {
          setError('课程不存在或您无权限查看')
          setLoading(false)
          return
        }
        setCourse(courseData as Course)

        const { data: subData, error: subErr } = await supabase
          .from('submission')
          .select(`
            id, task_id, group_id, student_id, content, status, submitted_at, graded_at, score, feedback,
            group:group_id(id, name),
            student:student_id(id, name, student_no)
          `)
          .eq('task_id', taskIdNum)
          .order('submitted_at', { ascending: false })
        if (!cancelled && subErr) throw subErr
        setSubmissions((subData ?? []) as unknown as SubmissionRow[])

        if (taskObj.allow_group) {
          const { data: sectionData } = await supabase
            .from('section')
            .select('id')
            .eq('course_id', taskObj.course_id)
          const sectionIds = (sectionData ?? []).map((s: { id: number }) => s.id)
          if (sectionIds.length > 0) {
            const { count, error: groupErr } = await supabase
              .from('group')
              .select('*', { count: 'exact', head: true })
              .in('section_id', sectionIds)
            if (!cancelled && !groupErr) setTotalExpected(count ?? 0)
          } else {
            setTotalExpected(0)
          }
        } else {
          const { data: enrollData } = await supabase
            .from('section')
            .select('id')
            .eq('course_id', taskObj.course_id)
          const sectionIds = (enrollData ?? []).map((s: { id: number }) => s.id)
          if (sectionIds.length > 0) {
            const { data: enrolls } = await supabase
              .from('enrollment')
              .select('student_id')
              .in('section_id', sectionIds)
            const uniqueStudents = new Set((enrolls ?? []).map((e: { student_id: number }) => e.student_id))
            setTotalExpected(uniqueStudents.size)
          } else {
            setTotalExpected(0)
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [courseIdNum, taskIdNum, user])

  if (!user || user.role !== 'teacher') {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }

  if (error || !task || !course) {
    return (
      <div>
        <div className="rounded-card bg-red-50 text-red-700 px-4 py-3 mb-4">
          {error ?? '加载失败'}
        </div>
        <Link href={`/teacher/courses/${courseId}`} className="text-primary hover:underline text-sm">
          ← 返回课程详情
        </Link>
      </div>
    )
  }

  const submittedCount = submissions.length
  const rate = totalExpected != null && totalExpected > 0
    ? `${Math.round((submittedCount / totalExpected) * 100)}%`
    : null

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/teacher/courses/${courseId}`}
          className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          ← 返回课程详情
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{task.title}</h1>
        <span className="text-gray-400 text-sm">（{course.name}）</span>
      </div>

      <section className="bg-white rounded-card shadow-card border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">任务信息</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">任务标题</dt>
            <dd className="font-medium text-gray-900">{task.title}</dd>
          </div>
          <div>
            <dt className="text-gray-500">提交截止时间</dt>
            <dd className="text-gray-700">{formatDateTime(task.due_at)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">是否组队</dt>
            <dd className="text-gray-700">
              {task.allow_group
                ? `是（${task.group_min}～${task.group_max} 人）`
                : '否（个人提交）'}
            </dd>
          </div>
          {task.allow_group && task.group_deadline && (
            <div>
              <dt className="text-gray-500">组队截止时间</dt>
              <dd className="text-gray-700">{formatDateTime(task.group_deadline)}</dd>
            </div>
          )}
          {task.description && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">任务说明</dt>
              <dd className="text-gray-700 mt-0.5 whitespace-pre-wrap">{task.description}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium text-gray-900">提交列表</h2>
          <div className="text-sm text-gray-500">
            已提交 {submittedCount} 份
            {totalExpected != null && (
              <>，共 {totalExpected} {task.allow_group ? '组' : '人'}
                {rate != null && <>，提交率 {rate}</>}
              </>
            )}
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无提交
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50/50">
                  <th className="py-3 px-4 font-medium">提交方</th>
                  <th className="py-3 px-4 font-medium">提交时间</th>
                  <th className="py-3 px-4 font-medium">内容摘要</th>
                  <th className="py-3 px-4 font-medium">状态</th>
                  <th className="py-3 px-4 font-medium w-24">操作</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 divide-y divide-gray-100">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      {sub.group_id && sub.group
                        ? sub.group.name
                        : sub.student_id && sub.student
                          ? `${sub.student.name}（${sub.student.student_no}）`
                          : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{formatDateTime(sub.submitted_at)}</td>
                    <td className="py-3 px-4 max-w-xs truncate text-gray-600" title={sub.content ?? ''}>
                      {sub.content ? (sub.content.length > 60 ? sub.content.slice(0, 60) + '…' : sub.content) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={sub.status === 'graded' ? 'text-green-600' : 'text-gray-600'}>
                        {sub.status === 'graded' ? '已批改' : '已提交'}
                      </span>
                      {sub.status === 'graded' && sub.score != null && (
                        <span className="ml-1 text-gray-500">({sub.score} 分)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/teacher/courses/${courseId}/tasks/${taskIdNum}/grade/${sub.id}`}
                        className="text-primary hover:text-primary-hover font-medium"
                      >
                        批改
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
