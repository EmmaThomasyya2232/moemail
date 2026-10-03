"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Globe } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useState, useEffect } from "react"
import { Role, ROLES } from "@/lib/permissions"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EMAIL_CONFIG } from "@/config"

export function WebsiteConfigPanel() {
  const t = useTranslations("profile.website")
  const tCard = useTranslations("profile.card")
  const [defaultRole, setDefaultRole] = useState<string>("")
  const [domains, setDomains] = useState<string[]>([])
  const [domainInput, setDomainInput] = useState<string>("")
  const [subdomainEnabled, setSubdomainEnabled] = useState<Record<string, boolean>>({})
  const [adminContact, setAdminContact] = useState<string>("")
  const [maxEmails, setMaxEmails] = useState<string>(EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString())
  const [turnstileEnabled, setTurnstileEnabled] = useState(false)
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("")
  const [turnstileSecretKey, setTurnstileSecretKey] = useState("")
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    const res = await fetch("/api/config")
    if (res.ok) {
      const data = await res.json() as {
        defaultRole: Exclude<Role, typeof ROLES.EMPEROR>,
        emailDomains: string,
        emailSubdomainDomains?: string,
        adminContact: string,
        maxEmails: string,
        turnstile?: {
          enabled: boolean,
          siteKey: string,
          secretKey?: string
        }
      }
      setDefaultRole(data.defaultRole)
      const list = (data.emailDomains || "")
        .split(",")
        .map(d => d.trim().toLowerCase())
        .filter(Boolean)
      const enabled = (data.emailSubdomainDomains || "")
        .split(",")
        .map(d => d.trim().toLowerCase())
        .filter(Boolean)
      setDomains(list)
      setSubdomainEnabled(
        Object.fromEntries(list.map(d => [d, enabled.length === 0 || enabled.includes(d)]))
      )
      setAdminContact(data.adminContact)
      setMaxEmails(data.maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString())
      setTurnstileEnabled(Boolean(data.turnstile?.enabled))
      setTurnstileSiteKey(data.turnstile?.siteKey ?? "")
      setTurnstileSecretKey(data.turnstile?.secretKey ?? "")
    }
  }

  const addDomain = () => {
    const value = domainInput.trim().toLowerCase()
    if (!value || domains.includes(value)) {
      setDomainInput("")
      return
    }
    setDomains(prev => [...prev, value])
    setSubdomainEnabled(prev => ({ ...prev, [value]: true }))
    setDomainInput("")
  }

  const removeDomain = (domain: string) => {
    setDomains(prev => prev.filter(d => d !== domain))
    setSubdomainEnabled(prev => {
      const next = { ...prev }
      delete next[domain]
      return next
    })
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const allowed = domains.filter(d => subdomainEnabled[d] !== false)
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultRole,
          emailDomains: domains.join(","),
          emailSubdomainDomains: allowed.length === domains.length ? "" : allowed.join(","),
          adminContact,
          maxEmails: maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString(),
          turnstile: {
            enabled: turnstileEnabled,
            siteKey: turnstileSiteKey,
            secretKey: turnstileSecretKey
          }
        }),
      })

      if (!res.ok) throw new Error(t("saveFailed"))

      toast({
        title: t("saveSuccess"),
        description: t("saveSuccess"),
      })
    } catch {
      toast({
        title: t("saveFailed"),
        description: t("saveFailed"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Globe className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{t("title")}</h2>
      </div>
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-[13px] text-muted-foreground">{t("defaultRole")}</span>
          <div className="flex-1">
            <Select value={defaultRole} onValueChange={setDefaultRole}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue placeholder={t("defaultRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROLES.DUKE}>{tCard("roles.DUKE")}</SelectItem>
                <SelectItem value={ROLES.KNIGHT}>{tCard("roles.KNIGHT")}</SelectItem>
                <SelectItem value={ROLES.CIVILIAN}>{tCard("roles.CIVILIAN")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[13px] font-medium">
              {t("emailDomains")} {domains.length > 0 && <span className="text-muted-foreground">({domains.length})</span>}
            </Label>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("subdomainHint")}</p>
          <div className="flex gap-2">
            <Input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDomain() } }}
              placeholder={t("emailDomainsPlaceholder")}
              className="h-8 text-[13px]"
            />
            <Button type="button" size="sm" variant="outline" onClick={addDomain}>
              {t("addDomain")}
            </Button>
          </div>
          {domains.length > 0 ? (
            <div className="divide-y rounded-lg border">
              {domains.map(domain => (
                <div key={domain} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px]">@{domain}</span>
                  <Label htmlFor={`sub-${domain}`} className="shrink-0 text-[11px] text-muted-foreground">
                    {t("subdomainEnabled")}
                  </Label>
                  <Switch
                    id={`sub-${domain}`}
                    checked={subdomainEnabled[domain] !== false}
                    onCheckedChange={(v) => setSubdomainEnabled(prev => ({ ...prev, [domain]: v }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-[12px] text-destructive hover:text-destructive"
                    onClick={() => removeDomain(domain)}
                  >
                    {t("removeDomain")}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("emailDomainsPlaceholder")}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="shrink-0 text-[13px] text-muted-foreground">{t("adminContact")}</span>
          <div className="flex-1">
            <Input
              value={adminContact}
              onChange={(e) => setAdminContact(e.target.value)}
              placeholder={t("adminContactPlaceholder")}
              className="h-8 text-[13px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="shrink-0 text-[13px] text-muted-foreground">{t("maxEmails")}</span>
          <div className="flex-1">
            <Input
              type="number"
              min="1"
              max="100"
              value={maxEmails}
              onChange={(e) => setMaxEmails(e.target.value)}
              placeholder={`${EMAIL_CONFIG.MAX_ACTIVE_EMAILS}`}
              className="h-8 text-[13px]"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="turnstile-enabled" className="text-[13px] font-medium">
                {t("turnstile.enable")}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t("turnstile.enableDescription")}
              </p>
            </div>
            <Switch
              id="turnstile-enabled"
              checked={turnstileEnabled}
              onCheckedChange={setTurnstileEnabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="turnstile-site-key" className="text-[13px] font-medium">
              {t("turnstile.siteKey")}
            </Label>
            <Input
              id="turnstile-site-key"
              value={turnstileSiteKey}
              onChange={(e) => setTurnstileSiteKey(e.target.value)}
              placeholder={t("turnstile.siteKeyPlaceholder")}
              className="h-8 text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="turnstile-secret-key" className="text-[13px] font-medium">
              {t("turnstile.secretKey")}
            </Label>
            <div className="relative">
              <Input
                id="turnstile-secret-key"
                type={showSecretKey ? "text" : "password"}
                value={turnstileSecretKey}
                onChange={(e) => setTurnstileSecretKey(e.target.value)}
                placeholder={t("turnstile.secretKeyPlaceholder")}
                className="h-8 pr-9 text-[13px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowSecretKey((prev) => !prev)}
              >
                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("turnstile.secretKeyDescription")}
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={loading}
          className="h-8 w-full text-[13px]"
        >
          {loading ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  )
}
