import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { apiFetch } from "@/lib/api"
import { SessionProvider } from "@/components/session-provider"
import {
  SubscriptionProvider,
  DEFAULT_SUBSCRIPTION_STATE,
  type SubscriptionState,
} from "@/lib/subscription-context"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()
  if (!user) redirect("/login")

  let subscription: SubscriptionState = DEFAULT_SUBSCRIPTION_STATE
  try {
    subscription = await apiFetch<SubscriptionState>("/brand/subscription")
  } catch {
    // 401/404/etc — fall back to default state rather than breaking the
    // dashboard shell; the client can refetch via SubscriptionProvider later.
  }

  return (
    <SessionProvider user={user}>
      <SubscriptionProvider initial={subscription}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </SubscriptionProvider>
    </SessionProvider>
  )
}
