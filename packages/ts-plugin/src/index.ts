import * as path from "node:path"

import type ts from "typescript/lib/tsserverlibrary"

import {
  type Config,
  typegenWatch,
  decorateLanguageService,
} from "@lossless/dev"

// plugin
// ----------------------------------------------------------------------------

function init(modules: { typescript: typeof ts }) {
  function create(info: ts.server.PluginCreateInfo) {
    const { logger } = info.project.projectService
    logger.info("[@lossless/ts-plugin] setup")

    const config = getConfig(info.project)
    if (!config) return
    typegenWatch(config, (msg) => logger.info("[@lossless/ts-plugin] " + msg))

    decorateLanguageService({
      config,
      languageService: info.languageService,
      languageServiceHost: info.languageServiceHost,
      ts: modules.typescript,
      logger,
    })
    return info.languageService
  }

  return { create }
}
export = init

function getConfig(project: ts.server.Project): Config | undefined {
  const compilerOptions = project.getCompilerOptions()

  if (typeof compilerOptions.configFilePath === "string") {
    return {
      appDirectory: path.dirname(compilerOptions.configFilePath),
    }
  }

  const packageJsonPath = path.join(
    project.getCurrentDirectory(),
    "package.json",
  )
  if (!project.fileExists(packageJsonPath)) return
  return {
    appDirectory: project.getCurrentDirectory(),
  }
}
