import type ts from "typescript/lib/tsserverlibrary"

import type { Context } from "./context"
import * as Autotype from "./autotype"
import { getRoutes, routeExports } from "../routes"
import * as AST from "./ast"

export function decorateLanguageService(ctx: Context) {
  function isRoute(fileName: string) {
    const route = getRoutes(ctx.config).get(fileName)
    return route
  }

  const ls = ctx.languageService

  // completions
  // --------------------------------------------------------------------------

  const { getCompletionsAtPosition } = ls
  ls.getCompletionsAtPosition = (fileName, position, ...rest) => {
    const completions = isRoute(fileName)
      ? Autotype.getCompletionsAtPosition(ctx)(fileName, position, ...rest)
      : getCompletionsAtPosition(fileName, position, ...rest)

    if (!isRoute(fileName)) return completions

    const sourceFile = ctx.languageService.getProgram()?.getSourceFile(fileName)
    if (!sourceFile) return completions

    const node = AST.findNodeAtPosition(sourceFile, position)
    if (!node) return completions

    const isTopLevel =
      ctx.ts.isSourceFile(node.parent) ||
      (ctx.ts.isStatement(node.parent) &&
        ctx.ts.isSourceFile(node.parent.parent))
    if (!isTopLevel) return completions

    const { line } = sourceFile.getLineAndCharacterOfPosition(position)
    const lineStart = sourceFile.getPositionOfLineAndCharacter(line, 0)
    const normalizedLine = sourceFile.text
      .slice(lineStart, position)
      .trim()
      .replace(/\s+g/, " ")
    const exports = AST.getExportNames(ctx.ts, sourceFile)

    const routeExportCompletions: ts.CompletionEntry[] = Object.keys(
      routeExports,
    )
      .map((key) => {
        if (exports.has(key)) return null

        const insertText =
          key === "default"
            ? `export default function Component() {}`
            : `export function ${key}() {}`
        if (!fzf(normalizedLine, insertText)) return null

        const completion: ts.CompletionEntry = {
          name: key,
          insertText,
          kind: ctx.ts.ScriptElementKind.functionElement,
          kindModifiers: ctx.ts.ScriptElementKindModifier.exportedModifier,
          sortText: "0",
          labelDetails: {
            description: "React Router Export",
          },
          data: {
            exportName: key, // TS needs this
            __reactRouter: key,
          } as any,
        }

        return {
          ...completion,
          replacementSpan: { start: lineStart, length: position - lineStart },
        }
      })
      .filter((x) => x !== null)

    if (!completions) {
      return routeExportCompletions.length > 0
        ? {
            isGlobalCompletion: false,
            isMemberCompletion: false,
            isNewIdentifierLocation: false,
            isIncomplete: true,
            entries: routeExportCompletions,
          }
        : undefined
    }

    return routeExportCompletions.length > 0
      ? {
          ...completions,
          entries: [...routeExportCompletions, ...completions.entries],
        }
      : completions
  }

  const { getCompletionEntryDetails } = ls
  ls.getCompletionEntryDetails = (...args) => {
    const data = args[6] as { __reactRouter?: string }
    if (data.__reactRouter) {
      const key = data.__reactRouter
      return {
        name: key,
        kind: ctx.ts.ScriptElementKind.functionElement,
        kindModifiers: ctx.ts.ScriptElementKindModifier.exportedModifier,
        documentation: routeExports[key]?.documentation ?? [],
        displayParts: [],
      }
    }
    return isRoute(args[0])
      ? Autotype.getCompletionEntryDetails(ctx)(...args)
      : getCompletionEntryDetails(...args)
  }

  const { getSignatureHelpItems } = ls
  ls.getSignatureHelpItems = (...args) =>
    isRoute(args[0])
      ? Autotype.getSignatureHelpItems(ctx)(...args)
      : getSignatureHelpItems(...args)

  // definitions
  // --------------------------------------------------------------------------

  const { getDefinitionAndBoundSpan } = ls
  ls.getDefinitionAndBoundSpan = (...args) =>
    isRoute(args[0])
      ? Autotype.getDefinitionAndBoundSpan(ctx)(...args)
      : getDefinitionAndBoundSpan(...args)

  const { getTypeDefinitionAtPosition } = ls
  ls.getTypeDefinitionAtPosition = (...args) =>
    isRoute(args[0])
      ? Autotype.getTypeDefinitionAtPosition(ctx)(...args)
      : getTypeDefinitionAtPosition(...args)

  // diagnostics
  // --------------------------------------------------------------------------

  const { getSyntacticDiagnostics } = ls
  ls.getSyntacticDiagnostics = (...args) =>
    isRoute(args[0])
      ? Autotype.getSyntacticDiagnostics(ctx)(...args)
      : getSyntacticDiagnostics(...args)

  const { getSemanticDiagnostics } = ls
  ls.getSemanticDiagnostics = (...args) =>
    isRoute(args[0])
      ? Autotype.getSemanticDiagnostics(ctx)(...args)
      : getSemanticDiagnostics(...args)

  const { getSuggestionDiagnostics } = ls
  ls.getSuggestionDiagnostics = (...args) =>
    isRoute(args[0])
      ? Autotype.getSuggestionDiagnostics(ctx)(...args)
      : getSuggestionDiagnostics(...args)

  // diagnostics
  // --------------------------------------------------------------------------

  const { getQuickInfoAtPosition } = ls
  ls.getQuickInfoAtPosition = (fileName, position) => {
    const quickinfo = isRoute(fileName)
      ? Autotype.getQuickInfoAtPosition(ctx)(fileName, position)
      : getQuickInfoAtPosition(fileName, position)
    if (!quickinfo) return

    const route = getRoutes(ctx.config).get(fileName)
    if (!route) return quickinfo

    const sourceFile = ctx.languageService.getProgram()?.getSourceFile(fileName)
    const node = sourceFile && AST.findNodeAtPosition(sourceFile, position)
    const exportName = node && AST.getRouteExportName(ctx, node)
    const routeExportDocs = exportName
      ? routeExports[exportName]?.documentation
      : undefined

    const documentation: ts.SymbolDisplayPart[] = [
      ...(quickinfo.documentation ?? []),
      ...(routeExportDocs ?? []),
    ]

    return {
      ...quickinfo,
      documentation: documentation.length > 0 ? documentation : undefined,
    }
  }

  // inlay hints
  // --------------------------------------------------------------------------

  const { provideInlayHints } = ls
  ls.provideInlayHints = (...args) =>
    isRoute(args[0])
      ? Autotype.provideInlayHints(ctx)(...args)
      : provideInlayHints(...args)
}

function fzf(pattern: string, target: string): boolean {
  let patternIndex = 0
  let targetIndex = 0

  while (patternIndex < pattern.length && targetIndex < target.length) {
    if (
      pattern[patternIndex]?.toLowerCase() ===
      target[targetIndex]?.toLowerCase()
    ) {
      patternIndex += 1
    }
    targetIndex += 1
  }
  return patternIndex === pattern.length
}
