/*
 *  Copyright 2021 Collate
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

import { Editor } from '@toast-ui/react-editor';
import React, {
  createRef,
  forwardRef,
  Fragment,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import './RichTextEditor.css';
import { editorRef, RichTextEditorProp } from './RichTextEditor.interface';

const RichTextEditor = forwardRef<editorRef, RichTextEditorProp>(
  (
    {
      placeHolder = 'Write your description',
      previewStyle = 'tab',
      editorType = 'markdown',
      previewHighlight = false,
      useCommandShortcut = false,
      extendedAutolinks = true,
      hideModeSwitch = true,
      initialValue = '',
    }: RichTextEditorProp,
    ref
  ) => {
    const editorRef = createRef<Editor>();

    const [editorValue, setEditorValue] = useState(initialValue);

    const onChangeHandler = () => {
      const value = editorRef.current?.getInstance().getMarkdown() as string;
      setEditorValue(value);
    };

    useImperativeHandle(ref, () => ({
      getEditorContent() {
        return editorValue;
      },
    }));

    useEffect(() => {
      setEditorValue(initialValue);
    }, [initialValue]);

    return (
      <Fragment>
        <Editor
          extendedAutolinks={extendedAutolinks}
          hideModeSwitch={hideModeSwitch}
          initialEditType={editorType}
          initialValue={editorValue}
          placeholder={placeHolder}
          previewHighlight={previewHighlight}
          previewStyle={previewStyle}
          ref={editorRef}
          toolbarItems={[['bold', 'italic'], ['ul', 'ol'], ['link']]}
          useCommandShortcut={useCommandShortcut}
          onChange={onChangeHandler}
        />
      </Fragment>
    );
  }
);

export default RichTextEditor;
