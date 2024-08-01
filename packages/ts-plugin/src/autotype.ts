import * as fs from "node:fs"
import * as path from "node:path"

import ts from "typescript"
import {
  autotypeRoute,
  getRoutes,
  typegen,
  typegenPath,
  type AutotypedRoute,
  type Config,
} from "@lossless/dev"

type TS = typeof ts

type RouteModule = {
  snapshot: ts.IScriptSnapshot
  version: string
  autotyped: AutotypedRoute
}

const FORCE_UPDATE_VERSION = "FORCE_UPDATE_VERSION"

const CACHE = new WeakMap<
  ts.server.PluginCreateInfo,
  {
    languageService: ts.LanguageService
    getRoute: (fileName: string) => RouteModule | undefined
  } | null
>()

export function getAutotypeLanguageService(
  config: Config,
  info: ts.server.PluginCreateInfo,
  ts: TS,
) {
  const cached = CACHE.get(info)
  if (cached) return cached

  const ROUTES_BY_FILE = new Map(
    getRoutes(config).map((route) => [
      path.join(config.appDirectory, route.file),
      route,
    ]),
  )

  const host = info.languageServiceHost

  class AutotypeLanguageServiceHost implements ts.LanguageServiceHost {
    private routes: Record<string, RouteModule> = {}

    constructor() {}

    // TODO: Q: are these needed? do they just "silence" the autotype host?
    // log() {}
    // trace() {}
    // error() {}

    getCompilationSettings() {
      return host.getCompilationSettings()
    }

    getCurrentDirectory() {
      return host.getCurrentDirectory()
    }

    getDefaultLibFileName(o: any) {
      return host.getDefaultLibFileName(o)
    }

    getScriptFileNames(): string[] {
      const names: Set<string> = new Set(Object.keys(this.routes))
      const files = host.getScriptFileNames()
      for (const file of files) {
        names.add(file)
      }
      return [...names]
    }

    getScriptVersion(fileName: string) {
      const route = this.routes[fileName]
      if (!route) return host.getScriptVersion(fileName)
      return route.version.toString()
    }

    getScriptSnapshot(fileName: string) {
      const route = this.routes[fileName]
      if (!route) return host.getScriptSnapshot(fileName)
      return route.snapshot
    }

    readFile(fileName: string) {
      const route = this.routes[fileName]
      return route
        ? route.snapshot.getText(0, route.snapshot.getLength())
        : host.readFile(fileName)
    }

    fileExists(fileName: string) {
      return this.routes[fileName] !== undefined || host.fileExists(fileName)
    }

    getRouteIfUpToDate(fileName: string) {
      const scriptVersion = this.getScriptVersion(fileName)
      const route = this.routes[fileName]
      if (
        !route ||
        scriptVersion !== host.getScriptVersion(fileName) ||
        scriptVersion === FORCE_UPDATE_VERSION
      ) {
        return undefined
      }
      return route
    }

    upsertRouteFile(fileName: string) {
      const route = ROUTES_BY_FILE.get(fileName)
      if (!route) return
      const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName)
      if (!sourceFile) return

      const { text: code } = sourceFile
      const autotyped = autotypeRoute(config, fileName, code)
      const snapshot = ts.ScriptSnapshot.fromString(autotyped.code())
      snapshot.getChangeRange = (_) => undefined

      const $typesPath = typegenPath(config, fileName)
      if (!fs.existsSync($typesPath)) {
        typegen(route).then(async (content) => {
          fs.mkdirSync(path.dirname($typesPath), { recursive: true })
          fs.writeFileSync($typesPath, content)
        })
      }

      this.routes[fileName] = {
        version:
          this.routes[fileName] === undefined
            ? FORCE_UPDATE_VERSION
            : host.getScriptVersion(fileName),
        snapshot,
        autotyped,
      }
      return this.routes[fileName]!
    }

    // needed for path auto completions
    readDirectory = host.readDirectory
      ? (
          ...args: Parameters<
            NonNullable<ts.LanguageServiceHost["readDirectory"]>
          >
        ) => {
          return host.readDirectory!(...args)
        }
      : undefined
  }

  const autotypeHost = new AutotypeLanguageServiceHost()
  function getRoute(fileName: string) {
    const route =
      autotypeHost.getRouteIfUpToDate(fileName) ??
      autotypeHost.upsertRouteFile(fileName)
    return route
  }

  const languageService = ts.createLanguageService(autotypeHost)
  const result = { languageService, getRoute }
  CACHE.set(info, result)
  return result
}
