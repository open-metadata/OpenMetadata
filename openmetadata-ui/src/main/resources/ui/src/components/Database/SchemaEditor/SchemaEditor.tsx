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
import { closeBrackets } from '@codemirror/autocomplete';
import { bracketMatching, foldGutter, indentUnit } from '@codemirror/language';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, highlightActiveLine, lineNumbers } from '@codemirror/view';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { Button, Tooltip } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/ic-duplicate.svg';
import { JSON_TAB_SIZE } from '../../../constants/constants';
import { CSMode, getLanguageExtension } from '../../../enums/codemirror.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { getSchemaEditorValue } from '../../../utils/SchemaEditor.utils';
import './schema-editor.less';
import { SchemaEditorProps } from './SchemaEditor.interface';

const SchemaEditor = ({
  value = '',
  className = '',
  mode = {
    name: CSMode.JAVASCRIPT,
    json: true,
  },
  options,
  editorClass,
  showCopyButton = true,
  onChange,
  onFocus,
  refreshEditor,
}: SchemaEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const { t } = useTranslation();

  const [internalValue, setInternalValue] = useState<string>(
    getSchemaEditorValue(value)
  );
  const wasHiddenRef = useRef(false);
  const { onCopyToClipBoard, hasCopied } = useClipboard(internalValue);

  const isReadOnly = options?.readOnly === true;

  const extensions: Extension[] = useMemo(() => {
    const exts: Extension[] = [
      getLanguageExtension(mode),
      EditorState.tabSize.of(JSON_TAB_SIZE),
      indentUnit.of(' '.repeat(JSON_TAB_SIZE)),
      lineNumbers(),
      EditorView.lineWrapping,
      highlightActiveLine(),
      bracketMatching(),
      closeBrackets(),
      foldGutter(),
    ];

    if (isReadOnly) {
      exts.push(EditorView.editable.of(false));
      exts.push(EditorState.readOnly.of(true));
    }

    return exts;
  }, [mode, isReadOnly]);

  const handleChange = useCallback(
    (val: string) => {
      setInternalValue(getSchemaEditorValue(val));
      if (!isUndefined(onChange)) {
        onChange(getSchemaEditorValue(val));
      }
    },
    [onChange]
  );

  const refreshAndResetScroll = useCallback(() => {
    const view = editorRef.current?.view;
    if (!view) {
      return;
    }
    view.scrollDOM.scrollTop = 0;
    view.requestMeasure();
    requestAnimationFrame(() => {
      const v = editorRef.current?.view;
      if (v) {
        v.scrollDOM.scrollTop = 0;
      }
    });
  }, []);

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
          refreshAndResetScroll();
        }
      },
      { threshold: 0 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [refreshAndResetScroll]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (refreshEditor) {
      timer = setTimeout(() => {
        refreshAndResetScroll();
      }, 50);
    }

    return () => clearTimeout(timer);
  }, [refreshEditor, refreshAndResetScroll]);

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

      <CodeMirror
        basicSetup={false}
        className={editorClass}
        extensions={extensions}
        ref={editorRef}
        value={internalValue}
        onChange={handleChange}
        {...(onFocus && { onFocus })}
      />
    </div>
  );
};

export default SchemaEditor;
