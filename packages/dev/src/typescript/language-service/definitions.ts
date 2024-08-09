import type ts from "typescript/lib/tsserverlibrary"

import { getAutotypeLanguageService } from "../autotype"
import { type Context } from "../context"

export function decorateGetDefinition(ctx: Context) {
  const ls = ctx.languageService
  const { getDefinitionAndBoundSpan } = ls
  ls.getDefinitionAndBoundSpan = (fileName, index) => {
    const fallback = () => getDefinitionAndBoundSpan(fileName, index)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const splicedIndex = route.autotyped.toSplicedIndex(index)

    const result = autotype.getDefinitionAndBoundSpan(fileName, splicedIndex)
    if (!result) return

    return {
      definitions: result.definitions?.map(toOriginalIndex(autotype)),
      textSpan: {
        ...result.textSpan,
        start: route.autotyped.toOriginalIndex(result.textSpan.start).index,
      },
    }
  }

  let { getTypeDefinitionAtPosition } = ls
  ls.getTypeDefinitionAtPosition = (fileName, index) => {
    const fallback = () => getTypeDefinitionAtPosition(fileName, index)

    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return fallback()

    const route = autotype.getRoute(fileName)
    if (!route) return fallback()

    const splicedIndex = route.autotyped.toSplicedIndex(index)

    const definitions = autotype.getTypeDefinitionAtPosition(
      fileName,
      splicedIndex,
    )
    if (!definitions) return

    return definitions.map(toOriginalIndex(autotype))
  }
}

const toOriginalIndex =
  (autotype: ReturnType<typeof getAutotypeLanguageService>) =>
  (definition: ts.DefinitionInfo): ts.DefinitionInfo => {
    const definitionRoute = autotype.getRoute(definition.fileName)
    if (!definitionRoute) return definition
    return {
      ...definition,
      textSpan: {
        ...definition.textSpan,
        start: definitionRoute.autotyped.toOriginalIndex(
          definition.textSpan.start,
        ).index,
      },
    }
  }
