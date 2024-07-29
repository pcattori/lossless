import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  entry: ["./src/autotype.ts"],
  format: ["cjs"],
  target: "node18",
  dts: true,
  external: ["typescript"],
})
