import { useEffect, useState } from 'react'
import { Camera, Lightbulb, Film, Palette, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  PRESET_CATEGORIES,
  type Preset,
  type PresetCategory,
} from '@/types'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const CATEGORY_META: Record<
  PresetCategory,
  { icon: typeof Camera; description: string; sample: string }
> = {
  Camera: {
    icon: Camera,
    description: 'Sudut, fokal, dan gerakan kamera.',
    sample: 'wide-angle dolly shot, f/2.8, 35mm',
  },
  Lighting: {
    icon: Lightbulb,
    description: 'Sumber cahaya, mood, dan kontras.',
    sample: 'low-key rim lighting, neon magenta',
  },
  FilmStock: {
    icon: Film,
    description: 'Karakter butir & warna seperti film analog.',
    sample: 'Kodak Portra 400, soft grain',
  },
  Style: {
    icon: Palette,
    description: 'Gaya artistik / referensi visual.',
    sample: 'cyberpunk noir, Blade Runner 2049',
  },
}

interface FormState {
  category: PresetCategory
  label: string
  modifier: string
}

const EMPTY_FORM: FormState = {
  category: 'Camera',
  label: '',
  modifier: '',
}

export function PresetEngine() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<PresetCategory>('Camera')

  const [dialog, setDialog] = useState<
    | { mode: 'create'; category: PresetCategory }
    | { mode: 'edit'; row: Preset }
    | null
  >(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Preset | null>(null)

  async function fetchPresets() {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('presets')
      .select('*')
      .order('created_at', { ascending: true })
    setLoading(false)
    if (error) {
      toast.error('Gagal memuat presets', { description: error.message })
      return
    }
    setPresets((data ?? []) as Preset[])
  }

  useEffect(() => {
    void fetchPresets()
  }, [])

  function openCreate(category: PresetCategory) {
    setForm({ ...EMPTY_FORM, category })
    setDialog({ mode: 'create', category })
  }

  function openEdit(row: Preset) {
    setForm({
      category: row.category,
      label: row.label,
      modifier: row.modifier,
    })
    setDialog({ mode: 'edit', row })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label.trim()) {
      toast.error('Label wajib diisi')
      return
    }
    setSubmitting(true)
    const payload = {
      category: form.category,
      label: form.label.trim(),
      modifier: form.modifier.trim(),
    }
    if (dialog?.mode === 'create') {
      const { data, error } = await supabase
        .from('presets')
        .insert(payload)
        .select()
        .single()
      setSubmitting(false)
      if (error) {
        toast.error('Gagal membuat preset', { description: error.message })
        return
      }
      setPresets((prev) => [...prev, data as Preset])
      toast.success(`Preset ${form.category} ditambahkan`)
    } else if (dialog?.mode === 'edit') {
      const { data, error } = await supabase
        .from('presets')
        .update(payload)
        .eq('id', dialog.row.id)
        .select()
        .single()
      setSubmitting(false)
      if (error) {
        toast.error('Gagal update preset', { description: error.message })
        return
      }
      const updated = data as Preset
      setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      toast.success('Preset diperbarui')
    }
    setDialog(null)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    const { error } = await supabase
      .from('presets')
      .delete()
      .eq('id', target.id)
    if (error) {
      toast.error('Gagal hapus preset', { description: error.message })
      return
    }
    setPresets((prev) => prev.filter((p) => p.id !== target.id))
    toast.success('Preset dihapus')
  }

  return (
    <div>
      <PageHeader
        title="Preset Engine"
        description="Empat kategori preset (Camera, Lighting, FilmStock, Style) dipakai oleh prompt constructor."
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as PresetCategory)}
      >
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-4">
          {PRESET_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_META[cat].icon
            const count = presets.filter((p) => p.category === cat).length
            return (
              <TabsTrigger key={cat} value={cat} className="gap-2">
                <Icon className="h-3.5 w-3.5" />
                <span>{cat}</span>
                <span className="text-xs text-muted-foreground">({count})</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {PRESET_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat]
          const Icon = meta.icon
          const filtered = presets.filter((p) => p.category === cat)
          return (
            <TabsContent key={cat} value={cat} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{cat} presets</p>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => openCreate(cat)}
                  disabled={!isSupabaseConfigured}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add preset
                </Button>
              </div>

              {loading ? (
                <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                  Memuat…
                </p>
              ) : filtered.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-card/40 p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Belum ada preset {cat}. Contoh modifier:
                  </p>
                  <code className="mt-2 inline-block rounded bg-secondary px-2 py-1 font-mono text-xs">
                    {meta.sample}
                  </code>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((p) => (
                    <Card key={p.id} className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-base">{p.label}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <p className="font-mono text-xs text-muted-foreground">
                          {p.modifier || (
                            <span className="italic">no modifier</span>
                          )}
                        </p>
                      </CardContent>
                      <CardFooter className="justify-end gap-1 pt-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(p)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPendingDelete(p)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'edit' ? 'Edit preset' : 'New preset'}
            </DialogTitle>
            <DialogDescription>
              Modifier akan ditempel mentah ke prompt akhir di Scene Assembler.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="preset-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v as PresetCategory }))
                }
                disabled={dialog?.mode === 'edit'}
              >
                <SelectTrigger id="preset-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dialog?.mode === 'edit' && (
                <p className="text-xs text-muted-foreground">
                  Category dikunci saat edit untuk mencegah category mixing.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="preset-label">Label</Label>
              <Input
                id="preset-label"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="e.g. Cinematic Dolly"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="preset-modifier">Modifier</Label>
              <Textarea
                id="preset-modifier"
                rows={3}
                value={form.modifier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, modifier: e.target.value }))
                }
                placeholder={CATEGORY_META[form.category].sample}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan…' : 'Simpan'}
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
            <AlertDialogTitle>Hapus preset?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `"${pendingDelete.label}" (${pendingDelete.category}) akan dihapus permanen.`}
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
