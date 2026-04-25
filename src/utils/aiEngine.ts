/**
 * Multi-key rotation engine for image generation.
 *
 * Reads active API keys from `api_vault`, then walks them in order. On
 * 429/503 (rate limit / service unavailable) we increment the key's
 * `error_count` and try the next key. A key is auto-disabled after 5 errors
 * to keep the rotation pool healthy.
 *
 * For development the actual provider call is **mocked** — we don't have a
 * real image-gen endpoint in this project yet. The mock honours the same
 * "needs at least one active key" contract so the Scene Assembler UI can be
 * exercised end-to-end against Supabase without a real provider.
 *
 * To plug in a real provider, replace `callImageProvider()` with a real
 * fetch and return the image URL.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase'

// ----- Error classes -----

export class NoActiveKeysError extends Error {
  constructor() {
    super('No active API keys found. Add one in API Vault.')
    this.name = 'NoActiveKeysError'
  }
}

export class RateLimitError extends Error {
  constructor(provider: string, status: number) {
    super(`Rate limited on ${provider} (HTTP ${status})`)
    this.name = 'RateLimitError'
  }
}

export class GenerationFailedError extends Error {
  constructor(reason: string) {
    super(`Image generation failed: ${reason}`)
    this.name = 'GenerationFailedError'
  }
}

// ----- Types -----

interface KeyRecord {
  id: string
  api_key: string
  provider: string
  error_count: number
}

const MAX_ERROR_COUNT = 5

// ----- Mock provider -----

/**
 * Mock image-generation call. In real life this would POST to the provider
 * (e.g. Google Imagen) with the prompt and Bearer token, and return the URL
 * of the generated asset. The mock simulates network latency and produces a
 * deterministic placeholder so the UI can show "an image".
 */
async function callImageProvider(
  _key: KeyRecord,
  prompt: string,
): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  // Use prompt hash to vary the placeholder per scene.
  const seed = encodeURIComponent(prompt.slice(0, 40))
  return `https://picsum.photos/seed/${seed}-${Date.now()}/1024/576`
}

// ----- Rotation engine -----

export async function generateImageWithRotation(
  finalPrompt: string,
): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new GenerationFailedError(
      'Supabase belum dikonfigurasi. Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.',
    )
  }

  const { data, error } = await supabase
    .from('api_vault')
    .select('id, api_key, provider, error_count')
    .eq('is_active', true)
    .order('error_count', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new GenerationFailedError(
      `Gagal membaca api_vault: ${error.message}`,
    )
  }

  const keys = (data ?? []) as KeyRecord[]
  if (keys.length === 0) {
    throw new NoActiveKeysError()
  }

  let lastError: Error | null = null

  for (const key of keys) {
    try {
      return await callImageProvider(key, finalPrompt)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const status = Number(message.match(/\d{3}/)?.[0] ?? 0)

      if (status === 429 || status === 503) {
        // Rate limit / service unavailable — bump error_count and rotate.
        await bumpErrorCount(key)
        lastError = new RateLimitError(key.provider, status)
        continue
      }

      // Hard error — surface immediately.
      throw err instanceof Error
        ? err
        : new GenerationFailedError(String(err))
    }
  }

  throw new GenerationFailedError(
    lastError?.message ??
      'System Overload: All active API keys are currently rate-limited or exhausted.',
  )
}

async function bumpErrorCount(key: KeyRecord): Promise<void> {
  const nextCount = key.error_count + 1
  const updates: { error_count: number; is_active?: boolean } = {
    error_count: nextCount,
  }
  if (nextCount >= MAX_ERROR_COUNT) {
    updates.is_active = false
  }
  await supabase.from('api_vault').update(updates).eq('id', key.id)
}

// ----- Prompt builder -----

interface PromptParts {
  bodyDna: string
  faceFeatures: string
  outfitDesc: string | null
  expressionDesc: string | null
  actionText: string
  cameraMod: string | null
  lightingMod: string | null
  filmStockMod: string | null
  styleMod: string | null
}

/**
 * Compose the final prompt from the structured Scene Card selections,
 * following the formula in PRD 3 §Phase 8 / Row 5.
 */
export function buildFinalPrompt(parts: PromptParts): string {
  const subject = [
    parts.bodyDna,
    parts.faceFeatures,
    parts.outfitDesc ? `wearing ${parts.outfitDesc}` : '',
    parts.expressionDesc ? `${parts.expressionDesc} expression` : '',
    `ACTION: ${parts.actionText}`,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('. ')

  const technicalMods = [
    parts.cameraMod,
    parts.lightingMod,
    parts.filmStockMod,
    parts.styleMod,
  ]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)

  if (technicalMods.length === 0) return subject
  return `${subject}. TECHNICAL SPECS: ${technicalMods.join(', ')}`
}
