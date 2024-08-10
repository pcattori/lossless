import type ts from "typescript/lib/tsserverlibrary"

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
