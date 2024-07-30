// Adapted from https://github.com/sveltejs/language-tools/blob/527c2adb2fc6f13674bcc73cf52b63370dc0c8db/packages/typescript-plugin/src/language-service/sveltekit.ts

import * as path from "node:path"

import type ts from "typescript/lib/tsserverlibrary"

import { type Config } from "@lossless/dev"
import { getAutotypeLanguageService } from "./autotype"

type TS = typeof ts

// plugin
// ----------------------------------------------------------------------------

function init(modules: { typescript: TS }) {
  const ts = modules.typescript

  function create(info: ts.server.PluginCreateInfo) {
    info.project.projectService.logger.info("[@lossless/ts-plugin] setup")

    const config = getConfig(info.project)
    if (!config) return

    const ls = info.languageService
    decorateGetDefinition(config, ls, info, ts)
    decorateHover(config, ls, info, ts)
    decorateSemanticDiagnostics(config, ls, info, ts)
    decorateCompletions(config, ls, info, ts)
    return ls
  }

  return { create }
}
export = init

function getConfig(project: ts.server.Project): Config | undefined {
  const compilerOptions = project.getCompilerOptions()

  if (typeof compilerOptions.configFilePath === "string") {
    return {
      appDirectory: path.dirname(compilerOptions.configFilePath),
    }
  }

  const packageJsonPath = path.join(
    project.getCurrentDirectory(),
    "package.json",
  )
  if (!project.fileExists(packageJsonPath)) return
  return {
    appDirectory: project.getCurrentDirectory(),
  }
}

// completions
// ----------------------------------------------------------------------------

function decorateCompletions(
  config: Config,
  ls: ts.LanguageService,
  info: ts.server.PluginCreateInfo,
  ts: TS,
) {
  const getCompletionsAtPosition = ls.getCompletionsAtPosition
  ls.getCompletionsAtPosition = (fileName, index, options, settings) => {
    info.project.projectService.logger.info(
      "[@lossless/ts-plugin] getCompletionsAtPosition",
    )
    const fallback = () =>
      getCompletionsAtPosition(fileName, index, options, settings)

    const autotype = getAutotypeLanguageService(config, info, ts)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const splicedIndex = route.autotyped.toSplicedIndex(index)
    const completions = autotype.languageService.getCompletionsAtPosition(
      fileName,
      splicedIndex,
      options,
      settings,
    )
    if (!completions) return fallback()
    info.project.projectService.logger.info(
      `[@lossless/ts-plugin] getCompletionsAtPosition: ${JSON.stringify(completions)}`,
    )

    completions.entries = completions.entries.map((c) => {
      if (c.replacementSpan) {
        return {
          ...c,
          replacementSpan: {
            ...c.replacementSpan,
            start: route.autotyped.toOriginalIndex(c.replacementSpan.start),
          },
        }
      }
      return c
    })
    if (completions.optionalReplacementSpan) {
      completions.optionalReplacementSpan = {
        ...completions.optionalReplacementSpan,
        start: route.autotyped.toOriginalIndex(
          completions.optionalReplacementSpan.start,
        ),
      }
    }
    return completions
  }
}

// semantic diagnostics
// ----------------------------------------------------------------------------

function decorateSemanticDiagnostics(
  config: Config,
  ls: ts.LanguageService,
  info: ts.server.PluginCreateInfo,
  ts: TS,
) {
  const getSemanticDiagnostics = ls.getSemanticDiagnostics
  ls.getSemanticDiagnostics = (fileName: string) => {
    const autotype = getAutotypeLanguageService(config, info, ts)
    if (!autotype) return getSemanticDiagnostics(fileName)

    const route = autotype.getRoute(fileName)
    if (!route) {
      info.project.projectService.logger.info(
        `[@lossless/ts-plugin] diagnostics/non-route: ${fileName}`,
      )
      return getSemanticDiagnostics(fileName)
    }
    info.project.projectService.logger.info(
      `[@lossless/ts-plugin] diagnostics/route: ${fileName}`,
    )

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
  config: Config,
  ls: ts.LanguageService,
  info: ts.server.PluginCreateInfo,
  ts: TS,
) {
  const getQuickInfoAtPosition = ls.getQuickInfoAtPosition
  ls.getQuickInfoAtPosition = (fileName: string, index: number) => {
    const autotype = getAutotypeLanguageService(config, info, ts)
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
  config: Config,
  ls: ts.LanguageService,
  info: ts.server.PluginCreateInfo,
  ts: TS,
) {
  const getDefinitionAndBoundSpan = ls.getDefinitionAndBoundSpan
  ls.getDefinitionAndBoundSpan = (fileName, index) => {
    const autotype = getAutotypeLanguageService(config, info, ts)
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
