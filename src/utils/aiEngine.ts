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
import type {
  Character,
  CharacterExpression,
  CharacterOutfit,
  Preset,
  Scene,
} from '@/types'

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

/**
 * Errors thrown by the provider call carry a numeric HTTP status so the
 * rotation engine can decide whether to retry. The mock never throws this,
 * but a real `callImageProvider` should wrap fetch errors in this class.
 */
export class ProviderError extends Error {
  status: number
  provider: string
  constructor(provider: string, status: number, message: string) {
    super(message)
    this.name = 'ProviderError'
    this.provider = provider
    this.status = status
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
      // Inspect a structured ProviderError instead of regex-parsing the
      // message — that mistakes incidental 3-digit numbers (IPs, request
      // ids) for HTTP statuses.
      if (err instanceof ProviderError && (err.status === 429 || err.status === 503)) {
        await bumpErrorCount(key)
        lastError = new RateLimitError(err.provider, err.status)
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

// ----- Scene-level helper -----

/**
 * Lookup tables passed by the workspace so we can resolve a Scene's FK
 * columns to actual rows when batching prompt construction.
 */
export interface SceneLookup {
  characters: Character[]
  outfits: CharacterOutfit[]
  expressions: CharacterExpression[]
  presets: Preset[]
}

/**
 * Build the final prompt for a Scene using the pre-loaded lookup tables.
 * Returns null when the scene is missing its anchor (no character or no
 * action_text) and therefore can't be sent to the model.
 */
export function buildPromptFromScene(
  scene: Scene,
  lookup: SceneLookup,
): string | null {
  if (!scene.character_id || !scene.action_text?.trim()) return null
  const character = lookup.characters.find((c) => c.id === scene.character_id)
  if (!character) return null

  const outfit = scene.outfit_id
    ? lookup.outfits.find((o) => o.id === scene.outfit_id) ?? null
    : null
  const expression = scene.expression_id
    ? lookup.expressions.find((e) => e.id === scene.expression_id) ?? null
    : null
  const findPreset = (id: string | null | undefined) =>
    id ? lookup.presets.find((p) => p.id === id) ?? null : null
  const camera = findPreset(scene.camera_id)
  const lighting = findPreset(scene.lighting_id)
  const filmStock = findPreset(scene.film_stock_id)
  const style = findPreset(scene.style_id)

  return buildFinalPrompt({
    bodyDna: character.body_dna,
    faceFeatures: character.face_features,
    outfitDesc: outfit?.prompt_desc ?? null,
    expressionDesc: expression?.prompt_desc ?? null,
    actionText: scene.action_text.trim(),
    cameraMod: camera?.modifier ?? null,
    lightingMod: lighting?.modifier ?? null,
    filmStockMod: filmStock?.modifier ?? null,
    styleMod: style?.modifier ?? null,
  })
}
