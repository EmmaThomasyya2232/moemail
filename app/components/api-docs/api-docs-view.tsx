"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { BookOpenText, Check, Copy, FileDown, FlaskConical, KeyRound, ShieldCheck, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/hooks/use-copy"
import { ApiKeyPanel } from "@/components/profile/api-key-panel"

interface EndpointDef {
  key: string
  method: string
  path: string
  needsBody: boolean
  query?: string
  bodyLines?: string[]
  responses: { status: string; noteKey: string; body: string }[]
}

const ENDPOINTS: EndpointDef[] = [
  {
    key: "getConfig",
    method: "GET",
    path: "/api/config",
    needsBody: false,
    responses: [
      {
        status: "200",
        noteKey: "respConfig",
        body: '{\n  "defaultRole": "CIVILIAN",\n  "emailDomains": "musin.tech,edu.musin.tech",\n  "emailSubdomainDomains": "",\n  "adminContact": "",\n  "maxEmails": "30"\n}',
      },
    ],
  },
  {
    key: "generate",
    method: "POST",
    path: "/api/emails/generate",
    needsBody: true,
    bodyLines: ['    "name": "test",', '    "subDomain": "edu",', '    "expiryTime": 3600000,', '    "domain": "musin.tech"'],
    responses: [
      {
        status: "200",
        noteKey: "respGenerate",
        body: '{\n  "id": "699ab625-24ac-4864-ac79-cc3e54684136",\n  "email": "test@edu.musin.tech",\n  "subDomain": "edu"\n}',
      },
    ],
  },
  {
    key: "listEmails",
    method: "GET",
    path: "/api/emails",
    query: "?cursor={nextCursor}",
    needsBody: false,
    responses: [
      {
        status: "200",
        noteKey: "respListEmails",
        body: '{\n  "emails": [\n    {\n      "id": "699ab625-24ac-4864-ac79-cc3e54684136",\n      "address": "test@edu.musin.tech",\n      "createdAt": "2026-10-03T09:24:49.070Z",\n      "expiresAt": "2026-10-04T09:24:49.070Z"\n    }\n  ],\n  "nextCursor": null,\n  "total": 2\n}',
      },
    ],
  },
  {
    key: "listMessages",
    method: "GET",
    path: "/api/emails/{emailId}",
    query: "?cursor={nextCursor}&type=sent",
    needsBody: false,
    responses: [
      {
        status: "200",
        noteKey: "respListMessages",
        body: '{\n  "messages": [\n    {\n      "id": "f0459955-2dbe-4e2f-b07a-fda3e5f7bc8b",\n      "from_address": "noreply@github.com",\n      "to_address": null,\n      "subject": "[GitHub] Please verify",\n      "content": "...",\n      "html": "...",\n      "sent_at": 1791043538009,\n      "received_at": 1791043538009\n    }\n  ],\n  "nextCursor": null,\n  "total": 1\n}',
      },
    ],
  },
  {
    key: "getMessage",
    method: "GET",
    path: "/api/emails/{emailId}/{messageId}",
    query: "?type=sent",
    needsBody: false,
    responses: [
      {
        status: "200",
        noteKey: "respGetMessage",
        body: '{\n  "message": {\n    "id": "f0459955-2dbe-4e2f-b07a-fda3e5f7bc8b",\n    "from_address": "noreply@github.com",\n    "to_address": null,\n    "subject": "[GitHub] Please verify",\n    "content": "...",\n    "html": "...",\n    "received_at": 1791043538009,\n    "sent_at": 1791043538009,\n    "type": "received"\n  }\n}',
      },
    ],
  },
  {
    key: "deleteEmail",
    method: "DELETE",
    path: "/api/emails/{emailId}",
    needsBody: false,
    responses: [{ status: "200", noteKey: "respDelete", body: '{ "success": true }' }],
  },
  {
    key: "deleteMessage",
    method: "DELETE",
    path: "/api/emails/{emailId}/{messageId}",
    query: "?type=sent",
    needsBody: false,
    responses: [{ status: "200", noteKey: "respDelete", body: '{ "success": true }' }],
  },
  {
    key: "send",
    method: "POST",
    path: "/api/emails/{emailId}/send",
    needsBody: true,
    bodyLines: ['    "to": "someone@example.com",', '    "subject": "Hello",', '    "content": "<p>Hi</p>"'],
    responses: [
      {
        status: "200",
        noteKey: "respSend",
        body: '{\n  "success": true,\n  "message": "邮件发送成功",\n  "remainingEmails": 4\n}',
      },
    ],
  },
  {
    key: "createEmailShare",
    method: "POST",
    path: "/api/emails/{emailId}/share",
    needsBody: true,
    bodyLines: ['    "expiresIn": 86400000'],
    responses: [
      {
        status: "201",
        noteKey: "respShare",
        body: '{\n  "id": "share-id",\n  "emailId": "{emailId}",\n  "token": "16-char-token",\n  "expiresAt": "2026-10-04T09:24:49.070Z"\n}',
      },
    ],
  },
  {
    key: "listEmailShares",
    method: "GET",
    path: "/api/emails/{emailId}/share",
    needsBody: false,
    responses: [
      {
        status: "200",
        noteKey: "respShareList",
        body: '{\n  "shares": [\n    {\n      "id": "share-id",\n      "token": "16-char-token",\n      "expiresAt": null\n    }\n  ],\n  "total": 1\n}',
      },
    ],
  },
  {
    key: "deleteEmailShare",
    method: "DELETE",
    path: "/api/emails/{emailId}/share/{shareId}",
    needsBody: false,
    responses: [{ status: "200", noteKey: "respDelete", body: '{ "success": true }' }],
  },
  {
    key: "createMessageShare",
    method: "POST",
    path: "/api/emails/{emailId}/messages/{messageId}/share",
    needsBody: true,
    bodyLines: ['    "expiresIn": 0'],
    responses: [
      {
        status: "201",
        noteKey: "respShare",
        body: '{\n  "id": "share-id",\n  "messageId": "{messageId}",\n  "token": "16-char-token",\n  "expiresAt": null\n}',
      },
    ],
  },
  {
    key: "listMessageShares",
    method: "GET",
    path: "/api/emails/{emailId}/messages/{messageId}/share",
    needsBody: false,
    responses: [
      {
        status: "200",
        noteKey: "respShareList",
        body: '{\n  "shares": [\n    {\n      "id": "share-id",\n      "token": "16-char-token",\n      "expiresAt": null\n    }\n  ],\n  "total": 1\n}',
      },
    ],
  },
  {
    key: "deleteMessageShare",
    method: "DELETE",
    path: "/api/emails/{emailId}/messages/{messageId}/share/{shareId}",
    needsBody: false,
    responses: [{ status: "200", noteKey: "respDelete", body: '{ "success": true }' }],
  },
]

function curlFor(base: string, ep: EndpointDef): string {
  const lines = [`curl -X ${ep.method} '${base}${ep.path}${ep.query ?? ""}' \\`, '  -H "X-API-Key: YOUR_API_KEY" \\']
  if (ep.needsBody) {
    lines.push('  -H "Content-Type: application/json" \\')
    lines.push("  -d '{")
    lines.push(...(ep.bodyLines ?? []))
    lines.push("  }'")
  }
  return lines.join("\n").replace(/ \\$/, "")
}

function markdownFor(base: string, t: (key: string) => string, epNotes: (key: string) => string): string {
  const out: string[] = []
  out.push(`# ${t("title")}`)
  out.push("")
  out.push(t("subtitle"))
  out.push("")
  out.push(`- ${t("baseUrlLabel")}: ${base}`)
  out.push("")
  out.push(`## ${t("authTitle")}`)
  out.push("")
  out.push(t("authDesc"))
  out.push("")
  out.push("```http")
  out.push("X-API-Key: YOUR_API_KEY")
  out.push("```")
  out.push("")
  out.push(`## ${t("endpointsTitle")}`)
  for (const ep of ENDPOINTS) {
    out.push("")
    out.push(`### ${ep.method} ${ep.path}${ep.query ?? ""}`)
    out.push("")
    out.push(epNotes(`ep.${ep.key}.d`))
    out.push("")
    out.push("```bash")
    out.push(curlFor(base, ep))
    out.push("```")
    for (const r of ep.responses) {
      out.push("")
      out.push(`Response ${r.status} — ${epNotes(r.noteKey)}`)
      out.push("")
      out.push("```json")
      out.push(r.body)
      out.push("```")
    }
  }
  out.push("")
  out.push(`## ${t("errorsTitle")}`)
  out.push("")
  for (const k of ["err401", "err403", "err404", "err409", "err503", "errSubdomain"]) {
    out.push(`- ${t(k)}`)
  }
  out.push("")
  out.push(`## ${t("notesTitle")}`)
  out.push("")
  for (const k of ["note1", "note2", "note3", "note4", "note5", "note6"]) {
    out.push(`- ${t(k)}`)
  }
  out.push("")
  return out.join("\n")
}

export function ApiDocsView({ baseUrl, authed }: { baseUrl: string; authed: boolean }) {
  const t = useTranslations("apiDocs")
  const locale = useLocale()
  const { copyToClipboard } = useCopy()
  const [mdCopied, setMdCopied] = useState(false)
  const [curlCopied, setCurlCopied] = useState<string | null>(null)

  const markdown = useMemo(() => markdownFor(baseUrl, t, (k) => t(k)), [baseUrl, t])

  const handleCopyMarkdown = async () => {
    const ok = await copyToClipboard(markdown)
    if (ok) {
      setMdCopied(true)
      setTimeout(() => setMdCopied(false), 1600)
    }
  }

  const handleCopyCurl = async (ep: EndpointDef) => {
    const ok = await copyToClipboard(curlFor(baseUrl, ep))
    if (ok) {
      setCurlCopied(ep.key)
      setTimeout(() => setCurlCopied((v) => (v === ep.key ? null : v)), 1600)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-20 pb-10 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpenText className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCopyMarkdown}>
          {mdCopied ? <Check className="size-3.5" /> : <FileDown className="size-3.5" />}
          {mdCopied ? t("copied") : t("copyMarkdown")}
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="shrink-0 text-[12px] text-muted-foreground">{t("baseUrlLabel")}</span>
        <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{baseUrl}</code>
      </div>

      <section className="mt-4 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="text-[14px] font-semibold tracking-tight">{t("authTitle")}</h2>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t("authDesc")}</p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-[12px]">X-API-Key: YOUR_API_KEY</pre>
      </section>

      <section className="mt-4 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          <h2 className="text-[14px] font-semibold tracking-tight">{t("getKeyTitle")}</h2>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t("getKeyDesc")}</p>
      </section>

      <h2 className="mt-8 text-[15px] font-semibold tracking-tight">{t("endpointsTitle")}</h2>
      <div className="mt-3 space-y-3">
        {ENDPOINTS.map((ep) => (
          <section key={ep.key} className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">{ep.method}</span>
                <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{ep.path}{ep.query ?? ""}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" title={t("copyCurl")} onClick={() => handleCopyCurl(ep)}>
                  {curlCopied === ep.key ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t(`ep.${ep.key}.t`)} — {t(`ep.${ep.key}.d`)}</p>
            </div>
            <div className="bg-muted/30 px-4 py-3">
              <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed">{curlFor(baseUrl, ep)}</pre>
            </div>
            {ep.responses.map((r) => (
              <div key={r.status} className="border-t px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Response {r.status} — {t(r.noteKey)}</p>
                <pre className="mt-1.5 overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-[12px] leading-relaxed">{r.body}</pre>
              </div>
            ))}
          </section>
        ))}
      </div>

      <section className="mt-4 rounded-lg border bg-card p-4">
        <h2 className="text-[14px] font-semibold tracking-tight">{t("responseTitle")}</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t("responseDesc")}</p>
      </section>

      <section className="mt-4 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-4 text-destructive" />
          <h2 className="text-[14px] font-semibold tracking-tight">{t("errorsTitle")}</h2>
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-muted-foreground">
          {["err401", "err403", "err404", "err409", "err503", "errSubdomain"].map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-lg border bg-card p-4">
        <h2 className="text-[14px] font-semibold tracking-tight">{t("notesTitle")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-muted-foreground">
          {["note1", "note2", "note3", "note4", "note5", "note6"].map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h2 className="text-[15px] font-semibold tracking-tight">{t("keysTitle")}</h2>
        </div>
        <div className="mt-3">
          <ApiKeyPanel embedded={true} authed={authed} loginHref={`/${locale}/login?callbackUrl=/${locale}/api-docs`} />
        </div>
      </div>
    </div>
  )
}
