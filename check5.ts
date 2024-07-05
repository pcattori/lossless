import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

function checkDefaultExportType(filePath: string, expectedType: string) {
  console.log(`Checking file: ${filePath}`);
  console.log(`Expected type: ${expectedType}`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  console.log("File contents:");
  console.log(fileContents);

  const fileName = path.basename(filePath);
  const directory = path.dirname(filePath);

  const sourceText = `
import DefaultExport from './${fileName}';
const _typeCheck: ${expectedType} = DefaultExport;
`;

  const checkFileName = path.join(directory, "__typeCheck.ts");

  console.log("Generated check file contents:");
  console.log(sourceText);

  const compilerOptions: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2015,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;

  host.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (fileName === checkFileName) {
      console.log(`Serving generated file: ${checkFileName}`);
      return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest);
    }
    const sourceFile = originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
    if (sourceFile) {
      console.log(`Loaded source file: ${fileName}`);
    } else {
      console.log(`Failed to load source file: ${fileName}`);
    }
    return sourceFile;
  };

  console.log("Creating program...");
  const program = ts.createProgram(
    [checkFileName, filePath],
    compilerOptions,
    host,
  );

  console.log("Getting pre-emit diagnostics...");
  const diagnostics = ts.getPreEmitDiagnostics(program);

  console.log(`Found ${diagnostics.length} diagnostics`);

  if (diagnostics.length > 0) {
    diagnostics.forEach((diagnostic) => {
      if (diagnostic.file) {
        const { line, character } =
          diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
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
  } else {
    console.log(
      "No diagnostics found. Default export type matches the expected type.",
    );
  }
}

// Usage
const filePath = path.join(__dirname, "foo.ts");
checkDefaultExportType(filePath, "{ a: { b: { c: number } } }");
