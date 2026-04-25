import { useEffect, useState } from 'react'
import { Plus, Trash2, UserCircle2, Shirt, Smile, IdCard } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type {
  Character,
  CharacterExpression,
  CharacterOutfit,
} from '@/types'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

type SheetState =
  | { mode: 'create'; saved: Character | null }
  | { mode: 'edit'; row: Character }
  | null

type DeleteTarget =
  | { kind: 'character'; row: Character }
  | { kind: 'outfit'; row: CharacterOutfit }
  | { kind: 'expression'; row: CharacterExpression }
  | null

export function CharacterMatrix() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)

  const [sheetState, setSheetState] = useState<SheetState>(null)
  const [activeTab, setActiveTab] = useState<'bio' | 'wardrobe' | 'expressions'>(
    'bio',
  )
  const [charForm, setCharForm] = useState<CharForm>(EMPTY_CHAR)

  const [outfits, setOutfits] = useState<CharacterOutfit[]>([])
  const [expressions, setExpressions] = useState<CharacterExpression[]>([])
  const [loadingNested, setLoadingNested] = useState(false)

  const [outfitForm, setOutfitForm] = useState<NestedForm>(EMPTY_NESTED)
  const [exprForm, setExprForm] = useState<NestedForm>(EMPTY_NESTED)

  const [pendingDelete, setPendingDelete] = useState<DeleteTarget>(null)
  const [submitting, setSubmitting] = useState(false)

  // Active character = the one currently being edited, OR a freshly-saved
  // create-mode character. Null means tabs 2/3 stay disabled.
  const activeChar: Character | null =
    sheetState?.mode === 'edit'
      ? sheetState.row
      : sheetState?.mode === 'create'
        ? sheetState.saved
        : null

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
    setCharacters((data ?? []) as Character[])
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
      toast.error('Gagal memuat outfits', {
        description: outfitRes.error.message,
      })
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

  // ---------- Sheet open/close ----------
  function openCreate() {
    setCharForm(EMPTY_CHAR)
    setOutfits([])
    setExpressions([])
    setOutfitForm(EMPTY_NESTED)
    setExprForm(EMPTY_NESTED)
    setActiveTab('bio')
    setSheetState({ mode: 'create', saved: null })
  }

  function openEdit(row: Character) {
    setCharForm({
      name: row.name,
      body_dna: row.body_dna,
      face_features: row.face_features,
      avatar_url: row.avatar_url ?? '',
    })
    setOutfitForm(EMPTY_NESTED)
    setExprForm(EMPTY_NESTED)
    setActiveTab('bio')
    setSheetState({ mode: 'edit', row })
    void fetchNested(row.id)
  }

  function closeSheet() {
    setSheetState(null)
  }

  // ---------- Character CRUD ----------
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

    if (sheetState?.mode === 'create') {
      const target = sheetState.saved
      // If we already inserted in this create-flow, treat subsequent saves as updates.
      if (target) {
        const { data, error } = await supabase
          .from('characters')
          .update(payload)
          .eq('id', target.id)
          .select()
          .single()
        setSubmitting(false)
        if (error) {
          toast.error('Gagal update character', {
            description: error.message,
          })
          return
        }
        const updated = data as Character
        setCharacters((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        )
        // Functional updater: only re-sync sheet state if the user hasn't
        // closed the sheet during the in-flight Supabase call.
        setSheetState((prev) =>
          prev !== null ? { mode: 'create', saved: updated } : null,
        )
        toast.success('Character diperbarui')
      } else {
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
        setSheetState((prev) =>
          prev !== null ? { mode: 'create', saved: created } : null,
        )
        toast.success('Character dibuat. Tab Wardrobe & Expressions aktif.')
      }
    } else if (sheetState?.mode === 'edit') {
      const { data, error } = await supabase
        .from('characters')
        .update(payload)
        .eq('id', sheetState.row.id)
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
      setSheetState((prev) =>
        prev !== null ? { mode: 'edit', row: updated } : null,
      )
      toast.success('Character diperbarui')
    }
  }

  // ---------- Outfit CRUD ----------
  async function submitOutfit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeChar) return
    if (!outfitForm.label.trim()) {
      toast.error('Label outfit wajib diisi')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase
      .from('character_outfits')
      .insert({
        character_id: activeChar.id,
        label: outfitForm.label.trim(),
        prompt_desc: outfitForm.prompt_desc.trim(),
      })
      .select()
      .single()
    setSubmitting(false)
    if (error) {
      toast.error('Gagal menambah outfit', { description: error.message })
      return
    }
    setOutfits((prev) => [...prev, data as CharacterOutfit])
    setOutfitForm(EMPTY_NESTED)
    toast.success('Outfit ditambahkan')
  }

  // ---------- Expression CRUD ----------
  async function submitExpression(e: React.FormEvent) {
    e.preventDefault()
    if (!activeChar) return
    if (!exprForm.label.trim()) {
      toast.error('Label expression wajib diisi')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase
      .from('character_expressions')
      .insert({
        character_id: activeChar.id,
        label: exprForm.label.trim(),
        prompt_desc: exprForm.prompt_desc.trim(),
      })
      .select()
      .single()
    setSubmitting(false)
    if (error) {
      toast.error('Gagal menambah expression', { description: error.message })
      return
    }
    setExpressions((prev) => [...prev, data as CharacterExpression])
    setExprForm(EMPTY_NESTED)
    toast.success('Expression ditambahkan')
  }

  // ---------- Delete ----------
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
      // If the active sheet was for this character, close it.
      if (
        (sheetState?.mode === 'edit' && sheetState.row.id === target.row.id) ||
        (sheetState?.mode === 'create' &&
          sheetState.saved?.id === target.row.id)
      ) {
        closeSheet()
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
          <Button onClick={openCreate} disabled={!isSupabaseConfigured}>
            <Plus className="h-4 w-4" />
            New Character
          </Button>
        }
      />

      {loading ? (
        <p className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
          Memuat…
        </p>
      ) : characters.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/40 p-12 text-center">
          <UserCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Belum ada character.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Klik <strong className="font-semibold">New Character</strong> untuk
            membuat actor pertama.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(c)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openEdit(c)
                }
              }}
              className="group cursor-pointer rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                  {c.avatar_url ? (
                    <img
                      src={c.avatar_url}
                      alt={c.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.body_dna || (
                      <span className="italic">no body DNA</span>
                    )}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPendingDelete({ kind: 'character', row: c })
                  }}
                  aria-label="Delete"
                  className="opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Character sheet */}
      <Sheet
        open={sheetState !== null}
        onOpenChange={(o) => !o && closeSheet()}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {sheetState?.mode === 'edit'
                ? `Edit ${sheetState.row.name}`
                : sheetState?.mode === 'create' && sheetState.saved
                  ? `Edit ${sheetState.saved.name}`
                  : 'New Character'}
            </SheetTitle>
            <SheetDescription>
              {activeChar
                ? 'Atur Bio & DNA, kemudian lampirkan wardrobe dan expression.'
                : 'Simpan Bio & DNA dulu untuk membuka tab Wardrobe & Expressions.'}
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(v as 'bio' | 'wardrobe' | 'expressions')
            }
            className="flex min-h-0 flex-1 flex-col px-6 py-4"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bio" className="gap-1.5">
                <IdCard className="h-3.5 w-3.5" />
                Bio &amp; DNA
              </TabsTrigger>
              <TabsTrigger
                value="wardrobe"
                className="gap-1.5"
                disabled={activeChar === null}
              >
                <Shirt className="h-3.5 w-3.5" />
                Wardrobe
              </TabsTrigger>
              <TabsTrigger
                value="expressions"
                className="gap-1.5"
                disabled={activeChar === null}
              >
                <Smile className="h-3.5 w-3.5" />
                Expressions
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Bio & DNA */}
            <TabsContent
              value="bio"
              className="flex-1 overflow-y-auto pr-1"
            >
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
                      setCharForm((f) => ({
                        ...f,
                        face_features: e.target.value,
                      }))
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
                      setCharForm((f) => ({
                        ...f,
                        avatar_url: e.target.value,
                      }))
                    }
                    placeholder="https://…"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeSheet}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Menyimpan…' : 'Save Character'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Tab 2: Wardrobe */}
            <TabsContent
              value="wardrobe"
              className="flex-1 overflow-y-auto pr-1"
            >
              {!activeChar ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Simpan character dulu untuk menambah outfit.
                </p>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={submitOutfit} className="grid gap-3 rounded-lg border bg-card p-4">
                    <div className="grid gap-2">
                      <Label htmlFor="outfit-label">Label</Label>
                      <Input
                        id="outfit-label"
                        value={outfitForm.label}
                        onChange={(e) =>
                          setOutfitForm((f) => ({
                            ...f,
                            label: e.target.value,
                          }))
                        }
                        placeholder="e.g. Office Suit"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="outfit-prompt">
                        Prompt description
                      </Label>
                      <Textarea
                        id="outfit-prompt"
                        rows={2}
                        value={outfitForm.prompt_desc}
                        onChange={(e) =>
                          setOutfitForm((f) => ({
                            ...f,
                            prompt_desc: e.target.value,
                          }))
                        }
                        placeholder="wearing black tuxedo, red tie"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="justify-self-end"
                      disabled={submitting}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add outfit
                    </Button>
                  </form>

                  {loadingNested ? (
                    <p className="text-sm text-muted-foreground">Memuat…</p>
                  ) : outfits.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Belum ada outfit untuk character ini.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {outfits.map((o) => (
                        <li
                          key={o.id}
                          className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{o.label}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {o.prompt_desc || (
                                <span className="italic">no description</span>
                              )}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setPendingDelete({ kind: 'outfit', row: o })
                            }
                            aria-label="Delete outfit"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab 3: Expressions */}
            <TabsContent
              value="expressions"
              className="flex-1 overflow-y-auto pr-1"
            >
              {!activeChar ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Simpan character dulu untuk menambah expression.
                </p>
              ) : (
                <div className="space-y-4">
                  <form
                    onSubmit={submitExpression}
                    className="grid gap-3 rounded-lg border bg-card p-4"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="expr-label">Label</Label>
                      <Input
                        id="expr-label"
                        value={exprForm.label}
                        onChange={(e) =>
                          setExprForm((f) => ({
                            ...f,
                            label: e.target.value,
                          }))
                        }
                        placeholder="e.g. Furious"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="expr-prompt">Prompt description</Label>
                      <Textarea
                        id="expr-prompt"
                        rows={2}
                        value={exprForm.prompt_desc}
                        onChange={(e) =>
                          setExprForm((f) => ({
                            ...f,
                            prompt_desc: e.target.value,
                          }))
                        }
                        placeholder="furrowed eyebrows, screaming"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="justify-self-end"
                      disabled={submitting}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add expression
                    </Button>
                  </form>

                  {loadingNested ? (
                    <p className="text-sm text-muted-foreground">Memuat…</p>
                  ) : expressions.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Belum ada expression untuk character ini.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {expressions.map((ex) => (
                        <li
                          key={ex.id}
                          className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{ex.label}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {ex.prompt_desc || (
                                <span className="italic">no description</span>
                              )}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setPendingDelete({
                                kind: 'expression',
                                row: ex,
                              })
                            }
                            aria-label="Delete expression"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

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
