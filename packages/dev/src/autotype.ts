import * as path from "node:path"

import ts from "typescript"

import type { Config } from "./config"
import { noext } from "./utils"

type Splice = [number, string]

const EXPORT_TO_TYPE: Record<string, string | undefined> = {
  serverLoader: "T.ServerLoader",
  clientLoader: "T.ClientLoader",
  // TODO clientLoaderHydrate
  HydrateFallback: "T.HydrateFallback",
}

export function autotypeRoute(config: Config, filepath: string, code: string) {
  const sourceFile = ts.createSourceFile(
    filepath,
    code,
    ts.ScriptTarget.Latest,
    true,
  )

  const typegenSource = path.join(
    config.appDirectory,
    ".typegen",
    path.relative(config.appDirectory, filepath),
  )
  const splices: Splice[] = [
    [0, `import * as T from "${noext(typegenSource)}"\n\n`],
  ]
  sourceFile.statements.forEach((stmt) => {
    if (ts.isExportAssignment(stmt)) {
      // export default |>(<|() => {}|>)satisfies <type><|
      if (stmt.isExportEquals === true) {
        throw Error(`Unexpected 'export  =' in '${filepath}'`)
      }
      splices.push([stmt.expression.getStart(sourceFile), "("])
      splices.push([stmt.expression.getEnd(), ") satisfies T.Component"])
    } else if (ts.isVariableStatement(stmt)) {
      // export const loader = |>(<|() => {}|>)satisfies <type><|
      if (!exported(stmt)) return
      for (let decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        if (decl.initializer === undefined) continue
        let type = EXPORT_TO_TYPE[decl.name.text]
        if (!type) continue
        splices.push([decl.initializer.getStart(sourceFile), "("])
        splices.push([decl.initializer.getEnd(), `) satisfies ${type}`])
      }
    } else if (ts.isFunctionDeclaration(stmt)) {
      // export |>const loader = (<|function loader() {}|>) satisfies <type><|
      let exp = exported(stmt)
      if (!exp) return
      if (!stmt.name) return
      let type = EXPORT_TO_TYPE[stmt.name.text]
      if (!type) return
      if (!stmt.body) return
      splices.push([exp.getEnd() + 1, `const ${stmt.name.text} = (`])
      splices.push([stmt.body.getEnd(), `) satisfies ${type}`])
    }
  })
  return new AutotypedRoute(code, splices)
}

class AutotypedRoute {
  private _originalCode: string
  private _splices: [number, string][]

  private _code: string | undefined = undefined

  constructor(code: string, splices: [number, string][]) {
    this._originalCode = code
    this._splices = splices
  }

  code(): string {
    if (!this._code) {
      const chars = Array.from(this._originalCode)

      // iterate over splices in reverse so that splicing doesn't mess up other indices
      for (let [index, content] of reverse(this._splices)) {
        chars.splice(index, 0, content)
      }

      this._code = chars.join("")
    }
    return this._code
  }

  toSplicedIndex(originalIndex: number): number {
    let spliceOffset = 0
    for (let [index, content] of this._splices) {
      if (index > originalIndex) break
      spliceOffset += content.length
    }
    return originalIndex + spliceOffset
  }

  toOriginalIndex(splicedIndex: number): number {
    let spliceOffset = 0
    for (let [index, content] of this._splices) {
      // before this splice
      if (splicedIndex < index + spliceOffset) break

      // within this splice
      if (splicedIndex < index + spliceOffset + content.length) return index

      // after this splice
      spliceOffset += content.length
    }
    return Math.max(0, splicedIndex - spliceOffset)
  }
}

function exported(stmt: ts.VariableStatement | ts.FunctionDeclaration) {
  let exported = stmt.modifiers?.find(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  )
  return exported
}

function* reverse<T>(array: T[]): Generator<T> {
  let i = array.length - 1
  while (i >= 0) {
    yield array[i]!
    i--
  }
}