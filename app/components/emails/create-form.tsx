"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, RefreshCw, Dices } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { nanoid, customAlphabet } from "nanoid"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EXPIRY_OPTIONS } from "@/types/email"
import { useCopy } from "@/hooks/use-copy"
import { useConfig } from "@/hooks/use-config"
import { cn } from "@/lib/utils"

// DNS 安全的子域随机串：小写字母+数字，避免 nanoid 默认字符集中的 `_ -`
const randomSubdomainAlphabet = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6)

interface CreateFormProps {
  onEmailCreated: () => void
  onCancel?: () => void
  showCancel?: boolean
  compact?: boolean
  autoFocus?: boolean
}

export function CreateForm({ onEmailCreated, onCancel, showCancel, compact, autoFocus }: CreateFormProps) {
  const { config } = useConfig()
  const t = useTranslations("emails.create")
  const tList = useTranslations("emails.list")
  const tCommon = useTranslations("common.actions")
  const [loading, setLoading] = useState(false)
  const [emailName, setEmailName] = useState("")
  const [currentDomain, setCurrentDomain] = useState("")
  const [domainSearch, setDomainSearch] = useState("")
  const [subDomain, setSubDomain] = useState("")
  const [expiryTime, setExpiryTime] = useState(EXPIRY_OPTIONS[1].value.toString())
  const { toast } = useToast()
  const { copyToClipboard } = useCopy()

  const domains = config?.emailDomainsArray ?? []
  const enabledDomains = config?.emailEnabledDomainsArray ?? domains
  const subdomainDomains = config?.emailSubdomainDomainsArray ?? []
  const subdomainEnabledForCurrent =
    subdomainDomains.length === 0 || subdomainDomains.includes(currentDomain)
  const filteredDomains = enabledDomains.filter(d =>
    d.toLowerCase().includes(domainSearch.trim().toLowerCase())
  )

  const generateRandomName = () => setEmailName(nanoid(8))
  const generateRandomSubDomain = () => {
    if (!subdomainEnabledForCurrent) return
    setSubDomain(randomSubdomainAlphabet())
  }

  const buildEmailAddress = () => {
    const prefix = subDomain.trim()
    return `${emailName}@${prefix ? `${prefix}.` : ""}${currentDomain}`
  }

  const copyEmailAddress = () => {
    copyToClipboard(buildEmailAddress())
  }


  const doCreate = async (name: string, sub: string) => {
    setLoading(true)
    try {
      const response = await fetch("/api/emails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subDomain: sub,
          domain: currentDomain,
          expiryTime: parseInt(expiryTime)
        })
      })
      if (!response.ok) {
        const data = await response.json() as { code?: string, error: string }
        if (data.code === "SUBDOMAIN_NOT_ENABLED") setSubDomain("")
        toast({ title: tList("error"), description: data.error, variant: "destructive" })
        return
      }
      toast({ title: tList("success"), description: t("success") })
      onEmailCreated()
      setEmailName("")
      setSubDomain("")
    } catch {
      toast({ title: tList("error"), description: t("failed"), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const createEmail = async () => {
    if (!emailName.trim()) {
      const random = nanoid(8)
      setEmailName(random)
      await doCreate(random, subDomain.trim())
      return
    }
    await doCreate(emailName, subDomain.trim())
  }

  useEffect(() => {
    if (enabledDomains.length > 0 && !enabledDomains.includes(currentDomain)) {
      setCurrentDomain(enabledDomains[0])
    }
  }, [enabledDomains, currentDomain])

  useEffect(() => {
    if ((config?.emailDomainsArray?.length ?? 0) > 0 && enabledDomains.length === 0) {
      setCurrentDomain("")
    }
  }, [config, enabledDomains.length])

  useEffect(() => {
    if (!subdomainEnabledForCurrent && subDomain.trim()) setSubDomain("")
  }, [currentDomain, subdomainEnabledForCurrent, subDomain])
  return (
    <div className={cn("space-y-3", compact ? "py-1" : "py-2")}>
      <div className="space-y-2">
        <div className="flex gap-1.5">
          <Input
            value={emailName}
            onChange={(e) => setEmailName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="h-8 flex-1 text-[13px]"
            autoFocus={autoFocus}
            onKeyDown={(e) => { if (e.key === "Enter") createEmail() }}
          />
          <Button variant="outline" size="icon" onClick={generateRandomName} type="button" className="h-8 w-8 shrink-0" title={t("randomName")}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Input
              value={subDomain}
              onChange={(e) => setSubDomain(e.target.value)}
              placeholder={t("subDomainPlaceholder")}
              className="h-8 pr-8 text-[13px]"
              disabled={!subdomainEnabledForCurrent}
              onKeyDown={(e) => { if (e.key === "Enter") createEmail() }}
            />
            <button
              type="button"
              onClick={generateRandomSubDomain}
              disabled={!subdomainEnabledForCurrent}
              title={t("randomSubdomain")}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Dices className="h-3.5 w-3.5" />
            </button>
          </div>
          <Select value={currentDomain} onValueChange={setCurrentDomain}>
            <SelectTrigger className="h-8 w-[132px] shrink-0 text-[13px]">
              <SelectValue placeholder={t("domainPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <Input value={domainSearch} onChange={(e) => setDomainSearch(e.target.value)} placeholder={t("domainSearchPlaceholder")} className="h-8" />
              </div>
              {filteredDomains.length > 0 ? (
                filteredDomains.map(d => (
                  <SelectItem key={d} value={d}>
                    @{d}
                    {(config?.emailSubdomainDomainsArray ?? []).length > 0 &&
                      !(config?.emailSubdomainDomainsArray ?? []).includes(d) &&
                      ` (${t("subdomainDisabledSuffix")})`}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">{t("domainNoResult")}</div>
              )}
            </SelectContent>
          </Select>
        </div>
        {!subdomainEnabledForCurrent && (
          <p className="text-[11px] leading-tight text-muted-foreground">{t("subdomainDisabledHint")}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Label className="shrink-0 text-[12px] text-muted-foreground">{t("expiryTime")}</Label>
        <RadioGroup value={expiryTime} onValueChange={setExpiryTime} className="flex flex-wrap gap-x-3 gap-y-1">
          {EXPIRY_OPTIONS.map((option, index) => {
            const labels = [t("oneHour"), t("oneDay"), t("threeDays"), t("permanent")]
            return (
              <div key={option.value} className="flex items-center gap-1.5">
                <RadioGroupItem value={option.value.toString()} id={`inline-${option.value}`} className="h-3.5 w-3.5" />
                <Label htmlFor={`inline-${option.value}`} className="cursor-pointer text-[12px] font-normal">{labels[index]}</Label>
              </div>
            )
          })}
        </RadioGroup>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="shrink-0">{t("domain")}:</span>
        {emailName && currentDomain ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{buildEmailAddress()}</span>
            <div className="shrink-0 cursor-pointer transition-colors hover:text-primary" onClick={copyEmailAddress}>
              <Copy className="size-3.5" />
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground/70">...</span>
        )}
      </div>
      <div className="flex justify-end gap-2">
        {showCancel && onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>{tCommon("cancel")}</Button>
        )}
        <Button size="sm" onClick={createEmail} disabled={loading} className="min-w-[72px]">
          {loading ? t("creating") : t("create")}
        </Button>
      </div>
    </div>
  )
}

