'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
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

export default function AdminEditAnnouncementPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<'published' | 'archived'>('published')
  const [submitting, setSubmitting] = useState(false)
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
        const a = data as Announcement
        setAnnouncement(a)
        setTitle(a.title)
        setBody(a.body ?? '')
        setStatus((a.status === 'archived' ? 'archived' : 'published') as 'published' | 'archived')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    const b = body.trim()
    if (!t) {
      setError('请填写标题')
      return
    }
    if (!b) {
      setError('请填写正文')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error: e } = await supabase
        .from('announcement')
        .update({
          title: t,
          body: b,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', announcement!.id)
      if (e) throw e
      router.push('/admin/announcements')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/announcements" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">
            ← 返回公告列表
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">编辑公告</h1>
        </div>
        <p className="text-sm text-gray-500">加载中…</p>
      </div>
    )
  }

  if (error && !announcement) {
    return (
      <div>
        <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error}</div>
        <Link href="/admin/announcements" className="text-primary hover:text-primary-hover text-sm transition-colors">
          ← 返回公告列表
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/announcements"
            className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
          >
            ← 返回公告列表
          </Link>
          <span className="text-gray-400">|</span>
          <Link
            href={`/admin/announcements/${announcement!.id}`}
            className="text-primary hover:text-primary-hover text-sm transition-colors"
          >
            返回详情
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">编辑公告</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-card shadow-card border border-gray-100 p-6 max-w-2xl"
      >
        {error && (
          <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={256}
              placeholder="请输入公告标题"
              className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
              正文 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="请输入公告正文"
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              状态
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'published' | 'archived')}
              className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={submitting}
            >
              <option value="published">已发布</option>
              <option value="archived">已下架</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {submitting ? '保存中…' : '保存'}
          </button>
          <Link
            href={`/admin/announcements/${announcement!.id}`}
            className="px-4 py-2.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-card hover:bg-gray-200 transition-colors"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  )
}
