'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

const ROLE_LABEL: Record<string, string> = {
  admin: '教务处',
  teacher: '教师',
  student: '学生',
}

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="h-14 flex items-center justify-between px-5 bg-white border-b border-gray-200 shrink-0">
      <Link
        href={user ? `/${user.role === 'admin' ? 'admin' : user.role === 'teacher' ? 'teacher' : 'student'}` : '/'}
        className="text-base font-semibold text-gray-900 hover:text-primary transition-colors"
      >
        高校教务协作平台
      </Link>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="text-sm">
              <span className="text-gray-500">{ROLE_LABEL[user.role]}</span>
              <span className="ml-1.5 text-gray-800 font-medium">{user.display_name}</span>
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-card px-2.5 py-1.5 transition-colors"
            >
              退出
            </button>
          </>
        )}
      </div>
    </header>
  )
}
