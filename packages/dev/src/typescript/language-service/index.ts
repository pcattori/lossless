// Adapted from https://github.com/sveltejs/language-tools/tree/master/packages/typescript-plugin/src/language-service

import type ts from "typescript/lib/tsserverlibrary"

import { getAutotypeLanguageService } from "../autotype"
import { type Context } from "../context"

export function decorateLanguageService(ctx: Context) {
  decorateCompletions(ctx)
  decorateDiagnostics(ctx)
  decorateHover(ctx)
  decorateGetDefinition(ctx)
  decorateInlayHints(ctx)
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

    const exportTypeDefinitions = getRouteExportTypeDefinitions(
      ctx,
      autotype.languageService,
      fileName,
      splicedIndex,
    )

    const result = autotype.languageService.getDefinitionAndBoundSpan(
      fileName,
      splicedIndex,
    )
    if (!result) return exportTypeDefinitions ?? fallback()

    let definitions = result.definitions?.map((definition) => {
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
    })
    definitions = [
      ...(definitions ?? []),
      ...(exportTypeDefinitions?.definitions ?? []),
    ]

    return {
      definitions: definitions?.length > 0 ? definitions : undefined,
      textSpan: {
        ...result.textSpan,
        start: route.autotyped.toOriginalIndex(result.textSpan.start).index,
      },
    }
  }
}

function getRouteExportTypeDefinitions(
  ctx: Context,
  autotype: ts.LanguageService,
  fileName: string,
  splicedIndex: number,
) {
  const autotypeSourceFile = autotype.getProgram()?.getSourceFile(fileName)
  if (!autotypeSourceFile) return
  const node = findNodeAtPosition(autotypeSourceFile, splicedIndex)
  if (!node) return

  const type =
    getRouteDefaultExportTypeDefinitions(ctx, node) ??
    getRouteNamedExportTypeDefinitions(ctx, node)

  if (!type) return
  return autotype.getDefinitionAndBoundSpan(fileName, type.getStart())
}

function getRouteDefaultExportTypeDefinitions(ctx: Context, node: ts.Node) {
  if (node.kind !== ctx.ts.SyntaxKind.DefaultKeyword) return

  const { parent } = node
  if (!ctx.ts.isExportAssignment(parent)) return

  const { expression } = parent
  if (!ctx.ts.isSatisfiesExpression(expression)) return

  const { type } = expression
  if (!ctx.ts.isTypeReferenceNode(type)) return

  const { typeName } = type
  if (!ctx.ts.isQualifiedName(typeName)) return

  return typeName.right
}

function getRouteNamedExportTypeDefinitions(ctx: Context, node: ts.Node) {
  if (!ctx.ts.isIdentifier(node)) return

  if (ctx.ts.isVariableDeclaration(node.parent)) {
    const varDecl = node.parent

    const varDeclList = varDecl.parent
    if (!ctx.ts.isVariableDeclarationList(varDeclList)) return

    const varStmt = varDeclList.parent
    if (!ctx.ts.isVariableStatement(varStmt)) return

    const exported = varStmt.modifiers?.find(
      (m) => m.kind === ctx.ts.SyntaxKind.ExportKeyword,
    )
    if (!exported) return

    const { initializer } = varDecl
    if (!initializer) return
    if (!ctx.ts.isSatisfiesExpression(initializer)) return

    const { type } = initializer
    if (!ctx.ts.isTypeReferenceNode(type)) return

    const { typeName } = type
    if (!ctx.ts.isQualifiedName(typeName)) return
    return typeName.right
  }

  if (ctx.ts.isFunctionExpression(node.parent)) {
    const fnExpr = node.parent

    const parenExpr = fnExpr.parent
    if (!ctx.ts.isParenthesizedExpression(parenExpr)) return

    const satisfiesExpr = parenExpr.parent
    if (!ctx.ts.isSatisfiesExpression(satisfiesExpr)) return

    const varDecl = satisfiesExpr.parent
    if (!ctx.ts.isVariableDeclaration(varDecl)) return

    const varDeclList = varDecl.parent
    if (!ctx.ts.isVariableDeclarationList(varDeclList)) return

    const varStmt = varDeclList.parent
    if (!ctx.ts.isVariableStatement(varStmt)) return

    const exported = varStmt.modifiers?.find(
      (m) => m.kind === ctx.ts.SyntaxKind.ExportKeyword,
    )
    if (!exported) return

    const { type } = satisfiesExpr
    if (!ctx.ts.isTypeReferenceNode(type)) return

    const { typeName } = type
    if (!ctx.ts.isQualifiedName(typeName)) return
    return typeName.right
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

// utils
// ----------------------------------------------------------------------------

function findNodeAtPosition(node: ts.Node, pos: number): ts.Node | undefined {
  if (pos < node.getStart() || node.getEnd() < pos) return
  for (const child of node.getChildren()) {
    if (pos < child.getStart()) return
    if (pos > child.getEnd()) continue

    const found = findNodeAtPosition(child, pos)
    if (found) return found

    return child
  }
  return node
}
