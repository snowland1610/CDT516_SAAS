'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/student', label: '工作台' },
  { href: '/student/courses', label: '我的课程' },
  { href: '/student/group-hall', label: '组队大厅' },
  { href: '/student/calendar', label: '我的日程' },
  { href: '/student/announcements', label: '教务处公告' },
]

export default function StudentSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 shrink-0 border-r border-gray-200 bg-white py-4 px-3">
      <nav className="space-y-0.5">
        {items.map(({ href, label }) => {
          const isActive = pathname === href || (href !== '/student' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-card text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
