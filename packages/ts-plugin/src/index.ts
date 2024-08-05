// Adapted from https://github.com/sveltejs/language-tools/blob/527c2adb2fc6f13674bcc73cf52b63370dc0c8db/packages/typescript-plugin/src/language-service/sveltekit.ts

import * as path from "node:path"

import type ts from "typescript/lib/tsserverlibrary"

import { typegenWatch, type Config } from "@lossless/dev"
import { getAutotypeLanguageService } from "./autotype"
import type { Context } from "./context"

type TS = typeof ts

// plugin
// ----------------------------------------------------------------------------

function init(modules: { typescript: TS }) {
  const ts = modules.typescript

  function create(info: ts.server.PluginCreateInfo) {
    info.project.projectService.logger.info("[@lossless/ts-plugin] setup")

    const config = getConfig(info.project)
    if (!config) return
    typegenWatch(config, (msg) => {
      info.project.projectService.logger.info("[@lossless/ts-plugin] " + msg)
    })

    const ls = info.languageService
    const { logger } = info.project.projectService
    const ctx: Context = { config, ls, info, ts, logger }

    decorateGetDefinition(ctx)
    decorateHover(ctx)
    decorateDiagnostics(ctx)
    decorateCompletions(ctx)
    decorateInlayHints(ctx)
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

function decorateCompletions(ctx: Context) {
  const { getCompletionsAtPosition } = ctx.ls
  ctx.ls.getCompletionsAtPosition = (fileName, index, options, settings) => {
    const fallback = () =>
      getCompletionsAtPosition(fileName, index, options, settings)

    const autotype = getAutotypeLanguageService(ctx)
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

    completions.entries = completions.entries.map((c) => {
      if (c.replacementSpan) {
        return {
          ...c,
          replacementSpan: {
            ...c.replacementSpan,
            start: route.autotyped.toOriginalIndex(c.replacementSpan.start)
              .index,
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
        ).index,
      }
    }
    return completions
  }

  const { getCompletionEntryDetails } = ctx.ls
  ctx.ls.getCompletionEntryDetails = (
    fileName,
    position,
    entryName,
    formatOptions,
    source,
    preferences,
    data,
  ) => {
    const fallback = () =>
      getCompletionEntryDetails(
        fileName,
        position,
        entryName,
        formatOptions,
        source,
        preferences,
        data,
      )

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const details = autotype.languageService.getCompletionEntryDetails(
      fileName,
      route.autotyped.toSplicedIndex(position),
      entryName,
      formatOptions,
      source,
      preferences,
      data,
    )
    if (!details) return fallback()

    details.codeActions = details.codeActions?.map((codeAction) => {
      codeAction.changes = codeAction.changes.map((change) => {
        change.textChanges = change.textChanges.map((textChange) => {
          return {
            ...textChange,
            span: {
              ...textChange.span,
              start: route.autotyped.toOriginalIndex(textChange.span.start)
                .index,
            },
          }
        })
        return change
      })
      return codeAction
    })
    return details
  }

  const { getSignatureHelpItems } = ctx.ls
  ctx.ls.getSignatureHelpItems = (fileName, position, options) => {
    const fallback = () => getSignatureHelpItems(fileName, position, options)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    return autotype.languageService.getSignatureHelpItems(
      fileName,
      route.autotyped.toSplicedIndex(position),
      options,
    )
  }
}

// diagnostics
// ----------------------------------------------------------------------------

function decorateDiagnostics(ctx: Context) {
  const { getSyntacticDiagnostics } = ctx.ls
  ctx.ls.getSyntacticDiagnostics = (fileName: string) => {
    return (
      getRouteDiagnostics(ctx, "getSyntacticDiagnostics", fileName) ??
      getSyntacticDiagnostics(fileName)
    )
  }

  const { getSemanticDiagnostics } = ctx.ls
  ctx.ls.getSemanticDiagnostics = (fileName: string) => {
    return (
      getRouteDiagnostics(ctx, "getSemanticDiagnostics", fileName) ??
      getSemanticDiagnostics(fileName)
    )
  }

  const { getSuggestionDiagnostics } = ctx.ls
  ctx.ls.getSuggestionDiagnostics = (fileName: string) => {
    return (
      getRouteDiagnostics(ctx, "getSuggestionDiagnostics", fileName) ??
      getSuggestionDiagnostics(fileName)
    )
  }
}

function getRouteDiagnostics<
  T extends
    | "getSemanticDiagnostics"
    | "getSuggestionDiagnostics"
    | "getSyntacticDiagnostics",
>(
  ctx: Context,
  methodName: T,
  fileName: string,
): ReturnType<ts.LanguageService[T]> | undefined {
  const autotype = getAutotypeLanguageService(ctx)
  if (!autotype) return

  const route = autotype.getRoute(fileName)
  if (!route) return

  const diagnostics: ts.Diagnostic[] = []
  for (let diagnostic of autotype.languageService[methodName](fileName)) {
    let start = diagnostic.start
    let length = diagnostic.length

    if (start) {
      const { index, exportName } = route.autotyped.toOriginalIndex(start)
      start = exportName?.start ?? index
      length = exportName?.length ?? length
    }
    diagnostics.push({ ...diagnostic, start, length })
  }
  // @ts-expect-error
  return diagnostics
}

// hover
// ----------------------------------------------------------------------------

function decorateHover(ctx: Context) {
  const { getQuickInfoAtPosition } = ctx.ls
  ctx.ls.getQuickInfoAtPosition = (fileName: string, index: number) => {
    const fallback = () => getQuickInfoAtPosition(fileName, index)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const splicedIndex = route.autotyped.toSplicedIndex(index)
    const quickinfo = autotype.languageService.getQuickInfoAtPosition(
      fileName,
      splicedIndex,
    )
    if (!quickinfo) return fallback()
    return {
      ...quickinfo,
      textSpan: {
        ...quickinfo.textSpan,
        start: route.autotyped.toOriginalIndex(quickinfo.textSpan.start).index,
      },
    }
  }
}

// definitions
// ----------------------------------------------------------------------------

function decorateGetDefinition(ctx: Context) {
  const { getDefinitionAndBoundSpan } = ctx.ls
  ctx.ls.getDefinitionAndBoundSpan = (fileName, index) => {
    const fallback = () => getDefinitionAndBoundSpan(fileName, index)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const splicedIndex = route.autotyped.toSplicedIndex(index)
    const result = autotype.languageService.getDefinitionAndBoundSpan(
      fileName,
      splicedIndex,
    )
    if (!result) return fallback()

    return {
      ...result,
      definitions: result.definitions?.map((definition) => {
        const definitionRoute = autotype.getRoute(definition.fileName)
        if (!definitionRoute) return definition
        return {
          ...definition,
          textSpan: {
            ...definition.textSpan,
            start: definitionRoute.autotyped.toOriginalIndex(
              definition.textSpan.start,
            ).index,
          },
        }
      }),
      textSpan: {
        ...result.textSpan,
        start: route.autotyped.toOriginalIndex(result.textSpan.start).index,
      },
    }
  }
}

// inlay hints
// ----------------------------------------------------------------------------

function decorateInlayHints(ctx: Context): void {
  const { provideInlayHints } = ctx.ls
  ctx.ls.provideInlayHints = (fileName, span, preferences) => {
    const fallback = () => provideInlayHints(fileName, span, preferences)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const start = route.autotyped.toSplicedIndex(span.start)
    return autotype.languageService
      .provideInlayHints(
        fileName,
        {
          start,
          length:
            route.autotyped.toSplicedIndex(span.start + span.length) - start,
        },
        preferences,
      )
      .map((hint) => ({
        ...hint,
        position: route.autotyped.toOriginalIndex(hint.position).index,
      }))
  }
}
