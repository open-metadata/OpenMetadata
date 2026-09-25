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
import { indentWithTab } from '@codemirror/commands';
import { Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { Box } from '@openmetadata/ui-core-components';
import { FormEvent, lazy, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../../../enums/codemirror.enum';
import withSuspenseFallback from '../../../../AppRouter/withSuspenseFallback';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.types';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../../Database/SchemaEditor/SchemaEditor'))
);

const SQL_MODE = { name: CSMode.SQL };
const READ_ONLY_OPTIONS = { readOnly: true };
const EDIT_OPTIONS = { lineNumbers: true };

const SqlPropertyView = ({ value }: PropertyViewProps) => (
  <div
    className="tw:max-h-60 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary"
    data-testid="sql-query-value">
    <SchemaEditor
      className="custom-query-editor custom-code-mirror-theme"
      mode={SQL_MODE}
      options={READ_ONLY_OPTIONS}
      showCopyButton={false}
      value={String(value)}
    />
  </div>
);

const SqlPropertyEdit = ({
  value,
  onSave,
  formId,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState(typeof value === 'string' ? value : '');
  const lineCount = query ? query.split('\n').length : 0;

  // Mod-Enter must beat CodeMirror's default binding (insert blank line).
  const extensions = useMemo(
    () => [
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              formRef.current?.requestSubmit();

              return true;
            },
          },
        ])
      ),
      keymap.of([indentWithTab]),
    ],
    []
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(query.trim() ? query : undefined);
  };

  return (
    <form noValidate id={formId} ref={formRef} onSubmit={handleSubmit}>
      <Box direction="col" gap={2}>
        <div
          className="tw:max-h-80 tw:overflow-auto tw:rounded-lg tw:border tw:border-primary"
          data-testid="sql-query-editor">
          <SchemaEditor
            className="custom-query-editor custom-code-mirror-theme"
            extensions={extensions}
            mode={SQL_MODE}
            options={EDIT_OPTIONS}
            showCopyButton={false}
            value={query}
            onChange={setQuery}
          />
        </div>
        <span className="tw:text-xs tw:text-tertiary">
          {t('message.sql-editor-footer', { count: lineCount })}
        </span>
      </Box>
    </form>
  );
};

export const sqlPropertyRenderer: CustomPropertyRenderer = {
  View: SqlPropertyView,
  Edit: SqlPropertyEdit,
  getEmptyHint: (_property, t) =>
    t('message.example-value', {
      value: 'SELECT * FROM orders WHERE order_date >= CURRENT_DATE - 7',
    }),
};
