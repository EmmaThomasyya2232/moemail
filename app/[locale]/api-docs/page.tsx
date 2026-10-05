import { Header } from "@/components/layout/header"
import { ApiDocsView } from "@/components/api-docs/api-docs-view"
import { auth } from "@/lib/auth"
import type { Locale } from "@/i18n/config"
import { headers } from "next/headers"

export const runtime = "edge"

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")
  }
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? ""
  return host ? `${proto}://${host}` : ""
}

export default async function ApiDocsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeFromParams } = await params
  const locale = localeFromParams as Locale
  void locale
  const session = await auth()

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="container mx-auto px-4 lg:px-8 max-w-[1600px]">
        <Header />
        <main>
          <ApiDocsView baseUrl={await getBaseUrl()} authed={Boolean(session?.user)} />
        </main>
      </div>
    </div>
  )
}
