import ts from "typescript"

type Addition = [number, string]

type Code = {
  original: string
  additions: Addition[]
}

export function toAugmented(code: Code): string {
  let chars = Array.from(code.original)
  for (let [index, addition] of code.additions) {
    chars.splice(index, 0, addition)
  }
  return chars.join("")
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
  return { original: content, additions: additions.reverse() }
}

function exported(stmt: ts.VariableStatement | ts.FunctionDeclaration) {
  let exported = stmt.modifiers?.find(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  )
  return exported
}
