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

import CodeMirror from '@uiw/react-codemirror';
import { Button, Card, Tooltip } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/copy-left.svg';
import { JSON_TAB_SIZE } from '../../../constants/constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { useCodeMirrorEditor } from '../../../hooks/useCodeMirrorEditor';
import { CodeMirrorOptions } from '../../../interface/codemirror.interface';
import './schema-editor.less';
import { SchemaEditorProps } from './SchemaEditor.interface';

const DEFAULT_OPTIONS: CodeMirrorOptions = {
  tabSize: JSON_TAB_SIZE,
  indentUnit: JSON_TAB_SIZE,
  indentWithTabs: false,
  lineNumbers: false,
  lineWrapping: false,
  styleActiveLine: true,
  matchBrackets: true,
  autoCloseBrackets: true,
  foldGutter: true,
  readOnly: false,
};

const CodeEditor = ({
  value = '',
  className = '',
  mode = {
    name: CSMode.JAVASCRIPT,
    json: true,
  },
  options,
  readOnly,
  extensions,
  editorClass,
  showCopyButton = true,
  onChange,
  onFocus,
  title,
}: SchemaEditorProps) => {
  const { t } = useTranslation();
  const {
    editorRef,
    editorExtensions,
    internalValue,
    handleChange,
    handleBlur,
  } = useCodeMirrorEditor({
    value,
    // CodeEditor has always formatted its value; it has no autoFormat prop.
    autoFormat: true,
    mode,
    defaultOptions: DEFAULT_OPTIONS,
    options,
    readOnly,
    extensions,
    onChange,
  });
  const { onCopyToClipBoard, hasCopied } = useClipboard(internalValue);

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
                onClick={() => onCopyToClipBoard(internalValue)}
              />
            </Tooltip>
          </div>
        )
      }
      title={title}>
      <CodeMirror
        basicSetup={false}
        className={editorClass}
        extensions={editorExtensions}
        indentWithTab={false}
        ref={editorRef}
        theme="none"
        value={internalValue}
        onBlur={handleBlur}
        onChange={handleChange}
        {...(onFocus && { onFocus })}
      />
    </Card>
  );
};

export default CodeEditor;
