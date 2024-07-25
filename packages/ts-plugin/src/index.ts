// Adapted from https://github.com/sveltejs/language-tools/blob/527c2adb2fc6f13674bcc73cf52b63370dc0c8db/packages/typescript-plugin/src/language-service/sveltekit.ts

import type ts from "typescript/lib/tsserverlibrary"
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

type RouteSnapshot = {
  file: ts.IScriptSnapshot
  version: string
}

type VirtualLanguageServiceHost = {
  getRouteScriptSnapshotIfUpToDate: (
    fileName: string,
  ) => RouteSnapshot | undefined
  upsertRouteFile: (fileName: string) => void
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

  const host = info.languageServiceHost

  class VirtualLanguageServiceHost implements ts.LanguageServiceHost {
    private files: Record<string, RouteSnapshot> = {}

    constructor() {}

    // TODO: Q: are these needed? do they just "silence" the virtual host?
    // log() {}
    // trace() {}
    // error() {}

    getCompilationSettings = host.getCompilationSettings
    getCurrentDirectory = host.getCurrentDirectory
    getDefaultLibFileName = host.getDefaultLibFileName

    getScriptFileNames(): string[] {
      const names: Set<string> = new Set(Object.keys(this.files))
      const files = host.getScriptFileNames()
      for (const file of files) {
        names.add(file)
      }
      return [...names]
    }

    getScriptVersion(fileName: string) {
      const file = this.files[fileName]
      if (!file) return host.getScriptVersion(fileName)
      return file.version.toString()
    }

    getScriptSnapshot(fileName: string) {
      const file = this.files[fileName]
      if (!file) return host.getScriptSnapshot(fileName)
      return file.file
    }

    readFile(fileName: string) {
      const file = this.files[fileName]
      return file
        ? file.file.getText(0, file.file.getLength())
        : host.readFile(fileName)
    }

    fileExists(fileName: string) {
      return this.files[fileName] !== undefined || host.fileExists(fileName)
    }

    getRouteScriptSnapshotIfUpToDate(fileName: string) {
      const scriptVersion = this.getScriptVersion(fileName)
      if (
        !this.files[fileName] ||
        scriptVersion !== host.getScriptVersion(fileName) ||
        scriptVersion === FORCE_UPDATE_VERSION
      ) {
        return undefined
      }
      return this.files[fileName]
    }
    upsertRouteFile(fileName: string) {
      const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName)
      if (!sourceFile) return

      const { text } = sourceFile
      const snap = ts.ScriptSnapshot.fromString(text)
      snap.getChangeRange = (_) => undefined

      this.files[fileName] = {
        version:
          this.files[fileName] === undefined
            ? FORCE_UPDATE_VERSION
            : host.getScriptVersion(fileName),
        file: snap,
      }
      return this.files[fileName]
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

function getVirtualLS(
  virtual: {
    languageService: ts.LanguageService
    languageServiceHost: VirtualLanguageServiceHost
  },
  fileName: string,
) {
  const result =
    virtual.languageServiceHost.getRouteScriptSnapshotIfUpToDate(fileName) ??
    virtual.languageServiceHost.upsertRouteFile(fileName)

  if (!result) return

  return {
    toVirtualPos: (pos: number) => pos, // TODO
    toOriginalPos: (pos: number) => pos, // TODO
  }
}

// definitions
// ----------------------------------------------------------------------------

function getRouteDefinitions(
  ts: TS,
  info: ts.server.PluginCreateInfo,
  fileName: string,
  position: number,
) {
  const virtual = getVirtualLanguageService(info, ts)
  const result = getVirtualLS(virtual, fileName)
  if (!result) return
  const { toOriginalPos, toVirtualPos } = result
  const virtualPos = toVirtualPos(position)
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
      start: toOriginalPos(definitions.textSpan.start),
    },
  }
}
