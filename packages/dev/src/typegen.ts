import * as fs from "node:fs/promises"
import * as path from "node:path"

import { parse as esModuleLexer } from "es-module-lexer"

import type { Route } from "./routes"
import type { Config } from "./config"
import { noext } from "./utils"

export function typegenPath(config: Config, routeFile: string): string {
  let rel = path.relative(config.appDirectory, routeFile)
  let dest = path.join(config.appDirectory, ".lossless/typegen", rel)
  return dest
}

export async function typegen(config: Config, route: Route) {
  let params = paramsType(route)

  let file = path.join(config.appDirectory, route.file)
  let code = await fs.readFile(file, "utf8")
  let exports = esModuleLexer(code)[1].map((x) => x.n)

  return [
    `import type { ReactNode } from "react"`,
    `import type * as T from "lossless"`,
    "",
    params,
    "",
    `type LoaderArgs = {`,
    `  context: T.AppLoadContext`,
    `  request: Request`,
    `  params: Params`,
    `}`,
    "",
    `export type ServerLoader = (args: LoaderArgs) => T.ServerData`,
    exports.includes("serverLoader")
      ? [
          `import type { serverLoader } from "${noext(file)}"`,
          `type ServerLoaderData = Awaited<ReturnType<typeof serverLoader>>`,
        ].join("\n")
      : `type ServerLoaderData = undefined`,
    "",

    `export type ClientLoader = (args: LoaderArgs & { serverLoader: () => Promise<ServerLoaderData> }) => unknown`,
    exports.includes("clientLoader")
      ? [
          `import type { clientLoader } from "${noext(file)}"`,
          `type ClientLoaderData = Awaited<ReturnType<typeof clientLoader>>`,
        ].join("\n")
      : `type ClientLoaderData = undefined`,
    "",
    `type ClientLoaderHydrate = false`, // TODO
    "",
    `export type HydrateFallback = (args: { params: Params }) => ReactNode`,
    `type HasHydrateFallback = ${exports.includes("HydrateFallback")}`,
    "",
    `type LoaderData = T.LoaderData<`,
    `  ServerLoaderData,`,
    `  ClientLoaderData,`,
    `  ClientLoaderHydrate,`,
    `  HasHydrateFallback`,
    `>`,
    "",
    `export type Component = (args: { params: Params, loaderData: LoaderData }) => ReactNode`,
  ].join("\n")
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
