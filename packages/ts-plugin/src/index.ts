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
    info.project.projectService.logger.info("[ts-plugin] setup")
    const ls = info.languageService
    decorateGetDefinition(ls, info, ts)
    return ls
  }

  return { create }
}
export = init

// virtual
// ----------------------------------------------------------------------------

type RouteModule = {
  snapshot: ts.IScriptSnapshot
  version: string
  autotyped: AutotypedRoute
}

type VirtualLanguageServiceHost = {
  getAutotypedRoute: (fileName: string) => RouteModule | undefined
}

const FORCE_UPDATE_VERSION = "FORCE_UPDATE_VERSION"

const CACHE = new WeakMap<
  ts.server.PluginCreateInfo,
  {
    languageService: ts.LanguageService
    languageServiceHost: ts.LanguageServiceHost & VirtualLanguageServiceHost
  } | null
>()

function getVirtualLanguageService(info: ts.server.PluginCreateInfo, ts: TS) {
  const cached = CACHE.get(info)
  if (cached) return cached

  const appDirectory = getProjectDirectory(info.project)
  if (!appDirectory) return
  const config: Config = { appDirectory }

  const host = info.languageServiceHost

  class VirtualLanguageServiceHost implements ts.LanguageServiceHost {
    private routes: Record<string, RouteModule> = {}

    constructor() {}

    // TODO: Q: are these needed? do they just "silence" the virtual host?
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
      info.project.projectService.logger.info(
        `[ts-plugin] getScriptFileNames: ${JSON.stringify(names)}`,
      )
      return [...names]
    }

    getScriptVersion(fileName: string) {
      info.project.projectService.logger.info(
        `[ts-plugin] getScriptVersion ${fileName}`,
      )
      const route = this.routes[fileName]
      if (!route) return host.getScriptVersion(fileName)
      return route.version.toString()
    }

    getScriptSnapshot(fileName: string) {
      info.project.projectService.logger.info(
        `[ts-plugin] getScriptSnapshot ${fileName}`,
      )
      const route = this.routes[fileName]
      if (!route) return host.getScriptSnapshot(fileName)
      return route.snapshot
    }

    readFile(fileName: string) {
      info.project.projectService.logger.info(
        `[ts-plugin] readFile ${fileName}`,
      )
      const route = this.routes[fileName]
      return route
        ? route.snapshot.getText(0, route.snapshot.getLength())
        : host.readFile(fileName)
    }

    fileExists(fileName: string) {
      info.project.projectService.logger.info(
        `[ts-plugin] fileExists ${fileName}`,
      )
      return this.routes[fileName] !== undefined || host.fileExists(fileName)
    }

    private _getRouteIfUpToDate(fileName: string) {
      info.project.projectService.logger.info(
        `[ts-plugin] getRouteScriptSnapshotIfUpToDate ${fileName}`,
      )
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

    private _upsertRouteFile(fileName: string) {
      info.project.projectService.logger.info(
        `[ts-plugin] upsertRouteFile ${fileName}`,
      )
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

    getAutotypedRoute(fileName: string) {
      const route =
        this._getRouteIfUpToDate(fileName) ?? this._upsertRouteFile(fileName)
      return route
    }
  }

  const languageServiceHost = new VirtualLanguageServiceHost()
  const languageService = ts.createLanguageService(languageServiceHost)
  CACHE.set(info, { languageService, languageServiceHost })
  return {
    languageService,
    languageServiceHost,
  }
}

// definitions
// ----------------------------------------------------------------------------

function decorateGetDefinition(
  ls: ts.LanguageService,
  info: ts.server.PluginCreateInfo,
  ts: TS,
) {
  info.project.projectService.logger.info(`[ts-plugin] decorateGetDefinition`)
  const getDefinitionAndBoundSpan = ls.getDefinitionAndBoundSpan
  ls.getDefinitionAndBoundSpan = (fileName, position) => {
    const definition = getDefinitionAndBoundSpan(fileName, position)
    if (!definition?.definitions) {
      return getRouteDefinitions(ts, info, fileName, position)
    }
    return definition
  }
}

function getRouteDefinitions(
  ts: TS,
  info: ts.server.PluginCreateInfo,
  fileName: string,
  position: number,
) {
  info.project.projectService.logger.info(
    `[ts-plugin] getRouteDefinitions ${fileName}`,
  )
  const virtual = getVirtualLanguageService(info, ts)
  if (!virtual) return

  const route = virtual.languageServiceHost.getAutotypedRoute(fileName)
  if (!route) return

  const virtualPos = route.autotyped.toSplicedIndex(position)
  const definitions = virtual.languageService.getDefinitionAndBoundSpan(
    fileName,
    virtualPos,
  )
  if (!definitions) return
  // Assumption: This is only called when the original definitions didn't turn up anything.
  // Therefore we are called on things like export function load ({ fetch }) .
  // This means the textSpan needs conversion but none of the definitions because they are all referencing other files.
  return {
    ...definitions,
    textSpan: {
      ...definitions.textSpan,
      start: route.autotyped.toOriginalIndex(definitions.textSpan.start),
    },
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
