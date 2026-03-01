'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const MAX_GROUP = 6

type CourseOption = { id: number; name: string }

type Section = { id: number; name: string; code: string | null; course_id: number }

type StudentInfo = { id: number; name: string; student_no: string }

type GroupWithMembers = {
  id: number
  name: string
  leader_id: number
  members: StudentInfo[]
}

type SectionRosterRow = {
  id: number
  name: string
  student_no: string
  groupName: string | null
}

/** 收到的邀请（用于「收到的邀请」区块展示） */
type ReceivedInvitationRow = {
  id: number
  group_id: number
  inviter_id: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  group_name: string
  inviter_name: string
  course_section_label: string
  section_id: number
}

export default function StudentGroupHallPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [courseName, setCourseName] = useState<string>('')
  const [mySections, setMySections] = useState<Section[]>([])
  const [groupsBySection, setGroupsBySection] = useState<Record<number, GroupWithMembers[]>>({})
  const [myGroupBySection, setMyGroupBySection] = useState<Record<number, number>>({})
  const [createName, setCreateName] = useState<Record<number, string>>({})
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sectionRoster, setSectionRoster] = useState<SectionRosterRow[]>([])
  const [receivedInvitations, setReceivedInvitations] = useState<ReceivedInvitationRow[]>([])

  const refreshGroups = useCallback(
    async (supabase: ReturnType<typeof createClient>, sectionIds: number[], studentId: number) => {
      const groupsRes = await supabase
        .from('group')
        .select('id, name, leader_id, section_id')
        .in('section_id', sectionIds)
      if (groupsRes.error) throw groupsRes.error
      const groups = (groupsRes.data ?? []) as { id: number; name: string; leader_id: number; section_id: number }[]
      if (groups.length === 0) {
        setGroupsBySection((prev) => {
          const next = { ...prev }
          for (const sid of sectionIds) next[sid] = []
          return next
        })
        setMyGroupBySection((prev) => {
          const next = { ...prev }
          for (const sid of sectionIds) next[sid] = 0
          return next
        })
        return
      }
      const groupIds = groups.map((g) => g.id)
      const membersRes = await supabase
        .from('group_member')
        .select('group_id, student:student_id(id, name, student_no)')
        .in('group_id', groupIds)
      if (membersRes.error) throw membersRes.error
      const membersRaw = (membersRes.data ?? []) as { group_id: number; student: StudentInfo | null }[]
      const membersByGroup: Record<number, StudentInfo[]> = {}
      for (const g of groups) membersByGroup[g.id] = []
      for (const m of membersRaw) {
        if (m.student) membersByGroup[m.group_id].push(m.student)
      }
      const groupList: GroupWithMembers[] = groups.map((g) => ({
        id: g.id,
        name: g.name,
        leader_id: g.leader_id,
        members: membersByGroup[g.id] ?? [],
      }))
      const bySection: Record<number, GroupWithMembers[]> = {}
      for (const g of groups) {
        if (!bySection[g.section_id]) bySection[g.section_id] = []
        bySection[g.section_id].push(groupList.find((x) => x.id === g.id)!)
      }
      setGroupsBySection((prev) => ({ ...prev, ...bySection }))
      const myRes = await supabase
        .from('group_member')
        .select('group_id, group:group_id(section_id)')
        .eq('student_id', studentId)
        .in('group_id', groupIds)
      if (myRes.error) throw myRes.error
      const myMap: Record<number, number> = {}
      for (const sid of sectionIds) myMap[sid] = 0
      for (const r of myRes.data ?? []) {
        const row = r as { group_id: number; group: { section_id: number } | null }
        if (row.group) myMap[row.group.section_id] = row.group_id
      }
      setMyGroupBySection((prev) => ({ ...prev, ...myMap }))
    },
    []
  )

  type InvRow = {
    id: number
    group_id: number
    inviter_id: number
    status: 'pending' | 'accepted' | 'rejected'
    created_at: string
    group: {
      id: number
      name: string
      section_id: number
      section: { id: number; name: string; course_id: number; course: { name: string } | null } | null
    } | null
    inviter: { id: number; name: string } | null
  }

  const fetchReceivedInvitationsForCourse = useCallback(
    async (
      supabase: ReturnType<typeof createClient>,
      sid: number,
      courseId: number
    ): Promise<ReceivedInvitationRow[]> => {
      const { data: invRaw } = await supabase
        .from('group_invitation')
        .select(
          'id, group_id, inviter_id, status, created_at, group:group_id(id, name, section_id, section:section_id(id, name, course_id, course:course_id(name))), inviter:inviter_id(id, name)'
        )
        .eq('invitee_id', sid)
        .order('created_at', { ascending: false })
      const invList = (invRaw ?? []) as InvRow[]
      const forCourse = invList.filter((r) => r.group?.section?.course_id === courseId)
      return forCourse.map((r) => ({
        id: r.id,
        group_id: r.group_id,
        inviter_id: r.inviter_id,
        status: r.status,
        created_at: r.created_at,
        group_name: r.group?.name ?? '',
        inviter_name: r.inviter?.name ?? '',
        course_section_label: r.group?.section
          ? `${r.group.section.course?.name ?? ''} · ${r.group.section.name}`
          : '',
        section_id: r.group?.section_id ?? 0,
      }))
    },
    []
  )

  useEffect(() => {
    if (!user || user.role !== 'student' || user.profile_id == null) {
      setLoadingCourses(false)
      return
    }
    let cancelled = false
    const supabase = createClient()
    async function fetchMyCourses() {
      try {
        const { data: enrollData } = await supabase
          .from('enrollment')
          .select('section_id')
          .eq('student_id', user.profile_id!)
        const sectionIds = [...new Set((enrollData ?? []).map((r: { section_id: number }) => r.section_id))]
        if (sectionIds.length === 0) {
          setCourseOptions([])
          setLoadingCourses(false)
          return
        }
        const { data: sectionData } = await supabase
          .from('section')
          .select('id, course_id')
          .in('id', sectionIds)
        const courseIds = [...new Set(((sectionData ?? []) as { course_id: number }[]).map((s) => s.course_id))]
        const { data: courseData } = await supabase
          .from('course')
          .select('id, name')
          .in('id', courseIds)
          .order('name')
        const list = ((courseData ?? []) as CourseOption[]).map((c) => ({ id: c.id, name: c.name }))
        if (!cancelled) setCourseOptions(list)

        const fromUrl = searchParams.get('courseId')
        if (fromUrl) {
          const id = parseInt(fromUrl, 10)
          if (!Number.isNaN(id) && list.some((c) => c.id === id)) setSelectedCourseId(id)
        }
      } catch {
        if (!cancelled) setCourseOptions([])
      } finally {
        if (!cancelled) setLoadingCourses(false)
      }
    }
    fetchMyCourses()
    return () => { cancelled = true }
  }, [user, searchParams])

  useEffect(() => {
    if (!user || user.role !== 'student' || user.profile_id == null || selectedCourseId == null) {
      setMySections([])
      setGroupsBySection({})
      setMyGroupBySection({})
      setLoadingDetail(false)
      return
    }
    let cancelled = false
    const supabase = createClient()
    const studentId = user.profile_id
    setLoadingDetail(true)
    setError(null)
    async function fetchCourseDetail() {
      try {
        const { data: courseData } = await supabase
          .from('course')
          .select('name')
          .eq('id', selectedCourseId!)
          .single()
        if (cancelled) return
        if (courseData) setCourseName((courseData as { name: string }).name)

        const { data: sectionData } = await supabase
          .from('section')
          .select('id, name, code, course_id')
          .eq('course_id', selectedCourseId!)
          .order('id')
        const allSections = (sectionData ?? []) as Section[]
        const sectionIds = allSections.map((s) => s.id)
        if (sectionIds.length === 0) {
          setMySections([])
          setLoadingDetail(false)
          return
        }

        const { data: enrollData } = await supabase
          .from('enrollment')
          .select('section_id')
          .eq('student_id', studentId)
          .in('section_id', sectionIds)
        const enrolledIds = new Set((enrollData ?? []).map((r: { section_id: number }) => r.section_id))
        const mySectionList = allSections.filter((s) => enrolledIds.has(s.id))
        setMySections(mySectionList)

        if (mySectionList.length === 0) {
          setGroupsBySection({})
          setMyGroupBySection({})
          setSectionRoster([])
          setReceivedInvitations([])
          setLoadingDetail(false)
          return
        }
        const mySectionIds = mySectionList.map((s) => s.id)
        await refreshGroups(supabase, mySectionIds, studentId)

        const received = await fetchReceivedInvitationsForCourse(
          supabase,
          studentId,
          selectedCourseId!
        )
        if (!cancelled) setReceivedInvitations(received)

        const firstSectionId = mySectionList[0].id
        const { data: enrollList } = await supabase
          .from('enrollment')
          .select('student_id')
          .eq('section_id', firstSectionId)
        const rosterStudentIds = [...new Set(((enrollList ?? []) as { student_id: number }[]).map((r) => r.student_id))]
        if (cancelled || rosterStudentIds.length === 0) {
          setSectionRoster([])
          setLoadingDetail(false)
          return
        }
        const { data: studentList } = await supabase
          .from('student')
          .select('id, name, student_no')
          .in('id', rosterStudentIds)
        const students = (studentList ?? []) as { id: number; name: string; student_no: string }[]
        const { data: sectionGroups } = await supabase
          .from('group')
          .select('id, name')
          .eq('section_id', firstSectionId)
        const groupIds = ((sectionGroups ?? []) as { id: number; name: string }[]).map((g) => g.id)
        const groupIdToName = Object.fromEntries(
          ((sectionGroups ?? []) as { id: number; name: string }[]).map((g) => [g.id, g.name])
        )
        let studentIdToGroupName: Record<number, string> = {}
        if (groupIds.length > 0) {
          const { data: memberList } = await supabase
            .from('group_member')
            .select('student_id, group_id')
            .in('group_id', groupIds)
          for (const row of (memberList ?? []) as { student_id: number; group_id: number }[]) {
            studentIdToGroupName[row.student_id] = groupIdToName[row.group_id] ?? ''
          }
        }
        const roster: SectionRosterRow[] = students.map((s) => ({
          id: s.id,
          name: s.name,
          student_no: s.student_no,
          groupName: studentIdToGroupName[s.id] ?? null,
        }))
        if (!cancelled) setSectionRoster(roster)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    }
    fetchCourseDetail()
    return () => { cancelled = true }
  }, [user, selectedCourseId, refreshGroups, fetchReceivedInvitationsForCourse])

  const handleSelectCourse = (courseId: string) => {
    const id = courseId === '' ? null : parseInt(courseId, 10)
    setSelectedCourseId(Number.isNaN(id) ? null : id)
    if (typeof window !== 'undefined' && id != null) {
      const url = new URL(window.location.href)
      url.searchParams.set('courseId', String(id))
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }

  if (!user || user.role !== 'student') return null

  const studentId = user.profile_id!
  const supabase = createClient()

  const handleCreate = async (sectionId: number) => {
    const name = (createName[sectionId] ?? '').trim()
    if (!name) return
    setActionLoading(`create-${sectionId}`)
    try {
      const { data: g, error: e1 } = await supabase
        .from('group')
        .insert({ section_id: sectionId, name, leader_id: studentId })
        .select('id')
        .single()
      if (e1) throw e1
      await supabase.from('group_member').insert({ group_id: g!.id, student_id: studentId })
      setCreateName((prev) => ({ ...prev, [sectionId]: '' }))
      await refreshGroups(supabase, [sectionId], studentId)
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleJoin = async (sectionId: number, groupId: number) => {
    setActionLoading(`join-${groupId}`)
    try {
      await supabase.from('group_member').insert({ group_id: groupId, student_id: studentId })
      const { data: sectionGroupIds } = await supabase
        .from('group')
        .select('id')
        .eq('section_id', sectionId)
      const gIds = ((sectionGroupIds ?? []) as { id: number }[]).map((g) => g.id)
      if (gIds.length > 0) {
        await supabase
          .from('group_invitation')
          .update({ status: 'rejected' })
          .eq('invitee_id', studentId)
          .eq('status', 'pending')
          .in('group_id', gIds)
      }
      await refreshGroups(supabase, [sectionId], studentId)
      if (selectedCourseId != null) {
        const received = await fetchReceivedInvitationsForCourse(
          supabase,
          studentId,
          selectedCourseId
        )
        setReceivedInvitations(received)
      }
      setSectionRoster((prev) => {
        const myGroup = (groupsBySection[sectionId] ?? []).find((g) => g.id === groupId)
        const name = myGroup?.name ?? null
        return prev.map((r) =>
          r.id === studentId ? { ...r, groupName: name } : r
        )
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : '加入失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleLeave = async (sectionId: number, groupId: number) => {
    if (!confirm('确定退出该小组？')) return
    setActionLoading(`leave-${groupId}`)
    try {
      await supabase.from('group_member').delete().eq('group_id', groupId).eq('student_id', studentId)
      await refreshGroups(supabase, [sectionId], studentId)
    } catch (err) {
      alert(err instanceof Error ? err.message : '退出失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDissolve = async (sectionId: number, groupId: number) => {
    if (!confirm('确定解散该小组？解散后所有成员需重新组队。')) return
    setActionLoading(`dissolve-${groupId}`)
    try {
      await supabase.from('group').delete().eq('id', groupId)
      await refreshGroups(supabase, [sectionId], studentId)
    } catch (err) {
      alert(err instanceof Error ? err.message : '解散失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleInvite = async (inviteeId: number) => {
    const firstSectionId = mySections[0]?.id
    const myGroupId = firstSectionId ? myGroupBySection[firstSectionId] : null
    if (!firstSectionId || !myGroupId) return
    setActionLoading(`invite-${inviteeId}`)
    try {
      const { data: existing } = await supabase
        .from('group_invitation')
        .select('id')
        .eq('group_id', myGroupId)
        .eq('invitee_id', inviteeId)
        .eq('status', 'pending')
        .maybeSingle()
      if (existing && (existing as { id: number }).id) {
        await supabase
          .from('group_invitation')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', (existing as { id: number }).id)
      } else {
        await supabase
          .from('group_invitation')
          .insert({ group_id: myGroupId, inviter_id: studentId, invitee_id: inviteeId, status: 'pending' })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '邀请失败')
    } finally {
      setActionLoading(null)
    }
  }

  /** 5.4：接受邀请 — 校验小组未满、本人未加入其他组，插入 group_member、更新邀请、自动拒绝同 section 其余 pending */
  const handleAcceptInvitation = async (inv: ReceivedInvitationRow) => {
    const group = (groupsBySection[inv.section_id] ?? []).find((g) => g.id === inv.group_id)
    if (!group || group.members.length >= MAX_GROUP) {
      alert('小组已满')
      return
    }
    const myGroupId = myGroupBySection[inv.section_id]
    if (myGroupId) {
      if (myGroupId === inv.group_id) {
        alert('您已在该小组')
        return
      }
      alert('您已在其他小组')
      return
    }
    setActionLoading(`accept-inv-${inv.id}`)
    try {
      await supabase.from('group_member').insert({ group_id: inv.group_id, student_id: studentId })
      await supabase
        .from('group_invitation')
        .update({ status: 'accepted' })
        .eq('id', inv.id)
      const { data: sectionGroupIds } = await supabase
        .from('group')
        .select('id')
        .eq('section_id', inv.section_id)
      const gIds = ((sectionGroupIds ?? []) as { id: number }[]).map((g) => g.id)
      if (gIds.length > 0) {
        await supabase
          .from('group_invitation')
          .update({ status: 'rejected' })
          .eq('invitee_id', studentId)
          .eq('status', 'pending')
          .in('group_id', gIds)
      }
      await refreshGroups(supabase, [inv.section_id], studentId)
      setSectionRoster((prev) =>
        prev.map((r) =>
          r.id === studentId ? { ...r, groupName: inv.group_name } : r
        )
      )
      const received = await fetchReceivedInvitationsForCourse(
        supabase,
        studentId,
        selectedCourseId!
      )
      setReceivedInvitations(received)
    } catch (err) {
      alert(err instanceof Error ? err.message : '接受失败')
    } finally {
      setActionLoading(null)
    }
  }

  /** 5.4：拒绝邀请 */
  const handleRejectInvitation = async (invId: number) => {
    setActionLoading(`reject-inv-${invId}`)
    try {
      await supabase
        .from('group_invitation')
        .update({ status: 'rejected' })
        .eq('id', invId)
      if (selectedCourseId != null) {
        const received = await fetchReceivedInvitationsForCourse(
          supabase,
          studentId,
          selectedCourseId
        )
        setReceivedInvitations(received)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActionLoading(null)
    }
  }

  const firstSectionId = mySections[0]?.id
  const myGroupIdForSection = firstSectionId ? myGroupBySection[firstSectionId] : null
  const myGroupForSection = firstSectionId && myGroupIdForSection
    ? (groupsBySection[firstSectionId] ?? []).find((g) => g.id === myGroupIdForSection)
    : null
  const isLeader = myGroupForSection?.leader_id === studentId

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">组队大厅</h1>

      {/* 选择课程 */}
      <section className="mb-6">
        <label htmlFor="group-hall-course" className="block text-sm font-medium text-gray-700 mb-2">
          选择课程
        </label>
        {loadingCourses ? (
          <p className="text-sm text-gray-500">加载课程列表…</p>
        ) : courseOptions.length === 0 ? (
          <div className="bg-white rounded-card shadow-card border border-gray-100 p-6 text-center text-sm text-gray-500">
            暂无选课，请先在「我的课程」中选课。
          </div>
        ) : (
          <select
            id="group-hall-course"
            value={selectedCourseId ?? ''}
            onChange={(e) => handleSelectCourse(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-w-[200px]"
          >
            <option value="">请选择一门课程</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* 组队内容区 */}
      {selectedCourseId != null && (
        <>
          {loadingDetail ? (
            <p className="text-sm text-gray-500">加载组队情况…</p>
          ) : error ? (
            <div className="rounded-card bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
          ) : mySections.length === 0 ? (
            <div className="bg-white rounded-card shadow-card border border-gray-100 p-6 text-center text-sm text-gray-500">
              您未选读该课程，无法查看组队情况。
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {courseName} · 小组人数 4～6 人，按班级组队。
              </p>

              {/* 收到的邀请（5.3 展示；5.4 接受/拒绝） */}
              <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden mb-6">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-base font-medium text-gray-900">收到的邀请</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {receivedInvitations.length > 0
                      ? `共 ${receivedInvitations.length} 条`
                      : '仅显示当前课程相关邀请'}
                  </p>
                </div>
                {receivedInvitations.length === 0 ? (
                  <div className="px-5 py-6 text-center text-sm text-gray-500">
                    暂无收到的邀请
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50/50">
                          <th className="py-3 px-4 font-medium">小组</th>
                          <th className="py-3 px-4 font-medium">邀请人</th>
                          <th className="py-3 px-4 font-medium">课程/班级</th>
                          <th className="py-3 px-4 font-medium">时间</th>
                          <th className="py-3 px-4 font-medium">状态</th>
                          <th className="py-3 px-4 font-medium w-28">操作</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700 divide-y divide-gray-100">
                        {receivedInvitations.map((inv) => {
                          const timeStr =
                            inv.created_at &&
                            (() => {
                              try {
                                const d = new Date(inv.created_at)
                                return Number.isNaN(d.getTime())
                                  ? inv.created_at
                                  : d.toLocaleString('zh-CN', {
                                      month: 'numeric',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                              } catch {
                                return inv.created_at
                              }
                            })()
                          return (
                            <tr key={inv.id} className="hover:bg-gray-50/50">
                              <td className="py-3 px-4 font-medium text-gray-900">{inv.group_name}</td>
                              <td className="py-3 px-4 text-gray-600">{inv.inviter_name}</td>
                              <td className="py-3 px-4 text-gray-600">{inv.course_section_label}</td>
                              <td className="py-3 px-4 text-gray-500">{timeStr}</td>
                              <td className="py-3 px-4">
                                {inv.status === 'pending' && (
                                  <span className="text-amber-600">待处理</span>
                                )}
                                {inv.status === 'accepted' && (
                                  <span className="text-green-600">已接受</span>
                                )}
                                {inv.status === 'rejected' && (
                                  <span className="text-gray-500">已拒绝</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {inv.status === 'pending' && (
                                  <span className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptInvitation(inv)}
                                      disabled={!!actionLoading}
                                      className="text-sm text-primary hover:text-primary-hover font-medium disabled:opacity-50"
                                    >
                                      {actionLoading === `accept-inv-${inv.id}` ? '处理中…' : '接受'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRejectInvitation(inv.id)}
                                      disabled={!!actionLoading}
                                      className="text-sm text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
                                    >
                                      {actionLoading === `reject-inv-${inv.id}` ? '处理中…' : '拒绝'}
                                    </button>
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 本班同学组队情况 */}
              {sectionRoster.length > 0 && (
                <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden mb-6">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h2 className="text-base font-medium text-gray-900">本班同学组队情况</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{mySections[0]?.name} · 共 {sectionRoster.length} 人</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50/50">
                          <th className="py-3 px-4 font-medium">姓名</th>
                          <th className="py-3 px-4 font-medium">学号</th>
                          <th className="py-3 px-4 font-medium">组队状态</th>
                          <th className="py-3 px-4 font-medium w-20">操作</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700 divide-y divide-gray-100">
                        {sectionRoster.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-4 font-medium text-gray-900">{row.name}</td>
                            <td className="py-3 px-4 text-gray-600">{row.student_no}</td>
                            <td className="py-3 px-4">
                              {row.groupName ? (
                                <span className="text-gray-700">{row.groupName}</span>
                              ) : (
                                <span className="text-amber-600">未组队</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {!row.groupName && isLeader && row.id !== studentId && (
                                <button
                                  type="button"
                                  onClick={() => handleInvite(row.id)}
                                  disabled={!!actionLoading}
                                  className="text-sm text-primary hover:text-primary-hover font-medium disabled:opacity-50"
                                >
                                  {actionLoading === `invite-${row.id}` ? '邀请中…' : '邀请'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {mySections.map((sec) => {
                  const groups = groupsBySection[sec.id] ?? []
                  const myGroupId = myGroupBySection[sec.id]
                  const myGroup = myGroupId ? groups.find((g) => g.id === myGroupId) : null
                  const canCreate = !myGroupId
                  const canJoin = (g: GroupWithMembers) =>
                    !myGroupId && g.members.length < MAX_GROUP && !g.members.some((m) => m.id === studentId)

                  return (
                    <div key={sec.id} className="bg-white rounded-card shadow-card border border-gray-100 p-5">
                      <h3 className="font-medium text-gray-900 mb-3">
                        {sec.name}
                        {sec.code && (
                          <span className="text-gray-500 font-normal ml-2">({sec.code})</span>
                        )}
                      </h3>
                      {myGroup && (
                        <div className="mb-4 p-4 bg-primary/5 rounded-card border border-primary/20">
                          <p className="text-sm font-medium text-gray-900 mb-2">我的小组：{myGroup.name}</p>
                          <ul className="text-sm text-gray-700 mb-2">
                            {myGroup.members.map((m) => (
                              <li key={m.id}>
                                {m.name}（{m.student_no}）
                                {m.id === myGroup.leader_id && (
                                  <span className="text-primary ml-1">组长</span>
                                )}
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-gray-500 mb-2">
                            {myGroup.members.length}/{MAX_GROUP} 人
                          </p>
                          <div className="flex gap-2">
                            {myGroup.leader_id === studentId ? (
                              <button
                                type="button"
                                onClick={() => handleDissolve(sec.id, myGroup.id)}
                                disabled={!!actionLoading}
                                className="px-3 py-1.5 text-sm text-red-700 bg-red-100 hover:bg-red-200 rounded-card disabled:opacity-50"
                              >
                                解散小组
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleLeave(sec.id, myGroup.id)}
                                disabled={!!actionLoading}
                                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-card disabled:opacity-50"
                              >
                                退出小组
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {canCreate && (
                        <div className="mb-4 flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="小组名称"
                            value={createName[sec.id] ?? ''}
                            onChange={(e) => setCreateName((p) => ({ ...p, [sec.id]: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-card text-sm w-40"
                          />
                          <button
                            type="button"
                            onClick={() => handleCreate(sec.id)}
                            disabled={!!actionLoading}
                            className="px-3 py-2 text-sm bg-primary text-white rounded-card hover:bg-primary-hover disabled:opacity-50 transition-colors"
                          >
                            创建小组
                          </button>
                        </div>
                      )}
                      <div className="space-y-3">
                        {groups
                          .filter((g) => g.id !== myGroupId)
                          .map((g) => (
                            <div
                              key={g.id}
                              className="p-3 border border-gray-200 rounded-card flex items-center justify-between"
                            >
                              <div>
                                <span className="font-medium text-gray-900">{g.name}</span>
                                <span className="text-gray-500 text-sm ml-2">
                                  （{g.members.map((m) => m.name).join('、')}）
                                </span>
                                <span className="text-gray-400 text-sm ml-2">
                                  {g.members.length}/{MAX_GROUP} 人
                                </span>
                              </div>
                              {canJoin(g) && (
                                <button
                                  type="button"
                                  onClick={() => handleJoin(sec.id, g.id)}
                                  disabled={!!actionLoading}
                                  className="px-3 py-1 text-sm text-primary border border-primary rounded-card hover:bg-primary/5 disabled:opacity-50 transition-colors"
                                >
                                  加入
                                </button>
                              )}
                            </div>
                          ))}
                        {groups.filter((g) => g.id !== myGroupId).length === 0 && !myGroup && (
                          <p className="text-sm text-gray-400">暂无其他小组，可创建新小组。</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {selectedCourseId == null && !loadingCourses && courseOptions.length > 0 && (
        <div className="bg-white rounded-card shadow-card border border-gray-100 p-6 text-center text-sm text-gray-500">
          请在上方选择一门课程查看组队情况。
        </div>
      )}
    </div>
  )
}
