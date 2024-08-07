import { getAutotypeLanguageService } from "../autotype"
import { type Context } from "../context"

export function decorateHover(ctx: Context) {
  const ls = ctx.languageService
  const { getQuickInfoAtPosition } = ls
  ls.getQuickInfoAtPosition = (fileName: string, index: number) => {
    const fallback = () => getQuickInfoAtPosition(fileName, index)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const splicedIndex = route.autotyped.toSplicedIndex(index)
    const quickinfo = autotype.getQuickInfoAtPosition(fileName, splicedIndex)
    if (!quickinfo) return fallback()
    return {
      ...quickinfo,
      textSpan: {
        ...quickinfo.textSpan,
        start: route.autotyped.toOriginalIndex(quickinfo.textSpan.start).index,
      },
    }
  }
}
