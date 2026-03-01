'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Major = { id: number; name: string; code: string | null }
type Teacher = { id: number; name: string; employee_no: string | null }
type CourseRow = {
  id: number
  name: string
  code: string | null
  major_id: number
  teacher_id: number
  major: Major | null
  teacher: Teacher | null
}
type SectionRow = { id: number; course_id: number }
type EnrollmentRow = { id: number; section_id: number }

type CourseWithStats = CourseRow & { section_count: number; enrollment_count: number }

export default function TeacherCoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<CourseWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || user.role !== 'teacher' || user.profile_id == null) {
      setLoading(false)
      return
    }
    const teacherId = user.profile_id
    let cancelled = false
    const supabase = createClient()
    async function fetchCourses() {
      try {
        const [coursesRes, sectionsRes, enrollmentsRes] = await Promise.all([
          supabase
            .from('course')
            .select('id, name, code, major_id, teacher_id, major:major_id(id, name, code), teacher:teacher_id(id, name, employee_no)')
            .eq('teacher_id', teacherId)
            .order('id'),
          supabase.from('section').select('id, course_id'),
          supabase.from('enrollment').select('id, section_id'),
        ])
        if (cancelled) return
        if (coursesRes.error) throw coursesRes.error
        if (sectionsRes.error) throw sectionsRes.error
        if (enrollmentsRes.error) throw enrollmentsRes.error

        const courseList = (coursesRes.data ?? []) as CourseRow[]
        const sections = (sectionsRes.data ?? []) as SectionRow[]
        const enrollments = (enrollmentsRes.data ?? []) as EnrollmentRow[]

        const sectionCountByCourse: Record<number, number> = {}
        for (const s of sections) {
          sectionCountByCourse[s.course_id] = (sectionCountByCourse[s.course_id] ?? 0) + 1
        }
        const enrollmentCountBySection: Record<number, number> = {}
        for (const e of enrollments) {
          enrollmentCountBySection[e.section_id] = (enrollmentCountBySection[e.section_id] ?? 0) + 1
        }
        const sectionIdsByCourse: Record<number, number[]> = {}
        for (const s of sections) {
          if (!sectionIdsByCourse[s.course_id]) sectionIdsByCourse[s.course_id] = []
          sectionIdsByCourse[s.course_id].push(s.id)
        }

        const withStats: CourseWithStats[] = courseList.map((c) => {
          const sectionCount = sectionCountByCourse[c.id] ?? 0
          const enrollmentCount = (sectionIdsByCourse[c.id] ?? []).reduce(
            (sum, sid) => sum + (enrollmentCountBySection[sid] ?? 0),
            0
          )
          return { ...c, section_count: sectionCount, enrollment_count: enrollmentCount }
        })
        setCourses(withStats)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCourses()
    return () => { cancelled = true }
  }, [user])

  if (!user || user.role !== 'teacher') {
    return null
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">我的课程</h1>
        <p className="text-sm text-gray-500">加载中…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">我的课程</h1>
        <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">我的课程</h1>
      {courses.length === 0 ? (
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-8 text-center text-sm text-gray-500">
          暂无课程
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  课程名称
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  课程代码
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  所属专业
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  班级数
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  选课人数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.code ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.major?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{c.section_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{c.enrollment_count}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/teacher/courses/${c.id}`}
                      className="text-primary hover:text-primary-hover text-sm font-medium transition-colors"
                    >
                      详情
                    </Link>
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
