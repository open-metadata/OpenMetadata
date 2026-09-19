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
import {
  getJSONSchemaFormValidator,
  jsonSchemaFormValidator,
} from './JSONSchemaFormValidator';

/**
 * An Ajv that lacks the meta-schema a document declares does not fail loudly — it
 * returns one `no schema with key or ref ...` error and validates nothing else, so
 * every field on the form silently stops being checked. These tests assert real
 * field-level errors come back, which is what a dialect/Ajv-build mismatch destroys.
 */
const DIALECT_MISMATCH = 'no schema with key or ref';

// Shaped like an OpenMetadata connection schema: 2020-12 dialect, `definitions`
// rather than `$defs`, and properties reaching them through `#/definitions/...`.
const CONNECTION_LIKE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  definitions: {
    postgresScheme: { type: 'string', enum: ['postgresql+psycopg2'] },
    hostPort: { type: 'string', minLength: 1 },
  },
  properties: {
    scheme: { $ref: '#/definitions/postgresScheme' },
    hostPort: { $ref: '#/definitions/hostPort' },
    username: { type: 'string' },
    maxConnections: { type: 'integer' },
  },
  required: ['hostPort', 'username'],
};

describe('JSONSchemaFormValidator', () => {
  it('reports field-level errors for a schema declaring the 2020-12 dialect', () => {
    const { errors } = jsonSchemaFormValidator.validateFormData(
      { maxConnections: 'not-a-number' },
      CONNECTION_LIKE_SCHEMA
    );

    expect(errors.map((error) => error.stack ?? '')).not.toContain(
      expect.stringContaining(DIALECT_MISMATCH)
    );
    expect(errors.map((error) => error.name)).toEqual(
      expect.arrayContaining(['required', 'type'])
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['hostPort', 'username', '.maxConnections'])
    );
  });

  it('resolves $ref into `definitions`, which 2020-12 treats as an unknown keyword', () => {
    const { errors } = jsonSchemaFormValidator.validateFormData(
      { hostPort: '', username: 'u', scheme: 'mysql+pymysql' },
      CONNECTION_LIKE_SCHEMA
    );

    expect(errors.map((error) => error.name)).toEqual(
      expect.arrayContaining(['minLength', 'enum'])
    );
  });

  it('still validates schemas that declare no dialect at all', () => {
    const { errors } = jsonSchemaFormValidator.validateFormData(
      {},
      { type: 'object', properties: {}, required: ['name'] }
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].name).toBe('required');
  });

  it('applies the same dialect support to generic validators', () => {
    const validator = getJSONSchemaFormValidator<{ hostPort?: string }>();

    const { errors } = validator.validateFormData({}, CONNECTION_LIKE_SCHEMA);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['hostPort', 'username'])
    );
  });

  it('validates every committed connection schema bundle without a dialect error', () => {
    const root = path.resolve(
      __dirname,
      '../../public/jsons/connectionSchemas/connections'
    );
    const bundles: string[] = [];
    const collect = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const child = path.join(dir, entry.name);
        entry.isDirectory()
          ? collect(child)
          : entry.name.endsWith('.json') && bundles.push(child);
      }
    };
    collect(root);

    expect(bundles.length).toBeGreaterThan(100);

    const broken = bundles.filter((bundle) => {
      const schema = JSON.parse(fs.readFileSync(bundle, 'utf8'));
      const { errors } = jsonSchemaFormValidator.validateFormData({}, schema);

      return errors.some((error) =>
        (error.stack ?? '').includes(DIALECT_MISMATCH)
      );
    });

    expect(broken).toEqual([]);
  });
});
