import { useEffect, useMemo, useState } from 'react'
import { Copy, ImageOff, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type {
  Character,
  CharacterExpression,
  CharacterOutfit,
  Preset,
  Scene,
} from '@/types'
import { buildFinalPrompt, generateImageWithRotation } from '@/utils/aiEngine'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const NONE = '__none__'

export interface GroupedPresets {
  Camera: Preset[]
  Lighting: Preset[]
  FilmStock: Preset[]
  Style: Preset[]
}

interface SceneCardProps {
  scene: Scene
  characters: Character[]
  presets: GroupedPresets
  /** Synchronously reserve and return the next `scene_order` for an insert.
   *
   * Implemented by the parent on top of a ref-based counter so that two
   * concurrent Duplicate / Add clicks always get distinct, monotonically
   * increasing values — a stale snapshot prop would let both inserts use
   * the same value and corrupt the row ordering. */
  reserveSceneOrder: () => number
  onUpdate: (updated: Scene) => void
  onDelete: (sceneId: string) => void
  onDuplicate: (newScene: Scene) => void
  /** When true, all interactive controls are disabled (e.g. during a batch
   * generation run). */
  locked?: boolean
}

function valueOrNone(id: string | null | undefined): string {
  return id ?? NONE
}

function fromSelect(value: string): string | null {
  return value === NONE ? null : value
}

export function SceneCard({
  scene,
  characters,
  presets,
  reserveSceneOrder,
  onUpdate,
  onDelete,
  onDuplicate,
  locked = false,
}: SceneCardProps) {
  const [characterId, setCharacterId] = useState<string | null>(
    scene.character_id ?? null,
  )
  const [outfitId, setOutfitId] = useState<string | null>(scene.outfit_id ?? null)
  const [expressionId, setExpressionId] = useState<string | null>(
    scene.expression_id ?? null,
  )
  const [cameraId, setCameraId] = useState<string | null>(scene.camera_id ?? null)
  const [lightingId, setLightingId] = useState<string | null>(
    scene.lighting_id ?? null,
  )
  const [filmStockId, setFilmStockId] = useState<string | null>(
    scene.film_stock_id ?? null,
  )
  const [styleId, setStyleId] = useState<string | null>(scene.style_id ?? null)
  const [actionText, setActionText] = useState(scene.action_text ?? '')

  const [outfits, setOutfits] = useState<CharacterOutfit[]>([])
  const [expressions, setExpressions] = useState<CharacterExpression[]>([])
  const [loadingNested, setLoadingNested] = useState(false)

  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)

  const character = useMemo(
    () => characters.find((c) => c.id === characterId) ?? null,
    [characters, characterId],
  )

  // Fetch outfits/expressions when actor changes (or on mount if scene has actor).
  useEffect(() => {
    let cancelled = false
    async function loadNested() {
      if (!characterId || !isSupabaseConfigured) {
        setOutfits([])
        setExpressions([])
        return
      }
      setLoadingNested(true)
      const [oRes, eRes] = await Promise.all([
        supabase
          .from('character_outfits')
          .select('*')
          .eq('character_id', characterId)
          .order('created_at', { ascending: true }),
        supabase
          .from('character_expressions')
          .select('*')
          .eq('character_id', characterId)
          .order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      setLoadingNested(false)
      if (oRes.error) {
        toast.error('Gagal memuat outfits', { description: oRes.error.message })
      } else {
        setOutfits((oRes.data ?? []) as CharacterOutfit[])
      }
      if (eRes.error) {
        toast.error('Gagal memuat expressions', {
          description: eRes.error.message,
        })
      } else {
        setExpressions((eRes.data ?? []) as CharacterExpression[])
      }
    }
    void loadNested()
    return () => {
      cancelled = true
    }
  }, [characterId])

  // ---------- Handlers ----------

  async function persist(updates: Partial<Scene>) {
    if (!isSupabaseConfigured) return
    const { data, error } = await supabase
      .from('scenes')
      .update(updates)
      .eq('id', scene.id)
      .select()
      .single()
    if (error) {
      toast.error('Gagal menyimpan scene', { description: error.message })
      return
    }
    onUpdate(data as Scene)
  }

  async function handleActorChange(value: string) {
    const next = fromSelect(value)
    setCharacterId(next)
    // Reset outfit/expression because they belong to the previous character.
    setOutfitId(null)
    setExpressionId(null)
    await persist({
      character_id: next,
      outfit_id: null,
      expression_id: null,
    })
  }

  async function handleSimpleSelect<K extends keyof Scene>(
    column: K,
    setter: (value: string | null) => void,
    value: string,
  ) {
    const next = fromSelect(value)
    setter(next)
    await persist({ [column]: next } as Partial<Scene>)
  }

  async function handleActionBlur() {
    if (actionText === scene.action_text) return
    await persist({ action_text: actionText })
  }

  async function handleGenerate() {
    if (!character) {
      toast.error('Pilih actor dulu')
      return
    }
    if (!actionText.trim()) {
      toast.error('Tulis action description dulu')
      return
    }
    if (!isSupabaseConfigured) {
      toast.error('Supabase belum dikonfigurasi')
      return
    }

    const outfit = outfitId ? outfits.find((o) => o.id === outfitId) : null
    const expression = expressionId
      ? expressions.find((e) => e.id === expressionId)
      : null
    const camera = cameraId ? presets.Camera.find((p) => p.id === cameraId) : null
    const lighting = lightingId
      ? presets.Lighting.find((p) => p.id === lightingId)
      : null
    const filmStock = filmStockId
      ? presets.FilmStock.find((p) => p.id === filmStockId)
      : null
    const style = styleId ? presets.Style.find((p) => p.id === styleId) : null

    const finalPrompt = buildFinalPrompt({
      bodyDna: character.body_dna,
      faceFeatures: character.face_features,
      outfitDesc: outfit?.prompt_desc ?? null,
      expressionDesc: expression?.prompt_desc ?? null,
      actionText: actionText.trim(),
      cameraMod: camera?.modifier ?? null,
      lightingMod: lighting?.modifier ?? null,
      filmStockMod: filmStock?.modifier ?? null,
      styleMod: style?.modifier ?? null,
    })

    setIsGenerating(true)
    try {
      const imageUrl = await generateImageWithRotation(finalPrompt)
      const { data, error } = await supabase
        .from('scenes')
        .update({
          generated_image_url: imageUrl,
          prompt_snapshot: finalPrompt,
          action_text: actionText.trim(),
        })
        .eq('id', scene.id)
        .select()
        .single()
      if (error) {
        toast.error('Gagal menyimpan hasil generate', {
          description: error.message,
        })
        return
      }
      onUpdate(data as Scene)
      toast.success('Image berhasil di-generate')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Gagal generate image', { description: msg })
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleDuplicate() {
    if (!isSupabaseConfigured) return
    const { data, error } = await supabase
      .from('scenes')
      .insert({
        project_id: scene.project_id,
        // Always append at the end to avoid colliding with existing scene_order
        // values. (PRD 3 hinted at "order + 1" but that creates duplicates.)
        scene_order: reserveSceneOrder(),
        action_text: actionText,
        character_id: characterId,
        outfit_id: outfitId,
        expression_id: expressionId,
        camera_id: cameraId,
        lighting_id: lightingId,
        film_stock_id: filmStockId,
        style_id: styleId,
        // generated_image_url & prompt_snapshot intentionally null — must regenerate.
      })
      .select()
      .single()
    if (error) {
      toast.error('Gagal duplicate scene', { description: error.message })
      return
    }
    onDuplicate(data as Scene)
    toast.success('Scene di-duplicate')
  }

  async function handleConfirmDelete() {
    setPendingDelete(false)
    if (!isSupabaseConfigured) return
    const { error } = await supabase
      .from('scenes')
      .delete()
      .eq('id', scene.id)
    if (error) {
      toast.error('Gagal hapus scene', { description: error.message })
      return
    }
    onDelete(scene.id)
    toast.success('Scene dihapus')
  }

  // ---------- Render ----------

  const disabled = !isSupabaseConfigured || locked

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <header className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Scene #{scene.scene_order}
          </p>
        </header>

        {/* Row 1 — Actor selection */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Actor</Label>
            <Select
              value={valueOrNone(characterId)}
              onValueChange={handleActorChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih actor…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(no actor)</SelectItem>
                {characters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Outfit</Label>
            <Select
              value={valueOrNone(outfitId)}
              onValueChange={(v) =>
                void handleSimpleSelect('outfit_id', setOutfitId, v)
              }
              disabled={disabled || !characterId || loadingNested}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !characterId
                      ? 'Pilih actor dulu'
                      : outfits.length === 0
                        ? '(no outfits)'
                        : 'Pilih outfit…'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(no outfit)</SelectItem>
                {outfits.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Expression</Label>
            <Select
              value={valueOrNone(expressionId)}
              onValueChange={(v) =>
                void handleSimpleSelect('expression_id', setExpressionId, v)
              }
              disabled={disabled || !characterId || loadingNested}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !characterId
                      ? 'Pilih actor dulu'
                      : expressions.length === 0
                        ? '(no expressions)'
                        : 'Pilih expression…'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(no expression)</SelectItem>
                {expressions.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2 — Preset dropdowns */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PresetSelect
            label="Camera"
            value={cameraId}
            options={presets.Camera}
            onChange={(v) =>
              void handleSimpleSelect('camera_id', setCameraId, v)
            }
            disabled={disabled}
          />
          <PresetSelect
            label="Lighting"
            value={lightingId}
            options={presets.Lighting}
            onChange={(v) =>
              void handleSimpleSelect('lighting_id', setLightingId, v)
            }
            disabled={disabled}
          />
          <PresetSelect
            label="Film Stock"
            value={filmStockId}
            options={presets.FilmStock}
            onChange={(v) =>
              void handleSimpleSelect('film_stock_id', setFilmStockId, v)
            }
            disabled={disabled}
          />
          <PresetSelect
            label="Style"
            value={styleId}
            options={presets.Style}
            onChange={(v) =>
              void handleSimpleSelect('style_id', setStyleId, v)
            }
            disabled={disabled}
          />
        </div>

        {/* Row 3 — Action description */}
        <div className="grid gap-1.5">
          <Label htmlFor={`action-${scene.id}`}>Action description</Label>
          <Textarea
            id={`action-${scene.id}`}
            rows={2}
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            onBlur={() => void handleActionBlur()}
            placeholder="e.g. drinking herbal medicine, looking at camera"
            disabled={disabled}
          />
        </div>

        {/* Row 4 — Generated image */}
        <div className="overflow-hidden rounded-md border bg-secondary">
          {scene.generated_image_url ? (
            <img
              src={scene.generated_image_url}
              alt={`Scene ${scene.scene_order}`}
              className="h-72 w-full object-cover"
            />
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="h-6 w-6" />
              <p className="text-xs">Belum ada image. Klik Generate.</p>
            </div>
          )}
        </div>

        {scene.prompt_snapshot && (
          <details className="rounded-md border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-mono">
              prompt snapshot
            </summary>
            <p className="mt-2 whitespace-pre-wrap font-mono">
              {scene.prompt_snapshot}
            </p>
          </details>
        )}

        {/* Row 5 — Actions */}
        <div className="mt-auto flex flex-wrap gap-2">
          <Button
            onClick={() => void handleGenerate()}
            disabled={disabled || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Scene
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleDuplicate()}
            disabled={disabled || isGenerating}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          <Button
            variant="ghost"
            onClick={() => setPendingDelete(true)}
            disabled={disabled || isGenerating}
            className="ml-auto"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
            Delete
          </Button>
        </div>
      </CardContent>

      <AlertDialog
        open={pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus scene #{scene.scene_order}?</AlertDialogTitle>
            <AlertDialogDescription>
              Image hasil generate akan ikut hilang. Tindakan tidak bisa
              di-undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function PresetSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string | null
  options: Preset[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select
        value={valueOrNone(value)}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              options.length === 0 ? `(no ${label.toLowerCase()} presets)` : `Pilih ${label.toLowerCase()}…`
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>(none)</SelectItem>
          {options.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
