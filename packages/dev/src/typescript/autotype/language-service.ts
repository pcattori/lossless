// Adapted from https://github.com/sveltejs/language-tools/blob/master/packages/typescript-plugin/src/language-service/sveltekit.ts

import ts from "typescript"

import * as path from "node:path"

import type { Config } from "../../config"
import { getRoutes, routeExports } from "../../routes"
import { getTypesPath } from "../../typegen"
import * as AST from "../ast"
import type { Context } from "../context"

type RouteModule = {
  snapshot: ts.IScriptSnapshot
  version: string
  autotyped: AutotypedRoute
}

const FORCE_UPDATE_VERSION = "FORCE_UPDATE_VERSION"

type AutotypeLanguageService = ts.LanguageService & {
  getRoute: (fileName: string) => RouteModule | undefined
}

let CACHED: AutotypeLanguageService

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
      ctx.logger?.info(`WOW\n\n${autotyped.code()}\n\n`)
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

type Splice = {
  index: number
  content: string
  remapDiagnostics: {
    start: number
    length: number
  }
}

function autotypeRoute(config: Config, filepath: string, code: string) {
  const sourceFile = ts.createSourceFile(
    filepath,
    code,
    ts.ScriptTarget.Latest,
    true,
  )
  const route = { file: path.relative(config.appDirectory, filepath) }
  const typesSource = "./" + path.parse(getTypesPath(config, route)).name

  const splices: Splice[] = [
    ...sourceFile.statements.flatMap((stmt) => [
      ...annotateDefaultExportFunctionDeclaration(stmt, typesSource),
      ...annotateDefaultExportExpression(stmt, typesSource),
      ...annotateNamedExportFunctionDeclaration(stmt, typesSource),
      ...annotateNamedExportVariableStatement(stmt, typesSource),
    ]),
  ]
  return new AutotypedRoute(code, splices)
}

function annotateDefaultExportFunctionDeclaration(
  stmt: ts.Statement,
  typesSource: string,
): Splice[] {
  if (!ts.isFunctionDeclaration(stmt)) return []

  if (!AST.exported(ts, stmt)) return []

  const _default = AST.defaulted(ts, stmt)
  if (!_default) return []

  return annotateFunction(stmt, typesSource, "default", {
    start: stmt.name?.getStart() ?? _default.getStart(),
    length: stmt.name?.getWidth() ?? _default.getWidth(),
  })
}

function annotateDefaultExportExpression(
  stmt: ts.Statement,
  typesSource: string,
): Splice[] {
  if (!ts.isExportAssignment(stmt)) return []
  if (stmt.isExportEquals) return []
  if (!ts.isArrowFunction(stmt.expression)) return []

  const regex = /^export\s+/
  const matches = stmt.getText().match(regex)
  if (!matches) {
    throw Error(
      `expected ${regex} at ${stmt.getSourceFile().fileName}:${stmt.getStart()}`,
    )
  }

  return annotateFunction(stmt.expression, typesSource, "default", {
    start: stmt.getStart() + matches[0].length,
    length: 7,
  })
}

function annotateNamedExportFunctionDeclaration(
  stmt: ts.Statement,
  typesSource: string,
): Splice[] {
  if (!ts.isFunctionDeclaration(stmt)) return []
  if (!AST.exported(ts, stmt)) return []
  if (AST.defaulted(ts, stmt)) return []

  const { name } = stmt
  if (!name) return []

  return annotateFunction(stmt, typesSource, name.text, {
    start: name.getStart(),
    length: name.getWidth(),
  })
}

function annotateNamedExportVariableStatement(
  stmt: ts.Statement,
  typesSource: string,
): Splice[] {
  if (!ts.isVariableStatement(stmt)) return []
  if (!AST.exported(ts, stmt)) return []

  return stmt.declarationList.declarations.flatMap((decl) => {
    if (!ts.isIdentifier(decl.name)) return []
    if (decl.initializer === undefined) return []
    if (
      ts.isFunctionExpression(decl.initializer) ||
      ts.isArrowFunction(decl.initializer)
    ) {
      const { name } = decl
      return annotateFunction(decl.initializer, typesSource, name.text, {
        start: name.getStart(),
        length: name.getWidth(),
      })
    }
    return []
  })
}

function annotateFunction(
  fn: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  typesSource: string,
  name: string,
  remapDiagnostics: {
    start: number
    length: number
  },
): Splice[] {
  const param = fn.parameters[0]

  const returnTypeIndex = ts.isArrowFunction(fn)
    ? fn.equalsGreaterThanToken.getStart()
    : fn.body?.getStart()

  const returnType = routeExports[name]?.returnType

  return [
    param && param.type === undefined
      ? {
          index: param.getEnd(),
          content: `: import("${typesSource}").Args["${name}"]`,
          remapDiagnostics,
        }
      : null,
    returnType && returnTypeIndex && fn.type === undefined
      ? {
          index: returnTypeIndex,
          content: `: ${returnType} `,
          remapDiagnostics,
        }
      : null,
  ].filter((x) => x !== null)
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
    remapDiagnostics?: { start: number; length: number }
  } {
    let spliceOffset = 0
    for (let { index, content, remapDiagnostics } of this._splices) {
      // before this splice
      if (splicedIndex < index + spliceOffset) break

      // within this splice
      if (splicedIndex < index + spliceOffset + content.length) {
        return { index, remapDiagnostics }
      }

      // after this splice
      spliceOffset += content.length
    }
    return { index: Math.max(0, splicedIndex - spliceOffset) }
  }
}

function* reverse<T>(array: T[]): Generator<T> {
  let i = array.length - 1
  while (i >= 0) {
    yield array[i]!
    i--
  }
}
