import { getAutotypeLanguageService } from "../autotype"
import { type Context } from "../context"

export function decorateInlayHints(ctx: Context): void {
  const ls = ctx.languageService
  const { provideInlayHints } = ls
  ls.provideInlayHints = (fileName, span, preferences) => {
    const fallback = () => provideInlayHints(fileName, span, preferences)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const start = route.autotyped.toSplicedIndex(span.start)
    return autotype.languageService
      .provideInlayHints(
        fileName,
        {
          start,
          length:
            route.autotyped.toSplicedIndex(span.start + span.length) - start,
        },
        preferences,
      )
      .map((hint) => ({
        ...hint,
        position: route.autotyped.toOriginalIndex(hint.position).index,
      }))
  }
}
