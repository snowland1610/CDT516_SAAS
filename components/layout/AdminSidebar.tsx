'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/admin', label: '工作台' },
  { href: '/admin/courses', label: '课程目录' },
  { href: '/admin/announcements', label: '公告' },
  { href: '/admin/stats', label: '统计' },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 shrink-0 border-r border-gray-200 bg-white py-4 px-3">
      <nav className="space-y-0.5">
        {items.map(({ href, label }) => {
          const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href))
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
