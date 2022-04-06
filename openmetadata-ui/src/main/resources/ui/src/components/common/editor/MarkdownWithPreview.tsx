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

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import RichTextEditor from '../rich-text-editor/RichTextEditor';
import { editorRef } from '../rich-text-editor/RichTextEditor.interface';

type EditorContentRef = {
  getEditorContent: () => string;
};

type Props = {
  value: string;
  readonly?: boolean;
};

const MarkdownWithPreview = forwardRef<editorRef, Props>(
  ({ value }: Props, ref) => {
    const [initValue, setInitValue] = useState<string>(value ?? '');

    const editorRef = useRef<EditorContentRef>();

    useImperativeHandle(ref, () => ({
      getEditorContent() {
        return editorRef.current?.getEditorContent();
      },
    }));

    useEffect(() => {
      setInitValue(value ?? '');
    }, [value]);

    return (
      <div>
        <div className="tw-my-5 tw-bg-white">
          <RichTextEditor initialValue={initValue} ref={editorRef} />
        </div>
      </div>
    );
  }
);

MarkdownWithPreview.displayName = 'MarkdownWithPreview';

export default MarkdownWithPreview;
