import * as Autotype from "../autotype/api.diagnostics"
import { type Context } from "../context"

export function decorateDiagnostics(ctx: Context) {
  const ls = ctx.languageService

  const { getSyntacticDiagnostics } = ls
  ls.getSyntacticDiagnostics = (...args) => {
    return (
      Autotype.getSyntacticDiagnostics(ctx)(...args) ??
      getSyntacticDiagnostics(...args)
    )
  }

  const { getSemanticDiagnostics } = ls
  ls.getSemanticDiagnostics = (...args) => {
    return (
      Autotype.getSemanticDiagnostics(ctx)(...args) ??
      getSemanticDiagnostics(...args)
    )
  }

  const { getSuggestionDiagnostics } = ls
  ls.getSuggestionDiagnostics = (...args) => {
    return (
      Autotype.getSuggestionDiagnostics(ctx)(...args) ??
      getSuggestionDiagnostics(...args)
    )
  }
}
