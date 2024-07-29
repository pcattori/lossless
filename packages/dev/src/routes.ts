import * as path from "node:path"

import type { Config } from "./config"

export type Route = {
  path: string
  file: string
}

export async function routes(config: Config): Promise<Route[]> {
  let { default: routes } = await import(
    path.join(config.appDirectory, "routes.mjs")
  )
  return routes
}
