import * as Autotype from "../autotype/api.inlay-hints"
import { type Context } from "../context"

export function decorateInlayHints(ctx: Context): void {
  const ls = ctx.languageService
  const { provideInlayHints } = ls
  ls.provideInlayHints = (...args) => {
    return (
      Autotype.provideInlayHints(ctx)(...args) ?? provideInlayHints(...args)
    )
  }
}
