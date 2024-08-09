import { type Context } from "../context"

import * as Autotype from "../autotype/api.completions"

export function decorateCompletions(ctx: Context) {
  const ls = ctx.languageService

  const { getCompletionsAtPosition } = ls
  ls.getCompletionsAtPosition = (...args) => {
    return (
      Autotype.getCompletionsAtPosition(ctx)(...args) ??
      getCompletionsAtPosition(...args)
    )
  }

  const { getCompletionEntryDetails } = ls
  ls.getCompletionEntryDetails = (...args) => {
    return (
      Autotype.getCompletionEntryDetails(ctx)(...args) ??
      getCompletionEntryDetails(...args)
    )
  }

  const { getSignatureHelpItems } = ls
  ls.getSignatureHelpItems = (...args) => {
    return (
      Autotype.getSignatureHelpItems(ctx)(...args) ??
      getSignatureHelpItems(...args)
    )
  }
}
