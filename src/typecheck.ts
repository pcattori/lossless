import ts from "typescript"
import * as path from "path"

import { fileURLToPath } from "url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const EXAMPLE_DIR = path.resolve(__dirname, "../example")

type Route = {
  path: string
  file: string
}

const ROUTES = new Map<string, Record<string, boolean>>()
let routes: Route[] = (await import(path.join(EXAMPLE_DIR, "routes.ts")))
  .default
for (let route of routes) {
  let params = Object.fromEntries(
    route.path
      .split("/")
      .filter((segment) => segment.startsWith(":"))
      .map((segment) => {
        segment = segment.slice(1) // trim `:`

        let optional = segment.endsWith("?")
        segment = optional ? segment.slice(0, -1) : segment // trim `?`

        return [segment, optional] as const
      }),
  )
  ROUTES.set(route.file, params)
}

function getRoute(fileName: string) {
  let rel = path.relative(EXAMPLE_DIR, fileName)
  if (path.isAbsolute(rel) || rel.startsWith("..")) return false

  let { dir, name } = path.parse(rel)
  let routeKey = path.join(dir, name)
  let route = ROUTES.get(routeKey)
  return route
}

function createProgram(
  rootFiles: string[],
  options: ts.CompilerOptions,
): ts.Program {
  const host = ts.createCompilerHost(options)

  const originalReadFile = host.readFile
  host.readFile = (fileName: string) => {
    const content = originalReadFile(fileName)
    let route = getRoute(fileName)
    if (content && route) {
      return addTypesToRoute(content, fileName, route)
    }
    return content
  }

  return ts.createProgram(rootFiles, options, host)
}

function addTypesToRoute(
  content: string,
  fileName: string,
  params: Record<string, boolean>,
): string {
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

    const paramEntries = Object.entries(params)
      .map(([param, optional]) => {
        let type = `${param}: string`
        if (optional) type += " | undefined"
        return type
      })
      .join("; ")
    const Params = `{ [key: string]: string | undefined; ${paramEntries} }`

    const newContent = `${beforeExpr}(${expr}) satisfies (arg: { params: ${Params} }) => string${afterExpr}`
    return newContent
  }

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
