"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { CreateDialog } from "./create-dialog"
import { ShareDialog } from "./share-dialog"
import { Inbox, Mail, Plus, RefreshCw, Search, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useThrottle } from "@/hooks/use-throttle"
import { EMAIL_CONFIG } from "@/config"
import { useToast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ROLES } from "@/lib/permissions"
import { useUserRole } from "@/hooks/use-user-role"
import { useConfig } from "@/hooks/use-config"

interface Email {
  id: string
  address: string
  createdAt: number
  expiresAt: number
}

interface EmailListProps {
  onEmailSelect: (email: Email | null) => void
  selectedEmailId?: string
}

interface EmailResponse {
  emails: Email[]
  nextCursor: string | null
  total: number
}

function splitAddress(address: string) {
  const atIndex = address.indexOf("@")
  if (atIndex === -1) return { local: address, domain: "" }
  return { local: address.slice(0, atIndex), domain: address.slice(atIndex + 1) }
}

export function EmailList({ onEmailSelect, selectedEmailId }: EmailListProps) {
  const { data: session } = useSession()
  const { config } = useConfig()
  const { role } = useUserRole()
  const t = useTranslations("emails.list")
  const tLayout = useTranslations("emails.layout")
  const tCreate = useTranslations("emails.create")
  const tCommon = useTranslations("common.actions")
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [emailToDelete, setEmailToDelete] = useState<Email | null>(null)
  const { toast } = useToast()

  const fetchEmails = async (cursor?: string) => {
    try {
      const url = new URL("/api/emails", window.location.origin)
      if (cursor) {
        url.searchParams.set('cursor', cursor)
      }
      const response = await fetch(url)
      const data = await response.json() as EmailResponse

      if (!cursor) {
        const newEmails = data.emails
        const oldEmails = emails

        const lastDuplicateIndex = newEmails.findIndex(
          newEmail => oldEmails.some(oldEmail => oldEmail.id === newEmail.id)
        )

        if (lastDuplicateIndex === -1) {
          setEmails(newEmails)
          setNextCursor(data.nextCursor)
          setTotal(data.total)
          return
        }
        const uniqueNewEmails = newEmails.slice(0, lastDuplicateIndex)
        setEmails([...uniqueNewEmails, ...oldEmails])
        setTotal(data.total)
        return
      }
      setEmails(prev => [...prev, ...data.emails])
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error) {
      console.error("Failed to fetch emails:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchEmails()
  }

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMore) return

    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    const threshold = clientHeight * 1.5
    const remainingScroll = scrollHeight - scrollTop

    if (remainingScroll <= threshold && nextCursor) {
      setLoadingMore(true)
      fetchEmails(nextCursor)
    }
  }, 200)

  useEffect(() => {
    if (session) fetchEmails()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const handleDelete = async (email: Email) => {
    try {
      const response = await fetch(`/api/emails/${email.id}`, {
        method: "DELETE"
      })

      if (!response.ok) throw new Error("Failed to delete email")

      setEmails(prev => prev.filter(e => e.id !== email.id))
      setTotal(prev => prev - 1)

      if (selectedEmailId === email.id) {
        onEmailSelect(null)
      }

      toast({
        title: t("success"),
        description: t("deleteSuccess")
      })

    } catch (error) {
      console.error("Failed to delete email:", error)
      toast({
        title: t("error"),
        description: t("deleteFailed"),
        variant: "destructive"
      })
    } finally {
      setEmailToDelete(null)
    }
  }

  const filteredEmails = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return emails
    return emails.filter(email => email.address.toLowerCase().includes(keyword))
  }, [emails, search])

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold tracking-tight">{tLayout("myEmails")}</span>
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {role === ROLES.EMPEROR
                ? t("emailCountUnlimited", { count: total })
                : t("emailCount", { count: total, max: config?.maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS })}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={handleRefresh}
              aria-label="refresh"
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            </Button>
            <CreateDialog
              onEmailCreated={handleRefresh}
              trigger={
                <Button size="icon" variant="secondary" className="h-7 w-7" title={tCreate("title")}>
                  <Plus className="size-3.5" />
                </Button>
              }
            />
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

        <div className="min-h-0 flex-1 overflow-auto p-1.5" onScroll={handleScroll}>
          {loading ? (
            <div className="space-y-0.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-md px-2 py-2">
                  <div className="size-7 shrink-0 animate-pulse rounded-md bg-muted" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEmails.length > 0 ? (
            <div className="space-y-0.5">
              {filteredEmails.map(email => {
                const { local, domain } = splitAddress(email.address)
                const isSelected = selectedEmailId === email.id
                const isPermanent = new Date(email.expiresAt).getFullYear() === 9999
                return (
                  <div
                    key={email.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEmailSelect(email)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onEmailSelect(email)
                      }
                    }}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring",
                      isSelected ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
                        isSelected
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-transparent bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <Mail className="size-3.5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium leading-tight">{local}</span>
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                        {domain ? `@${domain} · ` : ""}
                        {isPermanent ? t("permanent") : new Date(email.expiresAt).toLocaleDateString()}
                      </span>
                    </span>

                    <span
                      className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ShareDialog emailId={email.id} emailAddress={email.address} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title={tCommon("delete")}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEmailToDelete(email)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </span>
                  </div>
                )
              })}
              {loadingMore && (
                <div className="py-2 text-center text-[11px] text-muted-foreground">{t("loadingMore")}</div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="size-4" />
              </div>
              <p className="max-w-[200px] text-[12px] leading-relaxed text-muted-foreground">
                {search ? t("searchNoResult") : t("noEmails")}
              </p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!emailToDelete} onOpenChange={() => setEmailToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { email: emailToDelete?.address || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => emailToDelete && handleDelete(emailToDelete)}
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
