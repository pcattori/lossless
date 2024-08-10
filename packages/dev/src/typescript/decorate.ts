import type ts from "typescript/lib/tsserverlibrary"

import type { Context } from "./context"
import * as Autotype from "./autotype"
import { getRoutes, routeExports } from "../routes"
import { findNodeAtPosition } from "./ast"

export function decorateLanguageService(ctx: Context) {
  const ls = ctx.languageService

  // completions
  // --------------------------------------------------------------------------

  const { getCompletionsAtPosition } = ls
  ls.getCompletionsAtPosition = (...args) => {
    return (
      Autotype.getCompletionsAtPosition(ctx)(...args) ??
      getCompletionsAtPosition(...args)
    )
  }

  const { getCompletionEntryDetails } = ls
  ls.getCompletionEntryDetails = (...args) => {
    return (
      Autotype.getCompletionEntryDetails(ctx)(...args) ??
      getCompletionEntryDetails(...args)
    )
  }

  const { getSignatureHelpItems } = ls
  ls.getSignatureHelpItems = (...args) => {
    return (
      Autotype.getSignatureHelpItems(ctx)(...args) ??
      getSignatureHelpItems(...args)
    )
  }

  // definitions
  // --------------------------------------------------------------------------

  const { getDefinitionAndBoundSpan } = ls
  ls.getDefinitionAndBoundSpan = (...args) => {
    return (
      Autotype.getDefinitionAndBoundSpan(ctx)(...args) ??
      getDefinitionAndBoundSpan(...args)
    )
  }

  const { getTypeDefinitionAtPosition } = ls
  ls.getTypeDefinitionAtPosition = (...args) => {
    return (
      Autotype.getTypeDefinitionAtPosition(ctx)(...args) ??
      getTypeDefinitionAtPosition(...args)
    )
  }

  // diagnostics
  // --------------------------------------------------------------------------

  const { getSyntacticDiagnostics } = ls
  ls.getSyntacticDiagnostics = (...args) => {
    return (
      Autotype.getSyntacticDiagnostics(ctx)(...args) ??
      getSyntacticDiagnostics(...args)
    )
  }

  const { getSemanticDiagnostics } = ls
  ls.getSemanticDiagnostics = (...args) => {
    return (
      Autotype.getSemanticDiagnostics(ctx)(...args) ??
      getSemanticDiagnostics(...args)
    )
  }

  const { getSuggestionDiagnostics } = ls
  ls.getSuggestionDiagnostics = (...args) => {
    return (
      Autotype.getSuggestionDiagnostics(ctx)(...args) ??
      getSuggestionDiagnostics(...args)
    )
  }

  // diagnostics
  // --------------------------------------------------------------------------

  const { getQuickInfoAtPosition } = ls
  ls.getQuickInfoAtPosition = (fileName, position) => {
    const quickinfo =
      Autotype.getQuickInfoAtPosition(ctx)(fileName, position) ??
      getQuickInfoAtPosition(fileName, position)
    if (!quickinfo) return

    const jsdoc = getJsdoc(ctx, fileName, position)

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
  ls.provideInlayHints = (...args) => {
    return (
      Autotype.provideInlayHints(ctx)(...args) ?? provideInlayHints(...args)
    )
  }
}

function getJsdoc(
  ctx: Context,
  fileName: string,
  position: number,
): ts.SymbolDisplayPart | undefined {
  const route = getRoutes(ctx.config).get(fileName)
  if (!route) return

  const sourceFile = ctx.languageService.getProgram()?.getSourceFile(fileName)
  const node = sourceFile && findNodeAtPosition(sourceFile, position)
  if (!node) return
  const exportName = getExportName(ctx, node)
  if (!exportName) return
  const jsdoc = routeExports[exportName]?.jsdoc
  if (!jsdoc) return
  return {
    kind: "text",
    text: "\n\n" + jsdoc,
  }
}

function getExportName(ctx: Context, node: ts.Node) {
  if (node.kind === ctx.ts.SyntaxKind.DefaultKeyword) {
    return "default"
  }
  if (node.kind === ctx.ts.SyntaxKind.FunctionKeyword) {
    return getExportName(ctx, node.parent)
  }

  if (ctx.ts.isIdentifier(node)) {
    return getExportName(ctx, node.parent)
  }

  if (ctx.ts.isExportAssignment(node)) {
    if (node.isExportEquals) return
    if (!ctx.ts.isArrowFunction(node.expression)) return
    return "default"
  }

  if (ctx.ts.isFunctionDeclaration(node)) {
    const exported = node.modifiers?.find(
      (m) => m.kind === ctx.ts.SyntaxKind.ExportKeyword,
    )
    if (!exported) return
    const defaulted = node.modifiers?.find(
      (m) => m.kind === ctx.ts.SyntaxKind.DefaultKeyword,
    )
    if (defaulted) return "default"
    return node.name?.text
  }
  if (ctx.ts.isVariableDeclaration(node)) {
    const varDeclList = node.parent
    if (!ctx.ts.isVariableDeclarationList(varDeclList)) return
    const varStmt = varDeclList.parent
    if (!ctx.ts.isVariableStatement(varStmt)) return
    const exported = varStmt.modifiers?.find(
      (m) => m.kind === ctx.ts.SyntaxKind.ExportKeyword,
    )
    if (!exported) return
    if (!ctx.ts.isIdentifier(node.name)) return
    return node.name.text
  }
}
