import * as path from "node:path"

export type Route = {
  path: string
  file: string
}

export const appDirectory = path.resolve(__dirname, "../../../example")

export function routes(): Route[] {
  let routes = require(path.join(appDirectory, "routes.ts"))
  // let { default: routes } = await import(path.join(appDirectory, "routes.ts"))
  return routes
}
