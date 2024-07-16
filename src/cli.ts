import cac from "cac"

import * as Config from "./config"
import { typecheck } from "./typecheck"
import { typegen } from "./typegen"

async function typegenAll() {
  let routes = await Config.routes()
  await Promise.all(routes.map(typegen))
}

let cli = cac()

cli.command("typecheck").action(async () => {
  await typegenAll()
  const rootDir = process.cwd()
  typecheck(rootDir)
})

cli.command("typegen").action(typegenAll)

cli.parse()
