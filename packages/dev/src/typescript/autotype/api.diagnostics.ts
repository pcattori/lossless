import type ts from "typescript/lib/tsserverlibrary"

import { getAutotypeLanguageService } from "./language-service"
import { type Context } from "../context"

export const getSyntacticDiagnostics =
  (ctx: Context): ts.LanguageService["getSyntacticDiagnostics"] =>
  (fileName: string) => {
    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return []
    const route = autotype.getRoute(fileName)
    if (!route) return []

    const sourceFile = ctx.languageService.getProgram()?.getSourceFile(fileName)
    if (!sourceFile) return []

    return autotype
      .getSyntacticDiagnostics(fileName)
      .map(remapSpans(sourceFile, route.autotyped.toOriginalIndex))
  }

export const getSemanticDiagnostics =
  (ctx: Context): ts.LanguageService["getSemanticDiagnostics"] =>
  (fileName) => {
    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return []
    const route = autotype.getRoute(fileName)
    if (!route) return []

    const sourceFile = ctx.languageService.getProgram()?.getSourceFile(fileName)
    if (!sourceFile) return []

    return autotype
      .getSemanticDiagnostics(fileName)
      .map(remapSpans(sourceFile, route.autotyped.toOriginalIndex))
  }

export const getSuggestionDiagnostics =
  (ctx: Context): ts.LanguageService["getSuggestionDiagnostics"] =>
  (fileName) => {
    const autotype = getAutotypeLanguageService(ctx)
    if (!autotype) return []
    const route = autotype.getRoute(fileName)
    if (!route) return []

    const sourceFile = ctx.languageService.getProgram()?.getSourceFile(fileName)
    if (!sourceFile) return []

    return autotype
      .getSuggestionDiagnostics(fileName)
      .map(remapSpans(sourceFile, route.autotyped.toOriginalIndex))
  }

const remapSpans =
  <T extends ts.Diagnostic | ts.DiagnosticWithLocation>(
    sourceFile: ts.SourceFile,
    toOriginalIndex: (splicedIndex: number) => {
      index: number
      spliced: boolean
    },
  ) =>
  (diagnostic: T): T => {
    if (!diagnostic.start) return diagnostic

    const { index, spliced } = toOriginalIndex(diagnostic.start)
    let length = diagnostic.length
    if (spliced) {
      // avoid diagnostics in splices from overflowing onto unrelated code
      length = 1
    }
    return {
      ...diagnostic,
      start: index,
      length,
      file: sourceFile,
    }
  }
