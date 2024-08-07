import { type Context } from "../context"

import { decorateCompletions } from "./completions"
import { decorateGetDefinition } from "./definitions"
import { decorateDiagnostics } from "./diagnostics"
import { decorateHover } from "./hover"
import { decorateInlayHints } from "./inlay-hints"

export function decorateLanguageService(ctx: Context) {
  decorateCompletions(ctx)
  decorateGetDefinition(ctx)
  decorateDiagnostics(ctx)
  decorateHover(ctx)
  decorateInlayHints(ctx)
}
