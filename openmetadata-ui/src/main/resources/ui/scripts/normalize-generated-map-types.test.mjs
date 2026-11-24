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
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeGeneratedMapTypes } from './normalize-generated-map-types.mjs';

const quicktype = process.env.QUICKTYPE_BIN;
assert.ok(
  quicktype,
  'Set QUICKTYPE_BIN to the pinned binary resolved by json2ts.sh.'
);
const ts = createRequire(realpathSync(quicktype))('typescript');
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDirectory, '../../../../../..');

for (const [trigger, property] of [
  ['eventBasedEntityTrigger', 'filter'],
  ['periodicBatchEntityTrigger', 'filters'],
]) {
  it(`generates a strict optional-default string map for ${trigger}`, (context) => {
    const directory = mkdtempSync(join(tmpdir(), 'openmetadata-map-types-'));
    context.after(() => rmSync(directory, { recursive: true, force: true }));
    const schema = JSON.parse(
      readFileSync(
        join(
          repository,
          `openmetadata-spec/src/main/resources/json/schema/governance/workflows/elements/triggers/${trigger}.json`
        ),
        'utf8'
      )
    );
    const map = schema.definitions.config.properties[property].oneOf.find(
      (entry) => entry.type === 'object'
    );
    const schemaFile = join(directory, 'filterMap.json');
    const generatedFile = join(directory, 'filterMap.ts');
    const consumerFile = join(directory, 'consumer.ts');
    writeFileSync(schemaFile, JSON.stringify({ ...map, title: 'FilterMap' }));
    execFileSync(process.execPath, [
      realpathSync(quicktype),
      '-s',
      'schema',
      schemaFile,
      '-o',
      generatedFile,
      '--just-types',
    ]);
    execFileSync(process.execPath, [
      join(scriptDirectory, 'normalize-generated-map-types.mjs'),
      quicktype,
      generatedFile,
    ]);

    const compile = (consumer) => {
      writeFileSync(
        consumerFile,
        `import { FilterMap } from './filterMap';\n${consumer}`
      );

      return ts.getPreEmitDiagnostics(
        ts.createProgram([consumerFile], {
          strict: true,
          noEmit: true,
          types: [],
        })
      );
    };
    assert.deepEqual(
      compile(
        [
          'const empty: FilterMap = {};',
          'const fallback: FilterMap = { default: "true" };',
          'const entity: FilterMap = { table: "true" };',
          'const both: FilterMap = { default: "true", table: "false" };',
        ].join('\n')
      ),
      []
    );

    const invalid = compile(
      [
        'const invalidDefault: FilterMap = { default: 123 };',
        'const invalidEntity: FilterMap = { table: 123 };',
        'const undefinedEntity: FilterMap = { table: undefined };',
      ].join('\n')
    );
    assert.equal(invalid.length, 3);
    assert.ok(invalid.every((diagnostic) => diagnostic.code === 2322));
  });
}

it('preserves headers, comments, export modifiers and repeated generation', () => {
  const source = `/* License header */
/** Filter documentation. */
export interface FilterMap {
  /** Default filter documentation. */
  default?: string;
  [property: string]: string;
}
`;
  const result = normalizeGeneratedMapTypes(source, ts);
  assert.match(result, /export type FilterMap =/);
  for (const comment of [
    'License header',
    'Filter documentation.',
    'Default filter documentation.',
  ]) {
    assert.equal(result.split(comment).length - 1, 1);
  }
  assert.equal(normalizeGeneratedMapTypes(result, ts), result);
});

it('leaves already-valid interfaces unchanged', () => {
  const source = `export interface RequiredMap {
  default: string;
  [property: string]: string;
}
export interface AnyMap {
  default?: string;
  [property: string]: any;
}
export interface UnknownMap {
  default?: string;
  [property: string]: unknown;
}
export interface UndefinedMap {
  default?: string;
  [property: string]: string | undefined;
}
export interface OptionalProperty {
  default?: string;
}
`;
  assert.equal(normalizeGeneratedMapTypes(source, ts), source);
});
