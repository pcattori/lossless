import * as path from "node:path"
import ts from "typescript"

import * as Config from "./config"
import * as TextWithEdits from "./text-with-edits"
import { noext } from "./utils"

const EXPORT_TO_TYPE: Record<string, string | undefined> = {
  serverLoader: "T.ServerLoader",
  clientLoader: "T.ClientLoader",
  // TODO: clientLoaderHydrate
  HydrateFallback: "T.HydrateFallback",
}

export function annotateRouteExports(
  filepath: string,
  content: string,
): TextWithEdits.Type {
  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true,
  )

  let typegenSource = path.join(
    Config.appDirectory,
    ".typegen",
    path.relative(Config.appDirectory, filepath),
  )
  let edits: TextWithEdits.Edit[] = [
    [0, `import * as T from "${noext(typegenSource)}"\n\n`],
  ]

  sourceFile.statements.forEach((stmt) => {
    if (ts.isExportAssignment(stmt)) {
      // export default |>(<|() => {}|>)satisfies <type><|
      if (stmt.isExportEquals === true) {
        throw Error(`Unexpected 'export  =' in '${filepath}'`)
      }
      edits.push([stmt.expression.getStart(sourceFile), "("])
      edits.push([stmt.expression.getEnd(), ") satisfies T.Component"])
    } else if (ts.isVariableStatement(stmt)) {
      // export const loader = |>(<|() => {}|>)satisfies <type><|
      if (!exported(stmt)) return
      for (let decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        if (decl.initializer === undefined) continue
        let type = EXPORT_TO_TYPE[decl.name.text]
        if (!type) continue
        edits.push([decl.initializer.getStart(sourceFile), "("])
        edits.push([decl.initializer.getEnd(), `) satisfies ${type}`])
      }
    } else if (ts.isFunctionDeclaration(stmt)) {
      // export |>const loader = (<|function loader() {}|>) satisfies <type><|
      let exp = exported(stmt)
      if (!exp) return
      if (!stmt.name) return
      let type = EXPORT_TO_TYPE[stmt.name.text]
      if (!type) return
      if (!stmt.body) return
      edits.push([exp.getEnd() + 1, `const ${stmt.name.text} = (`])
      edits.push([stmt.body.getEnd(), `) satisfies ${type}`])
    }
  })
  return TextWithEdits.make({ original: content, edits })
}

function exported(stmt: ts.VariableStatement | ts.FunctionDeclaration) {
  let exported = stmt.modifiers?.find(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  )
  return exported
}
