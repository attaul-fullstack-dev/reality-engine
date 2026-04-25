import { AlertTriangle } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase'

export function SetupBanner() {
  if (isSupabaseConfigured) return null

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Supabase belum dikonfigurasi.</p>
          <p className="text-xs text-amber-200/80">
            Set <code className="font-mono">VITE_SUPABASE_URL</code> dan{' '}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> di{' '}
            <code className="font-mono">.env</code>, lalu jalankan SQL di{' '}
            <code className="font-mono">supabase/migrations/0001_initial_schema.sql</code>{' '}
            untuk membuat 7 tabel. Restart dev server setelahnya.
          </p>
        </div>
      </div>
    </div>
  )
}
