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

import { closeBrackets } from '@codemirror/autocomplete';
import { bracketMatching, foldGutter, indentUnit } from '@codemirror/language';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, highlightActiveLine, lineNumbers } from '@codemirror/view';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { Button, Card, Tooltip } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/copy-left.svg';
import { JSON_TAB_SIZE } from '../../../constants/constants';
import { CSMode, getLanguageExtension } from '../../../enums/codemirror.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { getSchemaEditorValue } from '../../../utils/SchemaEditor.utils';
import './schema-editor.less';
import { SchemaEditorProps } from './SchemaEditor.interface';

const CodeEditor = ({
  value = '',
  className = '',
  mode = {
    name: CSMode.JAVASCRIPT,
    json: true,
  },
  readOnly,
  options,
  editorClass,
  showCopyButton = true,
  onChange,
  onFocus,
  refreshEditor,
  title,
}: SchemaEditorProps) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const { t } = useTranslation();

  const [internalValue, setInternalValue] = useState<string>(
    getSchemaEditorValue(value)
  );
  const { onCopyToClipBoard, hasCopied } = useClipboard(internalValue);

  const isReadOnly = readOnly === true || Boolean(options?.readOnly);
  const showLineNumbers = options?.lineNumbers ?? false;
  const enableLineWrapping = options?.lineWrapping ?? false;

  const extensions: Extension[] = useMemo(() => {
    const exts: Extension[] = [
      getLanguageExtension(mode),
      EditorState.tabSize.of(JSON_TAB_SIZE),
      indentUnit.of(' '.repeat(JSON_TAB_SIZE)),
      highlightActiveLine(),
      bracketMatching(),
      closeBrackets(),
      foldGutter(),
    ];

    if (showLineNumbers) {
      exts.push(lineNumbers());
    }

    if (enableLineWrapping) {
      exts.push(EditorView.lineWrapping);
    }

    if (isReadOnly) {
      exts.push(EditorView.editable.of(false));
      exts.push(EditorState.readOnly.of(true));
    }

    return exts;
  }, [mode, showLineNumbers, enableLineWrapping, isReadOnly]);

  const handleChange = useCallback(
    (val: string) => {
      setInternalValue(getSchemaEditorValue(val));
      if (!isUndefined(onChange)) {
        onChange(getSchemaEditorValue(val));
      }
    },
    [onChange]
  );

  useEffect(() => {
    setInternalValue(getSchemaEditorValue(value));
  }, [value]);

  useEffect(() => {
    if (refreshEditor) {
      setTimeout(() => {
        const view = editorRef.current?.view;
        if (view) {
          view.requestMeasure();
        }
      }, 50);
    }
  }, [refreshEditor]);

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
      <CodeMirror
        basicSetup={false}
        className={editorClass}
        extensions={extensions}
        ref={editorRef}
        value={internalValue}
        onChange={handleChange}
        {...(onFocus && { onFocus })}
      />
    </Card>
  );
};

export default CodeEditor;
