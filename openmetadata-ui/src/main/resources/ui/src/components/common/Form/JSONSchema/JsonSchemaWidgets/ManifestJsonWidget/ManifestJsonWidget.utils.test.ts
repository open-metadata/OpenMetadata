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
import { TFunction } from 'i18next';
import { ValidationError } from './ManifestJsonWidget.interface';
import {
  checkArrayMismatch,
  checkPrimitiveMismatch,
  EntryFieldName,
  ENTRY_FIELDS,
  findEntryTypeMismatch,
  findMissingRequiredField,
  findUnknownTopLevelField,
  formatEntryError,
  formatPartitionError,
  formatSuggestion,
  formatTopLevelError,
  getValidatedEntries,
  isPlainObjectItem,
  parseManifestJson,
  validateEntry,
  validatePartitionColumn,
} from './ManifestJsonWidget.utils';

const t = jest.fn(
  (key: string, options?: Record<string, unknown>) =>
    `${key}${options ? `:${JSON.stringify(options)}` : ''}`
) as unknown as TFunction;

const ALL_FIELDS = Object.keys(ENTRY_FIELDS) as EntryFieldName[];

const validEntry = { containerName: 'bucket', dataPath: 'path' };

describe('ManifestJsonWidget.utils', () => {
  describe('type checks', () => {
    it('checkPrimitiveMismatch reports the actual type', () => {
      expect(checkPrimitiveMismatch('a', 'string', 'expected-string')).toBe(
        null
      );
      expect(checkPrimitiveMismatch(1, 'string', 'expected-string')).toEqual({
        kind: 'expected-string',
        got: 'number',
      });
    });

    it('checkArrayMismatch requires an array of valid items', () => {
      const isString = (item: unknown) => typeof item === 'string';

      expect(
        checkArrayMismatch('x', 'expected-string-array', isString)
      ).toEqual({ kind: 'expected-string-array' });
      expect(
        checkArrayMismatch(['a', 1], 'expected-string-array', isString)
      ).toEqual({ kind: 'expected-string-array' });
      expect(
        checkArrayMismatch(['a'], 'expected-string-array', isString)
      ).toBeNull();
    });

    it('isPlainObjectItem rejects null and arrays', () => {
      expect(isPlainObjectItem({})).toBe(true);
      expect(isPlainObjectItem(null)).toBe(false);
      expect(isPlainObjectItem([])).toBe(false);
      expect(isPlainObjectItem('x')).toBe(false);
    });
  });

  describe('findEntryTypeMismatch', () => {
    it('ignores null and undefined values', () => {
      expect(
        findEntryTypeMismatch(
          { containerName: null, depth: undefined },
          0,
          ALL_FIELDS
        )
      ).toBeNull();
    });

    it.each([
      ['containerName', 1, { kind: 'expected-string', got: 'number' }],
      ['isPartitioned', 'yes', { kind: 'expected-boolean', got: 'string' }],
      ['depth', '1', { kind: 'expected-number', got: 'string' }],
      ['excludePaths', 'a', { kind: 'expected-string-array' }],
      ['partitionColumns', [1], { kind: 'expected-object-array' }],
    ])('flags %s with a wrong value', (field, value, mismatch) => {
      expect(findEntryTypeMismatch({ [field]: value }, 2, ALL_FIELDS)).toEqual({
        code: 'entry-type-error',
        index: 3,
        field,
        mismatch,
      });
    });

    it('accepts well-typed values', () => {
      expect(
        findEntryTypeMismatch(
          {
            containerName: 'c',
            isPartitioned: true,
            depth: 2,
            excludePaths: ['a'],
            partitionColumns: [{ name: 'n' }],
          },
          0,
          ALL_FIELDS
        )
      ).toBeNull();
    });
  });

  describe('findMissingRequiredField', () => {
    it('requires non-blank containerName then dataPath', () => {
      expect(findMissingRequiredField({ dataPath: 'p' }, 0)).toEqual({
        code: 'entry-required-field',
        index: 1,
        field: 'containerName',
      });
      expect(
        findMissingRequiredField({ containerName: 'c', dataPath: '  ' }, 1)
      ).toEqual({ code: 'entry-required-field', index: 2, field: 'dataPath' });
      expect(findMissingRequiredField(validEntry, 0)).toBeNull();
    });
  });

  describe('findUnknownTopLevelField', () => {
    it('reports the first key that is not entries', () => {
      expect(findUnknownTopLevelField({ entries: [], extra: 1 })).toEqual({
        code: 'unknown-top-level-field',
        field: 'extra',
      });
      expect(findUnknownTopLevelField({ entries: [] })).toBeNull();
    });
  });

  describe('validatePartitionColumn', () => {
    it('rejects non-object columns', () => {
      expect(validatePartitionColumn(0, 1, 'x')).toEqual({
        code: 'partition-column-must-be-object',
        entryIndex: 1,
        colIndex: 1,
      });
      expect(validatePartitionColumn(0, 1, null)).toEqual({
        code: 'partition-column-must-be-object',
        entryIndex: 1,
        colIndex: 1,
      });
    });

    it('suggests a close field name for typos and none for garbage', () => {
      expect(validatePartitionColumn(0, 0, { nmae: 'x' })).toEqual({
        code: 'partition-column-unknown-field',
        entryIndex: 1,
        colIndex: 0,
        field: 'nmae',
        suggestion: 'name',
      });
      expect(
        validatePartitionColumn(0, 0, { completelyUnrelated: 'x' })
      ).toEqual({
        code: 'partition-column-unknown-field',
        entryIndex: 1,
        colIndex: 0,
        field: 'completelyUnrelated',
        suggestion: undefined,
      });
    });

    it('requires a non-blank name and dataType', () => {
      expect(validatePartitionColumn(0, 0, { dataType: 'string' })).toEqual({
        code: 'partition-column-required',
        entryIndex: 1,
        colIndex: 0,
        field: 'name',
      });
      expect(
        validatePartitionColumn(0, 0, { name: 'n', dataType: ' ' })
      ).toEqual({
        code: 'partition-column-required',
        entryIndex: 1,
        colIndex: 0,
        field: 'dataType',
      });
      expect(
        validatePartitionColumn(0, 0, {
          name: 'n',
          dataType: 'string',
          description: 'd',
          dataTypeDisplay: 'string',
        })
      ).toBeNull();
    });
  });

  describe('validateEntry', () => {
    it('rejects non-object entries', () => {
      expect(validateEntry('x', 0, ALL_FIELDS)).toEqual({
        code: 'entry-must-be-object',
        index: 1,
      });
      expect(validateEntry(null, 0, ALL_FIELDS)).toEqual({
        code: 'entry-must-be-object',
        index: 1,
      });
      expect(validateEntry([], 0, ALL_FIELDS)).toEqual({
        code: 'entry-must-be-object',
        index: 1,
      });
    });

    it('flags unknown fields with a suggestion when close', () => {
      expect(
        validateEntry({ ...validEntry, dataPth: 'x' }, 0, ALL_FIELDS)
      ).toEqual({
        code: 'entry-unknown-field',
        index: 1,
        field: 'dataPth',
        suggestion: 'dataPath',
      });
    });

    it('flags an unknown field with no suggestion when nothing is close', () => {
      expect(
        validateEntry(
          { ...validEntry, zzzzzzzzzzzzzzzzzzzz: 'x' },
          0,
          ALL_FIELDS
        )
      ).toEqual({
        code: 'entry-unknown-field',
        index: 1,
        field: 'zzzzzzzzzzzzzzzzzzzz',
        suggestion: undefined,
      });
    });

    it('returns the first failing check in order', () => {
      expect(validateEntry({ dataPath: 'p' }, 0, ALL_FIELDS)?.code).toBe(
        'entry-required-field'
      );
      expect(
        validateEntry({ ...validEntry, depth: 'x' }, 0, ALL_FIELDS)?.code
      ).toBe('entry-type-error');
      expect(
        validateEntry(
          { ...validEntry, partitionColumns: [{ name: 'n' }] },
          0,
          ALL_FIELDS
        )?.code
      ).toBe('partition-column-required');
    });

    it('accepts a valid entry with valid partition columns', () => {
      expect(
        validateEntry(
          {
            ...validEntry,
            partitionColumns: [{ name: 'n', dataType: 'string' }],
          },
          0,
          ALL_FIELDS
        )
      ).toBeNull();
    });
  });

  describe('parseManifestJson', () => {
    it('parses valid json', () => {
      expect(parseManifestJson('{"entries":[]}')).toEqual({
        parsed: { entries: [] },
      });
    });

    it('wraps syntax errors', () => {
      const result = parseManifestJson('{');

      expect(result).toHaveProperty('error.code', 'invalid-json');
      expect(typeof (result as { error: { error: string } }).error.error).toBe(
        'string'
      );
    });
  });

  describe('getValidatedEntries', () => {
    it('rejects non-object top-level values', () => {
      expect(getValidatedEntries([])).toEqual({
        error: { code: 'top-level-must-be-object' },
      });
      expect(getValidatedEntries(null)).toEqual({
        error: { code: 'top-level-must-be-object' },
      });
    });

    it('rejects unknown top-level fields and non-array entries', () => {
      expect(getValidatedEntries({ foo: 1 })).toEqual({
        error: { code: 'unknown-top-level-field', field: 'foo' },
      });
      expect(getValidatedEntries({ entries: {} })).toEqual({
        error: { code: 'entries-must-be-array' },
      });
    });

    it('returns the entries array', () => {
      expect(getValidatedEntries({ entries: [validEntry] })).toEqual({
        entries: [validEntry],
      });
    });
  });

  describe('formatters', () => {
    it('formatSuggestion renders only when a suggestion exists', () => {
      expect(formatSuggestion(undefined, t)).toBe('');
      expect(formatSuggestion('name', t)).toBe(
        'message.manifest-entry-unknown-field-suggestion:{"suggestion":"name"}'
      );
    });

    it('formatTopLevelError covers every top-level code', () => {
      expect(formatTopLevelError({ code: 'invalid-json', error: 'e' }, t)).toBe(
        'message.manifest-invalid-json:{"error":"e"}'
      );
      expect(formatTopLevelError({ code: 'top-level-must-be-object' }, t)).toBe(
        'message.manifest-top-level-must-be-object'
      );
      expect(
        formatTopLevelError({ code: 'unknown-top-level-field', field: 'f' }, t)
      ).toBe('message.manifest-unknown-top-level-field:{"field":"f"}');
      expect(formatTopLevelError({ code: 'entries-must-be-array' }, t)).toBe(
        'message.manifest-entries-must-be-array'
      );
      expect(
        formatTopLevelError({ code: 'entry-must-be-object', index: 1 }, t)
      ).toBeNull();
    });

    it('formatEntryError covers every entry code and mismatch kind', () => {
      expect(
        formatEntryError({ code: 'entry-must-be-object', index: 1 }, t)
      ).toBe('message.manifest-entry-must-be-object:{"index":1}');
      expect(
        formatEntryError(
          { code: 'entry-unknown-field', index: 1, field: 'f' },
          t
        )
      ).toBe(
        'message.manifest-entry-unknown-field:{"index":1,"field":"f","suggestion":""}'
      );
      expect(
        formatEntryError(
          { code: 'entry-required-field', index: 1, field: 'f' },
          t
        )
      ).toBe('message.manifest-entry-required-field:{"index":1,"field":"f"}');

      const typeError = (
        mismatch: ValidationError & { code: 'entry-type-error' }
      ) => formatEntryError(mismatch, t);

      expect(
        typeError({
          code: 'entry-type-error',
          index: 1,
          field: 'f',
          mismatch: { kind: 'expected-string', got: 'number' },
        })
      ).toContain(
        'message.expected-a-string-got-type:{\\"type\\":\\"number\\"}'
      );
      expect(
        typeError({
          code: 'entry-type-error',
          index: 1,
          field: 'f',
          mismatch: { kind: 'expected-boolean', got: 'string' },
        })
      ).toContain('message.expected-true-or-false-got-type');
      expect(
        typeError({
          code: 'entry-type-error',
          index: 1,
          field: 'f',
          mismatch: { kind: 'expected-number', got: 'string' },
        })
      ).toContain('message.expected-a-number-got-type');
      expect(
        typeError({
          code: 'entry-type-error',
          index: 1,
          field: 'f',
          mismatch: { kind: 'expected-string-array' },
        })
      ).toContain('message.expected-an-array-of-strings');
      expect(
        typeError({
          code: 'entry-type-error',
          index: 1,
          field: 'f',
          mismatch: { kind: 'expected-object-array' },
        })
      ).toContain('message.expected-an-array-of-objects');
      expect(
        formatEntryError({ code: 'top-level-must-be-object' }, t)
      ).toBeNull();
    });

    it('formatPartitionError covers every partition code', () => {
      expect(
        formatPartitionError(
          {
            code: 'partition-column-must-be-object',
            entryIndex: 1,
            colIndex: 0,
          },
          t
        )
      ).toBe(
        'message.manifest-partition-column-must-be-object:{"entryIndex":1,"colIndex":0}'
      );
      expect(
        formatPartitionError(
          {
            code: 'partition-column-unknown-field',
            entryIndex: 1,
            colIndex: 0,
            field: 'f',
            suggestion: 'name',
          },
          t
        )
      ).toContain('message.manifest-partition-column-unknown-field');
      expect(
        formatPartitionError(
          {
            code: 'partition-column-required',
            entryIndex: 1,
            colIndex: 0,
            field: 'name',
          },
          t
        )
      ).toBe(
        'message.manifest-partition-column-required:{"entryIndex":1,"colIndex":0,"field":"name"}'
      );
      expect(
        formatPartitionError({ code: 'entries-must-be-array' }, t)
      ).toBeNull();
    });
  });
});
