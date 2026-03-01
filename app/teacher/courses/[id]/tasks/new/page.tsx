'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Course = {
  id: number
  name: string
  code: string | null
  teacher_id: number
}

export default function TeacherNewTaskPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const courseId = parseInt(id, 10)
  const { user } = useAuth()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [allowGroup, setAllowGroup] = useState(true)
  const [groupMin, setGroupMin] = useState(4)
  const [groupMax, setGroupMax] = useState(6)
  const [groupDeadline, setGroupDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (Number.isNaN(courseId)) {
      setError('无效的课程 ID')
      setLoading(false)
      return
    }
    if (!user || user.role !== 'teacher' || user.profile_id == null) {
      setLoading(false)
      return
    }

    let cancelled = false
    const supabase = createClient()

    async function fetchCourse() {
      const { data, error: e } = await supabase
        .from('course')
        .select('id, name, code, teacher_id')
        .eq('id', courseId)
        .eq('teacher_id', user!.profile_id!)
        .single()
      if (cancelled) return
      if (e || !data) {
        if (e?.code === 'PGRST116') setError('课程不存在或您无权限操作')
        else setError(e?.message ?? '加载失败')
        setLoading(false)
        return
      }
      setCourse(data as Course)
      setLoading(false)
    }
    fetchCourse()
    return () => { cancelled = true }
  }, [courseId, user])

  // 默认截止时间：7 天后
  useEffect(() => {
    if (course && !dueAt) {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      d.setMinutes(0, 0)
      setDueAt(d.toISOString().slice(0, 16))
    }
  }, [course, dueAt])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      setSubmitError('请填写任务标题')
      return
    }
    if (!dueAt) {
      setSubmitError('请选择提交截止时间')
      return
    }
    const dueAtDate = new Date(dueAt)
    if (isNaN(dueAtDate.getTime())) {
      setSubmitError('截止时间格式无效')
      return
    }
    if (allowGroup) {
      const min = Number(groupMin)
      const max = Number(groupMax)
      if (Number.isNaN(min) || Number.isNaN(max) || min < 1 || max < min) {
        setSubmitError('小组人数范围无效（最小 ≤ 最大）')
        return
      }
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      const supabase = createClient()
      const payload: {
        course_id: number
        title: string
        description: string | null
        due_at: string
        allow_group: boolean
        group_min: number | null
        group_max: number | null
        group_deadline: string | null
      } = {
        course_id: courseId,
        title: t,
        description: description.trim() || null,
        due_at: dueAtDate.toISOString(),
        allow_group: allowGroup,
        group_min: allowGroup ? Number(groupMin) : null,
        group_max: allowGroup ? Number(groupMax) : null,
        group_deadline: allowGroup && groupDeadline ? new Date(groupDeadline).toISOString() : null,
      }
      const { error: e } = await supabase.from('task').insert(payload)
      if (e) throw e
      router.push(`/teacher/courses/${courseId}?tab=tasks`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }
  if (error || !course) {
    return (
      <div>
        <div className="rounded-card bg-red-50 text-red-700 px-4 py-3 mb-4">
          {error ?? '课程不存在'}
        </div>
        <Link
          href="/teacher/courses"
          className="text-primary hover:underline text-sm"
        >
          ← 返回我的课程
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/teacher/courses/${courseId}`}
          className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          ← 返回课程详情
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">发布任务</h1>
        <span className="text-gray-400 text-sm">（{course.name}）</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-card shadow-card border border-gray-100 p-6 max-w-2xl"
      >
        {submitError && (
          <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
            {submitError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              任务标题 <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={256}
              placeholder="请输入任务标题"
              className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              任务说明
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="选填：任务要求、提交格式等"
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="due_at" className="block text-sm font-medium text-gray-700 mb-1">
              提交截止时间 <span className="text-red-500">*</span>
            </label>
            <input
              id="due_at"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={submitting}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="allow_group"
              type="checkbox"
              checked={allowGroup}
              onChange={(e) => setAllowGroup(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
              disabled={submitting}
            />
            <label htmlFor="allow_group" className="text-sm font-medium text-gray-700">
              允许组队提交（以小组为单位提交）
            </label>
          </div>

          {allowGroup && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="group_min" className="block text-sm font-medium text-gray-700 mb-1">
                    小组最少人数 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="group_min"
                    type="number"
                    min={1}
                    max={20}
                    value={groupMin}
                    onChange={(e) => setGroupMin(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="group_max" className="block text-sm font-medium text-gray-700 mb-1">
                    小组最多人数 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="group_max"
                    type="number"
                    min={1}
                    max={20}
                    value={groupMax}
                    onChange={(e) => setGroupMax(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={submitting}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="group_deadline" className="block text-sm font-medium text-gray-700 mb-1">
                  组队截止时间 <span className="text-gray-400 font-normal">（选填，不填则与提交截止一致）</span>
                </label>
                <input
                  id="group_deadline"
                  type="datetime-local"
                  value={groupDeadline}
                  onChange={(e) => setGroupDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={submitting}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {submitting ? '发布中…' : '发布任务'}
          </button>
          <Link
            href={`/teacher/courses/${courseId}`}
            className="px-4 py-2.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-card hover:bg-gray-200 transition-colors"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  )
}
