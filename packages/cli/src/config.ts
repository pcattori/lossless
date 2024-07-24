import * as path from "node:path"

export type Route = {
  path: string
  file: string
}

export const appDirectory = process.cwd()

export async function routes(): Promise<Route[]> {
  let { default: routes } = await import(path.join(appDirectory, "routes.mjs"))
  return routes
}
