import * as ts from "typescript";
import * as path from "path";

function createProgram(
  rootFiles: string[],
  options: ts.CompilerOptions,
): ts.Program {
  const host = ts.createCompilerHost(options);

  // Override the readFile function to augment foo.ts files
  const originalReadFile = host.readFile;
  host.readFile = (fileName: string) => {
    let content = originalReadFile(fileName);
    if (content && path.basename(fileName) === "foo.ts") {
      content = augmentFooFile(content);
      console.log("readFile:", fileName);
      console.log(content);
    }
    return content;
  };

  return ts.createProgram(rootFiles, options, host);
}

function augmentFooFile(content: string): string {
  console.log("augment");
  // Add type annotation for default export if it doesn't exist
  if (!content.includes("export default")) {
    return content;
  }

  /export\s+default\s+()/;
  // If default export exists, try to add type annotation
  return content.replace(
    /export\s+default\s+function(\s*\([^)]*\))?\s*{/,
    "export default function(a: number, b: number): number {",
  );
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
