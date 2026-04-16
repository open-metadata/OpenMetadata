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
import { Alert, Typography } from 'antd';
import { WidgetProps } from '@rjsf/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SchemaEditor from '../../../../../Database/SchemaEditor/SchemaEditor';
import './manifest-json-widget.less';

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

type ValidationState =
  | { status: 'ok'; entryCount: number }
  | { status: 'empty' }
  | { status: 'error'; message: string };

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

const editDistance = (a: string, b: string): number => {
  // Classic Levenshtein, small strings only — field names are short.
  const m = a.length;
  const n = b.length;
  if (m === 0) {
    return n;
  }
  if (n === 0) {
    return m;
  }
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) {
    prev[j] = j;
  }
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insert
        prev[j] + 1, // delete
        prev[j - 1] + cost // substitute
      );
    }
    for (let j = 0; j <= n; j += 1) {
      prev[j] = curr[j];
    }
  }
  return prev[n];
};

const suggest = (bad: string, candidates: string[]): string | null => {
  // Return the candidate with the smallest case-insensitive edit
  // distance — but only if it's plausibly close (≤ max(2, len/3)).
  const lower = bad.toLowerCase();
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const cand of candidates) {
    const d = editDistance(lower, cand.toLowerCase());
    if (d < bestDistance) {
      bestDistance = d;
      best = cand;
    }
  }
  const threshold = Math.max(2, Math.floor(bad.length / 3));
  return bestDistance <= threshold ? best : null;
};

const checkType = (
  value: unknown,
  expected: (typeof ENTRY_FIELDS)[EntryFieldName]
): string | null => {
  if (value === null || value === undefined) {
    return null; // optional — absent values are allowed
  }
  switch (expected) {
    case 'string':
      return typeof value === 'string'
        ? null
        : `expected a string, got ${typeof value}`;
    case 'boolean':
      return typeof value === 'boolean'
        ? null
        : `expected true or false, got ${typeof value}`;
    case 'number':
      return typeof value === 'number'
        ? null
        : `expected a number, got ${typeof value}`;
    case 'string[]':
      if (!Array.isArray(value)) {
        return 'expected an array of strings';
      }
      return value.every((v) => typeof v === 'string')
        ? null
        : 'expected an array of strings';
    case 'object[]':
      if (!Array.isArray(value)) {
        return 'expected an array of objects';
      }
      return value.every(
        (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
      )
        ? null
        : 'expected an array of objects';
    default:
      return null;
  }
};

const validatePartitionColumns = (
  entryIndex: number,
  columns: unknown
): string | null => {
  if (!Array.isArray(columns)) {
    return null; // type already reported by checkType
  }
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    if (typeof col !== 'object' || col === null) {
      return `Entry ${entryIndex + 1}: partitionColumns[${i}] must be an object.`;
    }
    const keys = Object.keys(col as Record<string, unknown>);
    for (const key of keys) {
      if (!PARTITION_COLUMN_FIELDS.has(key)) {
        const suggestion = suggest(key, Array.from(PARTITION_COLUMN_FIELDS));
        return `Entry ${entryIndex + 1}: partitionColumns[${i}] has unknown field "${key}"${
          suggestion ? ` — did you mean "${suggestion}"?` : ''
        }`;
      }
    }
    const rec = col as Record<string, unknown>;
    if (typeof rec.name !== 'string' || !rec.name.trim()) {
      return `Entry ${entryIndex + 1}: partitionColumns[${i}].name is required.`;
    }
    if (typeof rec.dataType !== 'string' || !rec.dataType.trim()) {
      return `Entry ${entryIndex + 1}: partitionColumns[${i}].dataType is required.`;
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
      message: `Invalid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      status: 'error',
      message: 'Top-level value must be an object with an "entries" array.',
    };
  }

  const topLevelKeys = Object.keys(parsed as Record<string, unknown>);
  for (const key of topLevelKeys) {
    if (key !== 'entries') {
      return {
        status: 'error',
        message: `Unknown top-level field "${key}". Only "entries" is allowed.`,
      };
    }
  }

  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) {
    return {
      status: 'error',
      message: '"entries" must be an array.',
    };
  }

  const allowedFields = Object.keys(ENTRY_FIELDS);

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return {
        status: 'error',
        message: `Entry ${i + 1} must be an object.`,
      };
    }
    const rec = entry as Record<string, unknown>;

    // Unknown field detection with suggestion
    for (const key of Object.keys(rec)) {
      if (!(key in ENTRY_FIELDS)) {
        const suggestion = suggest(key, allowedFields);
        return {
          status: 'error',
          message: `Entry ${i + 1}: unknown field "${key}"${
            suggestion ? ` — did you mean "${suggestion}"?` : ''
          }`,
        };
      }
    }

    // Required fields
    if (typeof rec.containerName !== 'string' || !rec.containerName.trim()) {
      return {
        status: 'error',
        message: `Entry ${i + 1}: "containerName" is required and must be a non-empty string.`,
      };
    }
    if (typeof rec.dataPath !== 'string' || !rec.dataPath.trim()) {
      return {
        status: 'error',
        message: `Entry ${i + 1}: "dataPath" is required and must be a non-empty string.`,
      };
    }

    // Type checks on each known field
    for (const field of allowedFields as EntryFieldName[]) {
      const err = checkType(rec[field], ENTRY_FIELDS[field]);
      if (err) {
        return {
          status: 'error',
          message: `Entry ${i + 1}: "${field}" ${err}.`,
        };
      }
    }

    // Deep-check partitionColumns shape
    const pcError = validatePartitionColumns(i, rec.partitionColumns);
    if (pcError) {
      return { status: 'error', message: pcError };
    }
  }

  return { status: 'ok', entryCount: entries.length };
};

const ManifestJsonWidget = ({
  value,
  onChange,
  disabled,
  onFocus,
  ...props
}: WidgetProps) => {
  // Pre-populate an editable sample when the field is empty so users
  // have a ready template to edit instead of inventing JSON from scratch.
  useEffect(() => {
    if (value === undefined || value === null || value === '') {
      onChange(SAMPLE_MANIFEST_JSON);
    }
    // Only run on mount — we don't want to overwrite the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFocusHandler = useCallback(() => {
    onFocus?.(props.id, props.value);
  }, [onFocus, props.id, props.value]);

  const effectiveValue = value ?? SAMPLE_MANIFEST_JSON;
  const validation = useMemo(
    () => validateManifestJson(effectiveValue),
    [effectiveValue]
  );

  return (
    <div className="manifest-json-widget">
      <div className="manifest-json-widget-resize-wrapper">
        <SchemaEditor
          className="manifest-json-widget-editor"
          mode={{ name: 'application/json' }}
          readOnly={disabled}
          showCopyButton={false}
          value={effectiveValue}
          onChange={onChange}
          onFocus={onFocusHandler}
        />
      </div>
      <span className="manifest-json-widget-resize-hint">
        Drag the bottom-right corner to resize.
      </span>
      {validation.status === 'ok' && (
        <Alert
          showIcon
          className="m-t-xs"
          message={
            <Text>
              {`Valid manifest — ${validation.entryCount} entr${
                validation.entryCount === 1 ? 'y' : 'ies'
              }.`}
            </Text>
          }
          type="success"
        />
      )}
      {validation.status === 'error' && (
        <Alert
          showIcon
          className="m-t-xs"
          message={validation.message}
          type="error"
        />
      )}
    </div>
  );
};

export default ManifestJsonWidget;
