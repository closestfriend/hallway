interface ImportMetaEnv {
  /** Free key from https://opentopography.org/ (account → myOpenTopo Authorizations). See .env.example. */
  readonly VITE_OPENTOPOGRAPHY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
