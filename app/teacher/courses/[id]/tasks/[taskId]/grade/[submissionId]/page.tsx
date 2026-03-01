'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Task = {
  id: number
  course_id: number
  title: string
  description: string | null
}

type Submission = {
  id: number
  task_id: number
  group_id: number | null
  student_id: number | null
  content: string | null
  attachment_url: string | null
  score: number | null
  feedback: string | null
  status: string
  submitted_at: string
  graded_at: string | null
  task: Task | null
  group: { id: number; name: string; leader_id: number } | null
  student: { id: number; name: string; student_no: string } | null
}

type GroupMember = { student: { id: number; name: string; student_no: string } | null }

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TeacherGradeSubmissionPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string
  const taskId = params.taskId as string
  const submissionIdParam = params.submissionId as string
  const courseIdNum = parseInt(courseId, 10)
  const taskIdNum = parseInt(taskId, 10)
  const submissionIdNum = parseInt(submissionIdParam, 10)
  const { user } = useAuth()

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [score, setScore] = useState<string>('')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (Number.isNaN(courseIdNum) || Number.isNaN(taskIdNum) || Number.isNaN(submissionIdNum)) {
      setError('无效的课程、任务或提交 ID')
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
        const { data: subData, error: subErr } = await supabase
          .from('submission')
          .select(`
            id, task_id, group_id, student_id, content, attachment_url, score, feedback, status, submitted_at, graded_at,
            task:task_id(id, course_id, title, description),
            group:group_id(id, name, leader_id),
            student:student_id(id, name, student_no)
          `)
          .eq('id', submissionIdNum)
          .single()
        if (cancelled) return
        if (subErr || !subData) {
          if (subErr?.code === 'PGRST116') setError('提交不存在')
          else setError(subErr?.message ?? '加载失败')
          setLoading(false)
          return
        }
        const sub = subData as unknown as Submission
        if (sub.task?.course_id !== courseIdNum || sub.task_id !== taskIdNum) {
          setError('提交与当前任务不匹配')
          setLoading(false)
          return
        }

        const { data: courseData, error: courseErr } = await supabase
          .from('course')
          .select('id, teacher_id')
          .eq('id', sub.task!.course_id)
          .single()
        if (cancelled) return
        if (courseErr || !courseData || (courseData as { teacher_id: number }).teacher_id !== teacherId) {
          setError('无权限批改该提交')
          setLoading(false)
          return
        }

        setSubmission(sub)
        setScore(sub.score != null ? String(sub.score) : '')
        setFeedback(sub.feedback ?? '')

        if (sub.group_id) {
          const { data: membersData, error: membersErr } = await supabase
            .from('group_member')
            .select('student:student_id(id, name, student_no)')
            .eq('group_id', sub.group_id)
          if (!cancelled && !membersErr) setGroupMembers((membersData ?? []) as unknown as GroupMember[])
        } else {
          setGroupMembers([])
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [courseIdNum, taskIdNum, submissionIdNum, user])

  const handleSave = async () => {
    if (!submission) return
    const scoreNum = score.trim() === '' ? null : parseFloat(score.trim())
    if (scoreNum != null && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100)) {
      setSaveError('分数需为 0～100 的数字')
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: e } = await supabase
        .from('submission')
        .update({
          score: scoreNum,
          feedback: feedback.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id)
      if (e) throw e
      setSubmission((prev) =>
        prev
          ? { ...prev, score: scoreNum, feedback: feedback.trim() || null }
          : null
      )
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!submission) return
    const scoreNum = score.trim() === '' ? null : parseFloat(score.trim())
    if (scoreNum != null && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100)) {
      setSaveError('分数需为 0～100 的数字')
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: e } = await supabase
        .from('submission')
        .update({
          score: scoreNum,
          feedback: feedback.trim() || null,
          status: 'graded',
          graded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id)
      if (e) throw e
      router.push(`/teacher/courses/${courseId}/tasks/${taskId}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '发布失败')
    } finally {
      setSaving(false)
    }
  }

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

  if (error || !submission) {
    return (
      <div>
        <div className="rounded-card bg-red-50 text-red-700 px-4 py-3 mb-4">
          {error ?? '加载失败'}
        </div>
        <Link href={`/teacher/courses/${courseId}/tasks/${taskId}`} className="text-primary hover:underline text-sm">
          ← 返回任务详情
        </Link>
      </div>
    )
  }

  const task = submission.task!
  const submitLabel = submission.group_id && submission.group
    ? submission.group.name
    : submission.student_id && submission.student
      ? `${submission.student.name}（${submission.student.student_no}）`
      : '—'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/teacher/courses/${courseId}/tasks/${taskId}`}
          className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          ← 返回任务详情
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">批改：{task.title}</h1>
        <span className="text-gray-500 text-sm">（{submitLabel}）</span>
      </div>

      <section className="bg-white rounded-card shadow-card border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">提交内容</h2>
        <p className="text-sm text-gray-500 mb-1">提交时间：{formatDateTime(submission.submitted_at)}</p>
        {submission.group_id && submission.group && groupMembers.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-1">小组成员</p>
            <ul className="text-sm text-gray-600 list-disc list-inside">
              {groupMembers.map((m, i) =>
                m.student ? (
                  <li key={i}>
                    {m.student.name}（{m.student.student_no}）
                    {m.student.id === submission.group!.leader_id && (
                      <span className="text-primary ml-1">组长</span>
                    )}
                  </li>
                ) : null
              )}
            </ul>
          </div>
        )}
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-700 mb-1">内容</p>
          <div className="text-gray-700 text-sm whitespace-pre-wrap rounded-card bg-gray-50 p-3 border border-gray-100">
            {submission.content || '（无文字内容）'}
          </div>
        </div>
        {submission.attachment_url && (
          <p className="text-sm">
            <span className="text-gray-500">附件：</span>
            <a
              href={submission.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              打开链接
            </a>
          </p>
        )}
      </section>

      <section className="bg-white rounded-card shadow-card border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">批改</h2>
        {saveError && (
          <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
            {saveError}
          </div>
        )}
        <div className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="score" className="block text-sm font-medium text-gray-700 mb-1">
              分数 <span className="text-gray-400 font-normal">（0～100，选填）</span>
            </label>
            <input
              id="score"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="例：85"
              className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-1">
              评语
            </label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="选填：批改意见、改进建议等"
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              disabled={saving}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-card hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={saving}
            className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {saving ? '发布中…' : '发布成绩'}
          </button>
        </div>
      </section>
    </div>
  )
}
