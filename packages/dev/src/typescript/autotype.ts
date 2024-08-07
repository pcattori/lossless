// Adapted from https://github.com/sveltejs/language-tools/blob/master/packages/typescript-plugin/src/language-service/sveltekit.ts

import ts from "typescript"

import * as path from "node:path"

import type { Config } from "../config"
import { getRoutes, routeExports } from "../routes"
import { getTypesPath } from "../typegen"
import { noext } from "../utils"

import type { Context } from "./context"

type RouteModule = {
  snapshot: ts.IScriptSnapshot
  version: string
  autotyped: AutotypedRoute
}

const FORCE_UPDATE_VERSION = "FORCE_UPDATE_VERSION"

type AutotypeLanguageService = ts.LanguageService & {
  getRoute: (fileName: string) => RouteModule | undefined
}

let CACHED: AutotypeLanguageService | null = null

export function getAutotypeLanguageService(ctx: Context) {
  if (CACHED) return CACHED

  const host = ctx.languageServiceHost

  class AutotypeLanguageServiceHost implements ts.LanguageServiceHost {
    private routes: Record<string, RouteModule> = {}

    constructor() {}

    // TODO: Q: are these needed? do they just "silence" the autotype host?
    // log() {}
    // trace() {}
    // error() {}

    getCompilationSettings() {
      return host.getCompilationSettings()
    }

    getCurrentDirectory() {
      return host.getCurrentDirectory()
    }

    getDefaultLibFileName(o: any) {
      return host.getDefaultLibFileName(o)
    }

    getScriptFileNames(): string[] {
      const names: Set<string> = new Set(Object.keys(this.routes))
      const files = host.getScriptFileNames()
      for (const file of files) {
        names.add(file)
      }
      return [...names]
    }

    getScriptVersion(fileName: string) {
      const route = this.routes[fileName]
      if (!route) return host.getScriptVersion(fileName)
      return route.version.toString()
    }

    getScriptSnapshot(fileName: string) {
      const route = this.routes[fileName]
      if (!route) return host.getScriptSnapshot(fileName)
      return route.snapshot
    }

    readFile(fileName: string) {
      const route = this.routes[fileName]
      return route
        ? route.snapshot.getText(0, route.snapshot.getLength())
        : host.readFile(fileName)
    }

    fileExists(fileName: string) {
      return this.routes[fileName] !== undefined || host.fileExists(fileName)
    }

    getRouteIfUpToDate(fileName: string) {
      const scriptVersion = this.getScriptVersion(fileName)
      const route = this.routes[fileName]
      if (
        !route ||
        scriptVersion !== host.getScriptVersion(fileName) ||
        scriptVersion === FORCE_UPDATE_VERSION
      ) {
        return undefined
      }
      return route
    }

    upsertRouteFile(fileName: string) {
      const route = getRoutes(ctx.config).get(fileName)
      if (!route) return
      const sourceFile = ctx.languageService
        .getProgram()
        ?.getSourceFile(fileName)
      if (!sourceFile) return

      const { text: code } = sourceFile
      const autotyped = autotypeRoute(ctx.config, fileName, code)
      const snapshot = ts.ScriptSnapshot.fromString(autotyped.code())
      snapshot.getChangeRange = (_) => undefined

      this.routes[fileName] = {
        version:
          this.routes[fileName] === undefined
            ? FORCE_UPDATE_VERSION
            : host.getScriptVersion(fileName),
        snapshot,
        autotyped,
      }
      return this.routes[fileName]!
    }

    // needed for path auto completions
    readDirectory = host.readDirectory
      ? (
          ...args: Parameters<
            NonNullable<ts.LanguageServiceHost["readDirectory"]>
          >
        ) => {
          return host.readDirectory!(...args)
        }
      : undefined
  }

  const autotypeHost = new AutotypeLanguageServiceHost()
  function getRoute(fileName: string) {
    const route =
      autotypeHost.getRouteIfUpToDate(fileName) ??
      autotypeHost.upsertRouteFile(fileName)
    return route
  }

  const languageService = ts.createLanguageService(autotypeHost)
  CACHED = { ...languageService, getRoute }
  return CACHED
}

type ExportName = {
  start: number
  length: number
}

type Splice = {
  index: number
  content: string
  exportName?: ExportName
}

function autotypeRoute(config: Config, filepath: string, code: string) {
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
    ...sourceFile.statements.flatMap((stmt) => [
      ...annotateDefaultExportExpression(stmt),
      ...annotateNamedExportFunctionDeclaration(stmt),
      ...annotateNamedExportVariableStatement(stmt),
    ]),
  ]
  return new AutotypedRoute(code, splices)
}

function annotateDefaultExportExpression(stmt: ts.Statement): Splice[] {
  // BEFORE: export default expr
  // AFTER:  export default (expr) satisfies <type>
  //                        ^    ^^^^^^^^^^^^^^^^^^
  if (!ts.isExportAssignment(stmt)) return []
  if (stmt.isExportEquals) return []

  const sourceFile = stmt.parent
  const expStart = stmt.getStart()
  const expMatch = sourceFile
    .getFullText()
    .slice(expStart)
    .match(/^export\s+default\b/)
  if (!expMatch) {
    throw Error(
      `expected /export\\s+default\\b/ at ${sourceFile.fileName}:${expStart}`,
    )
  }
  const exportName = {
    start: expStart + (expMatch[0].length - 7),
    length: 7,
  }

  const jsdoc = routeExports.default?.jsdoc
  return [
    jsdoc
      ? {
          index: stmt.getStart(),
          content: `\n${jsdoc}\n`,
        }
      : null,
    {
      index: stmt.expression.getStart(),
      content: "(",
      exportName,
    },
    {
      index: stmt.expression.getEnd(),
      content: ") satisfies $autotype._default",
      exportName,
    },
  ].filter((x) => x !== null)
}

function annotateNamedExportFunctionDeclaration(stmt: ts.Statement): Splice[] {
  // BEFORE: export function loader() {...}
  // AFTER:  export const loader = (function loader() {...}) satisfies <type>
  //                ^^^^^^^^^^^^^^^^                       ^^^^^^^^^^^^^^^^^^
  if (!ts.isFunctionDeclaration(stmt)) return []
  let exp = exported(stmt)
  if (!exp) return []

  if (!stmt.name) return []
  if (!stmt.body) return []

  const jsdoc = routeExports[stmt.name.text]?.jsdoc

  const exportName = {
    start: stmt.name.getStart(),
    length: stmt.name.getWidth(),
  }
  return [
    {
      index: exp.getEnd() + 1, // TODO: account for more whitespace
      content: `const ${stmt.name.text} = (` + (jsdoc ? jsdoc + "\n" : ""),
      exportName,
    },
    {
      index: stmt.body.getEnd(),
      content: `) satisfies $autotype.${stmt.name.text}`,
      exportName,
    },
  ]
}

function annotateNamedExportVariableStatement(stmt: ts.Statement): Splice[] {
  // BEFORE: export const loader = expr
  // AFTER:  export const loader = (expr) satisfies <type>
  //                               ^    ^^^^^^^^^^^^^^^^^^
  if (!ts.isVariableStatement(stmt)) return []
  let exp = exported(stmt)
  if (!exp) return []

  const splices: Splice[] = []
  for (let decl of stmt.declarationList.declarations) {
    if (!ts.isIdentifier(decl.name)) continue
    if (decl.initializer === undefined) continue

    const jsdoc = routeExports[decl.name.text]?.jsdoc
    if (jsdoc) {
      splices.push({
        index: stmt.getStart(),
        content: `\n${jsdoc}\n`,
      })
    }

    const exportName = {
      start: decl.name.getStart(),
      length: decl.name.getWidth(),
    }
    splices.push({
      index: decl.initializer.getStart(),
      content: "(",
      exportName,
    })

    splices.push({
      index: decl.initializer.getEnd(),
      content: `) satisfies $autotype.${decl.name.text}`,
      exportName,
    })
  }
  return splices
}

class AutotypedRoute {
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
