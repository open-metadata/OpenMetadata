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
import { TypeMismatch, ValidationError } from './ManifestJsonWidget.interface';

const EXPECTED_STRING_ARRAY_ERROR = 'expected-string-array' as const;
const EXPECTED_OBJECT_ARRAY_ERROR = 'expected-object-array' as const;
const PARTITION_COLUMN_REQUIRED_ERROR = 'partition-column-required' as const;
const ENTRY_REQUIRED_FIELD_ERROR = 'entry-required-field' as const;

// Mirrors the properties defined on ManifestMetadataEntry in
// openmetadata-spec/.../storage/manifestMetadataConfig.json.
// Any field name not in this set is treated as a typo.
export const ENTRY_FIELDS = {
  containerName: 'string',
  dataPath: 'string',
  structureFormat: 'string',
  unstructuredData: 'boolean',
  unstructuredFormats: 'string[]',
  separator: 'string',
  isPartitioned: 'boolean',
  autoPartitionDetection: 'boolean',
  excludePaths: 'string[]',
  excludePatterns: 'string[]',
  partitionColumns: 'object[]',
  depth: 'number',
} as const;

export type EntryFieldName = keyof typeof ENTRY_FIELDS;

const PARTITION_COLUMN_FIELDS = new Set([
  'name',
  'dataType',
  'dataTypeDisplay',
  'description',
]);

const editDistance = (source: string, target: string): number => {
  // Classic Levenshtein, small strings only — field names are short.
  const sourceLength = source.length;
  const targetLength = target.length;
  if (sourceLength === 0) {
    return targetLength;
  }
  if (targetLength === 0) {
    return sourceLength;
  }
  const previousRow = new Array<number>(targetLength + 1);
  const currentRow = new Array<number>(targetLength + 1);
  for (let column = 0; column <= targetLength; column += 1) {
    previousRow[column] = column;
  }
  for (let row = 1; row <= sourceLength; row += 1) {
    currentRow[0] = row;
    for (let column = 1; column <= targetLength; column += 1) {
      const substitutionCost = source[row - 1] === target[column - 1] ? 0 : 1;
      currentRow[column] = Math.min(
        currentRow[column - 1] + 1,
        previousRow[column] + 1,
        previousRow[column - 1] + substitutionCost
      );
    }
    for (let column = 0; column <= targetLength; column += 1) {
      previousRow[column] = currentRow[column];
    }
  }

  return previousRow[targetLength];
};

const suggest = (unknownField: string, candidates: string[]): string | null => {
  // Return the candidate with the smallest case-insensitive edit
  // distance — but only if it's plausibly close (≤ max(2, len/3)).
  const lowerUnknown = unknownField.toLowerCase();
  let bestCandidate: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(lowerUnknown, candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = candidate;
    }
  }
  const threshold = Math.max(2, Math.floor(unknownField.length / 3));

  return bestDistance <= threshold ? bestCandidate : null;
};

// Shared by the 'string[]'/'object[]' cases below: both first require an array,
// then require every item to satisfy a type-specific predicate.
export const checkArrayMismatch = (
  value: unknown,
  kind: typeof EXPECTED_STRING_ARRAY_ERROR | typeof EXPECTED_OBJECT_ARRAY_ERROR,
  itemIsValid: (item: unknown) => boolean
): TypeMismatch | null => {
  if (!Array.isArray(value)) {
    return { kind };
  }

  return value.every(itemIsValid) ? null : { kind };
};

export const isPlainObjectItem = (item: unknown) =>
  typeof item === 'object' && item !== null && !Array.isArray(item);

// Shared by the 'string'/'boolean'/'number' cases below: each just checks
// `typeof value === expected` and tags the mismatch with its own `kind`.
export const checkPrimitiveMismatch = (
  value: unknown,
  expected: 'string' | 'boolean' | 'number',
  kind: 'expected-string' | 'expected-boolean' | 'expected-number'
): TypeMismatch | null =>
  typeof value === expected
    ? null
    : ({ kind, got: typeof value } as TypeMismatch);

const getTypeMismatch = (
  value: unknown,
  expected: (typeof ENTRY_FIELDS)[EntryFieldName]
): TypeMismatch | null => {
  if (value === null || value === undefined) {
    return null;
  }
  switch (expected) {
    case 'string':
      return checkPrimitiveMismatch(value, 'string', 'expected-string');
    case 'boolean':
      return checkPrimitiveMismatch(value, 'boolean', 'expected-boolean');
    case 'number':
      return checkPrimitiveMismatch(value, 'number', 'expected-number');
    case 'string[]':
      return checkArrayMismatch(
        value,
        EXPECTED_STRING_ARRAY_ERROR,
        (item) => typeof item === 'string'
      );
    case 'object[]':
      return checkArrayMismatch(
        value,
        EXPECTED_OBJECT_ARRAY_ERROR,
        isPlainObjectItem
      );
    default:
      return null;
  }
};

export const validatePartitionColumn = (
  entryIndex: number,
  colIndex: number,
  column: unknown
): ValidationError | null => {
  if (typeof column !== 'object' || column === null) {
    return {
      code: 'partition-column-must-be-object',
      entryIndex: entryIndex + 1,
      colIndex,
    };
  }
  const columnRecord = column as Record<string, unknown>;
  for (const key of Object.keys(columnRecord)) {
    if (!PARTITION_COLUMN_FIELDS.has(key)) {
      const suggestion = suggest(key, Array.from(PARTITION_COLUMN_FIELDS));

      return {
        code: 'partition-column-unknown-field',
        entryIndex: entryIndex + 1,
        colIndex,
        field: key,
        suggestion: suggestion ?? undefined,
      };
    }
  }
  if (typeof columnRecord.name !== 'string' || !columnRecord.name.trim()) {
    return {
      code: PARTITION_COLUMN_REQUIRED_ERROR,
      entryIndex: entryIndex + 1,
      colIndex,
      field: 'name',
    };
  }
  if (
    typeof columnRecord.dataType !== 'string' ||
    !columnRecord.dataType.trim()
  ) {
    return {
      code: PARTITION_COLUMN_REQUIRED_ERROR,
      entryIndex: entryIndex + 1,
      colIndex,
      field: 'dataType',
    };
  }

  return null;
};

const validatePartitionColumns = (
  entryIndex: number,
  columns: unknown
): ValidationError | null => {
  if (!Array.isArray(columns)) {
    return null;
  }
  for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
    const columnError = validatePartitionColumn(
      entryIndex,
      colIndex,
      columns[colIndex]
    );
    if (columnError) {
      return columnError;
    }
  }

  return null;
};

export const findUnknownTopLevelField = (
  parsed: object
): ValidationError | null => {
  for (const key of Object.keys(parsed as Record<string, unknown>)) {
    if (key !== 'entries') {
      return { code: 'unknown-top-level-field', field: key };
    }
  }

  return null;
};

export const REQUIRED_STRING_ENTRY_FIELDS = [
  'containerName',
  'dataPath',
] as const;

export const findMissingRequiredField = (
  entryRecord: Record<string, unknown>,
  index: number
): ValidationError | null => {
  for (const field of REQUIRED_STRING_ENTRY_FIELDS) {
    const fieldValue = entryRecord[field];
    if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
      return {
        code: ENTRY_REQUIRED_FIELD_ERROR,
        index: index + 1,
        field,
      };
    }
  }

  return null;
};

export const findEntryTypeMismatch = (
  entryRecord: Record<string, unknown>,
  index: number,
  allowedFields: EntryFieldName[]
): ValidationError | null => {
  for (const field of allowedFields) {
    const mismatch = getTypeMismatch(entryRecord[field], ENTRY_FIELDS[field]);
    if (mismatch) {
      return {
        code: 'entry-type-error',
        index: index + 1,
        field,
        mismatch,
      };
    }
  }

  return null;
};

export const validateEntry = (
  entry: unknown,
  index: number,
  allowedFields: EntryFieldName[]
): ValidationError | null => {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return { code: 'entry-must-be-object', index: index + 1 };
  }
  const entryRecord = entry as Record<string, unknown>;

  for (const key of Object.keys(entryRecord)) {
    if (!(key in ENTRY_FIELDS)) {
      const suggestion = suggest(key, allowedFields);

      return {
        code: 'entry-unknown-field',
        index: index + 1,
        field: key,
        suggestion: suggestion ?? undefined,
      };
    }
  }

  return (
    findMissingRequiredField(entryRecord, index) ??
    findEntryTypeMismatch(entryRecord, index, allowedFields) ??
    validatePartitionColumns(index, entryRecord.partitionColumns)
  );
};

export const parseManifestJson = (
  trimmed: string
): { parsed: unknown } | { error: ValidationError } => {
  try {
    return { parsed: JSON.parse(trimmed) };
  } catch (err) {
    return {
      error: {
        code: 'invalid-json',
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
};

export const getValidatedEntries = (
  parsed: unknown
): { entries: unknown[] } | { error: ValidationError } => {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { error: { code: 'top-level-must-be-object' } };
  }

  const unknownFieldError = findUnknownTopLevelField(parsed);
  if (unknownFieldError) {
    return { error: unknownFieldError };
  }

  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) {
    return { error: { code: 'entries-must-be-array' } };
  }

  return { entries };
};

const formatTypeMismatch = (mismatch: TypeMismatch, t: TFunction): string => {
  switch (mismatch.kind) {
    case 'expected-string':
      return t('message.expected-a-string-got-type', { type: mismatch.got });
    case 'expected-boolean':
      return t('message.expected-true-or-false-got-type', {
        type: mismatch.got,
      });
    case 'expected-number':
      return t('message.expected-a-number-got-type', { type: mismatch.got });
    case EXPECTED_STRING_ARRAY_ERROR:
      return t('message.expected-an-array-of-strings');
    case EXPECTED_OBJECT_ARRAY_ERROR:
      return t('message.expected-an-array-of-objects');
    default:
      return '';
  }
};

export const formatSuggestion = (
  suggestion: string | undefined,
  t: TFunction
): string =>
  suggestion
    ? t('message.manifest-entry-unknown-field-suggestion', { suggestion })
    : '';

export const formatTopLevelError = (
  error: ValidationError,
  t: TFunction
): string | null => {
  switch (error.code) {
    case 'invalid-json':
      return t('message.manifest-invalid-json', { error: error.error });
    case 'top-level-must-be-object':
      return t('message.manifest-top-level-must-be-object');
    case 'unknown-top-level-field':
      return t('message.manifest-unknown-top-level-field', {
        field: error.field,
      });
    case 'entries-must-be-array':
      return t('message.manifest-entries-must-be-array');
    default:
      return null;
  }
};

export const formatEntryError = (
  error: ValidationError,
  t: TFunction
): string | null => {
  switch (error.code) {
    case 'entry-must-be-object':
      return t('message.manifest-entry-must-be-object', { index: error.index });
    case 'entry-unknown-field':
      return t('message.manifest-entry-unknown-field', {
        index: error.index,
        field: error.field,
        suggestion: formatSuggestion(error.suggestion, t),
      });
    case ENTRY_REQUIRED_FIELD_ERROR:
      return t('message.manifest-entry-required-field', {
        index: error.index,
        field: error.field,
      });
    case 'entry-type-error':
      return t('message.manifest-entry-type-error', {
        index: error.index,
        field: error.field,
        error: formatTypeMismatch(error.mismatch, t),
      });
    default:
      return null;
  }
};

export const formatPartitionError = (
  error: ValidationError,
  t: TFunction
): string | null => {
  switch (error.code) {
    case 'partition-column-must-be-object':
      return t('message.manifest-partition-column-must-be-object', {
        entryIndex: error.entryIndex,
        colIndex: error.colIndex,
      });
    case 'partition-column-unknown-field':
      return t('message.manifest-partition-column-unknown-field', {
        entryIndex: error.entryIndex,
        colIndex: error.colIndex,
        field: error.field,
        suggestion: formatSuggestion(error.suggestion, t),
      });
    case PARTITION_COLUMN_REQUIRED_ERROR:
      return t('message.manifest-partition-column-required', {
        entryIndex: error.entryIndex,
        colIndex: error.colIndex,
        field: error.field,
      });
    default:
      return null;
  }
};
