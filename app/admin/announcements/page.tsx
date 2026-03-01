'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Announcement = {
  id: number
  title: string
  body: string | null
  status: string
  created_at: string
  updated_at: string
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

const STATUS_LABEL: Record<string, string> = {
  published: '已发布',
  archived: '已下架',
}

export default function AdminAnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<number | null>(null)

  const fetchList = async () => {
    const supabase = createClient()
    const { data, error: e } = await supabase
      .from('announcement')
      .select('id, title, body, status, created_at, updated_at, published_at')
      .order('created_at', { ascending: false })
    if (e) throw e
    setList((data ?? []) as Announcement[])
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await fetchList()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleArchive = async (id: number) => {
    setArchivingId(id)
    try {
      const supabase = createClient()
      const { error: e } = await supabase
        .from('announcement')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (e) throw e
      await fetchList()
    } catch (e) {
      alert(e instanceof Error ? e.message : '下架失败')
    } finally {
      setArchivingId(null)
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">公告管理</h1>
        <p className="text-sm text-gray-500">加载中…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">公告管理</h1>
        <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-900">公告管理</h1>
        <Link
          href="/admin/announcements/new"
          className="inline-flex items-center px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover transition-colors"
        >
          发布公告
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-500 mb-4">暂无公告</p>
          <Link
            href="/admin/announcements/new"
            className="inline-flex items-center px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover transition-colors"
          >
            发布公告
          </Link>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {list.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link
                      href={`/admin/announcements/${a.id}`}
                      className="text-primary hover:text-primary-hover transition-colors"
                    >
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(a.published_at ?? a.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </td>
                  <td className="px-4 py-3 text-sm space-x-3">
                    <Link
                      href={`/admin/announcements/${a.id}`}
                      className="text-primary hover:text-primary-hover transition-colors"
                    >
                      查看
                    </Link>
                    <Link
                      href={`/admin/announcements/${a.id}/edit`}
                      className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      编辑
                    </Link>
                    {a.status === 'published' && (
                      <button
                        type="button"
                        onClick={() => handleArchive(a.id)}
                        disabled={archivingId === a.id}
                        className="text-amber-600 hover:text-amber-800 disabled:opacity-50 transition-colors"
                      >
                        {archivingId === a.id ? '下架中…' : '下架'}
                      </button>
                    )}
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
