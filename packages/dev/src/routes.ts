import * as path from "node:path"

import type { Config } from "./config"

export type Route = {
  path: string
  file: string
}

export function getRoutesFile(config: Config) {
  return path.join(config.appDirectory, "routes.cjs")
}

export function getRoutes(config: Config): Map<string, Route> {
  const routesFile = getRoutesFile(config)
  delete require.cache[routesFile]
  const routes = require(routesFile) as Route[]
  return new Map(
    routes.map((route) => [path.join(config.appDirectory, route.file), route]),
  )
}
