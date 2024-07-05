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
    return newContent;
  }

  console.log(`No default export found in ${fileName}`);
  return content;
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
  let diagnostics = ts.getPreEmitDiagnostics(program);

  // Store original contents of foo.ts files
  const originalContents: { [fileName: string]: string } = {};
  program.getSourceFiles().forEach((sourceFile) => {
    if (path.basename(sourceFile.fileName) === "foo.ts") {
      originalContents[sourceFile.fileName] = sourceFile.text;
    }
  });

  // Adjust diagnostics for foo.ts files
  diagnostics = diagnostics.filter((diagnostic) => {
    if (
      diagnostic.file &&
      path.basename(diagnostic.file.fileName) === "foo.ts"
    ) {
      const originalContent = originalContents[diagnostic.file.fileName];
      if (!originalContent) return true; // Keep the diagnostic if we can't find the original content

      // Check if the error is related to our augmentation
      if (diagnostic.start !== undefined) {
        const errorPos = diagnostic.start;
        const augmentedPart = ") satisfies (a: number, b: number) => number";
        if (
          originalContent.length <= errorPos ||
          diagnostic.file.text.substr(errorPos, augmentedPart.length) ===
            augmentedPart
        ) {
          return false; // Filter out this diagnostic
        }
      }

      // Adjust start and length to refer to original content
      if (diagnostic.start !== undefined) {
        diagnostic.start = Math.max(0, diagnostic.start - 1);
      }
      if (diagnostic.length !== undefined) {
        diagnostic.length = Math.min(
          diagnostic.length,
          originalContent.length - diagnostic.start!,
        );
      }

      // Remove all nested diagnostics
      if (
        diagnostic.messageText &&
        typeof diagnostic.messageText === "object"
      ) {
        diagnostic.messageText = { ...diagnostic.messageText, next: undefined };
      }
    }
    return true;
  });

  if (diagnostics.length > 0) {
    const formatHost: ts.FormatDiagnosticsHost = {
      getCanonicalFileName: (path) => path,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => ts.sys.newLine,
    };

    const formattedDiagnostics = ts.formatDiagnosticsWithColorAndContext(
      diagnostics.map((d) => {
        if (d.file && path.basename(d.file.fileName) === "foo.ts") {
          return {
            ...d,
            file: {
              ...d.file,
              text: originalContents[d.file.fileName] || d.file.text,
            },
          };
        }
        return d;
      }),
      formatHost,
    );
    console.log(formattedDiagnostics);

    const errorCount = diagnostics.filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    ).length;
    const warningCount = diagnostics.filter(
      (d) => d.category === ts.DiagnosticCategory.Warning,
    ).length;
    console.log(
      `Found ${errorCount} error${errorCount === 1 ? "" : "s"} and ${warningCount} warning${warningCount === 1 ? "" : "s"}.`,
    );
  } else {
    console.log(
      "\x1b[36m%s\x1b[0m",
      "✨ Done. No errors or warnings were found.",
    );
  }
}

// Usage
const rootDir = process.cwd(); // Or provide the path to your project root
typeCheck(rootDir);
