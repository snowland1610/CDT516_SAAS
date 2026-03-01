'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Header from '@/components/layout/Header'
import TeacherSidebar from '@/components/layout/TeacherSidebar'

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, hasHydrated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!hasHydrated) return
    if (user === null) {
      router.replace('/')
      return
    }
    if (user.role !== 'teacher') {
      router.replace('/select-user?role=teacher')
    }
  }, [user, hasHydrated, router])

  if (!hasHydrated || !user || user.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">校验身份中…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex flex-1 min-h-0">
        <TeacherSidebar />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
