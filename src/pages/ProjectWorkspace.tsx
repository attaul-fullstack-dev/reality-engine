import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Project, Scene } from '@/types'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      const [projRes, sceneRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase
          .from('scenes')
          .select('*')
          .eq('project_id', projectId)
          .order('scene_order', { ascending: true }),
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
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId])

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
            description={`Workspace · dibuat ${formatDate(project.created_at)}`}
            actions={<Badge>{project.status}</Badge>}
          />

          <div className="rounded-lg border border-dashed bg-card/40 p-12 text-center">
            <Construction className="mx-auto mb-3 h-8 w-8 text-primary" />
            <h2 className="text-base font-semibold">Scene Assembler — PRD 3</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Workspace untuk merakit scene (actor, outfit, expression, preset,
              action, generate image) akan dibangun di PRD 3. Project ini sudah
              tercatat di database dan siap dipakai.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              {scenes.length} scene tersimpan untuk project ini.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
