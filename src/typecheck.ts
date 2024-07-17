import ts from "typescript"
import * as path from "path"

import * as Config from "./config"
import { noext } from "./utils"
import { augment, toAugmented } from "./augment"

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
      return addTypesToRoute(fileName, content)
    }
    return content
  }

  return ts.createProgram(rootFiles, options, host)
}

function addTypesToRoute(fileName: string, content: string): string {
  let code = augment(fileName, content)
  let augmented = toAugmented(code)

  let importSource = path.join(
    Config.appDirectory,
    ".typegen",
    path.relative(Config.appDirectory, fileName),
  )
  let newContent = `import * as T from "${noext(importSource)}"\n\n` + augmented
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
