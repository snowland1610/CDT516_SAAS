'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AdminNewAnnouncementPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        .insert({ title: t, body: b, status: 'published' })
      if (e) throw e
      router.push('/admin/announcements')
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/announcements"
          className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          ← 返回公告列表
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">发布公告</h1>
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
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {submitting ? '发布中…' : '发布'}
          </button>
          <Link
            href="/admin/announcements"
            className="px-4 py-2.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-card hover:bg-gray-200 transition-colors"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  )
}
