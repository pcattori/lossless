import cac from "cac"

import { typecheck } from "./typescript"
import * as typegen from "./typegen"
import type { Config } from "./config"

let cli = cac("lossless")

cli.command("typecheck").action(async () => {
  const config: Config = { appDirectory: process.cwd() }
  typegen.writeAll(config)
  await typecheck(config)
})

cli.command("typegen").action(async () => {
  const config: Config = { appDirectory: process.cwd() }
  typegen.writeAll(config)
})

cli.parse(process.argv, { run: false })
cli.runMatchedCommand()
