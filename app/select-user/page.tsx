'use client'

import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth, type CurrentUser, type Role } from '@/context/AuthContext'

const ROLE_LABEL: Record<string, string> = {
  admin: '教务处',
  teacher: '教师',
  student: '学生',
}

type ListItem = CurrentUser & { employee_no?: string; student_no?: string }

export default function SelectUserPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { selectUser } = useAuth()
  const role = (searchParams.get('role') || '') as Role
  const [list, setList] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isValidRole = role === 'admin' || role === 'teacher' || role === 'student'

  useEffect(() => {
    if (!isValidRole) {
      setLoading(false)
      return
    }
    const supabase = createClient()
    let cancelled = false

    async function fetchList() {
      try {
        if (role === 'admin') {
          const { data, error: e } = await supabase
            .from('user')
            .select('id, display_name, username')
            .eq('role', 'admin')
          if (cancelled) return
          if (e) throw e
          setList((data || []).map((r) => ({
            id: r.id,
            role: 'admin',
            display_name: r.display_name || '教务处管理员',
            username: r.username,
          })))
        } else if (role === 'teacher') {
          const { data, error: e } = await supabase
            .from('teacher')
            .select('id, name, employee_no, user_id(id, display_name, username)')
          if (cancelled) return
          if (e) throw e
          const raw = data as { id: number; name: string; employee_no?: string; user_id: { id: number; display_name?: string; username?: string } | null }[] | null
          const users: ListItem[] = (raw || []).map((r) => ({
            id: r.user_id?.id ?? 0,
            role: 'teacher' as const,
            display_name: r.user_id?.display_name || r.name,
            username: r.user_id?.username,
            profile_id: r.id,
            employee_no: r.employee_no,
          })).filter((u) => u.id)
          setList(users)
        } else {
          const { data, error: e } = await supabase
            .from('student')
            .select('id, name, student_no, user_id(id, display_name, username)')
          if (cancelled) return
          if (e) throw e
          const raw = data as { id: number; name: string; student_no: string; user_id: { id: number; display_name?: string; username?: string } | null }[] | null
          const users: ListItem[] = (raw || []).map((r) => ({
            id: r.user_id?.id ?? 0,
            role: 'student' as const,
            display_name: r.user_id?.display_name || r.name,
            username: r.user_id?.username,
            profile_id: r.id,
            student_no: r.student_no,
          })).filter((u) => u.id)
          setList(users)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchList()
    return () => { cancelled = true }
  }, [role, isValidRole])

  const handleSelect = (u: ListItem) => {
    selectUser({ id: u.id, role: u.role, display_name: u.display_name, username: u.username, profile_id: u.profile_id })
    if (u.role === 'admin') router.push('/admin')
    else if (u.role === 'teacher') router.push('/teacher')
    else router.push('/student')
  }

  if (!isValidRole) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <p className="text-gray-600 mb-4">请从首页选择身份进入</p>
        <Link href="/" className="text-primary hover:text-primary-hover transition-colors">返回首页</Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
            ← 返回首页
          </Link>
          <span className="px-3 py-1 bg-gray-100 rounded-card text-sm font-medium text-gray-700">
            {ROLE_LABEL[role]}
          </span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">选择账号</h1>
        <p className="text-sm text-gray-500 mb-6">点击下方账号进入工作台</p>

        {loading && (
          <div className="py-12 text-center text-gray-500">加载中…</div>
        )}
        {error && (
          <div className="py-4 px-4 bg-red-50 text-red-700 rounded-card text-sm mb-4">
            {error}
          </div>
        )}
        {!loading && !error && list.length === 0 && (
          <div className="py-12 text-center text-gray-500">暂无账号</div>
        )}
        {!loading && list.length > 0 && (
          <ul className="space-y-2">
            {list.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(u)}
                  className="w-full text-left px-4 py-3 bg-white rounded-card shadow-card border border-gray-100 hover:shadow-card-hover hover:bg-gray-50 transition-all"
                >
                  <span className="font-medium text-gray-900">{u.display_name}</span>
                  {role === 'teacher' && u.employee_no && (
                    <span className="ml-2 text-sm text-gray-500">{u.employee_no}</span>
                  )}
                  {role === 'student' && u.student_no && (
                    <span className="ml-2 text-sm text-gray-500">{u.student_no}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
