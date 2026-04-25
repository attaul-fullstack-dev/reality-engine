/**
 * AI Script Wizard — uses Gemini to break a story concept into a small
 * number of scene action descriptions.
 *
 * Key resolution order:
 *   1. `VITE_GEMINI_API_KEY` env var (recommended for local dev)
 *   2. First active `Google` provider key in `api_vault`
 *
 * The model is asked to return a JSON array of strings. We parse it
 * defensively because Gemini sometimes wraps the JSON in markdown code
 * fences.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const SYSTEM_PROMPT = `You are an expert storyboard artist. Break the following concept into exactly 5 distinct visual scenes. Return ONLY a valid JSON array of strings. Each string is a detailed description of the physical action happening in that scene. Do not include markdown formatting or backticks. Example format: ["A wide shot of a man walking in rain", "A close up of his boots splashing a puddle", "A medium shot of him pushing a glass door", "A dolly shot of him sitting at a counter", "An overhead shot of his hands clasping a warm mug"]`

export class ScriptWizardError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'ScriptWizardError'
  }
}

async function resolveGeminiKey(): Promise<string> {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (envKey && envKey.trim()) return envKey.trim()

  if (!isSupabaseConfigured) {
    throw new ScriptWizardError(
      'Gemini API key tidak tersedia. Set VITE_GEMINI_API_KEY atau tambahkan key Google aktif di API Vault.',
    )
  }
  const { data, error } = await supabase
    .from('api_vault')
    .select('api_key')
    .eq('provider', 'Google')
    .eq('is_active', true)
    .order('error_count', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new ScriptWizardError(`Gagal membaca api_vault: ${error.message}`)
  }
  if (!data?.api_key) {
    throw new ScriptWizardError(
      'Tidak ada Google API key aktif di api_vault. Tambahkan satu di /api-vault.',
    )
  }
  return data.api_key
}

function parseSceneArray(raw: string): string[] {
  let text = raw.trim()
  // Strip markdown code fences if present.
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
      return parsed
    }
  } catch {
    // fall through to extraction
  }
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) {
    throw new ScriptWizardError(
      'Gagal parse array scene dari respon Gemini.',
    )
  }
  // Wrap in try/catch so a malformed extracted array surfaces as a
  // ScriptWizardError instead of a raw SyntaxError.
  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    throw new ScriptWizardError(
      'Gagal parse array scene dari respon Gemini.',
    )
  }
  if (!Array.isArray(parsed) || !parsed.every((s) => typeof s === 'string')) {
    throw new ScriptWizardError(
      'Format respon Gemini bukan array of strings.',
    )
  }
  return parsed
}

export async function breakdownConcept(
  concept: string,
): Promise<string[]> {
  if (!concept.trim()) {
    throw new ScriptWizardError('Konsep cerita tidak boleh kosong.')
  }
  const apiKey = await resolveGeminiKey()

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\nConcept: ${concept.trim()}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ScriptWizardError(
      `Gemini API ${response.status} ${response.statusText}${text ? `: ${text.slice(0, 200)}` : ''}`,
    )
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new ScriptWizardError('Respon Gemini kosong.')
  }
  const scenes = parseSceneArray(text)
  if (scenes.length === 0) {
    throw new ScriptWizardError('Gemini tidak mengembalikan scene.')
  }
  return scenes
}
