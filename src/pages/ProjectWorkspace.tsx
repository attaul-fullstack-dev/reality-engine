import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Sparkles, Wand2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type {
  Character,
  CharacterExpression,
  CharacterOutfit,
  Preset,
  Project,
  Scene,
} from '@/types'
import { formatDate } from '@/lib/utils'
import {
  buildPromptFromScene,
  generateImageWithRotation,
} from '@/utils/aiEngine'
import { breakdownConcept } from '@/utils/scriptWizard'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { SceneCard, type GroupedPresets } from '@/components/SceneCard'

const EMPTY_PRESETS: GroupedPresets = {
  Camera: [],
  Lighting: [],
  FilmStock: [],
  Style: [],
}

function groupPresets(rows: Preset[]): GroupedPresets {
  const next: GroupedPresets = {
    Camera: [],
    Lighting: [],
    FilmStock: [],
    Style: [],
  }
  for (const p of rows) {
    next[p.category].push(p)
  }
  return next
}

function flattenPresets(grouped: GroupedPresets): Preset[] {
  return [
    ...grouped.Camera,
    ...grouped.Lighting,
    ...grouped.FilmStock,
    ...grouped.Style,
  ]
}

export function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [allOutfits, setAllOutfits] = useState<CharacterOutfit[]>([])
  const [allExpressions, setAllExpressions] = useState<CharacterExpression[]>([])
  const [presets, setPresets] = useState<GroupedPresets>(EMPTY_PRESETS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [conceptText, setConceptText] = useState('')
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isBatchRunning, setIsBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })

  /**
   * Synchronous monotonic counter for `scene_order`. Initialised from the
   * loaded scenes and bumped before every insert (Add / Duplicate / Script
   * Wizard) so concurrent operations always reserve distinct values, even
   * before React state catches up. Without this, a stale `useMemo` snapshot
   * lets two clicks race and create rows with identical scene_order.
   */
  const sceneOrderRef = useRef(0)

  const reserveSceneOrder = useCallback((): number => {
    sceneOrderRef.current += 1
    return sceneOrderRef.current
  }, [])

  useEffect(() => {
    if (!projectId) return
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const [projRes, sceneRes, charRes, outfitRes, exprRes, presetRes] =
        await Promise.all([
          supabase.from('projects').select('*').eq('id', projectId).single(),
          supabase
            .from('scenes')
            .select('*')
            .eq('project_id', projectId)
            .order('scene_order', { ascending: true }),
          supabase
            .from('characters')
            .select('*')
            .order('created_at', { ascending: true }),
          supabase.from('character_outfits').select('*'),
          supabase.from('character_expressions').select('*'),
          supabase
            .from('presets')
            .select('*')
            .order('created_at', { ascending: true }),
        ])
      if (cancelled) return
      setLoading(false)
      if (projRes.error) {
        setError(projRes.error.message)
        toast.error('Gagal memuat project', {
          description: projRes.error.message,
        })
        return
      }
      setProject(projRes.data as Project)
      if (sceneRes.error) {
        toast.error('Gagal memuat scenes', {
          description: sceneRes.error.message,
        })
      } else {
        const loaded = (sceneRes.data ?? []) as Scene[]
        setScenes(loaded)
        // Seed the counter from the loaded scenes so reserveSceneOrder()
        // always returns a value strictly greater than any existing row.
        sceneOrderRef.current = loaded.reduce(
          (max, s) => (s.scene_order > max ? s.scene_order : max),
          0,
        )
      }
      if (charRes.error) {
        toast.error('Gagal memuat characters', {
          description: charRes.error.message,
        })
      } else {
        setCharacters((charRes.data ?? []) as Character[])
      }
      if (!outfitRes.error) {
        setAllOutfits((outfitRes.data ?? []) as CharacterOutfit[])
      }
      if (!exprRes.error) {
        setAllExpressions((exprRes.data ?? []) as CharacterExpression[])
      }
      if (presetRes.error) {
        toast.error('Gagal memuat presets', {
          description: presetRes.error.message,
        })
      } else {
        setPresets(groupPresets((presetRes.data ?? []) as Preset[]))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function handleAddScene() {
    if (!projectId || !isSupabaseConfigured) return
    setAdding(true)
    const order = reserveSceneOrder()
    const { data, error: err } = await supabase
      .from('scenes')
      .insert({
        project_id: projectId,
        scene_order: order,
        action_text: '',
      })
      .select()
      .single()
    setAdding(false)
    if (err) {
      toast.error('Gagal membuat scene', { description: err.message })
      return
    }
    setScenes((prev) => [...prev, data as Scene])
    toast.success('Scene baru ditambahkan')
  }

  function handleSceneUpdate(updated: Scene) {
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  function handleSceneDelete(sceneId: string) {
    setScenes((prev) => prev.filter((s) => s.id !== sceneId))
  }

  function handleSceneDuplicate(newScene: Scene) {
    setScenes((prev) =>
      [...prev, newScene].sort((a, b) => a.scene_order - b.scene_order),
    )
  }

  // ---------- Batch generate ----------

  const emptyScenes = scenes.filter((s) => !s.generated_image_url)

  async function handleBatchGenerate() {
    if (!isSupabaseConfigured || isBatchRunning) return
    if (emptyScenes.length === 0) {
      toast.info('Semua scene sudah punya image.')
      return
    }
    setIsBatchRunning(true)
    setBatchProgress({ current: 0, total: emptyScenes.length })
    let success = 0
    let failure = 0
    const flatPresets = flattenPresets(presets)

    for (let i = 0; i < emptyScenes.length; i++) {
      const scene = emptyScenes[i]
      setBatchProgress({ current: i + 1, total: emptyScenes.length })
      const prompt = buildPromptFromScene(scene, {
        characters,
        outfits: allOutfits,
        expressions: allExpressions,
        presets: flatPresets,
      })
      if (!prompt) {
        failure++
        toast.error(
          `Scene ${scene.scene_order}: actor & action text wajib diisi.`,
        )
        continue
      }
      const toastId = toast.loading(
        `Generating scene ${i + 1} of ${emptyScenes.length}…`,
      )
      try {
        const url = await generateImageWithRotation(prompt)
        const { data, error: err } = await supabase
          .from('scenes')
          .update({ generated_image_url: url, prompt_snapshot: prompt })
          .eq('id', scene.id)
          .select()
          .single()
        if (err) throw err
        const updated = data as Scene
        setScenes((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        )
        success++
        toast.success(`Scene ${scene.scene_order} selesai`, { id: toastId })
      } catch (err) {
        failure++
        const message = err instanceof Error ? err.message : String(err)
        toast.error(`Scene ${scene.scene_order} gagal: ${message}`, {
          id: toastId,
        })
      }
    }

    setIsBatchRunning(false)
    setBatchProgress({ current: 0, total: 0 })
    if (failure === 0) {
      toast.success(`Batch selesai. ${success} scene generated.`)
    } else {
      toast.warning(
        `Batch selesai: ${success} sukses, ${failure} gagal. Cek toast per-scene.`,
      )
    }
  }

  // ---------- Script Wizard ----------

  async function handleAutoGenerateScenes() {
    if (!projectId || !isSupabaseConfigured) return
    if (!conceptText.trim()) {
      toast.error('Konsep cerita wajib diisi.')
      return
    }
    setIsGeneratingScript(true)
    try {
      const sceneDescriptions = await breakdownConcept(conceptText)
      const slice = sceneDescriptions.slice(0, 5)
      const rows = slice.map((desc) => ({
        project_id: projectId,
        scene_order: reserveSceneOrder(),
        action_text: desc,
      }))
      const { data, error: err } = await supabase
        .from('scenes')
        .insert(rows)
        .select()
      if (err) throw err
      const inserted = (data ?? []) as Scene[]
      setScenes((prev) =>
        [...prev, ...inserted].sort((a, b) => a.scene_order - b.scene_order),
      )
      setConceptText('')
      toast.success(`Script di-breakdown jadi ${inserted.length} scene.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('Script wizard gagal', { description: message })
    } finally {
      setIsGeneratingScript(false)
    }
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/project-lab">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Project Lab
        </Link>
      </Button>

      {loading ? (
        <p className="rounded-lg border border-dashed bg-card/40 p-12 text-center text-sm text-muted-foreground">
          Memuat project…
        </p>
      ) : !isSupabaseConfigured ? (
        <PageHeader
          title="Workspace project"
          description="Konfigurasi Supabase dulu untuk membuka workspace ini."
        />
      ) : error || !project ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">Project tidak ditemukan</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ID <code className="font-mono">{projectId}</code> tidak ada di
            database.
          </p>
        </div>
      ) : (
        <>
          <PageHeader
            title={project.title}
            description={`Scene Assembler · dibuat ${formatDate(project.created_at)} · ${scenes.length} scene${
              isBatchRunning && batchProgress.total > 0
                ? ` · batch ${batchProgress.current}/${batchProgress.total}`
                : ''
            }`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{project.status}</Badge>
                <Button
                  variant="secondary"
                  onClick={() => void handleBatchGenerate()}
                  disabled={
                    isBatchRunning ||
                    emptyScenes.length === 0 ||
                    isGeneratingScript
                  }
                >
                  {isBatchRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {isBatchRunning
                    ? `Generating ${batchProgress.current}/${batchProgress.total}…`
                    : `Generate all empty scenes${emptyScenes.length > 0 ? ` (${emptyScenes.length})` : ''}`}
                </Button>
                <Button
                  onClick={() => void handleAddScene()}
                  disabled={adding || isBatchRunning}
                >
                  <Plus className="h-4 w-4" />
                  {adding ? 'Menambah…' : 'Add new scene'}
                </Button>
              </div>
            }
          />

          <Accordion type="single" collapsible className="mb-6 rounded-lg border bg-card">
            <AccordionItem value="wizard" className="border-b-0">
              <AccordionTrigger className="px-5 py-4">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Wand2 className="h-4 w-4 text-primary" />
                  AI Script Wizard
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 px-5 pb-5">
                <p className="text-xs text-muted-foreground">
                  Tulis konsep cerita, Gemini akan breakdown jadi 5 scene
                  otomatis (action text saja — actor & preset tetap pilih
                  manual). Butuh <code className="font-mono">VITE_GEMINI_API_KEY</code> atau Google API key aktif di API Vault.
                </p>
                <Textarea
                  rows={4}
                  placeholder="Contoh: Sebuah iklan 30 detik untuk coffee shop cyberpunk di Jakarta 2099 — barista robot dan pelanggan manusia berinteraksi di tengah hujan neon."
                  value={conceptText}
                  onChange={(e) => setConceptText(e.target.value)}
                  disabled={isGeneratingScript || isBatchRunning}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleAutoGenerateScenes()}
                    disabled={
                      isGeneratingScript ||
                      isBatchRunning ||
                      !conceptText.trim()
                    }
                  >
                    {isGeneratingScript ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    {isGeneratingScript ? 'Membuat scene…' : 'Auto-Generate Scenes'}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {scenes.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card/40 p-12 text-center">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-sm font-semibold">
                Belum ada scene di project ini
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Klik <strong>Add new scene</strong> atau pakai Script Wizard
                di atas untuk memulai.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              {scenes.map((s) => (
                <SceneCard
                  key={s.id}
                  scene={s}
                  characters={characters}
                  presets={presets}
                  reserveSceneOrder={reserveSceneOrder}
                  onUpdate={handleSceneUpdate}
                  onDelete={handleSceneDelete}
                  onDuplicate={handleSceneDuplicate}
                  locked={isBatchRunning}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
