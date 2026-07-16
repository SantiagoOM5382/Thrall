import { redirect } from "next/navigation"
import { getSubscription } from "@/lib/subscription-server"
import { UpsellCard } from "@/components/shared/UpsellCard"

export default async function SubscribePage() {
  const sub = await getSubscription()

  if (sub.isPaidEffective) {
    redirect("/dashboard/services")
  }

  return <UpsellCard reason={sub.status === "expired" ? "trial_expired" : "free"} />
}
