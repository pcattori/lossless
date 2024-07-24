import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  entry: ["./src/types.ts"],
  format: ["esm"],
  target: "node18",
  dts: true,
})
