import ts from "typescript"
import * as path from "node:path"

import type { Config } from "../config"
import { decorateLanguageService } from "./language-service"

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

export function typecheck(config: Config) {
  const { fileNames, options } = parseTsconfig(config)

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => fileNames,
    getScriptVersion: () => "0",
    getScriptSnapshot: (fileName) => {
      const content = ts.sys.readFile(fileName)
      if (!content) return
      return ts.ScriptSnapshot.fromString(content)
    },
    getCurrentDirectory: () => process.cwd(), // TODO
    getCompilationSettings: () => options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
  }
  const ls = ts.createLanguageService(host)
  decorateLanguageService({
    config,
    languageService: ls,
    languageServiceHost: host,
    ts,
    logger: console,
  })
  const program = ts.createProgram(fileNames, options)

  let diagnostics: ts.Diagnostic[] = []
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue
    diagnostics = diagnostics.concat(
      ls.getSyntacticDiagnostics(sourceFile.fileName).map((d) => {
        d.file = sourceFile
        return d
      }),
      ls.getSemanticDiagnostics(sourceFile.fileName).map((d) => {
        d.file = sourceFile
        return d
      }),
    )
  }

  if (diagnostics) {
    const formattedDiagnostics = ts.formatDiagnosticsWithColorAndContext(
      diagnostics,
      {
        getCurrentDirectory: () => config.appDirectory,
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => ts.sys.newLine,
      },
    )
    const errorCount = diagnostics.filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    ).length
    const warningCount = diagnostics.filter(
      (d) => d.category === ts.DiagnosticCategory.Warning,
    ).length
    console.log(
      `Found ${errorCount} error${errorCount === 1 ? "" : "s"} and ${warningCount} warning${warningCount === 1 ? "" : "s"}.`,
    )

    console.log(formattedDiagnostics)
  } else {
    console.log(
      "\x1b[36m%s\x1b[0m",
      "✨ Done. No errors or warnings were found.",
    )
  }
}
