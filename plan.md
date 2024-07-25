# plan

## todo

- [ ] pnpm workspace structure w/ ts plugin
- [ ] serializable transform with opt for natively serializable types
  - turbo-stream : omit unserializable types! instead of crashing
- [ ] pkg bin fix (bin.js points to built cli)

## repo structure

- package/
  - export `.` : typescript plugin
  - bin : cli (`typegen` + `check`)
  - lib
    - text with edits
    - annotate route exports
    - typegen

## typecheck

- don't translate diagnostics for this yet

## ts plugin
