import cac from "cac"

import * as Config from "./config"
import { typecheck } from "./typecheck"
import { typegen } from "./typegen"

let cli = cac()

cli.command("typecheck").action(() => {
  const rootDir = process.cwd()
  typecheck(rootDir)
})

cli.command("typegen").action(async () => {
  let routes = await Config.routes()
  routes.forEach(typegen)
})

cli.parse()
