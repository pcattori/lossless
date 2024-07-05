import * as ts from "typescript";
import * as path from "path";

function createProgram(
  rootFiles: string[],
  options: ts.CompilerOptions,
): ts.Program {
  const host = ts.createCompilerHost(options);

  const originalReadFile = host.readFile;
  host.readFile = (fileName: string) => {
    const content = originalReadFile(fileName);
    if (content && path.basename(fileName) === "foo.ts") {
      return augmentFooFile(content, fileName);
    }
    return content;
  };

  return ts.createProgram(rootFiles, options, host);
}

function typeCheck(rootDir: string) {
  const configPath = ts.findConfigFile(
    rootDir,
    ts.sys.fileExists,
    "tsconfig.json",
  );
  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.");
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsedCommandLine = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  );

  const program = createProgram(
    parsedCommandLine.fileNames,
    parsedCommandLine.options,
  );
  const diagnostics = ts.getPreEmitDiagnostics(program);

  diagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start!,
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n",
      );
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`,
      );
    } else {
      console.log(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );
    }
  });
}

// Usage
const rootDir = process.cwd(); // Or provide the path to your project root
typeCheck(rootDir);

function augmentFooFile(content: string, fileName: string): string {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
  );

  let startIndex: number | undefined;
  let endIndex: number | undefined;

  const findDefaultExportIndices = (node: ts.Node) => {
    if (ts.isExportAssignment(node)) {
      startIndex = node.expression.getStart(sourceFile);
      endIndex = node.expression.getEnd();
      return;
    }
    ts.forEachChild(node, findDefaultExportIndices);
  };

  findDefaultExportIndices(sourceFile);

  if (startIndex !== undefined && endIndex !== undefined) {
    console.log(`Default export expression found in ${fileName}:`);
    console.log(`Start index: ${startIndex}`);
    console.log(`End index: ${endIndex}`);
    console.log(
      `Original expression: "${content.slice(startIndex, endIndex)}"`,
    );

    const beforeExpr = content.slice(0, startIndex);
    const expr = content.slice(startIndex, endIndex);
    const afterExpr = content.slice(endIndex);

    const newContent = `${beforeExpr}(${expr}) satisfies (a: number, b: number) => number${afterExpr}`;
    console.log(`Changed content:`, newContent);
    return newContent;
  }

  console.log(`No default export found in ${fileName}`);
  return content;
}
