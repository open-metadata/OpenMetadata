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

import Icon from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/ic-duplicate.svg';
import { JSON_TAB_SIZE } from '../../../constants/constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { useCodeMirror } from '../../../hooks/useCodeMirror';
import { getSchemaEditorValue } from '../../../utils/SchemaEditor.utils';
import './schema-editor.less';
import { Mode, SchemaEditorProps } from './SchemaEditor.interface';

const DEFAULT_MODE: Mode = { name: CSMode.JAVASCRIPT, json: true };

const SchemaEditor = ({
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
}: SchemaEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const [internalValue, setInternalValue] = useState<string>(
    getSchemaEditorValue(value)
  );
  const wasHiddenRef = useRef(false);
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

  const { editorRef, requestRefresh } = useCodeMirror({
    value: internalValue,
    mode,
    readOnly: readOnly ?? options?.readOnly === true,
    showLineNumbers: options?.lineNumbers !== false,
    lineWrapping: options?.lineWrapping !== false,
    showFoldGutter: options?.foldGutter !== false,
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
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isHidden = entry.boundingClientRect.height === 0;

        if (isHidden) {
          wasHiddenRef.current = true;
        } else if (wasHiddenRef.current) {
          wasHiddenRef.current = false;
          requestRefresh();
        }
      },
      { threshold: 0 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [requestRefresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (refreshEditor) {
      timer = setTimeout(() => {
        requestRefresh();
      }, 50);
    }

    return () => clearTimeout(timer);
  }, [refreshEditor, requestRefresh]);

  return (
    <div
      className={classNames('schema-editor-container relative', className)}
      data-testid="code-mirror-container"
      ref={containerRef}>
      {showCopyButton && (
        <div className="query-editor-button">
          <Tooltip
            title={
              hasCopied ? t('label.copied') : t('message.copy-to-clipboard')
            }>
            <Button
              className="query-editor-copy-button"
              data-testid="query-copy-button"
              icon={<Icon component={CopyIcon} />}
              onClick={() => onCopyToClipBoard(internalValue)}
            />
          </Tooltip>
        </div>
      )}

      <div className={editorClass} ref={editorRef} />
    </div>
  );
};

export default SchemaEditor;
