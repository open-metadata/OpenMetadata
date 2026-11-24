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
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { JSON_TAB_SIZE } from '../../../constants/constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { useCodeMirrorEditor } from '../../../hooks/useCodeMirrorEditor';
import { CodeMirrorOptions } from '../../../interface/codemirror.interface';
import CopyButton from '../../common/CopyButton/CopyButton';
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

  return (
    <div
      className={classNames('schema-editor-container relative', className)}
      data-testid="code-mirror-container">
      {showCopyButton && (
        <div className={classNames('query-editor-button', copyButtonClassName)}>
          <CopyButton
            testId="query-copy-button"
            tooltip={t('message.copy-to-clipboard')}
            value={internalValue}
          />
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
