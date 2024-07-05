import * as ts from "typescript";
import * as path from "path";

function checkDefaultExportType(filePath: string, expectedType: string) {
  const host = ts.createCompilerHost({});
  const originalGetSourceFile = host.getSourceFile;

  host.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const sourceFile = originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
    if (sourceFile && fileName === filePath) {
      const typeCheck = ts.factory.createTypeAliasDeclaration(
        undefined,
        ts.factory.createIdentifier("__TypeCheck"),
        undefined,
        ts.factory.createTypeReferenceNode(expectedType, undefined),
      );
      const assertion = ts.factory.createExpressionStatement(
        ts.factory.createAsExpression(
          ts.factory.createIdentifier("__export"),
          ts.factory.createTypeReferenceNode("__TypeCheck", undefined),
        ),
      );

      const updatedStatements = [
        ...sourceFile.statements,
        typeCheck,
        ts.factory.createVariableStatement(
          undefined,
          ts.factory.createVariableDeclarationList(
            [
              ts.factory.createVariableDeclaration(
                ts.factory.createIdentifier("__export"),
                undefined,
                undefined,
                ts.factory.createIdentifier("default"),
              ),
            ],
            ts.NodeFlags.Const,
          ),
        ),
        assertion,
      ];

      return ts.factory.updateSourceFile(sourceFile, updatedStatements);
    }
    return sourceFile;
  };

  const program = ts.createProgram([filePath], {}, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);

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
