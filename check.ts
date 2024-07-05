import * as ts from "typescript";
import * as path from "path";

function checkDefaultExportType(filePath: string) {
  // Create a program
  const program = ts.createProgram([filePath], {});
  const sourceFile = program.getSourceFile(filePath);
  const typeChecker = program.getTypeChecker();

  if (!sourceFile) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  // Find the default export
  const defaultExport = sourceFile.statements.find(ts.isExportAssignment);

  if (!defaultExport) {
    console.error("No default export found");
    return;
  }

  // Get the type of the default export
  const exportType = typeChecker.getTypeAtLocation(defaultExport.expression);

  // Check if the type extends number
  const numberType = typeChecker.getNumberType();

  console.log({ exportType, numberType });

  if (!typeChecker.isTypeAssignableTo(exportType, numberType)) {
    const typeName = typeChecker.typeToString(exportType);
    console.log(
      `Type error: Default export type '${typeName}' does not extend 'number'`,
    );
  } else {
    console.log("Default export type extends number");
  }
}

// Usage
const filePath = path.join(__dirname, "foo.ts");
checkDefaultExportType(filePath);
