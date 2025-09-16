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

import classNames from 'classnames';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  formatContent,
  formatValueBasedOnContent,
  setEditorContent,
} from '../../../utils/BlockEditorUtils';
import BlockEditor from '../../BlockEditor/BlockEditor';
import { BlockEditorRef } from '../../BlockEditor/BlockEditor.interface';
import {
  EditorContentRef,
  RichTextEditorProp,
} from './RichTextEditor.interface';

const RichTextEditor = forwardRef<EditorContentRef, RichTextEditorProp>(
  (
    {
      autofocus = false,
      initialValue = '',
      readonly,
      className,
      style,
      placeHolder,
      onTextChange,
    }: RichTextEditorProp,
    ref
  ) => {
    const editorRef = useRef<BlockEditorRef>({} as BlockEditorRef);

    const onChangeHandler = (backendFormatHtmlContent: string) => {
      onTextChange &&
        onTextChange(formatValueBasedOnContent(backendFormatHtmlContent));
    };

    useImperativeHandle(ref, () => ({
      getEditorContent() {
        const htmlContent = editorRef.current?.editor?.getHTML() ?? '';
        const backendFormat = formatContent(htmlContent, 'server');

        return formatValueBasedOnContent(backendFormat);
      },
      clearEditorContent() {
        editorRef.current?.editor &&
          setEditorContent(editorRef.current.editor, '');
      },
      setEditorContent(_content: string) {
        editorRef.current?.editor &&
          setEditorContent(editorRef.current.editor, _content);
      },
    }));

    return (
      <div className={classNames(className)} style={style} data-testid="editor">
        <BlockEditor
          placeholder={placeHolder}
          ref={editorRef}
          autoFocus={autofocus}
          content={initialValue}
          menuType="bar"
          editable={!readonly}
          onChange={onChangeHandler}
        />
      </div>
    );
  }
);

export default RichTextEditor;
