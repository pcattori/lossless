import type ts from "typescript/lib/tsserverlibrary"

import { getAutotypeLanguageService } from "../autotype"
import { type Context } from "../context"

export function decorateDiagnostics(ctx: Context) {
  const ls = ctx.info.languageService
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
  for (let diagnostic of autotype.languageService[methodName](fileName)) {
    let start = diagnostic.start
    let length = diagnostic.length

    if (start) {
      const { index, exportName } = route.autotyped.toOriginalIndex(start)
      start = exportName?.start ?? index
      length = exportName?.length ?? length
    }
    diagnostics.push({ ...diagnostic, start, length })
  }
  // @ts-expect-error
  return diagnostics
}
