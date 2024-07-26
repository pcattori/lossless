import * as fs from "node:fs/promises"
import * as path from "node:path"

import { parse as esModuleLexer } from "es-module-lexer"
import { noext } from "@lossless/dev"

import * as Config from "./config"

export default async function typegen() {
  let routes = await Config.routes()
  await Promise.all(routes.map(typegenRoute))
}

async function typegenRoute(route: Config.Route) {
  let params = paramsType(route)

  let file = path.join(Config.appDirectory, route.file)
  let content = await fs.readFile(file, "utf8")
  let exports = esModuleLexer(content)[1].map((x) => x.n)

  let types = [
    `import * as T from "lossless"`,
    "",
    params,
    "",
    `export type ServerLoader = T.ServerLoader<Params>`,
    exports.includes("serverLoader")
      ? [
          `import type { serverLoader } from "${noext(file)}"`,
          `type ServerLoaderData = Awaited<ReturnType<typeof serverLoader>>`,
        ].join("\n")
      : `type ServerLoaderData = undefined`,
    "",
    `export type ClientLoader = T.ClientLoader<Params, ServerLoaderData>`,
    exports.includes("clientLoader")
      ? [
          `import type { clientLoader } from "${noext(file)}"`,
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

  let rel = path.relative(Config.appDirectory, file)
  let dest = path.join(Config.appDirectory, ".typegen", rel)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, types)
  console.log(`Wrote '${path.relative(Config.appDirectory, dest)}'`)
}

function paramsType(route: Config.Route): string {
  let params = parseParams(route)
  let paramTypes = params.map(([param, optional]) => {
    let type = `  ${param}: string`
    if (optional) type += ` | undefined`
    return type
  })
  return ["type Params = {", ...paramTypes, "}"].join("\n")
}

type Params = Array<readonly [string, boolean]>

function parseParams(route: Config.Route): Params {
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
