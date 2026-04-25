import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Character, Preset, Project, Scene } from '@/types'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

export function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [presets, setPresets] = useState<GroupedPresets>(EMPTY_PRESETS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

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
      const [projRes, sceneRes, charRes, presetRes] = await Promise.all([
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
        setScenes((sceneRes.data ?? []) as Scene[])
      }
      if (charRes.error) {
        toast.error('Gagal memuat characters', {
          description: charRes.error.message,
        })
      } else {
        setCharacters((charRes.data ?? []) as Character[])
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

  const nextSceneOrder = useMemo(
    () => (scenes.length === 0 ? 1 : Math.max(...scenes.map((s) => s.scene_order)) + 1),
    [scenes],
  )

  async function handleAddScene() {
    if (!projectId || !isSupabaseConfigured) return
    setAdding(true)
    const { data, error: err } = await supabase
      .from('scenes')
      .insert({
        project_id: projectId,
        scene_order: nextSceneOrder,
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
            description={`Scene Assembler · dibuat ${formatDate(project.created_at)} · ${scenes.length} scene`}
            actions={
              <div className="flex items-center gap-2">
                <Badge>{project.status}</Badge>
                <Button onClick={() => void handleAddScene()} disabled={adding}>
                  <Plus className="h-4 w-4" />
                  {adding ? 'Menambah…' : 'Add new scene'}
                </Button>
              </div>
            }
          />

          {scenes.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card/40 p-12 text-center">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-sm font-semibold">
                Belum ada scene di project ini
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Klik <strong>Add new scene</strong> untuk membuat scene
                pertama, lalu pilih actor + presets dan klik Generate.
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
                  nextSceneOrder={nextSceneOrder}
                  onUpdate={handleSceneUpdate}
                  onDelete={handleSceneDelete}
                  onDuplicate={handleSceneDuplicate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
