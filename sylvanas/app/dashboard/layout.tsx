import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SessionProvider } from "@/components/session-provider"
import { SubscriptionProvider } from "@/lib/subscription-context"
import { getSubscription } from "@/lib/subscription-server"
import { Sidebar } from "@/components/layout/sidebar"
import { TrialBanner } from "@/components/shared/TrialBanner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()
  if (!user) redirect("/login")

  const subscription = await getSubscription()

  return (
    <SessionProvider user={user}>
      <SubscriptionProvider initial={subscription}>
        <TrialBanner />
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </SubscriptionProvider>
    </SessionProvider>
  )
}
