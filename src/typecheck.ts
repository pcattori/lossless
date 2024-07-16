import ts from "typescript"
import * as path from "path"

import * as Config from "./config"
import { noext } from "./utils"

let routes = await Config.routes()
const ROUTES = new Set<string>(routes.map((r) => r.file))

function isRoute(fileName: string) {
  let rel = path.relative(Config.appDirectory, fileName)
  if (path.isAbsolute(rel) || rel.startsWith("..")) return false
  return ROUTES.has(rel)
}

let exports: Record<string, string | undefined> = {
  serverLoader: "T.ServerLoader",
  clientLoader: "T.ClientLoader",
  // TODO: clientLoaderHydrate
  HydrateFallback: "T.HydrateFallback",
}

function createProgram(
  rootFiles: string[],
  options: ts.CompilerOptions,
): ts.Program {
  const host = ts.createCompilerHost(options)

  const originalReadFile = host.readFile
  host.readFile = (fileName: string) => {
    const content = originalReadFile(fileName)
    if (content && isRoute(fileName)) {
      return addTypesToRoute(content, fileName)
    }
    return content
  }

  return ts.createProgram(rootFiles, options, host)
}

function isExported(
  stmt: ts.VariableStatement | ts.FunctionDeclaration,
): boolean {
  let exported = stmt.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  )
  return exported === true
}

function addTypesToRoute(content: string, fileName: string): string {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
  )

  type Edit = { span: [number, number]; type: string }
  let edits: Edit[] = []

  sourceFile.statements.forEach((stmt) => {
    if (ts.isExportAssignment(stmt)) {
      if (stmt.isExportEquals === true) {
        throw Error(`Unexpected 'export =' in '${fileName}'`)
      }
      let span = [
        stmt.expression.getStart(sourceFile),
        stmt.expression.getEnd(),
      ] as [number, number]
      edits.push({ span, type: "T.Component" })
    } else if (ts.isVariableStatement(stmt)) {
      if (!isExported(stmt)) return
      for (let decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        if (decl.initializer === undefined) continue
        let type = exports[decl.name.text]
        if (!type) continue
        let span = [
          decl.initializer.getStart(sourceFile),
          decl.initializer.getEnd(),
        ] as [number, number]
        edits.push({ span, type })
      }
    } else if (ts.isFunctionDeclaration(stmt)) {
      if (!isExported(stmt)) return
      // TODO: handle function declarations for known exports
    }
  })

  // sort desc so that content slicing doesn't mess up indices of other edits
  edits = edits.sort((a, b) => b.span[0] - a.span[0])

  let newContent = content.slice(0)
  for (let edit of edits) {
    let [begin, end] = edit.span
    let before = newContent.slice(0, begin)
    let expr = newContent.slice(begin, end)
    let after = newContent.slice(end)
    newContent = `${before}(${expr}) satisfies ${edit.type}${after}`
  }

  let importSource = path.join(
    Config.appDirectory,
    ".typegen",
    path.relative(Config.appDirectory, fileName),
  )
  newContent = `import * as T from "${noext(importSource)}"\n\n` + newContent
  return newContent
}

export default function typecheck(rootDir: string) {
  const configPath = ts.findConfigFile(
    rootDir,
    ts.sys.fileExists,
    "tsconfig.json",
  )
  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.")
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsedCommandLine = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  )

  const program = createProgram(
    parsedCommandLine.fileNames,
    parsedCommandLine.options,
  )
  const diagnostics = ts.getPreEmitDiagnostics(program)

  if (diagnostics.length > 0) {
    const formattedDiagnostics = ts.formatDiagnosticsWithColorAndContext(
      diagnostics,
      {
        getCurrentDirectory: () => rootDir,
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => ts.sys.newLine,
      },
    )
    console.log(formattedDiagnostics)

    const errorCount = diagnostics.filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    ).length
    const warningCount = diagnostics.filter(
      (d) => d.category === ts.DiagnosticCategory.Warning,
    ).length
    console.log(
      `Found ${errorCount} error${errorCount === 1 ? "" : "s"} and ${warningCount} warning${warningCount === 1 ? "" : "s"}.`,
    )
  } else {
    console.log(
      "\x1b[36m%s\x1b[0m",
      "✨ Done. No errors or warnings were found.",
    )
  }
}
