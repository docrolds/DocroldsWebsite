/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ENV?: string;
  readonly VITE_SQUARE_APP_ID?: string;
  readonly VITE_SQUARE_LOCATION_ID?: string;
  readonly VITE_SQUARE_ENVIRONMENT?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
