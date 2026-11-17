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

// The lookup RJSF's findSchemaDefinition does: URI-decode the fragment, then walk
// it as an RFC 6901 JSON Pointer, where an empty token is a real (empty) key.
const resolves = (document: unknown, ref: string): boolean => {
  const pointer = decodeURIComponent(ref.slice(1));
  let current = document;

  return (
    (pointer === '' || pointer.startsWith('/')) &&
    pointer
      .split('/')
      .slice(1)
      .every((token) => {
        const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
        const found =
          isObject(current) &&
          Object.prototype.hasOwnProperty.call(current, key);
        current = found ? (current as Record<string, unknown>)[key] : undefined;

        return found;
      })
  );
};

describe('resolves', () => {
  const document = {
    definitions: { x: {}, '': { y: {} }, 'a/b': {}, 'a~b': {}, 'a b': {} },
  };

  it.each([
    ['#', true],
    ['#/definitions/x', true],
    ['#/definitions//y', true],
    ['#/definitions//x', false],
    ['#/definitions/a~1b', true],
    ['#/definitions/a~0b', true],
    ['#/definitions/a%20b', true],
    ['#/definitions/missing', false],
    ['#/definitions/x/constructor', false],
    ['#definitions/x', false],
  ])('%s → %s', (ref, expected) => {
    expect(resolves(document, ref)).toBe(expected);
  });
});

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
