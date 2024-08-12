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
  ls.getCompletionsAtPosition = (...args) =>
    isRoute(args[0])
      ? Autotype.getCompletionsAtPosition(ctx)(...args)
      : getCompletionsAtPosition(...args)

  const { getCompletionEntryDetails } = ls
  ls.getCompletionEntryDetails = (...args) =>
    isRoute(args[0])
      ? Autotype.getCompletionEntryDetails(ctx)(...args)
      : getCompletionEntryDetails(...args)

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
    const quickinfo =
      Autotype.getQuickInfoAtPosition(ctx)(fileName, position) ??
      getQuickInfoAtPosition(fileName, position)
    if (!quickinfo) return

    const route = getRoutes(ctx.config).get(fileName)
    if (!route) return quickinfo

    const sourceFile = ctx.languageService.getProgram()?.getSourceFile(fileName)
    const node = sourceFile && AST.findNodeAtPosition(sourceFile, position)
    const exportName = node && AST.getRouteExportName(ctx, node)
    const jsdoc = exportName ? routeExports[exportName]?.jsdoc : undefined

    const documentation: ts.SymbolDisplayPart[] = [
      ...(quickinfo.documentation ?? []),
      ...(jsdoc ? [jsdoc] : []),
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
