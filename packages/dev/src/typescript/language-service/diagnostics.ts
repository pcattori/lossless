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
    let start = diagnostic.start
    if (start) {
      start = route.autotyped.toOriginalIndex(start).index
    }
    diagnostics.push({
      ...diagnostic,
      start,
      file: ctx.languageService.getProgram()?.getSourceFile(fileName),
    })
  }
  // @ts-expect-error
  return diagnostics
}
