import type ts from "typescript/lib/tsserverlibrary"
import type { Context } from "./context"

export function findNodeAtPosition(
  node: ts.Node,
  pos: number,
): ts.Node | undefined {
  if (pos < node.getStart() || node.getEnd() < pos) return
  for (const child of node.getChildren()) {
    if (pos < child.getStart()) break
    if (pos > child.getEnd()) continue

    const found = findNodeAtPosition(child, pos)
    if (found) return found

    return child
  }
  return node
}

export function getRouteExportName(ctx: Context, node: ts.Node) {
  if (node.kind === ctx.ts.SyntaxKind.DefaultKeyword) {
    return "default"
  }
  if (node.kind === ctx.ts.SyntaxKind.FunctionKeyword) {
    return getRouteExportName(ctx, node.parent)
  }

  if (ctx.ts.isIdentifier(node)) {
    return getRouteExportName(ctx, node.parent)
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
