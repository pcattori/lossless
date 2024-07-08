import type { getSourceMapRange } from "typescript/lib/tsserverlibrary";
import type ts from "typescript/lib/tsserverlibrary";

type TS = typeof ts;

function init(modules: { typescript: TS }) {
  const ts = modules.typescript;
  function create(info: ts.server.PluginCreateInfo) {
    let ls = info.languageService;

    // getDefinition
    const getDefinitionAndBoundSpan = ls.getDefinitionAndBoundSpan;
    ls.getDefinitionAndBoundSpan = (fileName, position) => {
      const definition = getDefinitionAndBoundSpan(fileName, position);
      if (!definition?.definitions) {
        return getDefinitions(ts, info, fileName, position);
      }
      return definition;
    };
  }
  return { create };
}

function getDefinitions(
  ts: TS,
  info: ts.server.PluginCreateInfo,
  fileName: string,
  position: number,
): ts.DefinitionInfoAndBoundSpan | undefined {
  const { vls } = getVirtualLanguageServer(ts, info);
}

function getVirtualLanguageServer(ts: TS, info: ts.server.PluginCreateInfo) {
  let oghost = info.languageServiceHost;

  class VirtualLanguageServiceHost implements ts.LanguageServiceHost {
    constructor() {}

    // Q: no-ops to avoid noisy output?
    log() {}
    trace() {}
    error() {}

    getScriptVersion = oghost.getScriptVersion;
    getScriptSnapshot = oghost.getScriptSnapshot;
    getScriptFileNames = oghost.getScriptFileNames;

    fileExists = oghost.fileExists;
    getCompilationSettings = oghost.getCompilationSettings;
    getCurrentDirectory = oghost.getCurrentDirectory;
    getDefaultLibFileName = oghost.getDefaultLibFileName;
    readFile = oghost.readFile;
    // getCancellationToken
    // getDirectories = oghost.getDirectories;
    // getNewLine
    // readDirectory = oghost.readDirectory;
    // realpath
    // resolveModuleNameLiterals = oghost.resolveModuleNameLiterals;
    // resolveModuleNames = oghost.resolveModuleNames;
    // useCaseSensitiveFileNames
  }

  let vlsh = new VirtualLanguageServiceHost();
  let vls = ts.createLanguageService(vlsh);
  return {
    vlsh,
    vls,
  };
}

export = init;
