import ts from "typescript"

type Addition = [number, string]

type Code = {
  original: string
  additions: Addition[]
}

export function toAugmented(code: Code): string {
  let chars = Array.from(code.original)

  // iterate over additions in reverse so that splicing doesn't mess up other indices
  for (let [index, addition] of reverse(code.additions)) {
    chars.splice(index, 0, addition)
  }
  return chars.join("")
}

export function toVirtualIndex(code: Code, originalIndex: number): number {
  let virtualOffset = 0
  for (let [index, addition] of code.additions) {
    if (index > originalIndex) break
    virtualOffset += addition.length
  }
  return originalIndex + virtualOffset
}

export function toOriginalIndex(code: Code, virtualIndex: number): number {
  let originalIndex = virtualIndex
  let virtualOffset = 0
  for (let [index, addition] of code.additions) {
    // before this addition
    if (virtualIndex < index + virtualOffset) break

    // within this addition
    if (virtualIndex < index + virtualOffset + addition.length) return index

    // after this addition
    originalIndex -= addition.length
    virtualOffset += addition.length
  }
  return Math.max(0, originalIndex)
}

function* reverse<T>(array: T[]): Generator<T> {
  let i = array.length - 1
  while (i >= 0) {
    yield array[i]!
    i--
  }
}

const EXPORT_TO_TYPE: Record<string, string | undefined> = {
  serverLoader: "T.ServerLoader",
  clientLoader: "T.ClientLoader",
  // TODO: clientLoaderHydrate
  HydrateFallback: "T.HydrateFallback",
}

export function augment(filepath: string, content: string): Code {
  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true,
  )

  let additions: Addition[] = []

  sourceFile.statements.forEach((stmt) => {
    if (ts.isExportAssignment(stmt)) {
      // export default |>(<|() => {}|>)satisfies <type><|
      if (stmt.isExportEquals === true) {
        throw Error(`Unexpected 'export  =' in '${filepath}'`)
      }
      additions.push([stmt.expression.getStart(sourceFile), "("])
      additions.push([stmt.expression.getEnd(), ") satisfies T.Component"])
    } else if (ts.isVariableStatement(stmt)) {
      // export const loader = |>(<|() => {}|>)satisfies <type><|
      if (!exported(stmt)) return
      for (let decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        if (decl.initializer === undefined) continue
        let type = EXPORT_TO_TYPE[decl.name.text]
        if (!type) continue
        additions.push([decl.initializer.getStart(sourceFile), "("])
        additions.push([decl.initializer.getEnd(), `) satisfies ${type}`])
      }
    } else if (ts.isFunctionDeclaration(stmt)) {
      // export |>const loader = (<|function loader() {}|>) satisfies <type><|
      let exp = exported(stmt)
      if (!exp) return
      if (!stmt.name) return
      let type = EXPORT_TO_TYPE[stmt.name.text]
      if (!type) return
      if (!stmt.body) return
      additions.push([exp.getEnd() + 1, `const ${stmt.name.text} = (`])
      additions.push([stmt.body.getEnd(), `) satisfies ${type}`])
    }
  })
  return { original: content, additions }
}

function exported(stmt: ts.VariableStatement | ts.FunctionDeclaration) {
  let exported = stmt.modifiers?.find(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  )
  return exported
}
