'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AUTH_STORAGE_KEY = 'cdt516_current_user'

export type Role = 'admin' | 'teacher' | 'student'

export interface CurrentUser {
  id: number
  role: Role
  display_name: string
  username?: string
  /** 教师时为 teacher.id，学生时为 student.id，admin 为 undefined */
  profile_id?: number
}

interface AuthContextValue {
  user: CurrentUser | null
  /** 是否已从 localStorage 恢复过（用于刷新后避免在恢复前就重定向） */
  hasHydrated: boolean
  setUser: (user: CurrentUser | null) => void
  selectUser: (user: CurrentUser) => void
  logout: () => void
}

function readStoredUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as CurrentUser
    if (!u?.id || !u?.role) return null
    return u
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(null)
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    setUserState(readStoredUser())
    setHasHydrated(true)
  }, [])

  const setUser = useCallback((u: CurrentUser | null) => {
    setUserState(u)
    if (typeof window !== 'undefined') {
      if (u) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u))
      else localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [])

  const selectUser = useCallback((u: CurrentUser) => {
    setUserState(u)
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u))
    }
  }, [])

  const logout = useCallback(() => {
    setUserState(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      window.location.href = '/'
    }
  }, [])

  const value: AuthContextValue = {
    user,
    hasHydrated,
    setUser,
    selectUser,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用')
  }
  return ctx
}
