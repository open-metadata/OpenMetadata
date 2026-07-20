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
import { Editor, EditorChange } from 'codemirror';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/edit/closebrackets.js';
import 'codemirror/addon/edit/matchbrackets.js';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/fold/foldgutter.js';
import 'codemirror/addon/selection/active-line';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/sql/sql';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Controlled as CodeMirror,
  UnControlled as UnControlledCodeMirror,
} from 'react-codemirror2';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/ic-duplicate.svg';
import { JSON_TAB_SIZE } from '../../../constants/constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { getSchemaEditorValue } from '../../../utils/SchemaEditor.utils';
import './schema-editor.less';
import { SchemaEditorProps } from './SchemaEditor.interface';

const SchemaEditor = ({
  value = '',
  autoFormat = true,
  uncontrolled = false,
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
  const wrapperRef = useRef<CodeMirror | null>(null);
  const { t } = useTranslation();
  const defaultOptions = {
    tabSize: JSON_TAB_SIZE,
    indentUnit: JSON_TAB_SIZE,
    indentWithTabs: false,
    lineNumbers: true,
    lineWrapping: true,
    styleActiveLine: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    mode,
    readOnly: false,
    ...options,
  };
  const [internalValue, setInternalValue] = useState<string>(
    getSchemaEditorValue(value, autoFormat)
  );
  const editorInstance = useRef<Editor | null>(null);
  const wasHiddenRef = useRef(false);
  const { onCopyToClipBoard, hasCopied } = useClipboard(internalValue);

  // In uncontrolled mode CodeMirror owns the buffer, so the value prop is only
  // the initial content. Freezing it prevents the parent's onChange echo from
  // re-hydrating the editor and losing the caret (e.g. after autoCloseBrackets).
  const initialValueRef = useRef<string>(
    getSchemaEditorValue(value, autoFormat)
  );
  // Latest external value; used to flush a pending update on blur when the
  // sync effect had to skip it because the editor was focused.
  const latestValueRef = useRef<string>(
    getSchemaEditorValue(value, autoFormat)
  );

  const handleEditorInputBeforeChange = (
    _editor: Editor,
    _data: EditorChange,
    value: string
  ): void => {
    setInternalValue(getSchemaEditorValue(value, autoFormat));
  };
  const handleEditorInputChange = (
    _editor: Editor,
    _data: EditorChange,
    value: string
  ): void => {
    const nextValue = getSchemaEditorValue(value, autoFormat);
    if (uncontrolled) {
      setInternalValue(nextValue);
    }
    if (!isUndefined(onChange)) {
      onChange(nextValue);
    }
  };

  const refreshAndResetScroll = useCallback(() => {
    if (!editorInstance.current) {
      return;
    }
    editorInstance.current.scrollTo(0, 0);
    editorInstance.current.refresh();
    requestAnimationFrame(() => {
      editorInstance.current?.scrollTo(0, 0);
    });
  }, []);

  const editorWillUnmount = useCallback(() => {
    if (editorInstance.current) {
      const editorWrapper = editorInstance.current.getWrapperElement();
      if (editorWrapper) {
        editorWrapper.remove();
      }
    }
    if (wrapperRef.current) {
      (wrapperRef.current as unknown as { hydrated: boolean }).hydrated = false;
    }
  }, [editorInstance, wrapperRef]);

  useEffect(() => {
    setInternalValue(getSchemaEditorValue(value, autoFormat));
  }, [value, autoFormat]);

  // Uncontrolled editors own their buffer, so react-codemirror2 does not push
  // later value changes in. Sync external updates (e.g. an async-loaded saved
  // config) ourselves, but only while the editor is blurred so we never disturb
  // the caret or an in-progress edit.
  useEffect(() => {
    const nextValue = getSchemaEditorValue(value, autoFormat);
    latestValueRef.current = nextValue;
    const editor = editorInstance.current;
    if (
      uncontrolled &&
      editor &&
      !editor.hasFocus() &&
      editor.getValue() !== nextValue
    ) {
      editor.setValue(nextValue);
    }
  }, [value, autoFormat, uncontrolled]);

  // A value that arrived while the editor was focused is skipped above; apply
  // any such pending change once the editor loses focus.
  useEffect(() => {
    const editor = editorInstance.current;
    let detach = () => undefined as void;
    if (uncontrolled && editor) {
      const flushOnBlur = () => {
        if (editor.getValue() !== latestValueRef.current) {
          editor.setValue(latestValueRef.current);
        }
      };
      editor.on('blur', flushOnBlur);
      detach = () => editor.off('blur', flushOnBlur);
    }

    return detach;
  }, [uncontrolled]);

  // Auto-detect display:none → visible transitions (e.g. Ant Design tab switches).
  // When a parent sets display:none, boundingClientRect collapses to 0.
  // When it becomes visible again, we refresh CodeMirror and reset scroll.
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

  // Explicit refresh via prop (kept for backwards compatibility).
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

      {uncontrolled ? (
        <UnControlledCodeMirror
          className={editorClass}
          editorDidMount={(editor) => {
            editorInstance.current = editor;
          }}
          editorWillUnmount={editorWillUnmount}
          options={defaultOptions}
          value={initialValueRef.current}
          onChange={handleEditorInputChange}
          {...(onFocus && { onFocus })}
        />
      ) : (
        <CodeMirror
          className={editorClass}
          editorDidMount={(editor) => {
            editorInstance.current = editor;
          }}
          editorWillUnmount={editorWillUnmount}
          options={defaultOptions}
          ref={wrapperRef}
          value={internalValue}
          onBeforeChange={handleEditorInputBeforeChange}
          onChange={handleEditorInputChange}
          {...(onFocus && { onFocus })}
        />
      )}
    </div>
  );
};

export default SchemaEditor;
