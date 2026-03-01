'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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

export default function AdminAnnouncementDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const numId = parseInt(id, 10)
    if (Number.isNaN(numId)) {
      setError('无效的公告 ID')
      setLoading(false)
      return
    }
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('announcement')
      .select('id, title, body, status, created_at, updated_at, published_at')
      .eq('id', numId)
      .single()
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e || !data) {
          setError(e?.code === 'PGRST116' ? '公告不存在' : e?.message ?? '加载失败')
          setLoading(false)
          return
        }
        setAnnouncement(data as Announcement)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/announcements" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">
            ← 返回公告列表
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">公告详情</h1>
        </div>
        <p className="text-sm text-gray-500">加载中…</p>
      </div>
    )
  }

  if (error || !announcement) {
    return (
      <div>
        <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error ?? '未知错误'}</div>
        <Link href="/admin/announcements" className="text-primary hover:text-primary-hover text-sm transition-colors">
          ← 返回公告列表
        </Link>
      </div>
    )
  }

  const displayTime = announcement.published_at ?? announcement.created_at

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/announcements"
            className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
          >
            ← 返回公告列表
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{announcement.title}</h1>
        </div>
        <Link
          href={`/admin/announcements/${announcement.id}/edit`}
          className="inline-flex items-center px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover transition-colors"
        >
          编辑
        </Link>
      </div>

      <div className="bg-white rounded-card shadow-card border border-gray-100 p-6 max-w-3xl">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">发布时间</dt>
            <dd className="text-sm text-gray-900">{formatDate(displayTime)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">状态</dt>
            <dd className="text-sm text-gray-900">{STATUS_LABEL[announcement.status] ?? announcement.status}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">正文</dt>
            <dd className="text-sm text-gray-900 whitespace-pre-wrap mt-1">
              {announcement.body || '（无正文）'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
