'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const MAX_GROUP = 6

type Task = {
  id: number
  course_id: number
  title: string
  description: string | null
  due_at: string
  allow_group: boolean
  group_min: number | null
  group_max: number | null
  group_deadline: string | null
}

type Section = { id: number; name: string; course_id: number }

type StudentInfo = { id: number; name: string; student_no: string }

type GroupWithMembers = {
  id: number
  name: string
  leader_id: number
  section_id: number
  members: StudentInfo[]
}

type Submission = {
  id: number
  content: string | null
  status: string
  submitted_at: string
  score: number | null
  feedback: string | null
  graded_at: string | null
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function StudentTaskDetailPage() {
  const params = useParams()
  const courseId = params.id as string
  const taskIdParam = params.taskId as string
  const courseIdNum = parseInt(courseId, 10)
  const taskIdNum = parseInt(taskIdParam, 10)
  const { user } = useAuth()

  const [task, setTask] = useState<Task | null>(null)
  const [courseName, setCourseName] = useState<string>('')
  const [firstSection, setFirstSection] = useState<Section | null>(null)
  const [groupsInSection, setGroupsInSection] = useState<GroupWithMembers[]>([])
  const [myGroupId, setMyGroupId] = useState<number | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createGroupName, setCreateGroupName] = useState('')
  const [submitContent, setSubmitContent] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchGroupsForSection = useCallback(
    async (supabase: ReturnType<typeof createClient>, sectionId: number, studentId: number) => {
      const { data: groupsData } = await supabase
        .from('group')
        .select('id, name, leader_id, section_id')
        .eq('section_id', sectionId)
      const groups = (groupsData ?? []) as { id: number; name: string; leader_id: number; section_id: number }[]
      if (groups.length === 0) {
        setGroupsInSection([])
        setMyGroupId(null)
        return
      }
      const groupIds = groups.map((g) => g.id)
      const { data: membersData } = await supabase
        .from('group_member')
        .select('group_id, student:student_id(id, name, student_no)')
        .in('group_id', groupIds)
      const membersRaw = (membersData ?? []) as unknown as { group_id: number; student: StudentInfo | null }[]
      const membersByGroup: Record<number, StudentInfo[]> = {}
      for (const g of groups) membersByGroup[g.id] = []
      for (const m of membersRaw) {
        if (m.student) membersByGroup[m.group_id].push(m.student)
      }
      const withMembers: GroupWithMembers[] = groups.map((g) => ({
        ...g,
        members: membersByGroup[g.id] ?? [],
      }))
      setGroupsInSection(withMembers)

      const { data: myMem } = await supabase
        .from('group_member')
        .select('group_id')
        .eq('student_id', studentId)
        .in('group_id', groupIds)
      const my = (myMem ?? []).find((r: { group_id: number }) => r.group_id)
      setMyGroupId(my ? (my as { group_id: number }).group_id : null)
    },
    []
  )

  useEffect(() => {
    if (Number.isNaN(courseIdNum) || Number.isNaN(taskIdNum)) {
      setError('无效的课程或任务 ID')
      setLoading(false)
      return
    }
    if (!user || user.role !== 'student' || user.profile_id == null) {
      setLoading(false)
      return
    }

    const studentId = user.profile_id
    let cancelled = false
    const supabase = createClient()

    async function fetchData() {
      try {
        const { data: taskData, error: taskErr } = await supabase
          .from('task')
          .select('id, course_id, title, description, due_at, allow_group, group_min, group_max, group_deadline')
          .eq('id', taskIdNum)
          .eq('course_id', courseIdNum)
          .single()
        if (cancelled) return
        if (taskErr || !taskData) {
          setError(taskErr?.code === 'PGRST116' ? '任务不存在' : taskErr?.message ?? '加载失败')
          setLoading(false)
          return
        }
        setTask(taskData as Task)

        const { data: courseData } = await supabase
          .from('course')
          .select('name')
          .eq('id', courseIdNum)
          .single()
        if (courseData) setCourseName((courseData as { name: string }).name)

        const { data: sectionData } = await supabase
          .from('section')
          .select('id, name, course_id')
          .eq('course_id', courseIdNum)
          .order('id')
        const sections = (sectionData ?? []) as Section[]
        const sectionIds = sections.map((s) => s.id)
        if (sectionIds.length === 0) {
          setError('课程下暂无班级')
          setLoading(false)
          return
        }

        const { data: enrollData } = await supabase
          .from('enrollment')
          .select('section_id')
          .eq('student_id', studentId)
          .in('section_id', sectionIds)
        const enrolledIds = new Set((enrollData ?? []).map((r: { section_id: number }) => r.section_id))
        const mySections = sections.filter((s) => enrolledIds.has(s.id))
        if (mySections.length === 0) {
          setError('您未选读该课程')
          setLoading(false)
          return
        }
        const first = mySections[0]
        setFirstSection(first)
        await fetchGroupsForSection(supabase, first.id, studentId)

        let sub: Submission | null = null
        const { data: subByStudent } = await supabase
          .from('submission')
          .select('id, content, status, submitted_at, score, feedback, graded_at')
          .eq('task_id', taskIdNum)
          .eq('student_id', studentId)
          .maybeSingle()
        if (subByStudent) sub = subByStudent as Submission
        if (!sub && taskData.allow_group) {
          const groupsInFirst = await supabase.from('group').select('id').eq('section_id', first.id)
          const gIds = (groupsInFirst.data ?? []).map((x: { id: number }) => x.id)
          if (gIds.length > 0) {
            const { data: myMem } = await supabase
              .from('group_member')
              .select('group_id')
              .eq('student_id', studentId)
              .in('group_id', gIds)
              .maybeSingle()
            const myGid = myMem ? (myMem as { group_id: number }).group_id : null
            if (myGid != null) {
              const { data: subByGroup } = await supabase
                .from('submission')
                .select('id, content, status, submitted_at, score, feedback, graded_at')
                .eq('task_id', taskIdNum)
                .eq('group_id', myGid)
                .maybeSingle()
              if (subByGroup) sub = subByGroup as Submission
            }
          }
        }
        setSubmission(sub)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [courseIdNum, taskIdNum, user, fetchGroupsForSection])

  const refreshSubmission = useCallback(async () => {
    if (!user?.profile_id || !task) return
    const supabase = createClient()
    const studentId = user.profile_id
    let sub: Submission | null = null
    const { data: byStudent } = await supabase
      .from('submission')
      .select('id, content, status, submitted_at, score, feedback, graded_at')
      .eq('task_id', task.id)
      .eq('student_id', studentId)
      .maybeSingle()
    if (byStudent) sub = byStudent as Submission
    if (!sub && task.allow_group && firstSection && myGroupId) {
      const { data: byGroup } = await supabase
        .from('submission')
        .select('id, content, status, submitted_at, score, feedback, graded_at')
        .eq('task_id', task.id)
        .eq('group_id', myGroupId)
        .maybeSingle()
      if (byGroup) sub = byGroup as Submission
    }
    setSubmission(sub)
  }, [user, task, firstSection, myGroupId])

  if (!user || user.role !== 'student') return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div>
        <div className="rounded-card bg-red-50 text-red-700 px-4 py-3 mb-4">{error ?? '加载失败'}</div>
        <Link href={`/student/courses/${courseId}`} className="text-primary hover:underline text-sm">
          ← 返回课程详情
        </Link>
      </div>
    )
  }

  const studentId = user.profile_id!
  const supabase = createClient()
  const myGroup = myGroupId ? groupsInSection.find((g) => g.id === myGroupId) : null
  const maxGroup = task.group_max ?? MAX_GROUP

  const handleCreateGroup = async () => {
    const name = createGroupName.trim()
    if (!name || !firstSection) return
    setActionLoading('create')
    try {
      const { data: g, error: e1 } = await supabase
        .from('group')
        .insert({ section_id: firstSection.id, name, leader_id: studentId })
        .select('id')
        .single()
      if (e1) throw e1
      await supabase.from('group_member').insert({ group_id: g!.id, student_id: studentId })
      setCreateGroupName('')
      await fetchGroupsForSection(supabase, firstSection.id, studentId)
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleJoin = async (groupId: number) => {
    if (!firstSection) return
    setActionLoading(`join-${groupId}`)
    try {
      await supabase.from('group_member').insert({ group_id: groupId, student_id: studentId })
      await fetchGroupsForSection(supabase, firstSection.id, studentId)
    } catch (err) {
      alert(err instanceof Error ? err.message : '加入失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleLeave = async () => {
    if (!myGroupId || !firstSection || !confirm('确定退出该小组？')) return
    setActionLoading('leave')
    try {
      await supabase.from('group_member').delete().eq('group_id', myGroupId).eq('student_id', studentId)
      await fetchGroupsForSection(supabase, firstSection.id, studentId)
      setSubmission(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : '退出失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDissolve = async () => {
    if (!myGroupId || !firstSection || !confirm('确定解散该小组？解散后所有成员需重新组队。')) return
    setActionLoading('dissolve')
    try {
      await supabase.from('group').delete().eq('id', myGroupId)
      await fetchGroupsForSection(supabase, firstSection.id, studentId)
      setSubmission(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : '解散失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = submitContent.trim()
    if (!content) {
      setSubmitError('请填写提交内容')
      return
    }
    setSubmitError(null)
    setActionLoading('submit')
    try {
      if (task.allow_group) {
        if (!myGroupId) throw new Error('请先加入或创建小组')
        await supabase.from('submission').insert({ task_id: task.id, group_id: myGroupId, content })
      } else {
        await supabase.from('submission').insert({ task_id: task.id, student_id: studentId, content })
      }
      setSubmitContent('')
      await refreshSubmission()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '提交失败')
    } finally {
      setActionLoading(null)
    }
  }

  const canSubmit = task.allow_group ? !!myGroupId : true
  const showSubmitForm = canSubmit && !submission

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/student/courses/${courseId}`}
          className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          ← 返回课程详情
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{task.title}</h1>
        <span className="text-gray-400 text-sm">（{courseName}）</span>
      </div>

      <section className="bg-white rounded-card shadow-card border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">任务说明</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">提交截止时间</dt>
            <dd className="text-gray-700">{formatDateTime(task.due_at)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">是否组队</dt>
            <dd className="text-gray-700">
              {task.allow_group ? `是（${task.group_min}～${task.group_max} 人）` : '否（个人提交）'}
            </dd>
          </div>
          {task.allow_group && task.group_deadline && (
            <div>
              <dt className="text-gray-500">组队截止时间</dt>
              <dd className="text-gray-700">{formatDateTime(task.group_deadline)}</dd>
            </div>
          )}
          {task.description && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">说明</dt>
              <dd className="text-gray-700 mt-0.5 whitespace-pre-wrap">{task.description}</dd>
            </div>
          )}
        </dl>
      </section>

      {task.allow_group && firstSection && (
        <section className="bg-white rounded-card shadow-card border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-3">我的小组</h2>
          {myGroup ? (
            <div className="p-4 bg-primary/5 rounded-card border border-primary/20">
              <p className="font-medium text-gray-900 mb-2">{myGroup.name}</p>
              <ul className="text-sm text-gray-700 mb-2">
                {myGroup.members.map((m) => (
                  <li key={m.id}>
                    {m.name}（{m.student_no}）
                    {m.id === myGroup.leader_id && <span className="text-primary ml-1">组长</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mb-2">
                {myGroup.members.length}/{maxGroup} 人
              </p>
              <div className="flex gap-2">
                {myGroup.leader_id === studentId ? (
                  <button
                    type="button"
                    onClick={handleDissolve}
                    disabled={!!actionLoading}
                    className="px-3 py-1.5 text-sm text-red-700 bg-red-100 hover:bg-red-200 rounded-card disabled:opacity-50"
                  >
                    解散小组
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLeave}
                    disabled={!!actionLoading}
                    className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-card disabled:opacity-50"
                  >
                    退出小组
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">需组队后以小组为单位提交。请创建小组或加入已有小组。</p>
              <div className="mb-4 flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="小组名称"
                  value={createGroupName}
                  onChange={(e) => setCreateGroupName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-card text-sm w-40"
                />
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={!!actionLoading}
                  className="px-3 py-2 text-sm bg-primary text-white rounded-card hover:bg-primary-hover disabled:opacity-50"
                >
                  创建小组
                </button>
              </div>
              <div className="space-y-2">
                {groupsInSection.map((g) => {
                  const canJoin = g.members.length < maxGroup && !g.members.some((m) => m.id === studentId)
                  return (
                    <div key={g.id} className="p-3 border border-gray-200 rounded-card flex items-center justify-between">
                      <span className="text-sm font-medium">{g.name}</span>
                      <span className="text-gray-500 text-sm">{g.members.length}/{maxGroup} 人</span>
                      {canJoin && (
                        <button
                          type="button"
                          onClick={() => handleJoin(g.id)}
                          disabled={!!actionLoading}
                          className="px-3 py-1 text-sm text-primary border border-primary rounded-card hover:bg-primary/5 disabled:opacity-50"
                        >
                          加入
                        </button>
                      )}
                    </div>
                  )
                })}
                {groupsInSection.length === 0 && <p className="text-sm text-gray-400">暂无其他小组，可创建新小组。</p>}
              </div>
            </>
          )}
        </section>
      )}

      <section className="bg-white rounded-card shadow-card border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">提交</h2>
        {task.allow_group && !myGroupId && (
          <p className="text-amber-700 text-sm mb-3">请先在上方创建或加入小组后再提交。</p>
        )}
        {submission ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              提交时间：{formatDateTime(submission.submitted_at)}
              {submission.status === 'graded' && submission.graded_at && (
                <span className="ml-2 text-gray-500">批改时间：{formatDateTime(submission.graded_at)}</span>
              )}
            </p>
            <div className="rounded-card bg-gray-50 p-3 border border-gray-100 text-sm whitespace-pre-wrap">
              {submission.content || '（无内容）'}
            </div>
            {submission.status === 'graded' && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  成绩：{submission.score != null ? `${submission.score} 分` : '—'}
                </p>
                {submission.feedback && (
                  <p className="text-sm text-gray-700 mt-1">评语：{submission.feedback}</p>
                )}
              </div>
            )}
          </div>
        ) : showSubmitForm ? (
          <form onSubmit={handleSubmit}>
            {submitError && (
              <div className="rounded-card bg-red-50 text-red-700 text-sm px-4 py-3 mb-3">{submitError}</div>
            )}
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              提交内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              value={submitContent}
              onChange={(e) => setSubmitContent(e.target.value)}
              placeholder="请输入作业内容或链接"
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y mb-3"
              disabled={!!actionLoading}
            />
            <button
              type="submit"
              disabled={!!actionLoading}
              className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover disabled:opacity-50"
            >
              {actionLoading === 'submit' ? '提交中…' : '提交'}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  )
}
