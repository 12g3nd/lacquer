import { basename, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { globSync } from 'glob';
import { Project } from 'ts-morph';

const __dirname = dirname(fileURLToPath(import.meta.url));
const globalProject = new Project({
  tsConfigFilePath: resolve(__dirname, '..', 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
  skipLoadingLibFiles: true,
  skipFileDependencyResolution: true,
});

/**
 * `main` / `preload` get a loader per language, so a caller can load just the
 * languages it needs (`loadLanguageResources`) or all of them
 * (`languageResources`, for the language menu).
 *
 * `renderer` gets no translation files at all. Its bundle is compiled
 * synchronously on every full page load, and inlining all 68 languages put
 * ~1.5 MB on that critical path. It asks the preload instead, which has
 * already loaded English plus the selected language.
 */
export const i18nImporter = (target: 'main' | 'preload' | 'renderer') => {
  if (target === 'renderer') {
    return [
      'export const languageResources = async () =>',
      '  await window.lacquerI18n.getLanguageResources();',
      'export const loadLanguageResources = languageResources;',
      '',
    ].join('\n');
  }

  const srcPath = resolve(__dirname, '..', 'src');
  const languages = globSync(['src/i18n/resources/*.json']).map((path) => {
    const nameWithExt = basename(path);
    const name = nameWithExt.replace(extname(nameWithExt), '');

    return { name, path };
  });

  const src = globalProject.createSourceFile(
    'vm:i18n',
    (writer) => {
      writer.writeLine('const loaders = {');
      for (const { name, path } of languages) {
        const absolutePath = resolve(srcPath, '..', path).replace(
          /\\/g,
          '/',
        );

        writer.writeLine(
          `  "${name}": () => import('${absolutePath}').then((mod) => mod.default),`,
        );
      }
      writer.writeLine('};');
      writer.blankLine();
      writer.writeLine('export const loadLanguageResources = async (languages) => {');
      writer.writeLine('  const names = [...new Set(languages)].filter((name) => name in loaders);');
      writer.writeLine('  const entries = await Promise.all(');
      writer.writeLine('    names.map(async (name) => [name, { translation: await loaders[name]() }]),');
      writer.writeLine('  );');
      writer.writeLine('  return Object.fromEntries(entries);');
      writer.writeLine('};');
      writer.blankLine();
      writer.writeLine('export const languageResources = async () =>');
      writer.writeLine('  await loadLanguageResources(Object.keys(loaders));');
      writer.blankLine();
    },
    { overwrite: true },
  );

  return src.getText();
};
