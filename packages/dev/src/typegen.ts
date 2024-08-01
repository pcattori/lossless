import * as fs from "node:fs"
import * as path from "node:path"

import { getRoutes, type Route } from "./routes"
import type { Config } from "./config"
import { noext } from "./utils"

export function getTypesPath(
  config: Config,
  route: Pick<Route, "file">,
): string {
  const typegenDir = path.join(config.appDirectory, ".lossless/typegen")
  let dest = path.join(
    typegenDir,
    path.dirname(route.file),
    "$types." + path.basename(route.file),
  )
  return dest
}

export function writeAll(config: Config) {
  const routes = getRoutes(config)
  routes.forEach((route) => write(config, route))
}

export function write(config: Config, route: Route) {
  const content = typegen(route)
  const $typesPath = getTypesPath(config, route)
  fs.mkdirSync(path.dirname($typesPath), { recursive: true })
  fs.writeFileSync($typesPath, content)
}

function typegen(route: Route) {
  let routePath = "./" + noext(path.basename(route.file))
  let paramsType = getParamsType(route)
  return [
    `import type { ReactNode } from "react"`,
    `import type * as Lossless from "lossless"`,
    "",
    "type Pretty<T> = { [K in keyof T]: T[K] } & {}",
    "type IsAny<T> = 0 extends (1 & T) ? true : false",
    "",
    `type Params = ${paramsType}`,
    "",
    `export type LinksConstraint = (args: { params: Pretty<Params> }) => Lossless.LinkDescriptor[]`,
    "",
    `type LoaderArgs = {`,
    `  context: Lossless.AppLoadContext`,
    `  request: Request`,
    `  params: Pretty<Params>`,
    `}`,
    "",
    `export type ServerLoaderConstraint = (args: LoaderArgs) => Lossless.ServerData`,
    `// @ts-ignore`,
    `import type { serverLoader } from "${routePath}"`,
    `type ServerLoaderData = IsAny<typeof serverLoader> extends true ? undefined : Awaited<ReturnType<typeof serverLoader>>`,
    "",
    `export type ClientLoaderConstraint = (args: LoaderArgs & { serverLoader: () => Promise<ServerLoaderData> }) => unknown`,
    `// @ts-ignore`,
    `import type { clientLoader } from "${routePath}"`,
    `type ClientLoaderData = IsAny<typeof clientLoader> extends true ? undefined : Awaited<ReturnType<typeof clientLoader>>`,
    "",
    `type ClientLoaderHydrate = false`, // TODO
    "",
    `export type HydrateFallbackConstraint = (args: { params: Pretty<Params> }) => ReactNode`,
    `// @ts-ignore`,
    `import type { HydrateFallback } from "${routePath}"`,
    `type HasHydrateFallback = IsAny<typeof HydrateFallback> extends true ? false : true`,
    "",
    `type LoaderData = Lossless.LoaderData<`,
    `  ServerLoaderData,`,
    `  ClientLoaderData,`,
    `  ClientLoaderHydrate,`,
    `  HasHydrateFallback`,
    `>`,
    "",
    `type ActionArgs = {`,
    `  context: Lossless.AppLoadContext`,
    `  request: Request`,
    `  params: Pretty<Params>`,
    `}`,
    "",
    `export type ServerActionConstraint = (args: ActionArgs) => Lossless.ServerData`,
    `// @ts-ignore`,
    `import type { serverAction } from "${routePath}"`,
    `type ServerActionData = IsAny<typeof serverAction> extends true ? undefined : Awaited<ReturnType<typeof serverAction>>`,
    "",
    `export type ClientActionConstraint = (args: ActionArgs & { serverAction: () => Promise<ServerActionData> }) => unknown`,
    `// @ts-ignore`,
    `import type { clientAction } from "${routePath}"`,
    `type ClientActionData = IsAny<typeof clientAction> extends true ? undefined : Awaited<ReturnType<typeof clientAction>>`,
    "",
    `type ActionData = Lossless.ActionData<ServerActionData, ClientActionData>`,
    "",
    `export type ComponentConstraint = (args: { params: Pretty<Params>, loaderData: LoaderData, actionData?: ActionData }) => ReactNode`,
    "",
    `export type ErrorBoundaryConstraint = (args: { params: Pretty<Params>, error: unknown, loader: LoaderData, actionData?: ActionData }) => ReactNode`,
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
