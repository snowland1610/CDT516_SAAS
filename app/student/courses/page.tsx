'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Section = { id: number; name: string; code: string | null; course_id: number }
type Course = { id: number; name: string; code: string | null; teacher_id: number }
type Teacher = { id: number; name: string; employee_no: string | null }
type EnrollmentRow = {
  id: number
  section_id: number
  section: (Section & { course: (Course & { teacher: Teacher | null }) | null }) | null
}

type MyCourseRow = {
  courseId: number
  courseName: string
  courseCode: string | null
  sectionName: string
  teacherName: string
}

export default function StudentCoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<MyCourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || user.role !== 'student' || user.profile_id == null) {
      setLoading(false)
      return
    }
    const profileId = user.profile_id
    let cancelled = false
    const supabase = createClient()
    async function fetchCourses() {
      try {
        const { data, error: e } = await supabase
          .from('enrollment')
          .select(`
            id,
            section_id,
            section:section_id(
              name,
              code,
              course_id,
              course:course_id(id, name, code, teacher_id, teacher:teacher_id(name, employee_no))
            )
          `)
          .eq('student_id', profileId)
        if (cancelled) return
        if (e) throw e
        const rows = (data ?? []) as unknown as EnrollmentRow[]
        const list: MyCourseRow[] = rows
          .filter((r) => r.section?.course)
          .map((r) => ({
            courseId: r.section!.course!.id,
            courseName: r.section!.course!.name,
            courseCode: r.section!.course!.code,
            sectionName: r.section!.name,
            teacherName: r.section!.course!.teacher?.name ?? '—',
          }))
        setCourses(list)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCourses()
    return () => { cancelled = true }
  }, [user])

  if (!user || user.role !== 'student') {
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
          暂无选课
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
                  所在班级
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  教师
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {courses.map((row, i) => (
                <tr key={`${row.courseId}-${row.sectionName}-${i}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.courseName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{row.courseCode ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.sectionName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.teacherName}</td>
                  <td className="px-4 py-3 flex gap-3">
                    <Link
                      href={`/student/courses/${row.courseId}`}
                      className="text-primary hover:text-primary-hover text-sm font-medium transition-colors"
                    >
                      详情
                    </Link>
                    <Link
                      href={`/student/group-hall?courseId=${row.courseId}`}
                      className="text-primary hover:text-primary-hover text-sm font-medium transition-colors"
                    >
                      组队
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
