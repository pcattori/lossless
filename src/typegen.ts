import * as fs from "node:fs/promises"
import * as path from "node:path"

import { parse as esModuleLexer } from "es-module-lexer"

import { fileURLToPath } from "url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const EXAMPLE_DIR = path.resolve(__dirname, "../example")

const TYPES = path.resolve(__dirname, "./types.ts")

typegen({
  path: "products/:id/:brand?",
  file: "routes/product-details.tsx",
})

type Route = {
  path: string
  file: string
}

// find
async function typegen(route: Route) {
  let params = paramsType(route)

  let file = path.join(EXAMPLE_DIR, route.file)
  let content = await fs.readFile(file, "utf8")
  let exports = esModuleLexer(content)[1].map((x) => x.n)

  let importSource = path.relative(path.dirname(file), TYPES).slice(0, -3)
  let types = [
    `import * as T from "${importSource}"`,
    "",
    params,
    "",
    `export type ServerLoader = T.ServerLoader<Params>`,
    exports.includes("serverLoader")
      ? [
          `import type { serverLoader } from "./${path.basename(file)}"`,
          `type ServerLoaderData = Awaited<ReturnType<typeof serverLoader>>`,
        ].join("\n")
      : `type ServerLoaderData = undefined`,
    "",
    `export type ClientLoader = T.ClientLoader<Params, ServerLoaderData>`,
    exports.includes("clientLoader")
      ? [
          `import type { clientLoader } from "./${path.basename(file)}"`,
          `type ClientLoaderData = Awaited<ReturnType<typeof clientLoader>>`,
        ].join("\n")
      : `type ClientLoaderData = undefined`,
    "",
    `type ClientLoaderHydrate = false`, // TODO
    "",
    `export type HydrateFallback = T.HydrateFallback<Params>`,
    `type HasHydrateFallback = ${exports.includes("HydrateFallback")}`,
    "",
    `type LoaderData = T.LoaderData<`,
    `  ServerLoaderData,`,
    `  ClientLoaderData,`,
    `  ClientLoaderHydrate,`,
    `  HasHydrateFallback`,
    `>`,
    "",
    `export type Component = T.Component<Params, LoaderData>`,
  ].join("\n")
  console.log(types)
  await fs.writeFile(
    path.join(path.dirname(file), `$types.${path.basename(file)}`),
    types,
  )
}

function paramsType(route: Route): string {
  let params = parseParams(route)
  let paramTypes = params.map(([param, optional]) => {
    let type = `  ${param}: string`
    if (optional) type += ` | undefined`
    return type
  })
  return ["type Params = {", ...paramTypes, "}"].join("\n")
}

type Params = Array<readonly [string, boolean]>

function parseParams(route: Route): Params {
  let segments = route.path.split("/")
  let params = segments
    .filter((s) => s.startsWith(":"))
    .map((param) => {
      param = param.slice(1) // omit leading `:`
      let optional = param.endsWith("?")
      if (optional) {
        param = param.slice(0, -1) // omit trailing `?`
        return [param, true] as const
      }
      return [param, false] as const
    })
  return params
}
