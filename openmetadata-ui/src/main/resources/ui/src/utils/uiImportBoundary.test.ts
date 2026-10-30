/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import fs from 'fs';
import path from 'path';

const UI_ROOT = path.resolve(__dirname, '../..');
const SRC_ROOT = path.join(UI_ROOT, 'src');

const SCRIPT_SPECIFIER =
  /(?:\bfrom|\bimport|\bimport\s*\(|\brequire\s*\()\s*['"](\.{1,2}(?:\/[^'"\n]*)?)['"]/g;
const STYLE_SPECIFIER =
  /(?:@import\s*(?:\([^)]*\)\s*)?(?:url\(\s*)?|\burl\(\s*)['"]?(\.{1,2}\/[^'"()\s;]*)/g;

const SPECIFIER_BY_EXTENSION = new Map([
  ['.ts', SCRIPT_SPECIFIER],
  ['.tsx', SCRIPT_SPECIFIER],
  ['.js', SCRIPT_SPECIFIER],
  ['.jsx', SCRIPT_SPECIFIER],
  ['.less', STYLE_SPECIFIER],
  ['.css', STYLE_SPECIFIER],
]);
const TEST_DIRECTORIES = new Set(['__mocks__', '__tests__']);
const TEST_PATHS = new Set([
  path.join(SRC_ROOT, 'test'),
  path.join(SRC_ROOT, 'setupTests.js'),
]);
const TEST_FILE = /\.(test|spec)\.[jt]sx?$/;

const collectProductionFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (TEST_PATHS.has(fullPath)) {
      return [];
    }

    if (entry.isDirectory()) {
      return TEST_DIRECTORIES.has(entry.name)
        ? []
        : collectProductionFiles(fullPath);
    }

    return SPECIFIER_BY_EXTENSION.has(path.extname(entry.name)) &&
      !TEST_FILE.test(entry.name)
      ? [fullPath]
      : [];
  });

const toUiRelativePath = (file: string): string =>
  path.relative(UI_ROOT, file).split(path.sep).join('/');

const findImportsLeavingSrc = (file: string): string[] => {
  const specifierPattern = SPECIFIER_BY_EXTENSION.get(path.extname(file));

  if (!specifierPattern) {
    return [];
  }

  return [...fs.readFileSync(file, 'utf8').matchAll(specifierPattern)]
    .map(([, specifier]) => specifier)
    .filter((specifier) => {
      const target = path.resolve(
        path.dirname(file),
        specifier.split(/[?#]/)[0]
      );

      return path.relative(SRC_ROOT, target).startsWith('..');
    })
    .map((specifier) => `${toUiRelativePath(file)}: ${specifier}`);
};

describe('UI import boundary', () => {
  // Collate copies only src/ into its own UI, so a relative import that
  // leaves src/ does not resolve there.
  // ADR:2026-10-30-production-ui-code-imports-only-from-the-ui-src-folder
  it('keeps every production import inside src/', () => {
    expect(
      collectProductionFiles(SRC_ROOT).flatMap(findImportsLeavingSrc)
    ).toEqual([]);
  });
});
