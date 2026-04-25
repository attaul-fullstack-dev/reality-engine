import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { ApiVault } from '@/pages/ApiVault'
import { CharacterMatrix } from '@/pages/CharacterMatrix'
import { PresetEngine } from '@/pages/PresetEngine'
import { ProjectLab } from '@/pages/ProjectLab'
import { ProjectWorkspace } from '@/pages/ProjectWorkspace'
import { NotFound } from '@/pages/NotFound'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="api-vault" element={<ApiVault />} />
        <Route path="character-matrix" element={<CharacterMatrix />} />
        <Route path="preset-engine" element={<PresetEngine />} />
        <Route path="project-lab" element={<ProjectLab />} />
        <Route path="project-lab/:projectId" element={<ProjectWorkspace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
