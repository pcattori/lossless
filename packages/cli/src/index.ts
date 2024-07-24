import cac from "cac"

import typecheck from "./typecheck"
import typegen from "./typegen"

let cli = cac()

cli.command("").action(() => {
  console.error("ERROR: command not found")
})

cli.command("typecheck").action(async () => {
  await typegen()
  typecheck()
})

cli.command("typegen").action(typegen)

cli.parse()
