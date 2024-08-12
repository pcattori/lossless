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
  jsdoc: ts.SymbolDisplayPart
  returnType?: string
  completions: (ctx: Context) => ts.CompletionEntry[] // TODO
}

function createJsdoc(args: {
  name: string
  link: string
}): ts.SymbolDisplayPart {
  return {
    kind: "text",
    text: `React Router \`${args.name}\`. More info: ${args.link}`,
  }
}

function createFunctionCompletion(
  ctx: Context,
  name: string,
): ts.CompletionEntry {
  return {
    name,
    insertText: `export function ${name}() {}`,
    kind: ctx.ts.ScriptElementKind.functionElement,
    kindModifiers: ctx.ts.ScriptElementKindModifier.exportedModifier,
    sortText: "0",
    labelDetails: {
      description: "React Router",
    },
  }
}

export const routeExports: Record<string, RouteExportInfo> = {
  links: {
    jsdoc: createJsdoc({
      name: "links",
      link: `https://remix.run/docs/en/main/route/links`,
    }),
    returnType: `import("lossless/types").LinkDescriptor[]`,
    completions: (ctx) => [createFunctionCompletion(ctx, "links")],
  },
  serverLoader: {
    jsdoc: createJsdoc({
      name: "serverLoader",
      link: `https://remix.run/docs/en/main/route/loader`,
    }),
    completions: (ctx) => [createFunctionCompletion(ctx, "serverLoader")],
  },
  clientLoader: {
    jsdoc: createJsdoc({
      name: "clientLoader",
      link: `https://remix.run/docs/en/main/route/client-loader`,
    }),
    completions: (ctx) => [createFunctionCompletion(ctx, "clientLoader")],
  },
  // TODO clientLoader.hydrate?
  HydrateFallback: {
    jsdoc: createJsdoc({
      name: "HydrateFallback",
      link: `https://remix.run/docs/en/main/route/hydrate-fallback`,
    }),
    returnType: `import("react").ReactNode`,
    completions: (ctx) => [createFunctionCompletion(ctx, "HydrateFallback")],
  },
  serverAction: {
    jsdoc: createJsdoc({
      name: "serverAction",
      link: `https://remix.run/docs/en/main/route/action`,
    }),
    completions: (ctx) => [createFunctionCompletion(ctx, "serverAction")],
  },
  clientAction: {
    jsdoc: createJsdoc({
      name: "clientAction",
      link: `https://remix.run/docs/en/main/route/client-action`,
    }),
    completions: (ctx) => [createFunctionCompletion(ctx, "clientAction")],
  },
  default: {
    jsdoc: createJsdoc({
      name: "default",
      link: `https://remix.run/docs/en/main/route/component`,
    }),
    returnType: `import("react").ReactNode`,
    completions: (ctx) => [
      {
        name: `export default function Component() {}`,
        kind: ctx.ts.ScriptElementKind.functionElement,
        kindModifiers: ctx.ts.ScriptElementKindModifier.exportedModifier,
        sortText: "0",
      },
    ],
  },
  ErrorBoundary: {
    jsdoc: createJsdoc({
      name: "ErrorBoundary",
      link: `https://remix.run/docs/en/main/route/error-boundary`,
    }),
    returnType: `import("react").ReactNode`,
    completions: (ctx) => [createFunctionCompletion(ctx, "ErrorBoundary")],
  },
  // TODO handle
  // TODO meta
  // TODO shouldRevalidate
}
