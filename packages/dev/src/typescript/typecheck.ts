import ts from "typescript"
import * as path from "node:path"

import type { Config } from "../config"
import { getRoutes } from "../routes"
import { autotypeRoute } from "./autotype"

function parseTsconfig(config: Config): ts.ParsedCommandLine {
  const configPath = ts.findConfigFile(
    config.appDirectory,
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

export async function typecheck(config: Config) {
  const routes = getRoutes(config)

  const { fileNames, options } = parseTsconfig(config)
  const host = ts.createCompilerHost(options)
  const originalReadFile = host.readFile
  host.readFile = (fileName: string) => {
    const content = originalReadFile(fileName)
    const route = routes.get(fileName)
    if (content && route) {
      return autotypeRoute(config, fileName, content).code()
    }
    return content
  }
  const program = ts.createProgram(fileNames, options, host)

  const diagnostics = ts.getPreEmitDiagnostics(program)
  if (diagnostics.length > 0) {
    const formattedDiagnostics = ts.formatDiagnosticsWithColorAndContext(
      diagnostics,
      {
        getCurrentDirectory: () => config.appDirectory,
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
