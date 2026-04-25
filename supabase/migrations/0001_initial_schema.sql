-- Reality Engine — PRD 1 + 2 initial schema
-- Run this SQL once in your Supabase project (SQL editor) to provision the
-- 7 tables required by the app. RLS is intentionally left disabled because
-- this MVP is a single-user creator tool. Add policies before going public.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. API Vault (key rotation, max 5 keys enforced in app)
-- ------------------------------------------------------------
create table if not exists public.api_vault (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null default 'Google',
  label         text not null,
  api_key       text not null unique,
  is_active     boolean not null default true,
  error_count   integer not null default 0,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Characters
-- ------------------------------------------------------------
create table if not exists public.characters (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  body_dna       text not null default '',
  face_features  text not null default '',
  avatar_url     text,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. Character Outfits
-- ------------------------------------------------------------
create table if not exists public.character_outfits (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references public.characters(id) on delete cascade,
  label         text not null,
  prompt_desc   text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists character_outfits_character_id_idx
  on public.character_outfits(character_id);

-- ------------------------------------------------------------
-- 4. Character Expressions
-- ------------------------------------------------------------
create table if not exists public.character_expressions (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references public.characters(id) on delete cascade,
  label         text not null,
  prompt_desc   text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists character_expressions_character_id_idx
  on public.character_expressions(character_id);

-- ------------------------------------------------------------
-- 5. Presets (4 fixed categories)
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'preset_category') then
    create type public.preset_category as enum ('Camera', 'Lighting', 'FilmStock', 'Style');
  end if;
end$$;

create table if not exists public.presets (
  id          uuid primary key default gen_random_uuid(),
  category    public.preset_category not null,
  label       text not null,
  modifier    text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists presets_category_idx on public.presets(category);

-- ------------------------------------------------------------
-- 6. Projects
-- ------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  status      text not null default 'draft',
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. Scenes (FK: project_id)
-- The selection columns (character_id, outfit_id, ...) are populated in PRD 3.
-- ------------------------------------------------------------
create table if not exists public.scenes (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,
  scene_order           integer not null default 0,
  action_text           text not null default '',
  generated_image_url   text,
  prompt_snapshot       text,
  motion_prompt         text,
  generated_video_url   text,
  character_id          uuid references public.characters(id) on delete set null,
  outfit_id             uuid references public.character_outfits(id) on delete set null,
  expression_id         uuid references public.character_expressions(id) on delete set null,
  camera_id             uuid references public.presets(id) on delete set null,
  lighting_id           uuid references public.presets(id) on delete set null,
  film_stock_id         uuid references public.presets(id) on delete set null,
  style_id              uuid references public.presets(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists scenes_project_id_idx on public.scenes(project_id);
create index if not exists scenes_project_order_idx on public.scenes(project_id, scene_order);
