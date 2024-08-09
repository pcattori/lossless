import { getAutotypeLanguageService } from "../autotype"
import { type Context } from "../context"

export function decorateCompletions(ctx: Context) {
  const ls = ctx.languageService
  const { getCompletionsAtPosition } = ls
  ls.getCompletionsAtPosition = (fileName, index, options, settings) => {
    const fallback = () =>
      getCompletionsAtPosition(fileName, index, options, settings)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const splicedIndex = route.autotyped.toSplicedIndex(index)
    const completions = autotype.getCompletionsAtPosition(
      fileName,
      splicedIndex,
      options,
      settings,
    )
    if (!completions) return

    completions.entries = completions.entries.map((c) => {
      if (c.replacementSpan) {
        return {
          ...c,
          replacementSpan: {
            ...c.replacementSpan,
            start: route.autotyped.toOriginalIndex(c.replacementSpan.start)
              .index,
          },
        }
      }
      return c
    })
    if (completions.optionalReplacementSpan) {
      completions.optionalReplacementSpan = {
        ...completions.optionalReplacementSpan,
        start: route.autotyped.toOriginalIndex(
          completions.optionalReplacementSpan.start,
        ).index,
      }
    }
    return completions
  }

  const { getCompletionEntryDetails } = ls
  ls.getCompletionEntryDetails = (
    fileName,
    position,
    entryName,
    formatOptions,
    source,
    preferences,
    data,
  ) => {
    const fallback = () =>
      getCompletionEntryDetails(
        fileName,
        position,
        entryName,
        formatOptions,
        source,
        preferences,
        data,
      )

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const details = autotype.getCompletionEntryDetails(
      fileName,
      route.autotyped.toSplicedIndex(position),
      entryName,
      formatOptions,
      source,
      preferences,
      data,
    )
    if (!details) return

    details.codeActions = details.codeActions?.map((codeAction) => {
      codeAction.changes = codeAction.changes.map((change) => {
        change.textChanges = change.textChanges.map((textChange) => {
          return {
            ...textChange,
            span: {
              ...textChange.span,
              start: route.autotyped.toOriginalIndex(textChange.span.start)
                .index,
            },
          }
        })
        return change
      })
      return codeAction
    })
    return details
  }

  const { getSignatureHelpItems } = ls
  ls.getSignatureHelpItems = (fileName, position, options) => {
    const fallback = () => getSignatureHelpItems(fileName, position, options)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    return autotype.getSignatureHelpItems(
      fileName,
      route.autotyped.toSplicedIndex(position),
      options,
    )
  }
}
