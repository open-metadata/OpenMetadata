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

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const TEST_DIRECTORIES = new Set(['__mocks__', '__tests__']);
const TEST_PATHS = new Set([
  path.join(SRC_ROOT, 'test'),
  path.join(SRC_ROOT, 'setupTests.js'),
]);
const TEST_FILE = /\.(test|spec)\.[jt]sx?$/;

const RELATIVE_SPECIFIER =
  /(?:\bfrom|\bimport|\bimport\s*\(|\brequire\s*\()\s*['"](\.{1,2}(?:\/[^'"\n]*)?)['"]/g;

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

    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
      !TEST_FILE.test(entry.name)
      ? [fullPath]
      : [];
  });

const toUiRelativePath = (file: string): string =>
  path.relative(UI_ROOT, file).split(path.sep).join('/');

const findImportsLeavingUi = (file: string): string[] =>
  [...fs.readFileSync(file, 'utf8').matchAll(RELATIVE_SPECIFIER)]
    .map(([, specifier]) => specifier)
    .filter((specifier) => {
      const target = path.resolve(path.dirname(file), specifier.split('?')[0]);

      return path.relative(UI_ROOT, target).startsWith('..');
    })
    .map((specifier) => `${toUiRelativePath(file)}: ${specifier}`);

describe('UI import boundary', () => {
  // Collate builds this folder from a different parent directory, so a
  // relative import that leaves it does not resolve there.
  it('keeps every production import inside the UI folder', () => {
    expect(
      collectProductionFiles(SRC_ROOT).flatMap(findImportsLeavingUi)
    ).toEqual([]);
  });
});
