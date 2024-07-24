import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  entry: ["./src/index.ts"],
  format: ["cjs"],
  target: "node18",
  dts: false,
  banner: { js: "#!/usr/bin/env node" },
  external: ["typescript"],
})
