import { Header } from "@/components/layout/header"
import { DomainsView } from "@/components/domains/domains-view"
import { NoPermissionDialog } from "@/components/no-permission-dialog"
import { auth, checkPermission } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PERMISSIONS } from "@/lib/permissions"
import type { Locale } from "@/i18n/config"

export const runtime = "edge"

export default async function DomainsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeFromParams } = await params
  const locale = localeFromParams as Locale
  const session = await auth()

  if (!session?.user) {
    redirect(`/${locale}`)
  }

  const hasPermission = await checkPermission(PERMISSIONS.MANAGE_EMAIL)

  return (
    <div className="h-screen bg-muted/40">
      <div className="container mx-auto h-full px-4 lg:px-8 max-w-[1600px]">
        <Header />
        <main className="h-full">
          <DomainsView />
          {!hasPermission && <NoPermissionDialog />}
        </main>
      </div>
    </div>
  )
}
