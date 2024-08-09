import * as Autotype from "../autotype/api.definitions"
import { type Context } from "../context"

export function decorateGetDefinition(ctx: Context) {
  const ls = ctx.languageService

  const { getDefinitionAndBoundSpan } = ls
  ls.getDefinitionAndBoundSpan = (...args) => {
    return (
      Autotype.getDefinitionAndBoundSpan(ctx)(...args) ??
      getDefinitionAndBoundSpan(...args)
    )
  }

  const { getTypeDefinitionAtPosition } = ls
  ls.getTypeDefinitionAtPosition = (...args) => {
    return (
      Autotype.getTypeDefinitionAtPosition(ctx)(...args) ??
      getTypeDefinitionAtPosition(...args)
    )
  }
}
