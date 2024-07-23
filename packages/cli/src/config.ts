import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
