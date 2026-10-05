"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

export function NavLinks() {
  const t = useTranslations("common.nav")
  const locale = useLocale()
  const pathname = usePathname()
  const { data: session, status } = useSession()

  if (status === "loading" || !session?.user) {
    return null
  }

  const items = [
    { href: `/${locale}/moe`, label: t("mailbox") },
    { href: `/${locale}/domains`, label: t("domains") },
    { href: `/${locale}/api-docs`, label: t("api") },
    { href: `/${locale}/profile`, label: t("profile") },
  ]

  return (
    <nav className="hidden items-center gap-0.5 sm:flex">
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
