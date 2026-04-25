import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Triggering an async fetch inside useEffect is the canonical pattern
      // for loading data on mount. The new strict rule is too noisy; we keep
      // the rest of react-hooks's recommendations.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // shadcn-style UI primitives co-locate variant constants with the
    // component itself. That pattern only blocks Vite's HMR for that file,
    // which is acceptable for low-churn library code.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
