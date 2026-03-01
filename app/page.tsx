import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">
        高校教务协作平台
      </h1>
      <p className="text-gray-500 text-sm mb-12">
        请选择身份进入
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
        <Link
          href="/select-user?role=admin"
          className="block p-6 bg-white rounded-card shadow-card border border-gray-100 hover:shadow-card-hover transition-shadow text-center"
        >
          <span className="text-2xl mb-3 block" aria-hidden>📋</span>
          <span className="font-medium text-gray-900 block mb-1">教务处管理</span>
          <span className="text-sm text-gray-500">发布公告、管理课程与统计</span>
        </Link>
        <Link
          href="/select-user?role=teacher"
          className="block p-6 bg-white rounded-card shadow-card border border-gray-100 hover:shadow-card-hover transition-shadow text-center"
        >
          <span className="text-2xl mb-3 block" aria-hidden>👨‍🏫</span>
          <span className="font-medium text-gray-900 block mb-1">教师端</span>
          <span className="text-sm text-gray-500">课程与任务、批改与成绩</span>
        </Link>
        <Link
          href="/select-user?role=student"
          className="block p-6 bg-white rounded-card shadow-card border border-gray-100 hover:shadow-card-hover transition-shadow text-center"
        >
          <span className="text-2xl mb-3 block" aria-hidden>👨‍🎓</span>
          <span className="font-medium text-gray-900 block mb-1">学生端</span>
          <span className="text-sm text-gray-500">我的课程、组队与提交、成绩查看</span>
        </Link>
      </div>
    </main>
  )
}
