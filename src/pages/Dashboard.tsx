import { Link } from 'react-router-dom'
import { ArrowRight, Key, Users, Sparkles, FolderKanban } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'

const SHORTCUTS = [
  {
    to: '/api-vault',
    icon: Key,
    title: 'API Vault',
    description: 'Kelola sampai 5 API key dengan rotasi otomatis.',
  },
  {
    to: '/character-matrix',
    icon: Users,
    title: 'Character Matrix',
    description: 'Definisikan aktor dengan outfit & expression terkait.',
  },
  {
    to: '/preset-engine',
    icon: Sparkles,
    title: 'Preset Engine',
    description: 'Camera, Lighting, FilmStock, Style — siap dirakit.',
  },
  {
    to: '/project-lab',
    icon: FolderKanban,
    title: 'Project Lab',
    description: 'Workspace untuk merangkai scene per project.',
  },
] as const

export function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Reality Engine"
        description="AI Content Factory — generate storyboard cinematik dari karakter, preset, dan prompt."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group rounded-lg border bg-card p-1 transition-colors hover:border-primary/40"
          >
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  {s.title}
                  <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Klik untuk masuk →
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">Status build</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Anda sedang melihat scope <strong>PRD 1 + 2</strong>: foundation,
          routing, dark theme, dan CRUD untuk API Vault, Characters, Presets,
          dan Projects. Analytics & scene assembler menyusul di PRD 3+.
        </p>
      </div>
    </div>
  )
}
