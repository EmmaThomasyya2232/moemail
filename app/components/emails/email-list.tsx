"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { CreateForm } from "./create-form"
import { ShareDialog } from "./share-dialog"
import { Inbox, Mail, Plus, RefreshCw, Search, Trash2, CheckSquare, Square, X, ChevronDown, Lock, LockOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useThrottle } from "@/hooks/use-throttle"
import { EMAIL_CONFIG } from "@/config"
import { useToast } from "@/components/ui/use-toast"
import { ROLES } from "@/lib/permissions"
import { useUserRole } from "@/hooks/use-user-role"
import { useConfig } from "@/hooks/use-config"

interface Email {
  id: string
  address: string
  createdAt: number
  expiresAt: number
  isLocked?: boolean
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
  const [searching, setSearching] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchSeq = useRef(0)

  const fetchEmails = useCallback(async (cursor?: string, keyword?: string) => {
    try {
      const url = new URL("/api/emails", window.location.origin)
      if (cursor) {
        url.searchParams.set('cursor', cursor)
      }
      const q = (keyword ?? "").trim()
      if (q) {
        url.searchParams.set('search', q)
      }
      const response = await fetch(url)
      const data = await response.json() as EmailResponse

      if (!cursor) {
        // 搜索模式直接替换；非搜索的刷新走原来的增量合并
        if (q) {
          setEmails(data.emails)
          setNextCursor(data.nextCursor)
          setTotal(data.total)
          return
        }
        const newEmails = data.emails
        setEmails((oldEmails) => {
          const lastDuplicateIndex = newEmails.findIndex(
            newEmail => oldEmails.some(oldEmail => oldEmail.id === newEmail.id)
          )

          if (lastDuplicateIndex === -1) {
            return newEmails
          }
          const uniqueNewEmails = newEmails.slice(0, lastDuplicateIndex)
          return [...uniqueNewEmails, ...oldEmails]
        })
        setNextCursor(data.nextCursor)
        setTotal(data.total)
        return
      }
      // 翻页追加：按 id 去重，避免搜索/刷新竞态造成的重复
      setEmails(prev => {
        const seen = new Set(prev.map(e => e.id))
        const append = data.emails.filter(e => !seen.has(e.id))
        return [...prev, ...append]
      })
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error) {
      console.error("Failed to fetch emails:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchEmails(undefined, search)
  }

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMore) return

    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    const threshold = clientHeight * 1.5
    const remainingScroll = scrollHeight - scrollTop

    if (remainingScroll <= threshold && nextCursor) {
      setLoadingMore(true)
      fetchEmails(nextCursor, search)
    }
  }, 200)

  useEffect(() => {
    if (session) fetchEmails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, fetchEmails])

  // 搜索输入防抖 300ms，直接走服务端全库搜索，不再只过滤已加载的列表
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const keyword = search.trim()
    if (!keyword) {
      setSearching(false)
      return
    }
    setSearching(true)
    const seq = ++searchSeq.current
    searchTimer.current = setTimeout(async () => {
      setLoadingMore(false)
      await fetchEmails(undefined, keyword)
      if (searchSeq.current === seq) setSearching(false)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search, fetchEmails])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    // 清空搜索时回到全量列表
    if (!value.trim()) {
      setSearching(false)
      setLoading(true)
      fetchEmails()
    }
  }

  // 需求1：删除不再二次确认，点击即删（锁定的邮箱直接拦）
  const handleDelete = async (email: Email) => {
    if (deletingIds.has(email.id)) return
    if (email.isLocked) {
      toast({
        title: t("error"),
        description: t("lockedDeleteBlocked"),
        variant: "destructive"
      })
      return
    }
    setDeletingIds(prev => new Set(prev).add(email.id))
    // 乐观删除：先从列表移除，失败再回滚
    const snapshot = emails
    setEmails(prev => prev.filter(e => e.id !== email.id))
    setTotal(prev => Math.max(0, prev - 1))
    setSelectedIds(prev => {
      if (!prev.has(email.id)) return prev
      const next = new Set(prev)
      next.delete(email.id)
      return next
    })

    if (selectedEmailId === email.id) {
      onEmailSelect(null)
    }

    try {
      const response = await fetch(`/api/emails/${email.id}`, {
        method: "DELETE"
      })

      if (response.status === 423) {
        const data = await response.json().catch(() => ({})) as { error?: string }
        setEmails(snapshot)
        setTotal(prev => prev + 1)
        toast({
          title: t("error"),
          description: data.error || t("lockedDeleteBlocked"),
          variant: "destructive"
        })
        // 服务端说被锁，顺手把本地状态同步为锁定
        setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isLocked: true } : e))
        return
      }

      if (!response.ok) throw new Error("Failed to delete email")

      toast({
        title: t("success"),
        description: t("deleteSuccess")
      })
    } catch (error) {
      console.error("Failed to delete email:", error)
      setEmails(snapshot)
      setTotal(prev => prev + 1)
      toast({
        title: t("error"),
        description: t("deleteFailed"),
        variant: "destructive"
      })
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(email.id)
        return next
      })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size >= emails.length && emails.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(emails.map(e => e.id)))
    }
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  // 锁定切换：锁定后单个删除 / 批量删除都会被拒绝，只能先解锁再删
  const handleToggleLock = async (email: Email) => {
    if (lockingIds.has(email.id)) return
    const nextLocked = !email.isLocked
    setLockingIds(prev => new Set(prev).add(email.id))
    // 乐观更新，失败回滚
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isLocked: nextLocked } : e))

    try {
      const response = await fetch(`/api/emails/${email.id}/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: nextLocked })
      })
      if (!response.ok) throw new Error("Failed to toggle lock")
      toast({
        title: t("success"),
        description: nextLocked ? t("lockSuccess") : t("unlockSuccess")
      })
    } catch (error) {
      console.error("Failed to toggle email lock:", error)
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isLocked: email.isLocked } : e))
      toast({
        title: t("error"),
        description: t("lockFailed"),
        variant: "destructive"
      })
    } finally {
      setLockingIds(prev => {
        const next = new Set(prev)
        next.delete(email.id)
        return next
      })
    }
  }

  // 需求1：批量删除（服务端批量接口，一次请求删多个；锁定的自动跳过）
  const handleBatchDelete = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0 || batchDeleting) return
    const lockedInSelection = emails.filter(e => selectedIds.has(e.id) && e.isLocked)
    const deletableIds = ids.filter(id => !emails.find(e => e.id === id)?.isLocked)
    if (deletableIds.length === 0) {
      toast({
        title: t("error"),
        description: t("lockedDeleteBlocked"),
        variant: "destructive"
      })
      return
    }
    setBatchDeleting(true)
    const snapshot = emails
    const deletableSet = new Set(deletableIds)
    setEmails(prev => prev.filter(e => !deletableSet.has(e.id)))
    setTotal(prev => Math.max(0, prev - deletableIds.length))
    if (selectedEmailId && deletableSet.has(selectedEmailId)) {
      onEmailSelect(null)
    }

    try {
      const response = await fetch("/api/emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: deletableIds })
      })
      if (response.status === 423) {
        const data = await response.json().catch(() => ({})) as { error?: string }
        setEmails(snapshot)
        setTotal(prev => prev + deletableIds.length)
        toast({
          title: t("error"),
          description: data.error || t("lockedDeleteBlocked"),
          variant: "destructive"
        })
        return
      }
      if (!response.ok) throw new Error("batch delete failed")
      const data = await response.json() as { deletedIds?: string[], skippedLockedIds?: string[] }
      const deletedCount = data.deletedIds?.length ?? deletableIds.length
      const skippedCount = (data.skippedLockedIds?.length ?? 0) + lockedInSelection.filter(
        e => !(data.skippedLockedIds ?? []).includes(e.id) && !((data.deletedIds ?? []).includes(e.id))
      ).length
      // 服务端实际删掉的才清选中，锁定的保留选中态方便用户解锁后处理
      const deletedSet = new Set(data.deletedIds ?? deletableIds)
      setSelectedIds(prev => {
        const next = new Set([...prev].filter(id => !deletedSet.has(id)))
        return next
      })
      const skippedLockedIds = new Set([...(data.skippedLockedIds ?? []), ...lockedInSelection.map(e => e.id)])
      if (skippedLockedIds.size > 0) {
        setEmails(prev => prev.map(e => skippedLockedIds.has(e.id) ? { ...e, isLocked: true } : e))
      }
      toast({
        title: t("success"),
        description: skippedCount > 0
          ? t("batchDeletePartialLocked", { deleted: deletedCount, skipped: skippedCount })
          : t("batchDeleteSuccess", { count: deletedCount })
      })
      if (deletedSet.size >= selectedIds.size || [...selectedIds].every(id => deletedSet.has(id))) {
        setSelectMode(false)
      }
      // 批量删后补拉一页，保持列表连续
      fetchEmails(undefined, search)
    } catch (error) {
      console.error("Failed to batch delete emails:", error)
      setEmails(snapshot)
      setTotal(prev => prev + deletableIds.length)
      toast({
        title: t("error"),
        description: t("batchDeleteFailed"),
        variant: "destructive"
      })
    } finally {
      setBatchDeleting(false)
    }
  }

  const handleCreated = async () => {
    // 创建后保持展开，由用户手动折叠；若在搜索态则清空搜索回到全量，避免新邮箱被搜索词过滤掉
    if (search.trim()) setSearch("")
    await fetchEmails()
  }

  // 服务端已按搜索词过滤，这里直接展示即可
  const filteredEmails = emails

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
          <div className="flex min-w-0 items-center gap-2">
            {selectMode ? (
              <button
                type="button"
                onClick={toggleSelectAll}
                title={t("selectAll")}
                className="flex shrink-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                {selectedIds.size >= filteredEmails.length && filteredEmails.length > 0 ? (
                  <CheckSquare className="size-4" />
                ) : (
                  <Square className="size-4" />
                )}
                <span className="text-[12px]">{t("selectedCount", { count: selectedIds.size })}</span>
              </button>
            ) : (
              <>
                <span className="truncate text-[13px] font-semibold tracking-tight">{tLayout("myEmails")}</span>
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {role === ROLES.EMPEROR
                    ? t("emailCountUnlimited", { count: total })
                    : t("emailCount", { count: total, max: config?.maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS })}
                </span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {selectMode ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-[12px]"
                  disabled={selectedIds.size === 0 || batchDeleting}
                  onClick={handleBatchDelete}
                >
                  {batchDeleting ? t("deleting") : t("batchDelete")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={exitSelectMode}
                  title={t("cancelSelect")}
                >
                  <X className="size-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={handleRefresh}
                  aria-label="refresh"
                >
                  <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  title={t("select")}
                  onClick={() => setSelectMode(true)}
                >
                  <CheckSquare className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant={showCreate ? "default" : "secondary"}
                  className="h-7 w-7"
                  title={showCreate ? t("collapseCreate") : tCreate("title")}
                  onClick={() => setShowCreate(v => !v)}
                >
                  {showCreate ? <ChevronDown className="size-3.5" /> : <Plus className="size-3.5" />}
                </Button>
              </>
            )}
          </div>
        </div>

        {showCreate && !selectMode && (
          <div className="shrink-0 border-b bg-muted/30 px-2.5 py-1">
            <CreateForm compact autoFocus onEmailCreated={handleCreated} onCancel={() => setShowCreate(false)} showCancel />
          </div>
        )}

        <div className="shrink-0 border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-8 pl-7 pr-7 text-[13px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                title={tCommon("cancel")}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {search.trim() && (
            <p className="px-0.5 pt-1.5 text-[11px] leading-tight text-muted-foreground">
              {searching ? t("searching") : t("searchResultHint")}
            </p>
          )}
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
                const checked = selectedIds.has(email.id)
                const deleting = deletingIds.has(email.id)
                const locking = lockingIds.has(email.id)
                const locked = Boolean(email.isLocked)
                return (
                  <div
                    key={email.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (selectMode) toggleSelect(email.id)
                      else onEmailSelect(email)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        if (selectMode) toggleSelect(email.id)
                        else onEmailSelect(email)
                      }
                    }}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring",
                      isSelected && !selectMode ? "bg-muted" : "hover:bg-muted/60",
                      deleting && "opacity-50"
                    )}
                  >
                    {selectMode ? (
                      <span className="flex size-7 shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={checked} onChange={() => toggleSelect(email.id)} />
                      </span>
                    ) : (
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
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[13px] font-medium leading-tight">
                        <span className="block truncate">{local}</span>
                        {locked && <Lock className="size-3 shrink-0 text-amber-500" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                        {domain ? `@${domain} · ` : ""}
                        {isPermanent ? t("permanent") : new Date(email.expiresAt).toLocaleDateString()}
                      </span>
                    </span>

                    {!selectMode && (
                      <span
                        className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ShareDialog emailId={email.id} emailAddress={email.address} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-7 w-7", locked ? "text-amber-500" : "text-muted-foreground")}
                          title={locked ? t("unlock") : t("lock")}
                          disabled={locking}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleLock(email)
                          }}
                        >
                          {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7",
                            locked ? "text-muted-foreground/40" : "text-muted-foreground hover:text-destructive"
                          )}
                          title={locked ? t("lockedDeleteBlocked") : tCommon("delete")}
                          disabled={deleting || locked}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(email)
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </span>
                    )}
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
              {!search && !showCreate && (
                <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                  {tCreate("title")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
