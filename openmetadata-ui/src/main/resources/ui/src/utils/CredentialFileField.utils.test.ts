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
  CredentialFileFieldType,
  isCredentialFileFieldType,
} from './CredentialFileField.utils';

describe('isCredentialFileFieldType', () => {
  it.each([
    CredentialFileFieldType.FILE,
    CredentialFileFieldType.FILE_OR_INPUT,
  ])('recognises %s', (uiFieldType) => {
    expect(isCredentialFileFieldType(uiFieldType)).toBe(true);
  });

  it.each([undefined, null, '', 'code', 'treeSelect', 'FILE', 42])(
    'rejects %p',
    (uiFieldType) => {
      expect(isCredentialFileFieldType(uiFieldType)).toBe(false);
    }
  );
});

/**
 * These assertions run against the generated connection schemas the app
 * actually fetches, so they hold for every connector at once rather than for a
 * hand-picked few. The contract they pin is documented in
 * `docs/credential-file-fields.md`.
 */
describe('uiFieldType schema contract', () => {
  const SCHEMA_ROOT = path.join(
    __dirname,
    '../../public/jsons/connectionSchemas/connections'
  );

  /**
   * Formats that are not UTF-8 text. The field value is the file's decoded
   * text, so advertising one of these produces a picker that offers a file the
   * form then rejects.
   */
  const BINARY_EXTENSIONS = ['.der', '.p12', '.pfx', '.jks', '.keystore'];

  /**
   * A field whose runtime contract is a filesystem path on the ingestion
   * runner. A browser cannot supply such a path, so these must never carry the
   * marker — several are named like content and only their title says so.
   */
  const PATH_FIELD_HINT = /path|directory|folder/i;

  interface FoundField {
    file: string;
    name: string;
    schema: Record<string, unknown>;
  }

  const collectFields = (): FoundField[] => {
    const found: FoundField[] = [];

    const walkNode = (node: unknown, file: string) => {
      if (Array.isArray(node)) {
        node.forEach((item) => walkNode(item, file));

        return;
      }
      if (typeof node !== 'object' || node === null) {
        return;
      }

      const record = node as Record<string, unknown>;
      const properties = record.properties;
      if (typeof properties === 'object' && properties !== null) {
        Object.entries(properties as Record<string, unknown>).forEach(
          ([name, value]) => {
            if (typeof value === 'object' && value !== null) {
              found.push({
                file: path.relative(SCHEMA_ROOT, file),
                name,
                schema: value as Record<string, unknown>,
              });
            }
          }
        );
      }

      Object.values(record).forEach((value) => walkNode(value, file));
    };

    const walkDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(full);
        } else if (entry.name.endsWith('.json')) {
          walkNode(JSON.parse(fs.readFileSync(full, 'utf8')), full);
        }
      }
    };

    walkDir(SCHEMA_ROOT);

    return found;
  };

  const allFields = collectFields();
  const annotated = allFields.filter((field) =>
    isCredentialFileFieldType(field.schema.uiFieldType)
  );

  const describeField = (field: FoundField) => `${field.file}#${field.name}`;

  it('finds annotated credential fields to check', () => {
    expect(allFields.length).toBeGreaterThan(0);
    expect(annotated.length).toBeGreaterThan(0);
  });

  it('only marks secret string fields', () => {
    const offenders = annotated
      .filter(
        (field) =>
          field.schema.type !== 'string' || field.schema.format !== 'password'
      )
      .map(describeField);

    expect(offenders).toEqual([]);
  });

  it('never marks a field whose contract is a filesystem path', () => {
    const offenders = annotated
      .filter(
        (field) =>
          PATH_FIELD_HINT.test(field.name) ||
          PATH_FIELD_HINT.test(String(field.schema.title ?? ''))
      )
      .map(describeField);

    expect(offenders).toEqual([]);
  });

  it('never advertises a binary format in accept', () => {
    const offenders = allFields
      .filter((field) => Array.isArray(field.schema.accept))
      .filter((field) =>
        (field.schema.accept as string[]).some((extension) =>
          BINARY_EXTENSIONS.includes(extension.toLowerCase())
        )
      )
      .map(describeField);

    expect(offenders).toEqual([]);
  });

  it('only uses accept on a credential file field', () => {
    const offenders = allFields
      .filter((field) => field.schema.accept !== undefined)
      .filter((field) => !isCredentialFileFieldType(field.schema.uiFieldType))
      .map(describeField);

    expect(offenders).toEqual([]);
  });
});
