import * as ts from "typescript"
import * as path from "path"

function createProgram(
  rootFiles: string[],
  options: ts.CompilerOptions,
): ts.Program {
  const host = ts.createCompilerHost(options)

  const originalReadFile = host.readFile
  host.readFile = (fileName: string) => {
    const content = originalReadFile(fileName)
    if (content && path.basename(fileName) === "foo.ts") {
      return augmentFooFile(content, fileName)
    }
    return content
  }

  return ts.createProgram(rootFiles, options, host)
}

function augmentFooFile(content: string, fileName: string): string {
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

    const newContent = `${beforeExpr}(${expr}) satisfies (a: number, b: number) => number${afterExpr}`
    return newContent
  }

  console.log(`No default export found in ${fileName}`)
  return content
}

function typeCheck(rootDir: string) {
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

// Usage
const rootDir = process.cwd() // Or provide the path to your project root
typeCheck(rootDir)
