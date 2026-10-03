"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { AlertCircle, Check, Copy, Loader2, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useCopy } from "@/hooks/use-copy"
import { useToast } from "@/components/ui/use-toast"
import { ShareMessageDialog } from "./share-message-dialog"

interface Message {
  id: string
  from_address?: string
  to_address?: string
  subject: string
  content: string
  html?: string
  received_at?: number
  sent_at?: number
}

interface MessageViewProps {
  emailId: string
  messageId: string
  messageType?: 'received' | 'sent'
  onClose: () => void
}

type ViewMode = "html" | "text"

// 纯前端提取验证码：优先匹配带关键字的 4-8 位数字
function extractVerificationCode(message: Message | null): string | null {
  if (!message) return null
  const raw = `${message.subject || ""} ${message.content || ""} ${message.html || ""}`
  const text = raw.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  if (!text) return null

  const keywordPatterns = [
    /(?:verification|verify|security|confirmation|one[-\s]?time|passcode|otp|code)\D{0,16}(\d{4,8})/i,
    /(\d{4,8})\D{0,16}(?:is your|is the)?\s*(?:verification|verify|security|confirmation|one[-\s]?time|passcode|otp|code)/i,
    /(?:验证码|校验码|动态码|口令|代码|認証コード|인증\s?코드)\D{0,16}(\d{4,8})/,
    /(\d{4,8})\D{0,12}(?:为您的?|是您的?)?\s*(?:验证码|校验码|动态码|認証コード|인증\s?코드)/
  ]

  for (const pattern of keywordPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1]
  }

  // 短邮件（通常是验证类邮件）才回退到任意 4-8 位数字
  if (text.length <= 400) {
    const standalone = text.match(/(?:^|[^\d])(\d{4,8})(?!\d)/)
    if (standalone?.[1]) return standalone[1]
  }

  return null
}

export function MessageView({ emailId, messageId, messageType = 'received' }: MessageViewProps) {
  const t = useTranslations("emails.messageView")
  const tList = useTranslations("emails.list")
  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("html")
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { theme } = useTheme()
  const { toast } = useToast()
  const { copyToClipboard } = useCopy()

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        setLoading(true)
        setError(null)

        const url = `/api/emails/${emailId}/${messageId}${messageType === 'sent' ? '?type=sent' : ''}`

        const response = await fetch(url)

        if (!response.ok) {
          const errorData = await response.json()
          const errorMessage = (errorData as { error?: string }).error || t("loadError")
          setError(errorMessage)
          toast({
            title: tList("error"),
            description: errorMessage,
            variant: "destructive"
          })
          return
        }

        const data = await response.json() as { message: Message }
        setMessage(data.message)
        if (!data.message.html) {
          setViewMode("text")
        }
      } catch (error) {
        const errorMessage = t("networkError")
        setError(errorMessage)
        toast({
          title: tList("error"),
          description: errorMessage,
          variant: "destructive"
        })
        console.error("Failed to fetch message:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMessage()
  }, [emailId, messageId, messageType, toast, t, tList])

  const code = extractVerificationCode(message)

  const updateIframeContent = () => {
    if (viewMode === "html" && message?.html && iframeRef.current) {
      const iframe = iframeRef.current
      const doc = iframe.contentDocument || iframe.contentWindow?.document

      if (doc) {
        doc.open()
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <base target="_blank">
              <style>
                html, body {
                  margin: 0;
                  padding: 0;
                  min-height: 100%;
                  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
                  font-size: 13.5px;
                  line-height: 1.6;
                  color: ${theme === 'dark' ? '#e5e7eb' : '#111827'};
                  background: ${theme === 'dark' ? '#171a21' : '#ffffff'};
                  word-break: break-word;
                }
                body { padding: 16px; }
                img { max-width: 100%; height: auto; }
                a { color: #7C3AED; }
                table { max-width: 100%; }
              </style>
            </head>
            <body>${message.html}</body>
          </html>
        `)
        doc.close()
      }
    }
  }

  // 监听主题变化和内容变化
  useEffect(() => {
    updateIframeContent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.html, viewMode, theme])

  const handleCopyCode = async () => {
    if (!code) return
    const success = await copyToClipboard(code)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
        <Loader2 className="size-5 animate-spin text-primary/70" />
        <span className="text-[12px] text-muted-foreground">{t("loading")}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <p className="max-w-[280px] text-[12px] leading-relaxed text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => window.location.reload()}
        >
          {t("retry")}
        </Button>
      </div>
    )
  }

  if (!message) return null

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 border-b px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug tracking-tight">
            {message.subject}
          </h3>
          <ShareMessageDialog
            emailId={emailId}
            messageId={message.id}
            messageSubject={message.subject}
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground">
                <Share2 className="size-3.5" />
              </Button>
            }
          />
        </div>

        {code && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("codeLabel")}
              </p>
              <p className="font-mono text-[18px] font-semibold tracking-[0.2em] text-primary">{code}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1.5 text-xs"
              onClick={handleCopyCode}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? t("codeCopied") : t("copyCode")}
            </Button>
          </div>
        )}

        <div className="grid gap-1 text-[12px]">
          {message.from_address && (
            <div className="flex gap-2">
              <span className="w-10 shrink-0 text-muted-foreground">{t("from")}</span>
              <span className="min-w-0 break-all text-foreground/80">{message.from_address}</span>
            </div>
          )}
          {message.to_address && (
            <div className="flex gap-2">
              <span className="w-10 shrink-0 text-muted-foreground">{t("to")}</span>
              <span className="min-w-0 break-all text-foreground/80">{message.to_address}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="w-10 shrink-0 text-muted-foreground">{t("time")}</span>
            <span className="tabular-nums text-foreground/80">
              {new Date(message.sent_at || message.received_at || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {message.html && message.content && (
        <div className="flex shrink-0 items-center justify-end border-b px-4 py-1.5">
          <div className="flex items-center gap-0.5 rounded-md border p-0.5">
            {(["html", "text"] as ViewMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors duration-150",
                  viewMode === mode
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode === "html" ? t("htmlFormat") : t("textFormat")}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-auto">
        {viewMode === "html" && message.html ? (
          <iframe
            ref={iframeRef}
            className="absolute inset-0 h-full w-full border-0 bg-transparent"
            sandbox="allow-same-origin allow-popups"
          />
        ) : (
          <div className="whitespace-pre-wrap p-4 text-[13px] leading-relaxed">{message.content}</div>
        )}
      </div>
    </div>
  )
}
