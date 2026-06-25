import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SessionProvider } from "@/components/session-provider"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()
  if (!user) redirect("/login")

  return (
    <SessionProvider user={user}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </SessionProvider>
  )
}
