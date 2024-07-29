import { defineConfig } from "tsup"

export default defineConfig([
  {
    clean: true,
    entry: ["./src/autotype.ts", "./src/typegen.ts"],
    format: ["cjs"],
    target: "node18",
    dts: true,
    external: ["typescript"],
  },
  {
    clean: true,
    entry: ["./src/cli.ts"],
    format: ["cjs"],
    target: "node18",
    dts: false,
    banner: { js: "#!/usr/bin/env node" },
    external: ["typescript"],
  },
])
