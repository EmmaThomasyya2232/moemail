"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Send, Inbox } from "lucide-react"
import { Tabs, SlidingTabsList, SlidingTabsTrigger, TabsContent } from "@/components/ui/tabs"
import { MessageList } from "./message-list"
import { useSendPermission } from "@/hooks/use-send-permission"

interface MessageListContainerProps {
  email: {
    id: string
    address: string
  }
  onMessageSelect: (messageId: string | null, messageType?: 'received' | 'sent') => void
  selectedMessageId?: string | null
  refreshTrigger?: number
}

export function MessageListContainer({ email, onMessageSelect, selectedMessageId, refreshTrigger }: MessageListContainerProps) {
  const t = useTranslations("emails.messages")
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')
  const { canSend: canSendEmails } = useSendPermission()

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as 'received' | 'sent')
    onMessageSelect(null)
  }

  // 收件箱 / 已发送切换，直接嵌入消息列表头部
  const tabs = (
    <SlidingTabsList>
      <SlidingTabsTrigger value="received" className="h-7 gap-1.5 text-[12px]">
        <Inbox className="size-3.5" />
        {t("received")}
      </SlidingTabsTrigger>
      <SlidingTabsTrigger value="sent" className="h-7 gap-1.5 text-[12px]">
        <Send className="size-3.5" />
        {t("sent")}
      </SlidingTabsTrigger>
    </SlidingTabsList>
  )

  if (!canSendEmails) {
    return (
      <div className="h-full min-h-0">
        <MessageList
          email={email}
          messageType="received"
          onMessageSelect={onMessageSelect}
          selectedMessageId={selectedMessageId}
        />
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex h-full flex-col">
      <TabsContent value="received" className="m-0 flex-1 overflow-hidden">
        <MessageList
          email={email}
          messageType="received"
          onMessageSelect={onMessageSelect}
          selectedMessageId={selectedMessageId}
          toolbarLeading={tabs}
        />
      </TabsContent>

      <TabsContent value="sent" className="m-0 flex-1 overflow-hidden">
        <MessageList
          email={email}
          messageType="sent"
          onMessageSelect={onMessageSelect}
          selectedMessageId={selectedMessageId}
          refreshTrigger={refreshTrigger}
          toolbarLeading={tabs}
        />
      </TabsContent>
    </Tabs>
  )
}
