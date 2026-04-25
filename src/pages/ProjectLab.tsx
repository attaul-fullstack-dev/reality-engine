import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, FolderKanban, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  PROJECT_STATUSES,
  type Project,
  type ProjectStatus,
} from '@/types'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

interface FormState {
  title: string
  status: ProjectStatus
}

const EMPTY_FORM: FormState = { title: '', status: 'draft' }

const STATUS_VARIANT: Record<
  ProjectStatus,
  'default' | 'secondary' | 'success' | 'outline'
> = {
  draft: 'outline',
  in_progress: 'secondary',
  completed: 'success',
  archived: 'outline',
}

export function ProjectLab() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)

  async function fetchProjects() {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) {
      toast.error('Gagal memuat projects', { description: error.message })
      return
    }
    setProjects((data ?? []) as Project[])
  }

  useEffect(() => {
    void fetchProjects()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Judul wajib diisi')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({ title: form.title.trim(), status: form.status })
      .select()
      .single()
    setSubmitting(false)
    if (error) {
      toast.error('Gagal membuat project', { description: error.message })
      return
    }
    const created = data as Project
    setProjects((prev) => [created, ...prev])
    setForm(EMPTY_FORM)
    setDialogOpen(false)
    toast.success('Project dibuat')
    navigate(`/project-lab/${created.id}`)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', target.id)
    if (error) {
      toast.error('Gagal hapus project', { description: error.message })
      return
    }
    setProjects((prev) => prev.filter((p) => p.id !== target.id))
    toast.success('Project dihapus')
  }

  return (
    <div>
      <PageHeader
        title="Project Lab"
        description="Setiap project menampung scene, prompt, dan hasil generate-nya."
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM)
              setDialogOpen(true)
            }}
            disabled={!isSupabaseConfigured}
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        }
      />

      {loading ? (
        <p className="rounded-lg border border-dashed bg-card/40 p-12 text-center text-sm text-muted-foreground">
          Memuat…
        </p>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/40 p-12 text-center">
          <FolderKanban className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Belum ada project.</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Klik <span className="font-medium text-foreground">New Project</span>{' '}
            untuk membuat workspace baru. Workspace siap untuk dirakit di PRD 3+.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="group flex flex-col rounded-lg border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={`/project-lab/${p.id}`}
                    className="block truncate text-base font-semibold transition-colors group-hover:text-primary"
                  >
                    {p.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {formatDate(p.created_at)}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingDelete(p)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  Delete
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/project-lab/${p.id}`}>
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Setelah dibuat, Anda akan diarahkan ke workspace project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="project-title">Title</Label>
              <Input
                id="project-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Cyber-Diver Trailer"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as ProjectStatus }))
                }
              >
                <SelectTrigger id="project-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Membuat…' : 'Buat & Buka'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus project?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `"${pendingDelete.title}" beserta seluruh scene-nya akan dihapus permanen (cascade).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
