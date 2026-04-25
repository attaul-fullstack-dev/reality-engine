import { useEffect, useState } from 'react'
import { Plus, Trash2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { ApiVault as ApiVaultRow } from '@/types'
import { maskKey } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const MAX_KEYS = 5
const PROVIDERS = ['Google', 'OpenAI', 'Anthropic', 'Replicate', 'Custom']

interface FormState {
  provider: string
  label: string
  api_key: string
}

const EMPTY_FORM: FormState = { provider: 'Google', label: '', api_key: '' }

export function ApiVault() {
  const [keys, setKeys] = useState<ApiVaultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [pendingDelete, setPendingDelete] = useState<ApiVaultRow | null>(null)

  async function fetchKeys() {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('api_vault')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      toast.error('Gagal memuat API key', { description: error.message })
    } else {
      setKeys((data ?? []) as ApiVaultRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchKeys()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label.trim() || !form.api_key.trim()) {
      toast.error('Label dan API key wajib diisi')
      return
    }
    if (keys.length >= MAX_KEYS) {
      toast.error(`Maksimum ${MAX_KEYS} key`)
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase
      .from('api_vault')
      .insert({
        provider: form.provider,
        label: form.label.trim(),
        api_key: form.api_key.trim(),
        is_active: true,
        error_count: 0,
      })
      .select()
      .single()
    setSubmitting(false)

    if (error) {
      toast.error('Gagal menambah key', { description: error.message })
      return
    }
    setKeys((prev) => [...prev, data as ApiVaultRow])
    setForm(EMPTY_FORM)
    setDialogOpen(false)
    toast.success('API key ditambahkan')
  }

  async function handleToggleActive(row: ApiVaultRow, next: boolean) {
    setKeys((prev) =>
      prev.map((k) => (k.id === row.id ? { ...k, is_active: next } : k)),
    )
    const { error } = await supabase
      .from('api_vault')
      .update({ is_active: next })
      .eq('id', row.id)
    if (error) {
      toast.error('Gagal update status', { description: error.message })
      setKeys((prev) =>
        prev.map((k) =>
          k.id === row.id ? { ...k, is_active: !next } : k,
        ),
      )
    } else {
      toast.success(next ? 'Key diaktifkan' : 'Key dinonaktifkan')
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    const { error } = await supabase
      .from('api_vault')
      .delete()
      .eq('id', target.id)
    if (error) {
      toast.error('Gagal menghapus key', { description: error.message })
      return
    }
    setKeys((prev) => prev.filter((k) => k.id !== target.id))
    toast.success('API key dihapus')
  }

  return (
    <div>
      <PageHeader
        title="API Vault"
        description={`Maksimum ${MAX_KEYS} API key. Toggle untuk mengaktifkan rotasi.`}
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM)
              setDialogOpen(true)
            }}
            disabled={!isSupabaseConfigured || keys.length >= MAX_KEYS}
          >
            <Plus className="h-4 w-4" />
            Add Key
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Provider</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead className="w-[120px]">Errors</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  Memuat…
                </TableCell>
              </TableRow>
            ) : keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  <KeyRound className="mx-auto mb-2 h-6 w-6 opacity-60" />
                  Belum ada API key. Klik <span className="font-medium text-foreground">Add Key</span>{' '}
                  untuk menambah.
                </TableCell>
              </TableRow>
            ) : (
              keys.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge variant="secondary">{row.provider}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {maskKey(row.api_key)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {row.error_count}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.is_active}
                        onCheckedChange={(v) => void handleToggleActive(row, v)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {row.is_active ? 'Active' : 'Off'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPendingDelete(row)}
                      aria-label={`Hapus ${row.label}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {keys.length}/{MAX_KEYS} keys terdaftar.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah API Key</DialogTitle>
            <DialogDescription>
              Key disimpan apa adanya di tabel <code>api_vault</code>. Pastikan
              project Supabase Anda sudah mengaktifkan RLS sebelum production.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdd} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Pilih provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                placeholder="Primary Key"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-…"
                autoComplete="off"
                value={form.api_key}
                onChange={(e) =>
                  setForm((f) => ({ ...f, api_key: e.target.value }))
                }
                required
              />
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
                {submitting ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `"${pendingDelete.label}" akan dihapus permanen dari vault. Tindakan ini tidak bisa di-undo.`}
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
    </div>
  )
}
