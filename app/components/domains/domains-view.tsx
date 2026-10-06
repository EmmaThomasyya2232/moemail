"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  Check,
  Copy,
  Globe,
  Info,
  Mailbox,
  Search,
  ShieldCheck,
  ShieldOff
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfig } from "@/hooks/use-config"
import { useCopy } from "@/hooks/use-copy"

interface CopyLabels {
  copy: string
  copied: string
}

function CopyButton({ value, active, onCopy, labels }: { value: string; active: boolean; onCopy: (value: string) => void; labels: CopyLabels }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground"
      title={active ? labels.copied : labels.copy}
      onClick={() => onCopy(value)}
    >
      {active ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

function AddressRow({ label, value, active, onCopy, labels }: { label: string; value: string; active: boolean; onCopy: (value: string) => void; labels: CopyLabels }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{value}</span>
      <CopyButton value={value} active={active} onCopy={onCopy} labels={labels} />
    </div>
  )
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">{label}</span>
      <span className="shrink-0 text-[12px] font-medium">{value}</span>
    </div>
  )
}

export function DomainsView() {
  const t = useTranslations("domains")
  const tCard = useTranslations("profile.card")
  const { config, loading, error } = useConfig()
  const { copyToClipboard } = useCopy()
  const [search, setSearch] = useState("")
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [copiedValue, setCopiedValue] = useState<string | null>(null)

  const domains = useMemo(() => config?.emailEnabledDomainsArray ?? config?.emailDomainsArray ?? [], [config])
  const totalDomains = config?.emailDomainsArray.length ?? domains.length
  const subdomainDomains = config?.emailSubdomainDomainsArray ?? []
  // 与创建邮箱弹窗保持一致：子域名单为空表示「所有域名都允许子域名」
  const subdomainForAll = subdomainDomains.length === 0
  const isSubdomainEnabled = (domain: string) => subdomainForAll || subdomainDomains.includes(domain)

  const filteredDomains = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return domains
    return domains.filter(domain => domain.toLowerCase().includes(keyword))
  }, [domains, search])

  const desktopDomain = selectedDomain && domains.includes(selectedDomain)
    ? selectedDomain
    : (filteredDomains[0] ?? null)
  const mobileDomain = selectedDomain && domains.includes(selectedDomain) ? selectedDomain : null

  useEffect(() => {
    if (copiedValue === null) return
    const timer = setTimeout(() => setCopiedValue(null), 1600)
    return () => clearTimeout(timer)
  }, [copiedValue])

  const handleCopy = async (value: string) => {
    const success = await copyToClipboard(value)
    if (success) setCopiedValue(value)
  }

  const labels: CopyLabels = { copy: t("copy"), copied: t("copied") }

  const roleLabel = (role?: string) => {
    if (!role) return "-"
    const key = String(role).toUpperCase()
    const known = ["EMPEROR", "DUKE", "KNIGHT", "CIVILIAN"] as const
    if ((known as readonly string[]).includes(key)) {
      return tCard(`roles.${key}`)
    }
    return String(role)
  }

  if (loading && !config) {
    return (
      <div className="flex h-full min-h-0 flex-col pt-16 pb-4">
        <div className="flex min-h-0 flex-1 divide-x overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="w-[280px] shrink-0 space-y-1.5 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
          <div className="flex-1 space-y-3 p-6">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 pt-16 pb-4 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <p className="text-[13px] text-destructive">{t("loadError")}</p>
      </div>
    )
  }

  const list = (
    <>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-semibold tracking-tight">{t("title")}</span>
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {t("count", { count: totalDomains })}
          </span>
        </div>
      </div>

      <div className="shrink-0 border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 pl-7 text-[13px]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {filteredDomains.length > 0 ? (
          <div className="space-y-0.5">
            {filteredDomains.map(domain => {
              const enabled = isSubdomainEnabled(domain)
              const isActive = domain === desktopDomain
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => setSelectedDomain(domain)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring",
                    isActive ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    <Globe className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12px] font-medium leading-tight">@{domain}</span>
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                      {enabled ? t("subdomainEnabled") : t("subdomainDisabled")}
                    </span>
                  </span>
                  {enabled ? (
                    <ShieldCheck className="size-3.5 shrink-0 text-primary/70" />
                  ) : (
                    <ShieldOff className="size-3.5 shrink-0 text-muted-foreground/60" />
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Globe className="size-4" />
            </div>
            <p className="max-w-[200px] text-[12px] leading-relaxed text-muted-foreground">
              {totalDomains === 0 ? t("noDomains") : t("searchNoResult")}
            </p>
          </div>
        )}
      </div>
    </>
  )

  const detail = (domain: string, leading?: ReactNode) => {
    const enabled = isSubdomainEnabled(domain)
    const rootExample = `hello@${domain}`
    const subExample = `team.hello@${domain}`

    return (
      <>
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
          {leading}
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <AtSign className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-[13px] font-semibold tracking-tight">{domain}</span>
              <CopyButton value={domain} active={copiedValue === domain} onCopy={handleCopy} labels={labels} />
            </div>
            {enabled ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <ShieldCheck className="size-3" />
                {t("subdomainEnabled")}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <ShieldOff className="size-3" />
                {t("subdomainDisabled")}
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          <p className="text-[12px] leading-relaxed text-muted-foreground">{t("subtitle")}</p>

          <section className="rounded-lg border">
            <header className="flex items-center gap-2 border-b px-3 py-2">
              <Mailbox className="size-3.5 text-muted-foreground" />
              <h3 className="text-[12px] font-semibold tracking-tight">{t("addressExamples")}</h3>
            </header>
            <div className="divide-y">
              <AddressRow label={t("exampleRoot")} value={rootExample} active={copiedValue === rootExample} onCopy={handleCopy} labels={labels} />
              {enabled && (
                <AddressRow label={t("exampleSub")} value={subExample} active={copiedValue === subExample} onCopy={handleCopy} labels={labels} />
              )}
            </div>
            <p className="px-3 pb-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {enabled ? t("subdomainEnabledHint", { example: subExample }) : t("subdomainDisabledHint")}
            </p>
          </section>

          <section className="rounded-lg border">
            <header className="flex items-center gap-2 border-b px-3 py-2">
              <Info className="size-3.5 text-muted-foreground" />
              <h3 className="text-[12px] font-semibold tracking-tight">{t("policy")}</h3>
            </header>
            <dl className="divide-y">
              <PolicyRow label={t("maxEmails")} value={config ? String(config.maxEmails) : "-"} />
              <PolicyRow label={t("defaultRole")} value={roleLabel(config?.defaultRole)} />
              <PolicyRow label={t("adminContact")} value={config?.adminContact || t("adminContactNone")} />
            </dl>
          </section>

          <section className="rounded-lg border border-dashed bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Info className="size-3.5 text-muted-foreground" />
              <h3 className="text-[12px] font-semibold tracking-tight">{t("dnsNoticeTitle")}</h3>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{t("dnsNotice")}</p>
          </section>
        </div>
      </>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col pt-16 pb-4">
      {/* 桌面端双栏布局 */}
      <div className="hidden min-h-0 flex-1 divide-x overflow-hidden rounded-xl border bg-card shadow-sm lg:flex">
        <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden xl:w-[320px]">{list}</aside>
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {desktopDomain ? (
            detail(desktopDomain)
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Globe className="size-5" />
              </div>
              <p className="max-w-[240px] text-[13px] leading-relaxed text-muted-foreground">{t("selectDomain")}</p>
            </div>
          )}
        </section>
      </div>

      {/* 移动端单栏布局 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:hidden">
        {mobileDomain
          ? detail(
              mobileDomain,
              <button
                type="button"
                onClick={() => setSelectedDomain(null)}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                {t("title")}
              </button>
            )
          : list}
      </div>
    </div>
  )
}
