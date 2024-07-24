export const serverLoader = () => 1

export const clientLoader = () => 1

export default ({ params, loaderData }) => {
  let a: string = loaderData
  return `Hello, ${params.id}!`
}

const blah = {
  caller: 1,
  stuff: 2
}

/*
Info 24   [14:27:22.967] Enabling plugin @lossless/ts-plugin from candidate paths:

/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/typescript@5.5.3/node_modules/typescript/lib/typescript.js/../../..

Info 27   [14:18:42.219] Failed to load module '@lossless/ts-plugin' from /Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/typescript@5.5.3/node_modules/node_modules: Error: Could not resolve JS module '@lossless/ts-plugin' starting at '/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/typescript@5.5.3/node_modules/node_modules'.

Looked in:


/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/typescript@5.5.3/node_modules/@lossless/ts-plugin/package.json
/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/typescript@5.5.3/node_modules/@lossless/ts-plugin.js
/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/typescript@5.5.3/node_modules/@lossless/ts-plugin.jsx
/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/typescript@5.5.3/node_modules/@lossless/ts-plugin/index.js
/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/typescript@5.5.3/node_modules/@lossless/ts-plugin/index.jsx

/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/node_modules/@lossless/ts-plugin/package.json
/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/node_modules/@lossless/ts-plugin.js
/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/node_modules/@lossless/ts-plugin.jsx
/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/node_modules/@lossless/ts-plugin/index.js
/Users/pedrocattori/pcattori/lossless/node_modules/.pnpm/node_modules/@lossless/ts-plugin/index.jsx

/Users/pedrocattori/pcattori/lossless/node_modules/@lossless/ts-plugin/package.json
/Users/pedrocattori/pcattori/lossless/node_modules/@lossless/ts-plugin.js
/Users/pedrocattori/pcattori/lossless/node_modules/@lossless/ts-plugin.jsx
/Users/pedrocattori/pcattori/lossless/node_modules/@lossless/ts-plugin/index.js
/Users/pedrocattori/pcattori/lossless/node_modules/@lossless/ts-plugin/index.jsx

/Users/pedrocattori/pcattori/node_modules/@lossless/ts-plugin/package.json
/Users/pedrocattori/pcattori/node_modules/@lossless/ts-plugin.js
/Users/pedrocattori/pcattori/node_modules/@lossless/ts-plugin.jsx
/Users/pedrocattori/pcattori/node_modules/@lossless/ts-plugin/index.js
/Users/pedrocattori/pcattori/node_modules/@lossless/ts-plugin/index.jsx

/Users/pedrocattori/node_modules/@lossless/ts-plugin/package.json
/Users/pedrocattori/node_modules/@lossless/ts-plugin.js
/Users/pedrocattori/node_modules/@lossless/ts-plugin.jsx
/Users/pedrocattori/node_modules/@lossless/ts-plugin/index.js
/Users/pedrocattori/node_modules/@lossless/ts-plugin/index.jsx

/Users/node_modules/@lossless/ts-plugin/package.json
/Users/node_modules/@lossless/ts-plugin.js
/Users/node_modules/@lossless/ts-plugin.jsx
/Users/node_modules/@lossless/ts-plugin/index.js
/Users/node_modules/@lossless/ts-plugin/index.jsx

/node_modules/@lossless/ts-plugin/package.json
/node_modules/@lossless/ts-plugin.js
/node_modules/@lossless/ts-plugin.jsx
/node_modules/@lossless/ts-plugin/index.js
/node_modules/@lossless/ts-plugin/index.jsx
*/