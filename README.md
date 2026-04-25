# Reality Engine

**AI Content Factory** — generate cinematic storyboards from characters, presets, and prompts.

This repository implements **PRD 1 (Foundation)** and **PRD 2 (Data Management Layer)** from the master roadmap. PRDs 3–6 (Scene Assembler, Batch Generation, Storyboard Mode, Video Module, Analytics) build on top of this foundation.

## Stack

- React 19 + TypeScript + Vite
- React Router v7
- Tailwind CSS (dark-mode-only) + Shadcn-style components built on Radix UI
- Supabase JS SDK (PostgreSQL)
- Sonner for toasts, Lucide for icons

## What's implemented

| Phase | Page                | Status |
|-------|---------------------|--------|
| 1     | Database schema     | SQL migration in `supabase/migrations/` |
| 2     | App layout & routes | `/`, `/api-vault`, `/character-matrix`, `/preset-engine`, `/project-lab`, `/project-lab/:projectId` |
| 2     | Dark theme          | enforced via `class="dark"` + Tailwind tokens |
| 3     | API Vault CRUD      | add (max 5) / toggle / delete with confirmation |
| 5     | Character Matrix    | character CRUD + nested outfits + nested expressions |
| 6     | Preset Engine       | 4-category CRUD, category-mixing prevented on edit |
| 7     | Project Lab         | project CRUD + dynamic routing to workspace |

The project workspace at `/project-lab/:projectId` is a placeholder waiting for PRD 3.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Provision Supabase

1. Create a Supabase project at https://supabase.com/dashboard.
2. Open the SQL editor and run the contents of [`supabase/migrations/0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql) once. This creates the 7 tables, enums, and indexes the app expects.
3. Copy your project URL and anon key from **Project settings → API**.

### 3. Configure environment

```bash
cp .env.example .env
```

Then fill in:

```env
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

If you skip this step the app still boots and shows a yellow setup banner; CRUD calls will no-op until the keys are filled in.

### 4. Run

```bash
npm run dev      # dev server (Vite, port 5173)
npm run build    # type-check + production bundle
npm run lint     # ESLint
npm run preview  # preview the production build locally
```

## Project layout

```
src/
├── App.tsx                  # React Router routes
├── main.tsx                 # Entry — Strict + BrowserRouter + Toaster
├── index.css                # Tailwind + dark-mode CSS variables
├── lib/
│   ├── supabase.ts          # Supabase client (graceful when env missing)
│   └── utils.ts             # cn(), formatDate(), maskKey()
├── types/index.ts           # Domain types (ApiVault, Character, Preset, …)
├── components/
│   ├── PageHeader.tsx
│   ├── layout/              # AppLayout, Sidebar, SetupBanner
│   └── ui/                  # button, input, dialog, select, switch, …
└── pages/
    ├── Dashboard.tsx
    ├── ApiVault.tsx         # PRD 1, phase 3
    ├── CharacterMatrix.tsx  # PRD 2, phase 5
    ├── PresetEngine.tsx     # PRD 2, phase 6
    ├── ProjectLab.tsx       # PRD 2, phase 7
    ├── ProjectWorkspace.tsx # placeholder for PRD 3
    └── NotFound.tsx
supabase/
└── migrations/0001_initial_schema.sql
```

## Notes for future PRDs

- Scene rows already include FK columns (`character_id`, `outfit_id`, `expression_id`, `camera_id`, `lighting_id`, `film_stock_id`, `style_id`) and `prompt_snapshot`, `motion_prompt`, `generated_video_url` so PRDs 3, 4, and 6 can land without further migrations.
- `presets.category` is a Postgres enum; edit operations lock the category dropdown to prevent accidental category mixing.
- API keys are stored in plain text in `api_vault` per PRD spec. Add Supabase RLS or column-level encryption before deploying multi-tenant.
