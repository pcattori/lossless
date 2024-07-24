import ts from "typescript"
import * as path from "node:path"

import * as Config from "./config"
import { annotateRouteExports } from "./annotate-route-exports"

function parseTsconfig(): ts.ParsedCommandLine {
  const configPath = ts.findConfigFile(
    Config.appDirectory,
    ts.sys.fileExists,
    "tsconfig.json",
  )
  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.")
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  return ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  )
}

export default async function typecheck() {
  const routes = await Config.routes()
  const routePaths = new Set(routes.map((r) => r.file))
  function isRoute(filepath: string) {
    let rel = path.relative(Config.appDirectory, filepath)
    if (path.isAbsolute(rel) || rel.startsWith("..")) return false
    return routePaths.has(rel)
  }

  const { fileNames, options } = parseTsconfig()
  const host = ts.createCompilerHost(options)
  const originalReadFile = host.readFile
  host.readFile = (fileName: string) => {
    const content = originalReadFile(fileName)
    if (content && isRoute(fileName)) {
      return annotateRouteExports(fileName, content).edited
    }
    return content
  }
  const program = ts.createProgram(fileNames, options, host)

  const diagnostics = ts.getPreEmitDiagnostics(program)
  if (diagnostics.length > 0) {
    const formattedDiagnostics = ts.formatDiagnosticsWithColorAndContext(
      diagnostics,
      {
        getCurrentDirectory: () => Config.appDirectory,
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
