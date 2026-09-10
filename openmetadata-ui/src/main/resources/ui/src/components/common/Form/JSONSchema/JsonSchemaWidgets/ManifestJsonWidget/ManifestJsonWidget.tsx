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
import { lazy, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../../../../enums/codemirror.enum';
import withSuspenseFallback from '../../../../../AppRouter/withSuspenseFallback';
import './manifest-json-widget.less';
import {
  ValidationError,
  ValidationState,
} from './ManifestJsonWidget.interface';
import {
  EntryFieldName,
  ENTRY_FIELDS,
  formatEntryError,
  formatPartitionError,
  formatTopLevelError,
  getValidatedEntries,
  parseManifestJson,
  validateEntry,
} from './ManifestJsonWidget.utils';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../../../Database/SchemaEditor/SchemaEditor'))
);

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

export const validateManifestJson = (raw: string): ValidationState => {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { status: 'empty' };
  }

  const parseResult = parseManifestJson(trimmed);
  if ('error' in parseResult) {
    return { status: 'error', error: parseResult.error };
  }

  const entriesResult = getValidatedEntries(parseResult.parsed);
  if ('error' in entriesResult) {
    return { status: 'error', error: entriesResult.error };
  }
  const { entries } = entriesResult;

  const allowedFields = Object.keys(ENTRY_FIELDS) as EntryFieldName[];

  for (let i = 0; i < entries.length; i += 1) {
    const entryError = validateEntry(entries[i], i, allowedFields);
    if (entryError) {
      return { status: 'error', error: entryError };
    }
  }

  return { status: 'ok', entryCount: entries.length };
};

export const formatValidationError = (
  error: ValidationError,
  t: TFunction
): string =>
  formatTopLevelError(error, t) ??
  formatEntryError(error, t) ??
  formatPartitionError(error, t) ??
  '';

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

  // Show the sample JSON only as a greyed CodeMirror placeholder — never as the
  // field value — so clearing the editor leaves it truly empty and typing is not
  // reformatted mid-edit (autoFormat is disabled).
  const editorValue = typeof value === 'string' ? value : '';

  const editorOptions = useMemo(
    () => ({ placeholder: SAMPLE_MANIFEST_JSON }),
    []
  );

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
    () => validateManifestJson(editorValue),
    [editorValue]
  );

  return (
    <div className="manifest-json-widget">
      <div className="manifest-json-widget-resize-wrapper">
        <SchemaEditor
          uncontrolled // Let CodeMirror own the caret so autoclose does not jump it
          autoFormat={false} // To prevent cursor reset on every key press
          className="manifest-json-widget-editor"
          mode={JSON_EDITOR_MODE}
          options={editorOptions}
          readOnly={disabled}
          showCopyButton={false}
          value={editorValue}
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
