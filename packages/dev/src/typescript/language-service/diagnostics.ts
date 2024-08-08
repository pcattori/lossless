import type ts from "typescript/lib/tsserverlibrary"

import { getAutotypeLanguageService } from "../autotype"
import { type Context } from "../context"

export function decorateDiagnostics(ctx: Context) {
  const ls = ctx.languageService
  const { getSyntacticDiagnostics } = ls
  ls.getSyntacticDiagnostics = (fileName: string) => {
    return (
      getRouteDiagnostics(ctx, "getSyntacticDiagnostics", fileName) ??
      getSyntacticDiagnostics(fileName)
    )
  }

  const { getSemanticDiagnostics } = ls
  ls.getSemanticDiagnostics = (fileName: string) => {
    return (
      getRouteDiagnostics(ctx, "getSemanticDiagnostics", fileName) ??
      getSemanticDiagnostics(fileName)
    )
  }

  const { getSuggestionDiagnostics } = ls
  ls.getSuggestionDiagnostics = (fileName: string) => {
    return (
      getRouteDiagnostics(ctx, "getSuggestionDiagnostics", fileName) ??
      getSuggestionDiagnostics(fileName)
    )
  }
}

function getRouteDiagnostics<
  T extends
    | "getSemanticDiagnostics"
    | "getSuggestionDiagnostics"
    | "getSyntacticDiagnostics",
>(
  ctx: Context,
  methodName: T,
  fileName: string,
): ReturnType<ts.LanguageService[T]> | undefined {
  const autotype = getAutotypeLanguageService(ctx)
  if (!autotype) return

  const route = autotype.getRoute(fileName)
  if (!route) return

  const diagnostics: ts.Diagnostic[] = []
  for (let diagnostic of autotype[methodName](fileName)) {
    if (!diagnostic.start) {
      diagnostics.push(diagnostic)
      continue
    }

    const { index, spliced } = route.autotyped.toOriginalIndex(diagnostic.start)
    let length = diagnostic.length
    if (spliced) {
      // avoid diagnostics in splices from overflowing onto unrelated code
      length = 1
    }
    diagnostics.push({
      ...diagnostic,
      start: index,
      length,
      file: ctx.languageService.getProgram()?.getSourceFile(fileName),
    })
  }
  // @ts-expect-error
  return diagnostics
}
