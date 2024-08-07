import type ts from "typescript"

import type { Config } from "../config"

export type Context = {
  config: Config
  languageService: ts.LanguageService
  languageServiceHost: ts.LanguageServiceHost
  ts: typeof ts
  logger?: {
    info: (message: string) => void
  }
}
