import * as path from "node:path"

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
  jsdoc: string
}

function createJsdoc(args: { name: string; link: string }) {
  return `/** React Router \`${args.name}\`. More info: ${args.link} */`
}

export const routeExports: Record<string, RouteExportInfo> = {
  links: {
    jsdoc: createJsdoc({
      name: "links",
      link: `https://remix.run/docs/en/main/route/links`,
    }),
  },
  serverLoader: {
    jsdoc: createJsdoc({
      name: "serverLoader",
      link: `https://remix.run/docs/en/main/route/loader`,
    }),
  },
  clientLoader: {
    jsdoc: createJsdoc({
      name: "clientLoader",
      link: `https://remix.run/docs/en/main/route/client-loader`,
    }),
  },
  // TODO clientLoader.hydrate?
  HydrateFallback: {
    jsdoc: createJsdoc({
      name: "HydrateFallback",
      link: `https://remix.run/docs/en/main/route/hydrate-fallback`,
    }),
  },
  serverAction: {
    jsdoc: createJsdoc({
      name: "serverAction",
      link: `https://remix.run/docs/en/main/route/action`,
    }),
  },
  clientAction: {
    jsdoc: createJsdoc({
      name: "clientAction",
      link: `https://remix.run/docs/en/main/route/client-action`,
    }),
  },
  default: {
    jsdoc: createJsdoc({
      name: "default",
      link: `https://remix.run/docs/en/main/route/component`,
    }),
  },
  ErrorBoundary: {
    jsdoc: createJsdoc({
      name: "ErrorBoundary",
      link: `https://remix.run/docs/en/main/route/error-boundary`,
    }),
  },
  // TODO handle
  // TODO meta
  // TODO shouldRevalidate
}
