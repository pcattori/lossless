import * as path from "node:path"

import type { Route } from "./routes"
import type { Config } from "./config"
import { noext } from "./utils"

export function typegenPath(config: Config, routeFile: string): string {
  let rel = path.relative(config.appDirectory, routeFile)
  let dest = path.join(
    config.appDirectory,
    ".lossless/typegen",
    path.dirname(rel),
    "$types." + path.basename(rel),
  )
  return dest
}

export async function typegen(config: Config, route: Route) {
  let file = path.join(config.appDirectory, route.file)
  let paramsType = getParamsType(route)
  return [
    `import type { ReactNode } from "react"`,
    `import type * as Lossless from "lossless"`,
    "",
    "type Pretty<T> = { [K in keyof T]: T[K] } & {}",
    "export type IsAny<T> = 0 extends (1 & T) ? true : false",
    "",
    `type Params = ${paramsType}`,
    "",
    `type LoaderArgs = {`,
    `  context: Lossless.AppLoadContext`,
    `  request: Request`,
    `  params: Pretty<Params>`,
    `}`,
    "",
    `export type ServerLoader = (args: LoaderArgs) => Lossless.ServerData`,
    `// @ts-ignore`,
    `import type { serverLoader } from "${noext(file)}"`,
    `type ServerLoaderData = IsAny<typeof serverLoader> extends true ? undefined : Awaited<ReturnType<typeof serverLoader>>`,
    "",
    `export type ClientLoader = (args: LoaderArgs & { serverLoader: () => Promise<ServerLoaderData> }) => unknown`,
    `// @ts-ignore`,
    `import type { clientLoader } from "${noext(file)}"`,
    `type ClientLoaderData = IsAny<typeof clientLoader> extends true ? undefined : Awaited<ReturnType<typeof clientLoader>>`,
    "",
    `type ClientLoaderHydrate = false`, // TODO
    "",
    `export type HydrateFallback = (args: { params: Pretty<Params> }) => ReactNode`,
    `// @ts-ignore`,
    `import type { HydrateFallback as _HydrateFallback } from "${noext(file)}"`,
    `type HasHydrateFallback = IsAny<typeof _HydrateFallback> extends true ? false : true`,
    "",
    `type LoaderData = Lossless.LoaderData<`,
    `  ServerLoaderData,`,
    `  ClientLoaderData,`,
    `  ClientLoaderHydrate,`,
    `  HasHydrateFallback`,
    `>`,
    "",
    `export type Component = (args: { params: Pretty<Params>, loaderData: LoaderData }) => ReactNode`,
  ].join("\n")
}

function getParamsType(route: Route): string {
  let params = parseParams(route)
  let paramTypes = params.map(([param, optional]) => {
    let type = `  ${param}: string`
    if (optional) type += ` | undefined`
    return type
  })
  return ["{", ...paramTypes, "}"].join("\n")
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
