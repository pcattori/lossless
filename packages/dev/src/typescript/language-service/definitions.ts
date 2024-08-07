import type ts from "typescript/lib/tsserverlibrary"

import { getAutotypeLanguageService } from "../autotype"
import { type Context } from "../context"

export function decorateGetDefinition(ctx: Context) {
  const ls = ctx.languageService
  const { getDefinitionAndBoundSpan } = ls
  ls.getDefinitionAndBoundSpan = (fileName, index) => {
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
