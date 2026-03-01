'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type RecentAnnouncement = { id: number; title: string; created_at: string; published_at: string | null }

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function TeacherPage() {
  const { user } = useAuth()
  const [courseCount, setCourseCount] = useState<number | null>(null)
  const [pendingGradeCount, setPendingGradeCount] = useState<number | null>(null)
  const [recentAnnouncements, setRecentAnnouncements] = useState<RecentAnnouncement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || user.role !== 'teacher' || user.profile_id == null) {
      setLoading(false)
      return
    }
    const teacherId = user.profile_id
    let cancelled = false
    const supabase = createClient()
    async function fetchStats() {
      try {
        const [courseRes, recentRes] = await Promise.all([
          supabase
            .from('course')
            .select('id')
            .eq('teacher_id', teacherId),
          supabase
            .from('announcement')
            .select('id, title, created_at, published_at')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(5),
        ])
        if (cancelled) return
        if (courseRes.error) throw courseRes.error
        if (recentRes.error) throw recentRes.error
        const courseList = (courseRes.data ?? []) as { id: number }[]
        setCourseCount(courseList.length)
        setRecentAnnouncements((recentRes.data ?? []) as RecentAnnouncement[])

        const courseIds = courseList.map((c) => c.id)
        if (courseIds.length > 0) {
          const { data: taskData } = await supabase
            .from('task')
            .select('id')
            .in('course_id', courseIds)
          const taskIds = (taskData ?? []).map((t: { id: number }) => t.id)
          if (taskIds.length > 0) {
            const { count } = await supabase
              .from('submission')
              .select('*', { count: 'exact', head: true })
              .in('task_id', taskIds)
              .eq('status', 'submitted')
            if (!cancelled) setPendingGradeCount(count ?? 0)
          } else {
            if (!cancelled) setPendingGradeCount(0)
          }
        } else {
          if (!cancelled) setPendingGradeCount(0)
        }
      } catch {
        if (!cancelled) setCourseCount(0)
        if (!cancelled) setPendingGradeCount(0)
        if (!cancelled) setRecentAnnouncements([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStats()
    return () => { cancelled = true }
  }, [user])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">工作台</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-5 transition-shadow hover:shadow-card-hover">
          <p className="text-sm font-medium text-gray-500">我的课程数</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {loading ? '—' : courseCount ?? 0}
          </p>
        </div>
        <Link
          href="/teacher/courses"
          className="bg-white rounded-card shadow-card border border-gray-100 p-5 transition-shadow hover:shadow-card-hover block"
        >
          <p className="text-sm font-medium text-gray-500">待批改提交数</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {loading ? '—' : pendingGradeCount ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">点击进入我的课程批改</p>
        </Link>
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-5 transition-shadow hover:shadow-card-hover">
          <p className="text-sm font-medium text-gray-500">近期待办</p>
          <p className="mt-1 text-sm text-gray-500">
            {loading || pendingGradeCount == null ? '—' : pendingGradeCount > 0 ? `未批改 ${pendingGradeCount} 份提交` : '暂无待办'}
          </p>
        </div>
      </div>

      {/* 教务处公告 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-gray-900">教务处公告</h2>
          <Link
            href="/teacher/announcements"
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
                    href={`/teacher/announcements/${a.id}`}
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
            href="/teacher/courses"
            className="inline-flex items-center px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover transition-colors"
          >
            我的课程
          </Link>
          <Link
            href="/teacher/announcements"
            className="inline-flex items-center px-4 py-2.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-card hover:bg-gray-200 transition-colors"
          >
            教务处公告
          </Link>
        </div>
      </section>
    </div>
  )
}
