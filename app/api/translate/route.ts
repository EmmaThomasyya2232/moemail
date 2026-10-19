import { NextResponse } from "next/server"

export const runtime = "edge"

// 邮件“翻成中文”：服务端中转 MyMemory 免费翻译接口，前端无需配 key。
// 长文本按段切分逐段翻译后拼接；失败直接 502 让前端 toast 提示。
const MAX_TEXT_LENGTH = 20000
const CHUNK_SIZE = 1500
const UPSTREAM_TIMEOUT_MS = 15000

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = []
  let rest = text
  while (rest.length > 0) {
    if (rest.length <= size) {
      chunks.push(rest)
      break
    }
    // 尽量在换行 / 句末 / 空格处断开，避免把句子拦腰截断
    let cut = -1
    for (const sep of ["\n\n", "\n", "。", "！", "？", ". ", "! ", "? ", "；", "; ", "，", ", ", " "]) {
      const idx = rest.lastIndexOf(sep, size)
      if (idx > size * 0.4) {
        cut = idx + sep.length
        break
      }
    }
    if (cut <= 0) cut = size
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  return chunks
}

async function translateChunk(text: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|zh-CN`
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`upstream ${response.status}`)
    const data = await response.json() as {
      responseData?: { translatedText?: string }
      responseStatus?: number
    }
    const translated = data.responseData?.translatedText
    // 免费接口超限 / 查不到时会回原文或报错，此时直接抛错走降级
    if (!translated || data.responseStatus === 429) {
      throw new Error("empty translation")
    }
    return translated
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json() as { text?: unknown }
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "缺少待翻译文本" }, { status: 400 })
    }
    const input = text.slice(0, MAX_TEXT_LENGTH)
    const chunks = splitIntoChunks(input, CHUNK_SIZE)
    const out: string[] = []
    for (const chunk of chunks) {
      out.push(await translateChunk(chunk))
    }
    return NextResponse.json({ translatedText: out.join("") })
  } catch (error) {
    console.error("Failed to translate:", error)
    return NextResponse.json(
      { error: "翻译服务暂不可用，请稍后重试" },
      { status: 502 }
    )
  }
}
