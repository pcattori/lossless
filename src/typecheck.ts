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

function addTypesToRoute(content: string, fileName: string): string {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
  )

  let startIndex: number | undefined
  let endIndex: number | undefined

  const findDefaultExportIndices = (node: ts.Node) => {
    if (ts.isExportAssignment(node)) {
      startIndex = node.expression.getStart(sourceFile)
      endIndex = node.expression.getEnd()
      return
    }
    ts.forEachChild(node, findDefaultExportIndices)
  }

  findDefaultExportIndices(sourceFile)

  if (startIndex !== undefined && endIndex !== undefined) {
    const beforeExpr = content.slice(0, startIndex)
    const expr = content.slice(startIndex, endIndex)
    const afterExpr = content.slice(endIndex)

    let importSource = path.join(
      path.relative(path.dirname(fileName), Config.appDirectory),
      ".typegen",
      path.relative(Config.appDirectory, fileName),
    )
    let newContent = `import * as T from "${noext(importSource)}"\n`
    newContent += `${beforeExpr}(${expr}) satisfies T.Component${afterExpr}`
    return newContent
  }

  return content
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
