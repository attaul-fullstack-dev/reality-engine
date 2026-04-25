import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, UserCircle2, Shirt, Smile } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type {
  Character,
  CharacterExpression,
  CharacterOutfit,
} from '@/types'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

type CharForm = {
  name: string
  body_dna: string
  face_features: string
  avatar_url: string
}

type NestedForm = { label: string; prompt_desc: string }

const EMPTY_CHAR: CharForm = {
  name: '',
  body_dna: '',
  face_features: '',
  avatar_url: '',
}

const EMPTY_NESTED: NestedForm = { label: '', prompt_desc: '' }

type DeleteTarget =
  | { kind: 'character'; row: Character }
  | { kind: 'outfit'; row: CharacterOutfit }
  | { kind: 'expression'; row: CharacterExpression }
  | null

export function CharacterMatrix() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [outfits, setOutfits] = useState<CharacterOutfit[]>([])
  const [expressions, setExpressions] = useState<CharacterExpression[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingNested, setLoadingNested] = useState(false)

  const [charDialog, setCharDialog] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; row: Character }
    | null
  >(null)
  const [charForm, setCharForm] = useState<CharForm>(EMPTY_CHAR)

  const [outfitDialog, setOutfitDialog] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; row: CharacterOutfit }
    | null
  >(null)
  const [outfitForm, setOutfitForm] = useState<NestedForm>(EMPTY_NESTED)

  const [exprDialog, setExprDialog] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; row: CharacterExpression }
    | null
  >(null)
  const [exprForm, setExprForm] = useState<NestedForm>(EMPTY_NESTED)

  const [pendingDelete, setPendingDelete] = useState<DeleteTarget>(null)
  const [submitting, setSubmitting] = useState(false)

  const selected = characters.find((c) => c.id === selectedId) ?? null

  async function fetchCharacters() {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .order('created_at', { ascending: true })
    setLoading(false)
    if (error) {
      toast.error('Gagal memuat character', { description: error.message })
      return
    }
    const rows = (data ?? []) as Character[]
    setCharacters(rows)
    if (!selectedId && rows.length > 0) setSelectedId(rows[0].id)
  }

  async function fetchNested(characterId: string) {
    if (!isSupabaseConfigured) return
    setLoadingNested(true)
    const [outfitRes, exprRes] = await Promise.all([
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
    setLoadingNested(false)
    if (outfitRes.error) {
      toast.error('Gagal memuat outfits', { description: outfitRes.error.message })
    } else {
      setOutfits((outfitRes.data ?? []) as CharacterOutfit[])
    }
    if (exprRes.error) {
      toast.error('Gagal memuat expressions', {
        description: exprRes.error.message,
      })
    } else {
      setExpressions((exprRes.data ?? []) as CharacterExpression[])
    }
  }

  useEffect(() => {
    void fetchCharacters()
     
  }, [])

  useEffect(() => {
    if (selectedId) {
      void fetchNested(selectedId)
    } else {
      setOutfits([])
      setExpressions([])
    }
     
  }, [selectedId])

  // ---------- Character CRUD ----------
  function openCreateChar() {
    setCharForm(EMPTY_CHAR)
    setCharDialog({ mode: 'create' })
  }

  function openEditChar(row: Character) {
    setCharForm({
      name: row.name,
      body_dna: row.body_dna,
      face_features: row.face_features,
      avatar_url: row.avatar_url ?? '',
    })
    setCharDialog({ mode: 'edit', row })
  }

  async function submitCharacter(e: React.FormEvent) {
    e.preventDefault()
    if (!charForm.name.trim()) {
      toast.error('Nama wajib diisi')
      return
    }
    setSubmitting(true)
    const payload = {
      name: charForm.name.trim(),
      body_dna: charForm.body_dna.trim(),
      face_features: charForm.face_features.trim(),
      avatar_url: charForm.avatar_url.trim() || null,
    }

    if (charDialog?.mode === 'create') {
      const { data, error } = await supabase
        .from('characters')
        .insert(payload)
        .select()
        .single()
      setSubmitting(false)
      if (error) {
        toast.error('Gagal membuat character', { description: error.message })
        return
      }
      const created = data as Character
      setCharacters((prev) => [...prev, created])
      setSelectedId(created.id)
      toast.success('Character dibuat')
    } else if (charDialog?.mode === 'edit') {
      const { data, error } = await supabase
        .from('characters')
        .update(payload)
        .eq('id', charDialog.row.id)
        .select()
        .single()
      setSubmitting(false)
      if (error) {
        toast.error('Gagal update character', { description: error.message })
        return
      }
      const updated = data as Character
      setCharacters((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      toast.success('Character diperbarui')
    }
    setCharDialog(null)
  }

  // ---------- Outfit CRUD ----------
  function openCreateOutfit() {
    setOutfitForm(EMPTY_NESTED)
    setOutfitDialog({ mode: 'create' })
  }

  function openEditOutfit(row: CharacterOutfit) {
    setOutfitForm({ label: row.label, prompt_desc: row.prompt_desc })
    setOutfitDialog({ mode: 'edit', row })
  }

  async function submitOutfit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (!outfitForm.label.trim()) {
      toast.error('Label outfit wajib diisi')
      return
    }
    setSubmitting(true)
    const payload = {
      character_id: selected.id,
      label: outfitForm.label.trim(),
      prompt_desc: outfitForm.prompt_desc.trim(),
    }
    if (outfitDialog?.mode === 'create') {
      const { data, error } = await supabase
        .from('character_outfits')
        .insert(payload)
        .select()
        .single()
      setSubmitting(false)
      if (error) {
        toast.error('Gagal membuat outfit', { description: error.message })
        return
      }
      setOutfits((prev) => [...prev, data as CharacterOutfit])
      toast.success('Outfit ditambahkan')
    } else if (outfitDialog?.mode === 'edit') {
      const { data, error } = await supabase
        .from('character_outfits')
        .update(payload)
        .eq('id', outfitDialog.row.id)
        .select()
        .single()
      setSubmitting(false)
      if (error) {
        toast.error('Gagal update outfit', { description: error.message })
        return
      }
      const updated = data as CharacterOutfit
      setOutfits((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      toast.success('Outfit diperbarui')
    }
    setOutfitDialog(null)
  }

  // ---------- Expression CRUD ----------
  function openCreateExpr() {
    setExprForm(EMPTY_NESTED)
    setExprDialog({ mode: 'create' })
  }

  function openEditExpr(row: CharacterExpression) {
    setExprForm({ label: row.label, prompt_desc: row.prompt_desc })
    setExprDialog({ mode: 'edit', row })
  }

  async function submitExpression(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (!exprForm.label.trim()) {
      toast.error('Label expression wajib diisi')
      return
    }
    setSubmitting(true)
    const payload = {
      character_id: selected.id,
      label: exprForm.label.trim(),
      prompt_desc: exprForm.prompt_desc.trim(),
    }
    if (exprDialog?.mode === 'create') {
      const { data, error } = await supabase
        .from('character_expressions')
        .insert(payload)
        .select()
        .single()
      setSubmitting(false)
      if (error) {
        toast.error('Gagal membuat expression', { description: error.message })
        return
      }
      setExpressions((prev) => [...prev, data as CharacterExpression])
      toast.success('Expression ditambahkan')
    } else if (exprDialog?.mode === 'edit') {
      const { data, error } = await supabase
        .from('character_expressions')
        .update(payload)
        .eq('id', exprDialog.row.id)
        .select()
        .single()
      setSubmitting(false)
      if (error) {
        toast.error('Gagal update expression', { description: error.message })
        return
      }
      const updated = data as CharacterExpression
      setExpressions((prev) =>
        prev.map((e2) => (e2.id === updated.id ? updated : e2)),
      )
      toast.success('Expression diperbarui')
    }
    setExprDialog(null)
  }

  // ---------- Delete handlers ----------
  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)

    if (target.kind === 'character') {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', target.row.id)
      if (error) {
        toast.error('Gagal hapus character', { description: error.message })
        return
      }
      setCharacters((prev) => prev.filter((c) => c.id !== target.row.id))
      if (selectedId === target.row.id) {
        const next = characters.find((c) => c.id !== target.row.id)
        setSelectedId(next ? next.id : null)
      }
      toast.success('Character dihapus')
    } else if (target.kind === 'outfit') {
      const { error } = await supabase
        .from('character_outfits')
        .delete()
        .eq('id', target.row.id)
      if (error) {
        toast.error('Gagal hapus outfit', { description: error.message })
        return
      }
      setOutfits((prev) => prev.filter((o) => o.id !== target.row.id))
      toast.success('Outfit dihapus')
    } else if (target.kind === 'expression') {
      const { error } = await supabase
        .from('character_expressions')
        .delete()
        .eq('id', target.row.id)
      if (error) {
        toast.error('Gagal hapus expression', { description: error.message })
        return
      }
      setExpressions((prev) => prev.filter((e2) => e2.id !== target.row.id))
      toast.success('Expression dihapus')
    }
  }

  return (
    <div>
      <PageHeader
        title="Character Matrix"
        description="Definisikan aktor (DNA tubuh & wajah), lalu lampirkan outfit dan expression."
        actions={
          <Button onClick={openCreateChar} disabled={!isSupabaseConfigured}>
            <Plus className="h-4 w-4" />
            New Character
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Left: character list */}
        <div className="space-y-2">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Memuat…
            </p>
          ) : characters.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card/40 px-4 py-8 text-center">
              <UserCircle2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Belum ada character.
              </p>
            </div>
          ) : (
            characters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40',
                  selectedId === c.id &&
                    'border-primary/60 bg-primary/10 text-foreground',
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                  {c.avatar_url ? (
                    <img
                      src={c.avatar_url}
                      alt={c.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <span className="truncate text-sm font-medium">{c.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Right: detail */}
        <div className="min-w-0 space-y-6">
          {!selected ? (
            <div className="rounded-lg border border-dashed bg-card/40 p-12 text-center text-sm text-muted-foreground">
              Pilih character di kiri untuk mengelola outfit & expression.
            </div>
          ) : (
            <>
              <CharacterDetail
                character={selected}
                onEdit={() => openEditChar(selected)}
                onDelete={() =>
                  setPendingDelete({ kind: 'character', row: selected })
                }
              />

              <NestedSection
                title="Outfits"
                icon={<Shirt className="h-4 w-4" />}
                emptyText="Belum ada outfit. Tambah satu untuk dipakai di scene."
                loading={loadingNested}
                items={outfits.map((o) => ({
                  id: o.id,
                  label: o.label,
                  prompt: o.prompt_desc,
                  raw: o,
                }))}
                onAdd={openCreateOutfit}
                onEdit={(it) => openEditOutfit(it.raw as CharacterOutfit)}
                onDelete={(it) =>
                  setPendingDelete({
                    kind: 'outfit',
                    row: it.raw as CharacterOutfit,
                  })
                }
              />

              <NestedSection
                title="Expressions"
                icon={<Smile className="h-4 w-4" />}
                emptyText="Belum ada expression. Buat ekspresi seperti happy / serious / shocked."
                loading={loadingNested}
                items={expressions.map((e) => ({
                  id: e.id,
                  label: e.label,
                  prompt: e.prompt_desc,
                  raw: e,
                }))}
                onAdd={openCreateExpr}
                onEdit={(it) =>
                  openEditExpr(it.raw as CharacterExpression)
                }
                onDelete={(it) =>
                  setPendingDelete({
                    kind: 'expression',
                    row: it.raw as CharacterExpression,
                  })
                }
              />
            </>
          )}
        </div>
      </div>

      {/* Character dialog */}
      <Dialog
        open={charDialog !== null}
        onOpenChange={(o) => !o && setCharDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {charDialog?.mode === 'edit' ? 'Edit Character' : 'New Character'}
            </DialogTitle>
            <DialogDescription>
              Body DNA dan face features digunakan oleh prompt constructor di
              PRD 3.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitCharacter} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="char-name">Name</Label>
              <Input
                id="char-name"
                value={charForm.name}
                onChange={(e) =>
                  setCharForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Rara, the Cyber-Diver"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="char-body">Body DNA</Label>
              <Textarea
                id="char-body"
                rows={3}
                value={charForm.body_dna}
                onChange={(e) =>
                  setCharForm((f) => ({ ...f, body_dna: e.target.value }))
                }
                placeholder="petite Asian woman, athletic build, 168cm…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="char-face">Face features</Label>
              <Textarea
                id="char-face"
                rows={3}
                value={charForm.face_features}
                onChange={(e) =>
                  setCharForm((f) => ({ ...f, face_features: e.target.value }))
                }
                placeholder="sharp jawline, freckles, neon-green eyes…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="char-avatar">Avatar URL (optional)</Label>
              <Input
                id="char-avatar"
                type="url"
                value={charForm.avatar_url}
                onChange={(e) =>
                  setCharForm((f) => ({ ...f, avatar_url: e.target.value }))
                }
                placeholder="https://…"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCharDialog(null)}
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

      {/* Outfit dialog */}
      <NestedDialog
        open={outfitDialog !== null}
        mode={outfitDialog?.mode ?? 'create'}
        title="Outfit"
        form={outfitForm}
        setForm={setOutfitForm}
        onClose={() => setOutfitDialog(null)}
        onSubmit={submitOutfit}
        submitting={submitting}
      />

      {/* Expression dialog */}
      <NestedDialog
        open={exprDialog !== null}
        mode={exprDialog?.mode ?? 'create'}
        title="Expression"
        form={exprForm}
        setForm={setExprForm}
        onClose={() => setExprDialog(null)}
        onSubmit={submitExpression}
        submitting={submitting}
      />

      {/* Confirm delete */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === 'character'
                ? 'Hapus character?'
                : pendingDelete?.kind === 'outfit'
                  ? 'Hapus outfit?'
                  : 'Hapus expression?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === 'character'
                ? `Semua outfit dan expression milik "${pendingDelete.row.name}" juga akan ikut terhapus (cascade).`
                : 'Tindakan ini tidak bisa di-undo.'}
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

// ---------- Sub-components ----------

function CharacterDetail({
  character,
  onEdit,
  onDelete,
}: {
  character: Character
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
            {character.avatar_url ? (
              <img
                src={character.avatar_url}
                alt={character.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle2 className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{character.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {character.body_dna || (
                <span className="italic">Belum ada body DNA.</span>
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {character.face_features || (
                <span className="italic">Belum ada face features.</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface NestedItem {
  id: string
  label: string
  prompt: string
  raw: CharacterOutfit | CharacterExpression
}

function NestedSection({
  title,
  icon,
  emptyText,
  items,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string
  icon: React.ReactNode
  emptyText: string
  items: NestedItem[]
  loading: boolean
  onAdd: () => void
  onEdit: (item: NestedItem) => void
  onDelete: (item: NestedItem) => void
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
          <span className="text-xs font-normal text-muted-foreground">
            · {items.length}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </header>

      <div className="divide-y divide-border">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Memuat…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className="flex items-start justify-between gap-4 p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{it.label}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {it.prompt || (
                    <span className="italic">no prompt description</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit(it)}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(it)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function NestedDialog({
  open,
  mode,
  title,
  form,
  setForm,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean
  mode: 'create' | 'edit'
  title: string
  form: NestedForm
  setForm: React.Dispatch<React.SetStateAction<NestedForm>>
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? `Edit ${title}` : `New ${title}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${title}-label`}>Label</Label>
            <Input
              id={`${title}-label`}
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({ ...f, label: e.target.value }))
              }
              placeholder={
                title === 'Outfit'
                  ? 'e.g. Cyber-Diver Suit'
                  : 'e.g. Determined'
              }
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${title}-prompt`}>Prompt description</Label>
            <Textarea
              id={`${title}-prompt`}
              rows={3}
              value={form.prompt_desc}
              onChange={(e) =>
                setForm((f) => ({ ...f, prompt_desc: e.target.value }))
              }
              placeholder={
                title === 'Outfit'
                  ? 'sleek black neoprene suit with neon green accents…'
                  : 'jaw clenched, eyes narrowed with focus…'
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
