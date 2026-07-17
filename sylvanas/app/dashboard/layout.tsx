import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SessionProvider } from "@/components/session-provider"
import { SubscriptionProvider } from "@/lib/subscription-context"
import { getSubscription } from "@/lib/subscription-server"
import { WalletProvider } from "@/lib/wallet-context"
import { getWallet } from "@/lib/wallet-server"
import { Sidebar } from "@/components/layout/sidebar"
import { TrialBanner } from "@/components/shared/TrialBanner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()
  if (!user) redirect("/login")

  const [subscription, wallet] = await Promise.all([getSubscription(), getWallet()])

  return (
    <SessionProvider user={user}>
      <SubscriptionProvider initial={subscription}>
        <WalletProvider initial={wallet}>
          <TrialBanner />
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </div>
        </WalletProvider>
      </SubscriptionProvider>
    </SessionProvider>
  )
}
