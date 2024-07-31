import * as path from "node:path"

import type { Config } from "./config"

export type Route = {
  path: string
  file: string
}

export function getRoutes(config: Config): Route[] {
  return require(path.join(config.appDirectory, "routes.cjs"))
}
