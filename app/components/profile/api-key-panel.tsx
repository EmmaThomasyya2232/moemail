"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Key, Plus, Loader2, Trash2, Copy } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useCopy } from "@/hooks/use-copy"
import { useRolePermission } from "@/hooks/use-role-permission"
import { PERMISSIONS } from "@/lib/permissions"
import { useConfig } from "@/hooks/use-config"

type ApiKey = {
  id: string
  name: string
  key: string
  createdAt: string
  expiresAt: string | null
  enabled: boolean
}

export function ApiKeyPanel({ embedded = false, authed = true, loginHref }: { embedded?: boolean; authed?: boolean; loginHref?: string } = {}) {
  const t = useTranslations("profile.apiKey")
  const tCommon = useTranslations("common.actions")
  const tNoPermission = useTranslations("emails.noPermission")
  const tMessages = useTranslations("emails.messages")
  const tNav = useTranslations("common.nav")
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const { toast } = useToast()
  const { copyToClipboard } = useCopy()
  const [isLoading, setIsLoading] = useState(true)
  const { checkPermission } = useRolePermission()
  const canManageApiKey = checkPermission(PERMISSIONS.MANAGE_API_KEY)

  const fetchApiKeys = async () => {
    try {
      const res = await fetch("/api/api-keys")
      if (!res.ok) throw new Error(t("createFailed"))
      const data = await res.json() as { apiKeys: ApiKey[] }
      setApiKeys(data.apiKeys)
    } catch (error) {
      console.error(error)
      toast({
        title: t("createFailed"),
        description: t("createFailed"),
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (canManageApiKey) {
      fetchApiKeys()
    }
  }, [canManageApiKey])

  const { config } = useConfig()

  const createApiKey = async () => {
    if (!newKeyName.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName })
      })

      if (!res.ok) throw new Error(t("createFailed"))

      const data = await res.json() as { key: string }
      setNewKey(data.key)
      fetchApiKeys()
    } catch (error) {
      toast({
        title: t("createFailed"),
        description: error instanceof Error ? error.message : t("createFailed"),
        variant: "destructive"
      })
      setCreateDialogOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const handleDialogClose = () => {
    setCreateDialogOpen(false)
    setNewKeyName("")
    setNewKey(null)
  }

  const toggleApiKey = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      })

      if (!res.ok) throw new Error(t("createFailed"))

      setApiKeys(keys =>
        keys.map(key =>
          key.id === id ? { ...key, enabled } : key
        )
      )
    } catch (error) {
      console.error(error)
      toast({
        title: t("createFailed"),
        description: t("createFailed"),
        variant: "destructive"
      })
    }
  }

  const deleteApiKey = async (id: string) => {
    try {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: "DELETE"
      })

      if (!res.ok) throw new Error(t("deleteFailed"))

      setApiKeys(keys => keys.filter(key => key.id !== id))
      toast({
        title: t("deleteSuccess"),
        description: t("deleteSuccess")
      })
    } catch (error) {
      console.error(error)
      toast({
        title: t("deleteFailed"),
        description: t("deleteFailed"),
        variant: "destructive"
      })
    }
  }

  if (embedded && !authed) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("loginRequired")}</p>
        <Button className="mt-4 gap-2" asChild>
          <a href={loginHref ?? "/login"}>{tNav("login")}</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-background rounded-lg border border-border p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
        {
          canManageApiKey && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4" />
                  {t("create")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {newKey ? t("createSuccess") : t("create")}
                  </DialogTitle>
                  {newKey && (
                    <DialogDescription className="text-destructive">
                      {t("description")}
                    </DialogDescription>
                  )}
                </DialogHeader>

                {!newKey ? (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{t("name")}</Label>
                      <Input
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder={t("namePlaceholder")}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{t("key")}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newKey}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(newKey)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      variant="outline"
                      onClick={handleDialogClose}
                      disabled={loading}
                    >
                      {newKey ? tCommon("ok") : tCommon("cancel")}
                    </Button>
                  </DialogClose>
                  {!newKey && (
                    <Button
                      onClick={createApiKey}
                      disabled={loading || !newKeyName.trim()}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t("create")
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      </div>

      {
        !canManageApiKey ? (
          <div className="text-center text-muted-foreground py-8">
            <p>{tNoPermission("needPermission")}</p>
            <p className="mt-2">{tNoPermission("contactAdmin")}</p>
            {
              config?.adminContact && (
                <p className="mt-2">{tNoPermission("adminContact")}: {config.adminContact}</p>
              )
            }
          </div>
        ) : (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tMessages("loading")}</p>
                </div>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Key className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">{t("noKeys")}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("description")}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{key.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {t("createdAt")}: {new Date(key.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={key.enabled}
                        onCheckedChange={(checked) => toggleApiKey(key.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteApiKey(key.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

              </>
            )}
          </div>
        )
      }
    </div>
  )
} 