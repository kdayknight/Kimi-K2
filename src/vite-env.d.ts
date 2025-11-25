/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_SUPABASE_ANON_KEY: string
  readonly VITE_KIMI_API_KEY: string
  readonly VITE_KIMI_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
