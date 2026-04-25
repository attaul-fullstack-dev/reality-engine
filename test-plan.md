# Test Plan — PR #1 (PRD 1 + 2 scaffold)

## What changed (user-visible)
A brand-new Vite + React app implementing PRD 1 (Foundation) and PRD 2 (Data Management Layer) of Reality Engine: dark theme, sidebar navigation, 5 routes, and CRUD pages for API keys / characters / presets / projects backed by Supabase. When Supabase env vars are missing, the app boots into a clearly-marked "not configured" state instead of crashing.

## Constraint
The user opted to skip Supabase (`.env` has no real URL/anon key in this session). All CRUD `Add` / `New` buttons are wired to `disabled={!isSupabaseConfigured}` (see `src/pages/ApiVault.tsx:169`, `CharacterMatrix.tsx:390`, `PresetEngine.tsx:244`, `ProjectLab.tsx:143`). That means the **CRUD write paths cannot be exercised in this run** — the meaningful end-to-end "guarantee" we can prove is: *the app boots, renders every route, shows the not-configured warning, and refuses to attempt writes that would no-op.*

If the user wants the actual CRUD flow recorded, they must provide a Supabase URL + anon key (and run the SQL migration in `supabase/migrations/0001_initial_schema.sql`). Plan B section below describes that flow.

## Plan A — UI smoke test (no Supabase, will execute now)

### Setup (off-camera, before recording)
- `npm install` already done; `.env` intentionally absent so `isSupabaseConfigured === false`
- `npm run dev` (Vite, port 5173) — verify HTTP 200 from `curl localhost:5173`
- Open Chrome to `http://localhost:5173`, maximize the window

### Test 1 — App boots in dark mode with setup banner
- Navigate to `/`
- **PASS criteria:**
  - Background is near-black (`hsl(240 10% 4%)` = zinc-950); page does NOT flash white
  - `<html>` element has `class="dark"` (verify via DevTools Elements briefly OR rely on visual)
  - Yellow "Supabase belum dikonfigurasi." banner is visible at top of main area, with the literal text "VITE_SUPABASE_URL" and "VITE_SUPABASE_ANON_KEY"
  - Sidebar shows 5 nav items: Dashboard, API Vault, Character Matrix, Preset Engine, Project Lab — only "Dashboard" is highlighted
  - Dashboard heading reads exactly "Reality Engine" with subtitle starting "AI Content Factory"
  - Four shortcut cards render: API Vault / Character Matrix / Preset Engine / Project Lab

A broken implementation (e.g. light theme, missing banner, sidebar not rendering, route not loading) would visibly fail this test.

### Test 2 — API Vault page renders empty state and Add Key is disabled
- Click sidebar "API Vault"
- **PASS criteria:**
  - URL is `/api-vault`; sidebar highlight moves to API Vault
  - Heading reads "API Vault"; description mentions "Maksimum 5 API key"
  - Empty-state row visible inside the table with key icon and the literal text "Belum ada API key."
  - Counter at bottom reads "0/5 keys terdaftar."
  - **`Add Key` button at top-right is visibly disabled** (greyed out, `disabled` attribute present, click does nothing)

A broken disable-guard would fire the dialog or attempt an insert that errors against the placeholder Supabase URL — test fails if dialog opens.

### Test 3 — Character Matrix renders correctly with disabled "New Character"
- Click sidebar "Character Matrix"
- **PASS criteria:**
  - URL is `/character-matrix`
  - Empty-state card on the left reads "Belum ada character."
  - Right pane reads exactly "Pilih character di kiri untuk mengelola outfit & expression."
  - **`New Character` button is disabled**

### Test 4 — Preset Engine 4-tab strip renders, Add preset disabled
- Click sidebar "Preset Engine"
- **PASS criteria:**
  - URL is `/preset-engine`
  - Tab strip shows 4 cards: **Camera, Lighting, FilmStock, Style**, each with "0 preset"
  - Default active tab is **Camera** with description "Sudut, fokal, dan gerakan kamera."
  - Empty state shows the sample modifier `wide-angle dolly shot, f/2.8, 35mm`
  - **`Add preset` button is disabled**
- Click the **Lighting** card
  - Description changes to "Sumber cahaya, mood, dan kontras." and sample modifier changes to `low-key rim lighting, neon magenta`

A broken category switch (e.g. tabs not changing description) would fail this assertion since each tab has a unique description.

### Test 5 — Project Lab empty state, New Project disabled
- Click sidebar "Project Lab"
- **PASS criteria:**
  - URL is `/project-lab`
  - Empty state with folder icon and the literal text "Belum ada project."
  - **`New Project` button is disabled**

### Test 6 — 404 route renders the NotFound page
- Address bar: navigate to `/no-such-page`
- **PASS criteria:**
  - Mono "404" text visible
  - Heading reads "Halaman tidak ditemukan"
  - "Kembali ke Dashboard" button present and clicking it returns to `/`

### Optional Test 7 — Direct workspace URL falls back gracefully
- Navigate to `/project-lab/abc-not-real`
- **PASS criteria:**
  - The "Konfigurasi Supabase dulu untuk membuka workspace ini." copy is shown (because `isSupabaseConfigured` is false — see `src/pages/ProjectWorkspace.tsx:73`)
  - "Kembali ke Project Lab" back button present

## Plan B — Full CRUD (only if user provides Supabase creds)
Skipped unless requested. Would cover: add/toggle/delete API key, create character + nested outfit + nested expression, create one preset per category, create project and confirm redirect to `/project-lab/:id`.

## How a broken PR would fail Plan A
- Dev server doesn't boot → Test 1 fails immediately
- Routing broken → Tests 2-6 each fail (sidebar click does not change URL or content)
- Dark theme not enforced → Test 1's "near-black background" assertion fails (white flash visible)
- `isSupabaseConfigured` not wired correctly → Tests 2/3/4/5 fail because Add buttons are NOT disabled (or banner not shown)
- Preset tab state broken → Test 4's description swap fails
- 404 route not registered → Test 6 fails (Vite default fallback or blank page)

## Evidence to capture
- Screenshots of each route (Dashboard, ApiVault, CharacterMatrix, PresetEngine on Camera, PresetEngine on Lighting, ProjectLab, NotFound, ProjectWorkspace fallback)
- One continuous screen recording covering the full traversal with annotations per test
- Final test-report.md with inline screenshots
