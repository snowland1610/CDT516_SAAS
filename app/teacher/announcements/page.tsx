'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type AnnouncementRow = {
  id: number
  title: string
  created_at: string
  published_at: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TeacherAnnouncementsPage() {
  const [list, setList] = useState<AnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('announcement')
      .select('id, title, created_at, published_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) throw e
        setList((data ?? []) as AnnouncementRow[])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">教务处公告</h1>
        <p className="text-sm text-gray-500">加载中…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">教务处公告</h1>
        <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">教务处公告</h1>

      {list.length === 0 ? (
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-500">暂无公告</p>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  标题
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  发布时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {list.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link
                      href={`/teacher/announcements/${a.id}`}
                      className="text-primary hover:text-primary-hover transition-colors"
                    >
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(a.published_at ?? a.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/teacher/announcements/${a.id}`}
                      className="text-primary hover:text-primary-hover transition-colors"
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
    </div>
  )
}
