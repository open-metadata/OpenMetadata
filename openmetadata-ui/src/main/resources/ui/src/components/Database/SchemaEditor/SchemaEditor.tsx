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
import CodeMirror from '@uiw/react-codemirror';
import { Button, Tooltip } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/ic-duplicate.svg';
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
  lineNumbers: true,
  lineWrapping: true,
  styleActiveLine: true,
  matchBrackets: true,
  autoCloseBrackets: true,
  foldGutter: true,
  readOnly: false,
};

const SchemaEditor = ({
  value = '',
  autoFormat = true,
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
  copyButtonClassName,
  onChange,
  onFocus,
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
    autoFormat,
    mode,
    defaultOptions: DEFAULT_OPTIONS,
    options,
    readOnly,
    extensions,
    onChange,
  });
  const { onCopyToClipBoard, hasCopied } = useClipboard(internalValue);

  return (
    <div
      className={classNames('schema-editor-container relative', className)}
      data-testid="code-mirror-container">
      {showCopyButton && (
        <div className={classNames('query-editor-button', copyButtonClassName)}>
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
    </div>
  );
};

export default SchemaEditor;
