import * as ts from "typescript";
import * as path from "path";

function checkDefaultExportType(filePath: string, expectedType: string) {
  const { name: fileName } = path.parse(filePath);
  console.log(fileName);
  const directory = path.dirname(filePath);

  // Create a new source file that imports and checks the type
  const sourceText = `
import DefaultExport from './${fileName}';

// Type check
const _typeCheck: ${expectedType} = DefaultExport;
`;

  const checkFileName = path.join(directory, "__typeCheck.ts");

  const compilerOptions: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
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
      return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest);
    }
    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };

  const program = ts.createProgram(
    [checkFileName, filePath],
    compilerOptions,
    host,
  );
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length > 0) {
    diagnostics.forEach((diagnostic) => {
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } =
          diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const message = ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n",
        );
        console.log(
          `${diagnostic.file.fileName}:${line + 1}:${character + 1} - error TS${diagnostic.code}: ${message}`,
        );
      } else {
        console.log(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      }
    });
  } else {
    console.log("Default export type matches the expected type");
  }
}

// Usage
const filePath = path.join(__dirname, "foo.ts");
checkDefaultExportType(filePath, "{ a: { b: { c: number } } }");
