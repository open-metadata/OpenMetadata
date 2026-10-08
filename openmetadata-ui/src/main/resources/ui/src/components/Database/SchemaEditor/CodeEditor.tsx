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

import { ButtonUtility, Card } from '@openmetadata/ui-core-components';
import { Copy01 } from '@openmetadata/ui-core-components/icons';
import CodeMirror from '@uiw/react-codemirror';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
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
      className={classNames(
        'tw:overflow-visible tw:border-subtle tw:shadow-card tw:text-sm tw:leading-[1.5715] tw:text-primary tw:tabular-nums',
        className,
        'code-editor-new-style'
      )}
      data-testid="code-mirror-container">
      {(title || showCopyButton) && (
        <div
          className={classNames(
            'tw:-mb-px tw:flex tw:min-h-7 tw:items-center tw:rounded-t-xl',
            'tw:border-b tw:border-subtle tw:bg-secondary tw:px-6 tw:text-base',
            'tw:leading-[1.5715] tw:font-medium tw:text-primary'
          )}>
          <div className="tw:inline-block tw:flex-1 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap tw:[&_.ant-form-item-label]:p-0!">
            {title}
          </div>
          {showCopyButton && (
            <div
              className="tw:ml-auto tw:text-sm tw:leading-[1.5715] tw:font-normal tw:text-primary"
              data-testid="copy-button-container">
              <ButtonUtility
                aria-label={t('message.copy-to-clipboard')}
                color="tertiary"
                data-testid="query-copy-button"
                icon={Copy01}
                size="sm"
                tooltip={
                  hasCopied ? t('label.copied') : t('message.copy-to-clipboard')
                }
                onClick={() => onCopyToClipBoard(internalValue)}
              />
            </div>
          )}
        </div>
      )}
      <div className="tw:p-5">
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
    </Card>
  );
};

export default CodeEditor;
