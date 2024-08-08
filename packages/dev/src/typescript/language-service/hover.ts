import type ts from "typescript/lib/tsserverlibrary"

import {
  getAutotypeLanguageService,
  type AutotypeLanguageService,
} from "../autotype"
import { type Context } from "../context"
import { routeExports } from "../../routes"

export function decorateHover(ctx: Context) {
  const ls = ctx.languageService
  const { getQuickInfoAtPosition } = ls
  ls.getQuickInfoAtPosition = (fileName: string, index: number) => {
    const fallback = () => getQuickInfoAtPosition(fileName, index)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const splicedIndex = route.autotyped.toSplicedIndex(index)

    const quickinfo = autotype.getQuickInfoAtPosition(fileName, splicedIndex)
    if (!quickinfo) return

    const jsdoc = getJsdoc(ctx, autotype, fileName, splicedIndex)
    const documentation: ts.SymbolDisplayPart[] = [
      ...(quickinfo.documentation ?? []),
      ...(jsdoc ? [jsdoc] : []),
    ]

    return {
      ...quickinfo,
      documentation: documentation.length > 0 ? documentation : undefined,
      textSpan: {
        ...quickinfo.textSpan,
        start: route.autotyped.toOriginalIndex(quickinfo.textSpan.start).index,
      },
    }
  }
}

function getJsdoc(
  ctx: Context,
  autotype: AutotypeLanguageService,
  fileName: string,
  splicedIndex: number,
): ts.SymbolDisplayPart | undefined {
  const sourceFile = autotype.getProgram()?.getSourceFile(fileName)
  const node = sourceFile && findNodeAtPosition(sourceFile, splicedIndex)
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
