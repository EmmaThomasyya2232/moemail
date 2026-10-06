"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Copy, Plus, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { nanoid } from "nanoid"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EXPIRY_OPTIONS } from "@/types/email"
import { useCopy } from "@/hooks/use-copy"
import { useConfig } from "@/hooks/use-config"

interface CreateDialogProps {
  onEmailCreated: () => void
  trigger?: ReactNode
}

export function CreateDialog({ onEmailCreated, trigger }: CreateDialogProps) {
  const { config } = useConfig()
  const t = useTranslations("emails.create")
  const tList = useTranslations("emails.list")
  const tCommon = useTranslations("common.actions")
  const [open, setOpen] = useState(false)
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

  const buildEmailAddress = () => {
    const prefix = subDomain.trim()
    return `${emailName}@${prefix ? `${prefix}.` : ""}${currentDomain}`
  }

  const copyEmailAddress = () => {
    copyToClipboard(buildEmailAddress())
  }

  const createEmail = async () => {
    if (!emailName.trim()) {
      toast({
        title: tList("error"),
        description: t("namePlaceholder"),
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/emails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: emailName,
          subDomain: subDomain.trim(),
          domain: currentDomain,
          expiryTime: parseInt(expiryTime)
        })
      })

      if (!response.ok) {
        const data = await response.json() as { code?: string, error: string }
        if (data.code === "SUBDOMAIN_NOT_ENABLED") {
          setSubDomain("")
        }
        toast({
          title: tList("error"),
          description: data.error,
          variant: "destructive"
        })
        return
      }

      toast({
        title: tList("success"),
        description: t("success")
      })
      onEmailCreated()
      setOpen(false)
      setEmailName("")
      setSubDomain("")
    } catch {
      toast({
        title: tList("error"),
        description: t("failed"),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
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
    if (!subdomainEnabledForCurrent && subDomain.trim()) {
      setSubDomain("")
    }
  }, [currentDomain, subdomainEnabledForCurrent, subDomain])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t("title")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={emailName}
                onChange={(e) => setEmailName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={generateRandomName}
                type="button"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={subDomain}
                onChange={(e) => setSubDomain(e.target.value)}
                placeholder={t("subDomainPlaceholder")}
                className="flex-1"
                disabled={!subdomainEnabledForCurrent}
              />
              <Select value={currentDomain} onValueChange={setCurrentDomain}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      value={domainSearch}
                      onChange={(e) => setDomainSearch(e.target.value)}
                      placeholder={t("domainSearchPlaceholder")}
                      className="h-8"
                    />
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
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {t("domainNoResult")}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            {!subdomainEnabledForCurrent && (
              <p className="text-xs text-muted-foreground">{t("subdomainDisabledHint")}</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Label className="shrink-0 text-muted-foreground">{t("expiryTime")}</Label>
            <RadioGroup
              value={expiryTime}
              onValueChange={setExpiryTime}
              className="flex gap-6"
            >
              {EXPIRY_OPTIONS.map((option, index) => {
                const labels = [t("oneHour"), t("oneDay"), t("threeDays"), t("permanent")]
                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <RadioGroupItem value={option.value.toString()} id={option.value.toString()} />
                    <Label htmlFor={option.value.toString()} className="cursor-pointer text-sm">
                      {labels[index]}
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0">{t("domain")}:</span>
            {emailName ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{buildEmailAddress()}</span>
                <div
                  className="shrink-0 cursor-pointer hover:text-primary transition-colors"
                  onClick={copyEmailAddress}
                >
                  <Copy className="size-4" />
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground/70">...</span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={createEmail} disabled={loading}>
            {loading ? t("creating") : t("create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 