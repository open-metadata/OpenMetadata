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

// Output of parseSchemas.js. RJSF resolves each local `$ref` with JSON Pointer
// against the document root, so a pointer that runs through another `$ref`
// fails at render time with "Could not find a definition".
const UI_ROOT = path.resolve(__dirname, '../..');
const GENERATED_DIRS = ['src/jsons', 'public/jsons'].map((dir) =>
  path.join(UI_ROOT, dir)
);

const isObject = (node: unknown): node is Record<string, unknown> =>
  typeof node === 'object' && node !== null;

const listJsonFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listJsonFiles(entryPath);
    }

    return entry.name.endsWith('.json') ? [entryPath] : [];
  });

const collectLocalRefs = (node: unknown, refs: string[] = []): string[] => {
  if (isObject(node)) {
    if (typeof node.$ref === 'string' && node.$ref.startsWith('#')) {
      refs.push(node.$ref);
    }
    Object.values(node).forEach((child) => collectLocalRefs(child, refs));
  }

  return refs;
};

const resolves = (document: unknown, ref: string): boolean => {
  let current = document;

  return ref
    .slice(1)
    .split('/')
    .filter(Boolean)
    .every((token) => {
      const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
      const found = isObject(current) && key in current;
      current = found ? (current as Record<string, unknown>)[key] : undefined;

      return found;
    });
};

describe('Generated JSON schemas', () => {
  const files = GENERATED_DIRS.flatMap(listJsonFiles);

  it('finds the generated schemas', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(UI_ROOT, file), file]))(
    '%s has no local $ref that resolves to nothing',
    (_, file) => {
      const document = JSON.parse(fs.readFileSync(file, 'utf8'));

      expect(
        collectLocalRefs(document).filter((ref) => !resolves(document, ref))
      ).toEqual([]);
    }
  );
});
