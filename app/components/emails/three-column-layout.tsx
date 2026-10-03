"use client"

import { useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { EmailList } from "./email-list"
import { MessageListContainer } from "./message-list-container"
import { MessageView } from "./message-view"
import { SendDialog } from "./send-dialog"
import { cn } from "@/lib/utils"
import { useCopy } from "@/hooks/use-copy"
import { useSendPermission } from "@/hooks/use-send-permission"
import { Copy, Inbox, MailOpen } from "lucide-react"

interface Email {
  id: string
  address: string
}

function EmptyState({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="max-w-[220px] text-[13px] leading-relaxed text-muted-foreground">{title}</p>
    </div>
  )
}

export function ThreeColumnLayout() {
  const t = useTranslations("emails.layout")
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [selectedMessageType, setSelectedMessageType] = useState<'received' | 'sent'>('received')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const { copyToClipboard } = useCopy()
  const { canSend: canSendEmails } = useSendPermission()

  const headerClass = "flex h-11 shrink-0 items-center gap-2 border-b px-3"

  // 移动端视图逻辑
  const mobileView = selectedMessageId ? "message" : selectedEmail ? "emails" : "list"

  const copyEmailAddress = () => {
    copyToClipboard(selectedEmail?.address || "")
  }

  const handleMessageSelect = (messageId: string | null, messageType: 'received' | 'sent' = 'received') => {
    setSelectedMessageId(messageId)
    setSelectedMessageType(messageType)
  }

  const handleSendSuccess = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  // 消息列表栏：桌面端第二栏与移动端二级页共用
  const renderMessageColumn = (leading?: ReactNode) => (
    <>
      <div className={headerClass}>
        {leading}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          {selectedEmail ? (
            <>
              <div className="flex min-w-0 items-center gap-1">
                <span className="truncate text-[13px] font-semibold tracking-tight">
                  {selectedEmail.address}
                </span>
                <button
                  type="button"
                  onClick={copyEmailAddress}
                  aria-label="copy address"
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
              {canSendEmails && (
                <SendDialog
                  emailId={selectedEmail.id}
                  fromAddress={selectedEmail.address}
                  onSendSuccess={handleSendSuccess}
                />
              )}
            </>
          ) : (
            <span className="truncate text-[13px] font-semibold tracking-tight">{t("messageContent")}</span>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {selectedEmail ? (
          <MessageListContainer
            email={selectedEmail}
            onMessageSelect={handleMessageSelect}
            selectedMessageId={selectedMessageId}
            refreshTrigger={refreshTrigger}
          />
        ) : (
          <EmptyState icon={<Inbox className="size-5" />} title={t("selectEmail")} />
        )}
      </div>
    </>
  )

  return (
    <div className="flex h-full min-h-0 flex-col pt-16 pb-4">
      {/* 桌面端三栏布局 */}
      <div className="hidden min-h-0 flex-1 divide-x overflow-hidden rounded-xl border bg-card shadow-sm lg:flex">
        <aside className="flex w-[260px] shrink-0 flex-col overflow-hidden xl:w-[288px]">
          <EmailList
            onEmailSelect={(email) => {
              setSelectedEmail(email)
              setSelectedMessageId(null)
            }}
            selectedEmailId={selectedEmail?.id}
          />
        </aside>

        <section className="flex w-[340px] shrink-0 flex-col overflow-hidden xl:w-[400px]">
          {renderMessageColumn()}
        </section>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selectedEmail && selectedMessageId ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <MessageView
                emailId={selectedEmail.id}
                messageId={selectedMessageId}
                messageType={selectedMessageType}
                onClose={() => setSelectedMessageId(null)}
              />
            </div>
          ) : (
            <EmptyState icon={<MailOpen className="size-5" />} title={t("selectMessage")} />
          )}
        </section>
      </div>

      {/* 移动端单栏布局 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:hidden">
        {mobileView === "list" && (
          <EmailList
            onEmailSelect={(email) => {
              setSelectedEmail(email)
              setSelectedMessageId(null)
            }}
            selectedEmailId={selectedEmail?.id}
          />
        )}

        {mobileView === "emails" && selectedEmail && (
          renderMessageColumn(
            <button
              type="button"
              onClick={() => setSelectedEmail(null)}
              className="shrink-0 whitespace-nowrap text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("backToEmailList")}
            </button>
          )
        )}

        {mobileView === "message" && selectedEmail && selectedMessageId && (
          <>
            <div className={cn(headerClass, "justify-between")}>
              <button
                type="button"
                onClick={() => setSelectedMessageId(null)}
                className="shrink-0 whitespace-nowrap text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("backToMessageList")}
              </button>
              <span className="truncate text-[13px] font-medium">{t("messageContent")}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <MessageView
                emailId={selectedEmail.id}
                messageId={selectedMessageId}
                messageType={selectedMessageType}
                onClose={() => setSelectedMessageId(null)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
