import type ts from "typescript"

import type { Config } from "../config"

export type Context = {
  config: Config
  ls: ts.LanguageService
  info: ts.server.PluginCreateInfo
  ts: typeof ts
  logger: {
    info: (message: string) => void
  }
}
