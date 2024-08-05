import type { Config } from "@lossless/dev"
import type ts from "typescript"

export type Context = {
  config: Config
  ls: ts.LanguageService
  info: ts.server.PluginCreateInfo
  ts: typeof ts
  logger: {
    info: (message: string) => void
  }
}
