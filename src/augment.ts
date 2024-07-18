import ts from "typescript"

type Edit = [index: number, addition: string]

type TextWithEdits = {
  original: string
  edits: Edit[]
  edited: string
}

export function make({
  original,
  edits,
}: Omit<TextWithEdits, "edited">): TextWithEdits {
  let chars = Array.from(original)

  // iterate over additions in reverse so that splicing doesn't mess up other indices
  for (let [index, addition] of reverse(edits)) {
    chars.splice(index, 0, addition)
  }

  let edited = chars.join("")
  return { original, edits, edited }
}

export function toEditedIndex(
  { edits }: TextWithEdits,
  originalIndex: number,
): number {
  let editOffset = 0
  for (let [index, addition] of edits) {
    if (index > originalIndex) break
    editOffset += addition.length
  }
  return originalIndex + editOffset
}

export function toOriginalIndex(
  { edits }: TextWithEdits,
  editedIndex: number,
): number {
  let originalIndex = editedIndex
  let editOffset = 0
  for (let [index, addition] of edits) {
    // before this addition
    if (editedIndex < index + editOffset) break

    // within this addition
    if (editedIndex < index + editOffset + addition.length) return index

    // after this addition
    originalIndex -= addition.length
    editOffset += addition.length
  }
  return Math.max(0, originalIndex)
}

function* reverse<T>(array: T[]): Generator<T> {
  let i = array.length - 1
  while (i >= 0) {
    yield array[i]!
    i--
  }
}

const EXPORT_TO_TYPE: Record<string, string | undefined> = {
  serverLoader: "T.ServerLoader",
  clientLoader: "T.ClientLoader",
  // TODO: clientLoaderHydrate
  HydrateFallback: "T.HydrateFallback",
}

export function augment(filepath: string, content: string): TextWithEdits {
  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true,
  )

  let edits: Edit[] = []

  sourceFile.statements.forEach((stmt) => {
    if (ts.isExportAssignment(stmt)) {
      // export default |>(<|() => {}|>)satisfies <type><|
      if (stmt.isExportEquals === true) {
        throw Error(`Unexpected 'export  =' in '${filepath}'`)
      }
      edits.push([stmt.expression.getStart(sourceFile), "("])
      edits.push([stmt.expression.getEnd(), ") satisfies T.Component"])
    } else if (ts.isVariableStatement(stmt)) {
      // export const loader = |>(<|() => {}|>)satisfies <type><|
      if (!exported(stmt)) return
      for (let decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        if (decl.initializer === undefined) continue
        let type = EXPORT_TO_TYPE[decl.name.text]
        if (!type) continue
        edits.push([decl.initializer.getStart(sourceFile), "("])
        edits.push([decl.initializer.getEnd(), `) satisfies ${type}`])
      }
    } else if (ts.isFunctionDeclaration(stmt)) {
      // export |>const loader = (<|function loader() {}|>) satisfies <type><|
      let exp = exported(stmt)
      if (!exp) return
      if (!stmt.name) return
      let type = EXPORT_TO_TYPE[stmt.name.text]
      if (!type) return
      if (!stmt.body) return
      edits.push([exp.getEnd() + 1, `const ${stmt.name.text} = (`])
      edits.push([stmt.body.getEnd(), `) satisfies ${type}`])
    }
  })
  return make({ original: content, edits })
}

function exported(stmt: ts.VariableStatement | ts.FunctionDeclaration) {
  let exported = stmt.modifiers?.find(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  )
  return exported
}
