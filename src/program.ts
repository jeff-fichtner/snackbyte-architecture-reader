import { relative } from 'node:path';
import ts from 'typescript';
import { StopError } from './errors.js';

function describe(diagnostic: ts.Diagnostic, root: string): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (diagnostic.file && diagnostic.start !== undefined) {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const file = relative(root, diagnostic.file.fileName);
    return `${file}:${line + 1}:${character + 1}: ${message}`;
  }
  return message;
}

/** Parses one TypeScript project file, or stops naming what is wrong with it. */
function parseProject(project: string, root: string): ts.ParsedCommandLine {
  const problems: ts.Diagnostic[] = [];
  const host: ts.ParseConfigFileHost = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => problems.push(diagnostic),
  };
  const parsed = ts.getParsedCommandLineOfConfigFile(project, {}, host);
  const all = [...problems, ...(parsed?.errors ?? [])];
  if (!parsed || all.length > 0) {
    const messages = all.map((d) => describe(d, root)).join('\n');
    throw new StopError(`${relative(root, project)}: the project cannot be read\n${messages}`);
  }
  return parsed;
}

/**
 * Builds one compiler program per project. Code the compiler reports errors in stops the run:
 * a report made from a partial picture would read as the whole one.
 */
export function loadPrograms(projects: string[], root: string): ts.Program[] {
  return projects.map((project) => {
    const parsed = parseProject(project, root);
    const program = ts.createProgram({
      rootNames: parsed.fileNames,
      options: parsed.options,
      projectReferences: parsed.projectReferences ?? [],
      configFileParsingDiagnostics: parsed.errors,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length > 0) {
      const messages = diagnostics.map((d) => describe(d, root)).join('\n');
      throw new StopError(`the compiler reports errors in ${relative(root, project)}\n${messages}`);
    }
    return program;
  });
}
