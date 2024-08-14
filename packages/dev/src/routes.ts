import * as path from "node:path"

import type ts from "typescript/lib/tsserverlibrary"

import type { Config } from "./config"

export type Route = {
  path: string
  file: string
}

export function getRoutesFile(config: Config) {
  return path.join(config.appDirectory, "routes.cjs")
}

export function getRoutes(config: Config): Map<string, Route> {
  const routesFile = getRoutesFile(config)
  delete require.cache[routesFile]
  const routes = require(routesFile) as Route[]
  return new Map(
    routes.map((route) => [path.join(config.appDirectory, route.file), route]),
  )
}

type RouteExportInfo = {
  annotateReturnType: boolean
  documentation: ts.SymbolDisplayPart[]
}

function createDocumentation(args: {
  name: string
  link: string
}): ts.SymbolDisplayPart[] {
  return [
    {
      kind: "text",
      text: `React Router \`${args.name}\` export\n\nDocs: ${args.link}`,
    },
  ]
}

export const routeExports: Record<string, RouteExportInfo> = {
  links: {
    annotateReturnType: true,
    documentation: createDocumentation({
      name: "links",
      link: `https://remix.run/docs/en/main/route/links`,
    }),
  },
  serverLoader: {
    annotateReturnType: false,
    documentation: createDocumentation({
      name: "serverLoader",
      link: `https://remix.run/docs/en/main/route/loader`,
    }),
  },
  clientLoader: {
    annotateReturnType: false,
    documentation: createDocumentation({
      name: "clientLoader",
      link: `https://remix.run/docs/en/main/route/client-loader`,
    }),
  },
  // TODO clientLoader.hydrate?
  HydrateFallback: {
    annotateReturnType: true,
    documentation: createDocumentation({
      name: "HydrateFallback",
      link: `https://remix.run/docs/en/main/route/hydrate-fallback`,
    }),
  },
  serverAction: {
    annotateReturnType: false,
    documentation: createDocumentation({
      name: "serverAction",
      link: `https://remix.run/docs/en/main/route/action`,
    }),
  },
  clientAction: {
    annotateReturnType: false,
    documentation: createDocumentation({
      name: "clientAction",
      link: `https://remix.run/docs/en/main/route/client-action`,
    }),
  },
  default: {
    annotateReturnType: true,
    documentation: createDocumentation({
      name: "default",
      link: `https://remix.run/docs/en/main/route/component`,
    }),
  },
  ErrorBoundary: {
    annotateReturnType: true,
    documentation: createDocumentation({
      name: "ErrorBoundary",
      link: `https://remix.run/docs/en/main/route/error-boundary`,
    }),
  },
  // TODO handle
  // TODO meta
  // TODO shouldRevalidate
}
