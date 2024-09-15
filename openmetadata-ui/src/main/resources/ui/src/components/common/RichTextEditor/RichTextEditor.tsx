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

/* eslint-disable */

import { Editor, Viewer } from '@toast-ui/react-editor';
import classNames from 'classnames';
import { uniqueId } from 'lodash';
import React, {
  createRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../utils/i18next/LocalUtil';
import { customHTMLRenderer } from './CustomHtmlRederer/CustomHtmlRederer';
import { EDITOR_TOOLBAR_ITEMS } from './EditorToolBar';
import './rich-text-editor.less';
import { editorRef, RichTextEditorProp } from './RichTextEditor.interface';

const RichTextEditor = forwardRef<editorRef, RichTextEditorProp>(
  (
    {
      placeHolder = 'Write your description',
      previewStyle = 'tab',
      editorType = 'markdown',
      previewHighlight = false,
      useCommandShortcut = true,
      extendedAutolinks = true,
      hideModeSwitch = true,
      autofocus = false,
      initialValue = '',
      readonly,
      height,
      className,
      style,
      onTextChange,
    }: RichTextEditorProp,
    ref
  ) => {
    const { t } = useTranslation();
    const richTextEditorRef = createRef<Editor>();

    const [editorValue, setEditorValue] = useState(initialValue);
    const [imageBlobError, setImageBlobError] = useState<string | null>(null);

    const onChangeHandler = () => {
      const value = richTextEditorRef.current
        ?.getInstance()
        .getMarkdown() as string;
      setEditorValue(value);
      onTextChange && onTextChange(value);
    };

    useImperativeHandle(ref, () => ({
      getEditorContent() {
        return editorValue;
      },
      clearEditorContent() {
        richTextEditorRef.current?.getInstance().setMarkdown('');
      },
    }));

    useEffect(() => {
      setEditorValue(initialValue);
    }, [initialValue]);

    // handle the direction of the editor
    useEffect(() => {
      const dir = i18n.dir();
      const editorElement = document.querySelector('.toastui-editor.md-mode');
      const previewElement = document.querySelector(
        '.toastui-editor-md-preview'
      );
      const textAlign = dir === 'rtl' ? 'right' : 'left';
      if (editorElement) {
        editorElement.setAttribute('dir', dir);
        editorElement.setAttribute('style', `text-align: ${textAlign};`);
      }

      if (previewElement) {
        previewElement.setAttribute('dir', dir);
        previewElement.setAttribute('style', `text-align: ${textAlign};`);
      }
    }, []);

    return (
      <div className={classNames(className)} style={style}>
        {readonly ? (
          <div
            className={classNames('border p-xs rounded-4', {
              'text-right': i18n.dir() === 'rtl',
            })}
            data-testid="viewer"
            dir={i18n.dir()}>
            <Viewer
              extendedAutolinks={extendedAutolinks}
              customHTMLRenderer={customHTMLRenderer}
              initialValue={editorValue}
              key={uniqueId()}
              ref={richTextEditorRef}
            />
          </div>
        ) : (
          <div data-testid="editor">
            <Editor
              hooks={{
                addImageBlobHook() {
                  setImageBlobError(t('message.image-upload-error'));

                  setTimeout(() => {
                    setImageBlobError(null);
                  }, 3000);
                },
              }}
              autofocus={autofocus}
              extendedAutolinks={extendedAutolinks}
              height={height ?? '320px'}
              hideModeSwitch={hideModeSwitch}
              initialEditType={editorType}
              initialValue={editorValue}
              placeholder={placeHolder}
              previewHighlight={previewHighlight}
              previewStyle={previewStyle}
              ref={richTextEditorRef}
              customHTMLRenderer={customHTMLRenderer}
              toolbarItems={[EDITOR_TOOLBAR_ITEMS]}
              useCommandShortcut={useCommandShortcut}
              onChange={onChangeHandler}
            />
            {imageBlobError && (
              <div style={{ display: 'flex', flexWrap: 'nowrap' }}>
                <div
                  className="ant-form-item-explain ant-form-item-explain-connected"
                  role="alert">
                  <div className="ant-form-item-explain-error">
                    {imageBlobError}
                  </div>
                </div>
                <div style={{ width: '0px', height: '24px' }}></div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

export default RichTextEditor;
