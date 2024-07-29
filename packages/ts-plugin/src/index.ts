// Adapted from https://github.com/sveltejs/language-tools/blob/527c2adb2fc6f13674bcc73cf52b63370dc0c8db/packages/typescript-plugin/src/language-service/sveltekit.ts
import * as path from "node:path"

import type ts from "typescript/lib/tsserverlibrary"

import { autotypeRoute, type AutotypedRoute, type Config } from "@lossless/dev"

type TS = typeof ts

// plugin
// ----------------------------------------------------------------------------

function init(modules: { typescript: TS }) {
  const ts = modules.typescript

  function create(info: ts.server.PluginCreateInfo) {
    info.project.projectService.logger.info("[@lossless/ts-plugin] setup")
    const ls = info.languageService
    decorateGetDefinition(ls, info, ts)
    decorateHover(ls, info, ts)
    decorateSemanticDiagnostics(ls, info, ts)
    return ls
  }

  return { create }
}
export = init

// autotype
// ----------------------------------------------------------------------------

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

function getAutotypeLanguageService(info: ts.server.PluginCreateInfo, ts: TS) {
  const cached = CACHE.get(info)
  if (cached) return cached

  const appDirectory = getProjectDirectory(info.project)
  if (!appDirectory) return
  const config: Config = { appDirectory }

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
      const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName)
      if (!sourceFile) return

      const { text: code } = sourceFile
      const autotyped = autotypeRoute(config, fileName, code)
      const snapshot = ts.ScriptSnapshot.fromString(autotyped.code())
      snapshot.getChangeRange = (_) => undefined

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

// semantic diagnostics
// ----------------------------------------------------------------------------

function decorateSemanticDiagnostics(
  ls: ts.LanguageService,
  info: ts.server.PluginCreateInfo,
  ts: TS,
) {
  const getSemanticDiagnostics = ls.getSemanticDiagnostics
  ls.getSemanticDiagnostics = (fileName: string) => {
    const autotype = getAutotypeLanguageService(info, ts)
    if (!autotype) return getSemanticDiagnostics(fileName)

    const route = autotype.getRoute(fileName)
    if (!route) return getSemanticDiagnostics(fileName)

    const diagnostics: ts.Diagnostic[] = []
    for (let diagnostic of autotype.languageService.getSemanticDiagnostics(
      fileName,
    )) {
      let start = diagnostic.start
      if (start) {
        start = route.autotyped.toOriginalIndex(start)
      }
      diagnostics.push({ ...diagnostic, start })
    }
    return diagnostics
  }
}

// hover
// ----------------------------------------------------------------------------

function decorateHover(
  ls: ts.LanguageService,
  info: ts.server.PluginCreateInfo,
  ts: TS,
) {
  const getQuickInfoAtPosition = ls.getQuickInfoAtPosition
  ls.getQuickInfoAtPosition = (fileName: string, index: number) => {
    const autotype = getAutotypeLanguageService(info, ts)
    if (!autotype) return getQuickInfoAtPosition(fileName, index)

    const route = autotype.getRoute(fileName)
    if (!route) return getQuickInfoAtPosition(fileName, index)

    const splicedIndex = route.autotyped.toSplicedIndex(index)
    const quickinfo = autotype.languageService.getQuickInfoAtPosition(
      fileName,
      splicedIndex,
    )
    if (!quickinfo) return getQuickInfoAtPosition(fileName, index)
    return {
      ...quickinfo,
      textSpan: {
        ...quickinfo.textSpan,
        start: route.autotyped.toOriginalIndex(quickinfo.textSpan.start),
      },
    }
  }
}

// definitions
// ----------------------------------------------------------------------------

function decorateGetDefinition(
  ls: ts.LanguageService,
  info: ts.server.PluginCreateInfo,
  ts: TS,
) {
  const getDefinitionAndBoundSpan = ls.getDefinitionAndBoundSpan
  ls.getDefinitionAndBoundSpan = (fileName, index) => {
    const autotype = getAutotypeLanguageService(info, ts)
    if (!autotype) return getDefinitionAndBoundSpan(fileName, index)

    const route = autotype.getRoute(fileName)
    if (!route) return getDefinitionAndBoundSpan(fileName, index)

    const splicedIndex = route.autotyped.toSplicedIndex(index)
    const definitions = autotype.languageService.getDefinitionAndBoundSpan(
      fileName,
      splicedIndex,
    )
    if (!definitions) return getDefinitionAndBoundSpan(fileName, index)
    return {
      ...definitions,
      textSpan: {
        ...definitions.textSpan,
        start: route.autotyped.toOriginalIndex(definitions.textSpan.start),
      },
    }
  }
}

function getProjectDirectory(project: ts.server.Project) {
  const compilerOptions = project.getCompilerOptions()

  if (typeof compilerOptions.configFilePath === "string") {
    return path.dirname(compilerOptions.configFilePath)
  }

  const packageJsonPath = path.join(
    project.getCurrentDirectory(),
    "package.json",
  )
  return project.fileExists(packageJsonPath)
    ? project.getCurrentDirectory()
    : undefined
}
