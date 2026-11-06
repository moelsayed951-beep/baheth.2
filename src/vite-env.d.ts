/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_ERIC_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
