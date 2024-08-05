import * as path from "node:path"

import ts from "typescript"

import type { Config } from "./config"
import { noext } from "./utils"
import { getTypesPath } from "./typegen"

type ExportName = {
  start: number
  length: number
}

type Splice = {
  index: number
  content: string
  exportName?: ExportName
}

export function autotypeRoute(config: Config, filepath: string, code: string) {
  const sourceFile = ts.createSourceFile(
    filepath,
    code,
    ts.ScriptTarget.Latest,
    true,
  )
  const route = { file: path.relative(config.appDirectory, filepath) }
  const typesSource = noext(getTypesPath(config, route))

  const splices: Splice[] = [
    { index: 0, content: `import * as $autotype from "${typesSource}"\n\n` },
  ]
  sourceFile.statements.forEach((stmt) => {
    if (ts.isExportAssignment(stmt)) {
      // BEFORE: export default expr
      // AFTER:  export default (expr) satisfies <type>
      //                        ^    ^^^^^^^^^^^^^^^^^^
      if (stmt.isExportEquals === true) {
        throw Error(`Unexpected 'export  =' in '${filepath}'`)
      }
      splices.push({
        index: stmt.getStart(sourceFile),
        content: "\n/** docs for default export go here */\n",
      })

      const expStart = stmt.getStart(sourceFile)
      const expMatch = sourceFile
        .getFullText()
        .slice(expStart)
        .match(/^export\s+default\b/)
      if (!expMatch) {
        throw Error(
          `expected /export\\s+default\\b/ at ${filepath}:${expStart}`,
        )
      }
      const exportName = {
        start: expStart + (expMatch[0].length - 7),
        length: 7,
      }
      splices.push({
        index: stmt.expression.getStart(sourceFile),
        content: "(",
        exportName,
      })
      splices.push({
        index: stmt.expression.getEnd(),
        content: ") satisfies $autotype._default",
        exportName,
      })
    } else if (ts.isVariableStatement(stmt)) {
      // BEFORE: export const loader = expr
      // AFTER:  export const loader = (expr) satisfies <type>
      //                               ^    ^^^^^^^^^^^^^^^^^^
      let exp = exported(stmt)
      if (!exp) return
      for (let decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        if (decl.initializer === undefined) continue
        splices.push({
          index: stmt.getStart(sourceFile),
          content: `\n/** docs for ${decl.name.text} go here */\n`,
        })

        const exportName = {
          start: decl.name.getStart(sourceFile),
          length: decl.name.getWidth(sourceFile),
        }
        splices.push({
          index: decl.initializer.getStart(sourceFile),
          content: "(",
          exportName,
        })

        splices.push({
          index: decl.initializer.getEnd(),
          content: `) satisfies $autotype.${decl.name.text}`,
          exportName,
        })
      }
    } else if (ts.isFunctionDeclaration(stmt)) {
      // BEFORE: export function loader() {...}
      // AFTER:  export const loader = (function loader() {...}) satisfies <type>
      //                ^^^^^^^^^^^^^^^^                       ^^^^^^^^^^^^^^^^^^
      let exp = exported(stmt)
      if (!exp) return
      if (!stmt.name) return
      if (!stmt.body) return
      splices.push({
        index: stmt.getStart(sourceFile),
        content: `\n/** docs for ${stmt.name.text} go here */\n`,
      })

      const exportName = {
        start: stmt.name.getStart(sourceFile),
        length: stmt.name.getWidth(sourceFile),
      }
      splices.push({
        index: exp.getEnd() + 1, // TODO: account for more whitespace
        content: `const ${stmt.name.text} = (`,
        exportName,
      })
      splices.push({
        index: stmt.body.getEnd(),
        content: `) satisfies $autotype.${stmt.name.text}`,
        exportName,
      })
    }
  })
  return new AutotypedRoute(code, splices)
}

export class AutotypedRoute {
  private _originalCode: string
  private _splices: Splice[]

  private _code: string | undefined = undefined

  constructor(code: string, splices: Splice[]) {
    this._originalCode = code
    this._splices = splices
  }

  code(): string {
    if (!this._code) {
      const chars = Array.from(this._originalCode)

      // iterate over splices in reverse so that splicing doesn't mess up other indices
      for (let { index, content } of reverse(this._splices)) {
        chars.splice(index, 0, content)
      }

      this._code = chars.join("")
    }
    return this._code
  }

  toSplicedIndex(originalIndex: number): number {
    let spliceOffset = 0
    for (let { index, content } of this._splices) {
      if (index > originalIndex) break
      spliceOffset += content.length
    }
    return originalIndex + spliceOffset
  }

  toOriginalIndex(splicedIndex: number): {
    index: number
    exportName?: ExportName
  } {
    let spliceOffset = 0
    for (let { index, content, exportName } of this._splices) {
      // before this splice
      if (splicedIndex < index + spliceOffset) break

      // within this splice
      if (splicedIndex < index + spliceOffset + content.length)
        return { index, exportName }

      // after this splice
      spliceOffset += content.length
    }
    return { index: Math.max(0, splicedIndex - spliceOffset) }
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
