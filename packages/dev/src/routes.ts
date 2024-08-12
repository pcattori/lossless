import * as path from "node:path"

import type ts from "typescript/lib/tsserverlibrary"

import type { Config } from "./config"
import type { Context } from "./typescript/context"

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
  returnType?: string
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
    returnType: `import("lossless").LinkDescriptor[]`,
    documentation: createDocumentation({
      name: "links",
      link: `https://remix.run/docs/en/main/route/links`,
    }),
  },
  serverLoader: {
    documentation: createDocumentation({
      name: "serverLoader",
      link: `https://remix.run/docs/en/main/route/loader`,
    }),
  },
  clientLoader: {
    documentation: createDocumentation({
      name: "clientLoader",
      link: `https://remix.run/docs/en/main/route/client-loader`,
    }),
  },
  // TODO clientLoader.hydrate?
  HydrateFallback: {
    documentation: createDocumentation({
      name: "HydrateFallback",
      link: `https://remix.run/docs/en/main/route/hydrate-fallback`,
    }),
    returnType: `import("react").ReactNode`,
  },
  serverAction: {
    documentation: createDocumentation({
      name: "serverAction",
      link: `https://remix.run/docs/en/main/route/action`,
    }),
  },
  clientAction: {
    documentation: createDocumentation({
      name: "clientAction",
      link: `https://remix.run/docs/en/main/route/client-action`,
    }),
  },
  default: {
    documentation: createDocumentation({
      name: "default",
      link: `https://remix.run/docs/en/main/route/component`,
    }),
    returnType: `import("react").ReactNode`,
  },
  ErrorBoundary: {
    documentation: createDocumentation({
      name: "ErrorBoundary",
      link: `https://remix.run/docs/en/main/route/error-boundary`,
    }),
    returnType: `import("react").ReactNode`,
  },
  // TODO handle
  // TODO meta
  // TODO shouldRevalidate
}
