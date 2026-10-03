"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useCopy } from "@/hooks/use-copy"
import { useState, useEffect } from "react"
import { Role, ROLES } from "@/lib/permissions"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff } from "lucide-react"
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
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null)
  const { toast } = useToast()
  const { copyToClipboard } = useCopy()


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
      const subdomainList = domains.filter(d => subdomainEnabled[d] !== false)
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          defaultRole, 
          emailDomains: domains.join(","),
          emailSubdomainDomains: subdomainList.length === domains.length ? "" : subdomainList.join(","),
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
    } catch (error) {
      toast({
        title: t("saveFailed"),
        description: error instanceof Error ? error.message : t("saveFailed"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background rounded-lg border-2 border-primary/20 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm">{t("defaultRole")}:</span>
          <Select value={defaultRole} onValueChange={setDefaultRole}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROLES.DUKE}>{tCard("roles.DUKE")}</SelectItem>
              <SelectItem value={ROLES.KNIGHT}>{tCard("roles.KNIGHT")}</SelectItem>
              <SelectItem value={ROLES.CIVILIAN}>{tCard("roles.CIVILIAN")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <span className="text-sm">{t("emailDomains")} ({domains.length}):</span>
          <div className="flex gap-2">
            <Input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addDomain()
                }
              }}
              placeholder={t("emailDomainsPlaceholder")}
            />
            <Button type="button" variant="outline" onClick={addDomain}>
              {t("addDomain")}
            </Button>
          </div>
          {domains.length > 0 ? (
            <div className="space-y-2 rounded-lg border p-3">
              {domains.map((domain) => (
                <div key={domain} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-mono">@{domain}</span>
                    <Label htmlFor={`subdomain-${domain}`} className="shrink-0 text-xs text-muted-foreground">
                      {t("subdomainEnabled")}
                    </Label>
                    <Switch
                      id={`subdomain-${domain}`}
                      checked={subdomainEnabled[domain] !== false}
                      onCheckedChange={(checked) =>
                        setSubdomainEnabled(prev => ({ ...prev, [domain]: checked }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDomain(domain)}
                    >
                      {t("removeDomain")}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedGuide(prev => prev === domain ? null : domain)}
                  >
                    {expandedGuide === domain ? t("guideHide") : t("guideShow")}
                  </Button>
                  {expandedGuide === domain && (
                    <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
                      <p className="font-medium text-sm">{t("guideTitle", { domain })}</p>
                      <ol className="list-decimal space-y-1 pl-4">
                        <li>{t("guideStep1", { domain })}</li>
                        <li>{t("guideStep2")}</li>
                        <li>{t("guideStep3", { domain })}</li>
                        <li>{t("guideStep4")}</li>
                        <li>{t("guideStep5", { domain })}</li>
                      </ol>
                      <div className="space-y-1 font-mono">
                        {[
                          `MX @ route1.mx.cloudflare.net`,
                          `MX @ route2.mx.cloudflare.net`,
                          `MX @ route3.mx.cloudflare.net`,
                          `MX * route1.mx.cloudflare.net`,
                          `MX * route2.mx.cloudflare.net`,
                          `MX * route3.mx.cloudflare.net`,
                          `TXT @ v=spf1 include:_spf.mx.cloudflare.net ~all`,
                        ].map(line => (
                          <div key={line} className="flex items-center justify-between gap-2 rounded bg-background px-2 py-1">
                            <span className="truncate">{line}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 shrink-0 px-2"
                              onClick={() => copyToClipboard(line)}
                            >
                              {t("copyRecord")}
                            </Button>
                          </div>
                        ))}
                      </div>
                      <p className="text-muted-foreground">{t("guideVerify", { domain })}</p>
                    </div>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t("subdomainHint")}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("emailDomainsPlaceholder")}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm">{t("adminContact")}:</span>
          <div className="flex-1">
            <Input 
              value={adminContact}
              onChange={(e) => setAdminContact(e.target.value)}
              placeholder={t("adminContactPlaceholder")}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm">{t("maxEmails")}:</span>
          <div className="flex-1">
            <Input 
              type="number"
              min="1"
              max="100"
              value={maxEmails}
              onChange={(e) => setMaxEmails(e.target.value)}
              placeholder={`${EMAIL_CONFIG.MAX_ACTIVE_EMAILS}`}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-dashed border-primary/40 p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="turnstile-enabled" className="text-sm font-medium">
                {t("turnstile.enable")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("turnstile.enableDescription")}
              </p>
            </div>
            <Switch
              id="turnstile-enabled"
              checked={turnstileEnabled}
              onCheckedChange={setTurnstileEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="turnstile-site-key" className="text-sm font-medium">
              {t("turnstile.siteKey")}
            </Label>
            <Input
              id="turnstile-site-key"
              value={turnstileSiteKey}
              onChange={(e) => setTurnstileSiteKey(e.target.value)}
              placeholder={t("turnstile.siteKeyPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="turnstile-secret-key" className="text-sm font-medium">
              {t("turnstile.secretKey")}
            </Label>
            <div className="relative">
              <Input
                id="turnstile-secret-key"
                type={showSecretKey ? "text" : "password"}
                value={turnstileSecretKey}
                onChange={(e) => setTurnstileSecretKey(e.target.value)}
                placeholder={t("turnstile.secretKeyPlaceholder")}
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
            <p className="text-xs text-muted-foreground">
              {t("turnstile.secretKeyDescription")}
            </p>
          </div>
        </div>

        <Button 
          onClick={handleSave}
          disabled={loading}
          className="w-full"
        >
          {t("save")}
        </Button>
      </div>
    </div>
  )
} 
