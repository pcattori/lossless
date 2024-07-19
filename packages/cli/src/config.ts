import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export type Route = {
  path: string
  file: string
}

export const appDirectory = path.resolve(__dirname, "../../../example")

export async function routes(): Promise<Route[]> {
  let { default: routes } = await import(path.join(appDirectory, "routes.ts"))
  return routes
}
