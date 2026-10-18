"use client"

import { useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { CreateForm } from "./create-form"

interface CreateDialogProps {
  onEmailCreated: () => void
  trigger?: ReactNode
}

export function CreateDialog({ onEmailCreated, trigger }: CreateDialogProps) {
  const t = useTranslations("emails.create")
  const [open, setOpen] = useState(false)

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
        <CreateForm
          onEmailCreated={() => {
            onEmailCreated()
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
} 