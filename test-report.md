# Test Report — PR #1 (PRD 1 + 2 scaffold)

**Session**: https://app.devin.ai/sessions/8e038dc5d8df40318074cb86414501a3
**PR**: https://github.com/attaul-fullstack-dev/reality-engine/pull/1
**Mode**: UI smoke test only (Plan A from `test-plan.md`). Supabase intentionally **not** configured per user instruction, so all CRUD writes are blocked at the UI layer (`disabled={!isSupabaseConfigured}`) and were not exercised. Plan B (full CRUD) was skipped — would need user to provide `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and run the SQL migration.

## Summary
Started `npm run dev`, opened `http://localhost:5173/`, traversed every route via the sidebar + direct URL entry, and verified the not-configured fallback path. All 7 assertions passed. No console errors. Recording attached.

## Results

| # | Assertion | Result |
| - | --- | --- |
| 1 | App boots in dark theme with yellow Supabase setup banner; sidebar shows 5 nav items; Dashboard active | passed |
| 2 | `/api-vault` empty state with "Belum ada API key.", counter "0/5 keys terdaftar.", **Add Key disabled** (click did nothing) | passed |
| 3 | `/character-matrix` empty state "Belum ada character." + right pane "Pilih character di kiri…", **New Character disabled** | passed |
| 4 | `/preset-engine` 4 tabs each with unique header & sample modifier (Camera→`wide-angle dolly shot, f/2.8, 35mm`; Lighting→`low-key rim lighting, neon magenta`; FilmStock→`Kodak Portra 400, soft grain`; Style→`cyberpunk noir, Blade Runner 2049`); **Add preset disabled** on every tab | passed |
| 5 | `/project-lab` empty state "Belum ada project." referencing PRD 3+, **New Project disabled** | passed |
| 6 | `/no-such-page` renders 404 page with "Halaman tidak ditemukan" + "Kembali ke Dashboard" button | passed |
| 7 | `/project-lab/abc-not-real` falls back to "Konfigurasi Supabase dulu untuk membuka workspace ini." with back link, no crash | passed |

## Not tested (and why)
- API key add/toggle/delete CRUD round-trip
- Character + nested outfit/expression CRUD
- Preset CRUD per category and category-lock-on-edit
- Project create + redirect to `/project-lab/:id` + cascade delete
- Toast notifications and optimistic update rollback paths
- Production build behavior (only `vite dev` was tested at runtime; `vite build` was confirmed earlier during PR creation)

These all require Supabase. To exercise them, set `.env` and run `supabase/migrations/0001_initial_schema.sql` on a fresh Supabase project.

## Evidence

### Dashboard — dark theme, banner, sidebar, 4 shortcut cards
![Dashboard](https://app.devin.ai/attachments/922ee03a-eba2-4c15-b2c9-f666119dba60/screenshot_ead4fc6eb1574d20816c48c51e3e85c7.png)

### `/api-vault` — empty table, 0/5 counter, Add Key disabled
![API Vault](https://app.devin.ai/attachments/60bcc5a6-7134-4ef1-8268-2b6e7bdce2ac/screenshot_e7561a27b0714f9fbb63ee382d892df6.png)

### `/character-matrix` — split pane, New Character disabled
![Character Matrix](https://app.devin.ai/attachments/db145e0a-27cb-4085-b9b9-e1bd7a69dac2/screenshot_4a2dae7a8b284b699d73c1032d15ce36.png)

### `/preset-engine` — Camera tab default
![Preset Engine — Camera](https://app.devin.ai/attachments/8bc59b09-868c-4651-b9b9-7475bf2cb425/screenshot_99c14fd586f341d5bf6d657541178d95.png)

### `/preset-engine` — Lighting tab (header + modifier swap proves tab state works)
![Preset Engine — Lighting](https://app.devin.ai/attachments/7d56c874-663a-4595-96f3-fcecebc8623b/screenshot_951a3d04e21548f2a1e46a81a78e3acb.png)

### `/preset-engine` — Style tab (final tab)
![Preset Engine — Style](https://app.devin.ai/attachments/427cf29a-41e0-444d-b371-521838889cc6/screenshot_f0e6ee1705024d299ce5d9c4f8317b95.png)

### `/project-lab` — empty grid, New Project disabled
![Project Lab](https://app.devin.ai/attachments/fa28a836-716e-442c-b21a-d97c44b5b394/screenshot_8a73b1a1ef6a438497b7a48494f521c2.png)

### `/no-such-page` — 404 page
![404](https://app.devin.ai/attachments/9d4c74f7-136a-437b-bee6-c3f33f64af47/screenshot_1de5129832d64e60bb78dd00f4ec8368.png)

### `/project-lab/abc-not-real` — graceful workspace fallback
![Workspace fallback](https://app.devin.ai/attachments/16d0140a-e56f-41a7-a104-f6730164d337/screenshot_f6a180efb0f8481fb34df75a54ee3607.png)

### Recording
[rec-47575ec9-…-subtitled.mp4](https://app.devin.ai/attachments/505e8183-725c-44f3-aa5a-334f9ca76c06/rec-47575ec9-d9af-4aae-ba0e-2021b01fffa0-subtitled.mp4)

### Console
No errors during traversal. Only Vite HMR connection logs and the React DevTools recommendation.
