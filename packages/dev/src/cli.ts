import * as fs from "node:fs/promises"
import * as path from "node:path"

import cac from "cac"

import typecheck from "./typecheck"
import { typegen, typegenPath } from "./typegen"
import { getRoutes } from "./routes"
import type { Config } from "./config"

let cli = cac("lossless")

cli.command("typecheck").action(async () => {
  const config: Config = { appDirectory: process.cwd() }
  await typegenFiles(config)
  await typecheck(config)
})

cli.command("typegen").action(async () => {
  const config: Config = { appDirectory: process.cwd() }
  await typegenFiles(config)
})

cli.parse(process.argv, { run: false })
cli.runMatchedCommand()

async function typegenFiles(config: Config) {
  const routes = getRoutes(config)
  await Promise.all(
    routes.map(async (route) => {
      const code = await typegen(config, route)
      const dest = typegenPath(config, route.file)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.writeFile(dest, code)
    }),
  )
}
