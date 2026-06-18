/*
 *  Copyright 2022 Collate.
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

import { Button, Card, Tooltip } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/copy-left.svg';
import { JSON_TAB_SIZE } from '../../../constants/constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { useCodeMirror } from '../../../hooks/useCodeMirror';
import { getSchemaEditorValue } from '../../../utils/SchemaEditor.utils';
import './schema-editor.less';
import { Mode, SchemaEditorProps } from './SchemaEditor.interface';

const DEFAULT_MODE: Mode = { name: CSMode.JAVASCRIPT, json: true };

const CodeEditor = ({
  value = '',
  className = '',
  mode = DEFAULT_MODE,
  options,
  editorClass,
  showCopyButton = true,
  readOnly,
  onChange,
  onFocus,
  refreshEditor,
  title,
}: SchemaEditorProps) => {
  const { t } = useTranslation();
  const [internalValue, setInternalValue] = useState<string>(
    getSchemaEditorValue(value)
  );
  const { onCopyToClipBoard, hasCopied } = useClipboard(internalValue);

  const handleChange = useCallback(
    (val: string) => {
      const processed = getSchemaEditorValue(val);
      setInternalValue(processed);
      if (!isUndefined(onChange)) {
        onChange(processed);
      }
    },
    [onChange]
  );

  const { editorRef, viewRef, requestRefresh } = useCodeMirror({
    value: internalValue,
    mode,
    readOnly: readOnly ?? options?.readOnly === true,
    showLineNumbers: options?.lineNumbers === true,
    lineWrapping: options?.lineWrapping === true,
    showFoldGutter: false,
    styleActiveLine: options?.styleActiveLine !== false,
    matchBrackets: options?.matchBrackets !== false,
    autoCloseBrackets: options?.autoCloseBrackets !== false,
    tabSize:
      typeof options?.tabSize === 'number' ? options.tabSize : JSON_TAB_SIZE,
    onChange: handleChange,
    onFocus,
  });

  useEffect(() => {
    setInternalValue(getSchemaEditorValue(value));
  }, [value]);

  useEffect(() => {
    if (refreshEditor) {
      setTimeout(() => {
        requestRefresh();
      }, 50);
    }
  }, [refreshEditor, requestRefresh]);

  return (
    <Card
      className={classNames(className, 'code-editor-new-style')}
      data-testid="code-mirror-container"
      extra={
        showCopyButton && (
          <div data-testid="copy-button-container">
            <Tooltip
              title={
                hasCopied ? t('label.copied') : t('message.copy-to-clipboard')
              }>
              <Button
                className="flex-center"
                data-testid="query-copy-button"
                icon={<CopyIcon height={16} width={16} />}
                size="small"
                type="text"
                onClick={() => onCopyToClipBoard()}
              />
            </Tooltip>
          </div>
        )
      }
      title={title}>
      <div
        className={editorClass}
        data-testid="code-mirror-editor"
        data-view={viewRef.current ? 'mounted' : 'pending'}
        ref={editorRef}
      />
    </Card>
  );
};

export default CodeEditor;
