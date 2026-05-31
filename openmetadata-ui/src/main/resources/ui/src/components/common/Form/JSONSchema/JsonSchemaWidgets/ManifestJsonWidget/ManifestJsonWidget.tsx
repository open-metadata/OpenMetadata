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
import { WidgetProps } from '@rjsf/utils';
import { Alert, Typography } from 'antd';
import { TFunction } from 'i18next';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../../../../enums/codemirror.enum';
import SchemaEditor from '../../../../../Database/SchemaEditor/SchemaEditor';
import './manifest-json-widget.less';

// SchemaEditor uses CodeMirror's JavaScript mode with the ``json: true``
// flag to get proper JSON-aware syntax highlighting. Reuse the default
// shape so the editor lights up the same way as everywhere else in the
// UI (SqlQuery, SchemaViewer, etc.).
const JSON_EDITOR_MODE = { name: CSMode.JAVASCRIPT, json: true };

const { Text } = Typography;

export const SAMPLE_MANIFEST_JSON = `{
  "entries": [
    {
      "containerName": "my-bucket",
      "dataPath": "data/*/events/*.parquet",
      "structureFormat": "parquet",
      "autoPartitionDetection": true
    },
    {
      "containerName": "my-bucket",
      "dataPath": "logs/**/*.json",
      "structureFormat": "json"
    }
  ]
}`;

type TypeMismatch =
  | { kind: 'expected-string'; got: string }
  | { kind: 'expected-boolean'; got: string }
  | { kind: 'expected-number'; got: string }
  | { kind: 'expected-string-array' }
  | { kind: 'expected-object-array' };

export type ValidationError =
  | { code: 'invalid-json'; error: string }
  | { code: 'top-level-must-be-object' }
  | { code: 'unknown-top-level-field'; field: string }
  | { code: 'entries-must-be-array' }
  | { code: 'entry-must-be-object'; index: number }
  | {
      code: 'entry-unknown-field';
      index: number;
      field: string;
      suggestion?: string;
    }
  | { code: 'entry-required-field'; index: number; field: string }
  | {
      code: 'entry-type-error';
      index: number;
      field: string;
      mismatch: TypeMismatch;
    }
  | {
      code: 'partition-column-must-be-object';
      entryIndex: number;
      colIndex: number;
    }
  | {
      code: 'partition-column-unknown-field';
      entryIndex: number;
      colIndex: number;
      field: string;
      suggestion?: string;
    }
  | {
      code: 'partition-column-required';
      entryIndex: number;
      colIndex: number;
      field: string;
    };

export type ValidationState =
  | { status: 'ok'; entryCount: number }
  | { status: 'empty' }
  | { status: 'error'; error: ValidationError };

// Mirrors the properties defined on ManifestMetadataEntry in
// openmetadata-spec/.../storage/manifestMetadataConfig.json.
// Any field name not in this set is treated as a typo.
const ENTRY_FIELDS = {
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

type EntryFieldName = keyof typeof ENTRY_FIELDS;

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

const getTypeMismatch = (
  value: unknown,
  expected: (typeof ENTRY_FIELDS)[EntryFieldName]
): TypeMismatch | null => {
  if (value === null || value === undefined) {
    return null;
  }
  switch (expected) {
    case 'string':
      return typeof value === 'string'
        ? null
        : { kind: 'expected-string', got: typeof value };
    case 'boolean':
      return typeof value === 'boolean'
        ? null
        : { kind: 'expected-boolean', got: typeof value };
    case 'number':
      return typeof value === 'number'
        ? null
        : { kind: 'expected-number', got: typeof value };
    case 'string[]':
      if (!Array.isArray(value)) {
        return { kind: 'expected-string-array' };
      }

      return value.every((item) => typeof item === 'string')
        ? null
        : { kind: 'expected-string-array' };
    case 'object[]':
      if (!Array.isArray(value)) {
        return { kind: 'expected-object-array' };
      }

      return value.every(
        (item) =>
          typeof item === 'object' && item !== null && !Array.isArray(item)
      )
        ? null
        : { kind: 'expected-object-array' };
    default:
      return null;
  }
};

const validatePartitionColumns = (
  entryIndex: number,
  columns: unknown
): ValidationError | null => {
  if (!Array.isArray(columns)) {
    return null;
  }
  for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
    const column = columns[colIndex];
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
        code: 'partition-column-required',
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
        code: 'partition-column-required',
        entryIndex: entryIndex + 1,
        colIndex,
        field: 'dataType',
      };
    }
  }

  return null;
};

export const validateManifestJson = (raw: string): ValidationState => {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { status: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      status: 'error',
      error: {
        code: 'invalid-json',
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      status: 'error',
      error: { code: 'top-level-must-be-object' },
    };
  }

  const topLevelKeys = Object.keys(parsed as Record<string, unknown>);
  for (const key of topLevelKeys) {
    if (key !== 'entries') {
      return {
        status: 'error',
        error: { code: 'unknown-top-level-field', field: key },
      };
    }
  }

  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) {
    return {
      status: 'error',
      error: { code: 'entries-must-be-array' },
    };
  }

  const allowedFields = Object.keys(ENTRY_FIELDS);

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return {
        status: 'error',
        error: { code: 'entry-must-be-object', index: i + 1 },
      };
    }
    const entryRecord = entry as Record<string, unknown>;

    for (const key of Object.keys(entryRecord)) {
      if (!(key in ENTRY_FIELDS)) {
        const suggestion = suggest(key, allowedFields);

        return {
          status: 'error',
          error: {
            code: 'entry-unknown-field',
            index: i + 1,
            field: key,
            suggestion: suggestion ?? undefined,
          },
        };
      }
    }

    if (
      typeof entryRecord.containerName !== 'string' ||
      !entryRecord.containerName.trim()
    ) {
      return {
        status: 'error',
        error: {
          code: 'entry-required-field',
          index: i + 1,
          field: 'containerName',
        },
      };
    }
    if (
      typeof entryRecord.dataPath !== 'string' ||
      !entryRecord.dataPath.trim()
    ) {
      return {
        status: 'error',
        error: {
          code: 'entry-required-field',
          index: i + 1,
          field: 'dataPath',
        },
      };
    }

    for (const field of allowedFields as EntryFieldName[]) {
      const mismatch = getTypeMismatch(entryRecord[field], ENTRY_FIELDS[field]);
      if (mismatch) {
        return {
          status: 'error',
          error: {
            code: 'entry-type-error',
            index: i + 1,
            field,
            mismatch,
          },
        };
      }
    }

    const partitionError = validatePartitionColumns(
      i,
      entryRecord.partitionColumns
    );
    if (partitionError) {
      return { status: 'error', error: partitionError };
    }
  }

  return { status: 'ok', entryCount: entries.length };
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
    case 'expected-string-array':
      return t('message.expected-an-array-of-strings');
    case 'expected-object-array':
      return t('message.expected-an-array-of-objects');
    default:
      return '';
  }
};

export const formatValidationError = (
  error: ValidationError,
  t: TFunction
): string => {
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
    case 'entry-must-be-object':
      return t('message.manifest-entry-must-be-object', { index: error.index });
    case 'entry-unknown-field': {
      const suggestionText = error.suggestion
        ? t('message.manifest-entry-unknown-field-suggestion', {
            suggestion: error.suggestion,
          })
        : '';

      return t('message.manifest-entry-unknown-field', {
        index: error.index,
        field: error.field,
        suggestion: suggestionText,
      });
    }
    case 'entry-required-field':
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
    case 'partition-column-must-be-object':
      return t('message.manifest-partition-column-must-be-object', {
        entryIndex: error.entryIndex,
        colIndex: error.colIndex,
      });
    case 'partition-column-unknown-field': {
      const suggestionText = error.suggestion
        ? t('message.manifest-entry-unknown-field-suggestion', {
            suggestion: error.suggestion,
          })
        : '';

      return t('message.manifest-partition-column-unknown-field', {
        entryIndex: error.entryIndex,
        colIndex: error.colIndex,
        field: error.field,
        suggestion: suggestionText,
      });
    }
    case 'partition-column-required':
      return t('message.manifest-partition-column-required', {
        entryIndex: error.entryIndex,
        colIndex: error.colIndex,
        field: error.field,
      });
    default:
      return '';
  }
};

const ManifestJsonWidget = ({
  value,
  onChange,
  disabled,
  onFocus,
  ...props
}: WidgetProps) => {
  const { t } = useTranslation();

  const onFocusHandler = useCallback(() => {
    onFocus?.(props.id, props.value);
  }, [onFocus, props.id, props.value]);

  // Display the sample JSON as a placeholder when the field is empty so
  // users have a ready template. We purposely do NOT write it into form
  // state on mount — the field may be populated asynchronously after a
  // saved pipeline config loads, and writing our sample into form data
  // would overwrite the real value. We also skip when disabled.
  const hasUserValue = typeof value === 'string' && value.trim().length > 0;
  const effectiveValue = hasUserValue ? value : SAMPLE_MANIFEST_JSON;

  const handleChange = useCallback(
    (next: string) => {
      if (disabled) {
        return;
      }
      onChange(next);
    },
    [disabled, onChange]
  );

  const validation = useMemo(
    () => validateManifestJson(effectiveValue),
    [effectiveValue]
  );

  return (
    <div className="manifest-json-widget">
      <div className="manifest-json-widget-resize-wrapper">
        <SchemaEditor
          className="manifest-json-widget-editor"
          mode={JSON_EDITOR_MODE}
          readOnly={disabled}
          showCopyButton={false}
          value={effectiveValue}
          onChange={handleChange}
          onFocus={onFocusHandler}
        />
      </div>
      <span className="manifest-json-widget-resize-hint">
        {t('message.drag-bottom-right-corner-to-resize')}
      </span>
      {validation.status === 'ok' && (
        <Alert
          showIcon
          className="m-t-xs"
          message={
            <Text>
              {t('label.valid-manifest-entry-count', {
                count: validation.entryCount,
              })}
            </Text>
          }
          type="success"
        />
      )}
      {validation.status === 'error' && (
        <Alert
          showIcon
          className="m-t-xs"
          message={formatValidationError(validation.error, t)}
          type="error"
        />
      )}
    </div>
  );
};

export default ManifestJsonWidget;
