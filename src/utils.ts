import * as path from "node:path"

export function noext(filepath: string): string {
  let { dir, name } = path.parse(filepath)
  return path.join(dir, name)
}
