export type PresetCategory = 'Camera' | 'Lighting' | 'FilmStock' | 'Style'

export const PRESET_CATEGORIES: PresetCategory[] = [
  'Camera',
  'Lighting',
  'FilmStock',
  'Style',
]

export interface ApiVault {
  id: string
  provider: string
  label: string
  api_key: string
  is_active: boolean
  error_count: number
  created_at?: string
}

export interface Character {
  id: string
  name: string
  body_dna: string
  face_features: string
  avatar_url?: string | null
  created_at?: string
}

export interface CharacterOutfit {
  id: string
  character_id: string
  label: string
  prompt_desc: string
  created_at?: string
}

export interface CharacterExpression {
  id: string
  character_id: string
  label: string
  prompt_desc: string
  created_at?: string
}

export interface Preset {
  id: string
  category: PresetCategory
  label: string
  modifier: string
  created_at?: string
}

export type ProjectStatus = 'draft' | 'in_progress' | 'completed' | 'archived'

export const PROJECT_STATUSES: ProjectStatus[] = [
  'draft',
  'in_progress',
  'completed',
  'archived',
]

export interface Project {
  id: string
  title: string
  status: ProjectStatus
  created_at: string
}

export interface Scene {
  id: string
  project_id: string
  scene_order: number
  action_text: string
  generated_image_url?: string | null
  prompt_snapshot?: string | null
  motion_prompt?: string | null
  generated_video_url?: string | null
  character_id?: string | null
  outfit_id?: string | null
  expression_id?: string | null
  camera_id?: string | null
  lighting_id?: string | null
  film_stock_id?: string | null
  style_id?: string | null
  created_at?: string
}
