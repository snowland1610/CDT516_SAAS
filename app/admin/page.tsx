'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type RecentAnnouncement = { id: number; title: string; created_at: string; published_at: string | null }

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPage() {
  const [courseCount, setCourseCount] = useState<number | null>(null)
  const [announcementCount, setAnnouncementCount] = useState<number | null>(null)
  const [taskCount, setTaskCount] = useState<number | null>(null)
  const [pendingGradeCount, setPendingGradeCount] = useState<number | null>(null)
  const [recentAnnouncements, setRecentAnnouncements] = useState<RecentAnnouncement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    async function fetchStats() {
      try {
        const [courseRes, announcementRes, taskRes, pendingRes, recentRes] = await Promise.all([
          supabase.from('course').select('*', { count: 'exact', head: true }),
          supabase.from('announcement').select('*', { count: 'exact', head: true }),
          supabase.from('task').select('*', { count: 'exact', head: true }),
          supabase.from('submission').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
          supabase
            .from('announcement')
            .select('id, title, created_at, published_at')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(5),
        ])
        if (cancelled) return
        if (courseRes.error) throw courseRes.error
        if (announcementRes.error) throw announcementRes.error
        if (taskRes.error) throw taskRes.error
        if (pendingRes.error) throw pendingRes.error
        if (recentRes.error) throw recentRes.error
        setCourseCount(courseRes.count ?? 0)
        setAnnouncementCount(announcementRes.count ?? 0)
        setTaskCount(taskRes.count ?? 0)
        setPendingGradeCount(pendingRes.count ?? 0)
        setRecentAnnouncements((recentRes.data ?? []) as RecentAnnouncement[])
      } catch {
        if (!cancelled) setCourseCount(0)
        if (!cancelled) setAnnouncementCount(0)
        if (!cancelled) setTaskCount(0)
        if (!cancelled) setPendingGradeCount(0)
        if (!cancelled) setRecentAnnouncements([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStats()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">工作台</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-5 transition-shadow hover:shadow-card-hover">
          <p className="text-sm font-medium text-gray-500">课程总数</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {loading ? '—' : courseCount ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-5 transition-shadow hover:shadow-card-hover">
          <p className="text-sm font-medium text-gray-500">公告总数</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {loading ? '—' : announcementCount ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-5 transition-shadow hover:shadow-card-hover">
          <p className="text-sm font-medium text-gray-500">任务总数</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {loading ? '—' : taskCount ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-5 transition-shadow hover:shadow-card-hover">
          <p className="text-sm font-medium text-gray-500">待批改提交（全平台）</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {loading ? '—' : pendingGradeCount ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">教师端批改后减少</p>
        </div>
      </div>

      {/* 近期公告 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-gray-900">近期公告</h2>
          <Link
            href="/admin/announcements"
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
                    href={`/admin/announcements/${a.id}`}
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
            href="/admin/courses"
            className="inline-flex items-center px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover transition-colors"
          >
            课程目录
          </Link>
          <Link
            href="/admin/announcements"
            className="inline-flex items-center px-4 py-2.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-card hover:bg-gray-200 transition-colors"
          >
            公告管理
          </Link>
        </div>
      </section>
    </div>
  )
}
