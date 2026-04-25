import { NavLink } from 'react-router-dom'
import {
  Key,
  LayoutDashboard,
  Sparkles,
  Users,
  FolderKanban,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/api-vault', label: 'API Vault', icon: Key },
  { to: '/character-matrix', label: 'Character Matrix', icon: Users },
  { to: '/preset-engine', label: 'Preset Engine', icon: Sparkles },
  { to: '/project-lab', label: 'Project Lab', icon: FolderKanban },
]

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-zinc-950/60 px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">Reality Engine</p>
          <p className="text-xs text-muted-foreground">AI Content Factory</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2 pt-6 text-[11px] text-muted-foreground">
        PRD 1 + 2 · Foundation & Data Management
      </div>
    </aside>
  )
}
