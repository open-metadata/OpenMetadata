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

import { Editor, Viewer } from '@toast-ui/react-editor';
import React, {
  createRef,
  forwardRef,
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
      readonly,
    }: RichTextEditorProp,
    ref
  ) => {
    const richTextEditorRef = createRef<Editor>();

    const [editorValue, setEditorValue] = useState(initialValue);

    const onChangeHandler = () => {
      const value = richTextEditorRef.current
        ?.getInstance()
        .getMarkdown() as string;
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
      <div className="tw-my-4">
        {readonly ? (
          <div
            className="tw-border tw-border-main tw-p-2 tw-rounded"
            data-testid="viewer">
            <Viewer
              extendedAutolinks={extendedAutolinks}
              initialValue={editorValue}
              ref={richTextEditorRef}
            />
          </div>
        ) : (
          <div data-testid="editor">
            <Editor
              extendedAutolinks={extendedAutolinks}
              hideModeSwitch={hideModeSwitch}
              initialEditType={editorType}
              initialValue={editorValue}
              placeholder={placeHolder}
              previewHighlight={previewHighlight}
              previewStyle={previewStyle}
              ref={richTextEditorRef}
              toolbarItems={[['bold', 'italic'], ['ul', 'ol'], ['link']]}
              useCommandShortcut={useCommandShortcut}
              onChange={onChangeHandler}
            />
          </div>
        )}
      </div>
    );
  }
);

export default RichTextEditor;
