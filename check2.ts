import * as ts from "typescript";
import * as path from "path";

function checkDefaultExportType(filePath: string) {
  const program = ts.createProgram([filePath], {});
  const sourceFile = program.getSourceFile(filePath);
  const typeChecker = program.getTypeChecker();

  if (!sourceFile) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const defaultExport = sourceFile.statements.find(ts.isExportAssignment);

  if (!defaultExport) {
    console.error("No default export found");
    return;
  }

  const exportType = typeChecker.getTypeAtLocation(defaultExport.expression);
  const numberType = typeChecker.getNumberType();

  if (!typeChecker.isTypeAssignableTo(exportType, numberType)) {
    const diagnostic = createDiagnostic(
      sourceFile,
      defaultExport,
      exportType,
      numberType,
      typeChecker,
    );
    const formattedMessage = ts.formatDiagnostic(diagnostic, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => "\n",
    });

    console.log(formattedMessage);
  } else {
    console.log("Default export type extends number");
  }
}

function createDiagnostic(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  actualType: ts.Type,
  expectedType: ts.Type,
  typeChecker: ts.TypeChecker,
): ts.Diagnostic {
  const actualTypeString = typeChecker.typeToString(actualType);
  const expectedTypeString = typeChecker.typeToString(expectedType);

  return {
    file: sourceFile,
    start: node.getStart(),
    length: node.getWidth(),
    category: ts.DiagnosticCategory.Error,
    code: 2322,
    messageText: `Type '${actualTypeString}' is not assignable to type '${expectedTypeString}'.`,
  };
}

// Usage
const filePath = path.join(__dirname, "foo.ts");
checkDefaultExportType(filePath);
