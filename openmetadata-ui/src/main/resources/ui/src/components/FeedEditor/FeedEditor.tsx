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

import classNames from 'classnames';
import MarkdownShortcuts from 'quill-markdown-shortcuts';
import 'quill-mention';
import React, {
  forwardRef,
  HTMLAttributes,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import ReactQuill, { Quill } from 'react-quill';
import { HTMLToMarkdown, matcher } from '../../utils/FeedUtils';
import { insertMention, insertRef } from '../../utils/QuillUtils';
import { editorRef } from '../common/rich-text-editor/RichTextEditor.interface';
import './FeedEditor.css';

Quill.register('modules/markdownShortcuts', MarkdownShortcuts);
const Delta = Quill.import('delta');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const strikethrough = (_node: any, delta: typeof Delta) => {
  return delta.compose(new Delta().retain(delta.length(), { strike: true }));
};

interface FeedEditorProp extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  editorClass?: string;
  className?: string;
  placeHolder?: string;
  onChangeHandler?: (value: string) => void;
  onSave?: () => void;
}

const modules = {
  toolbar: {
    container: [
      ['bold', 'italic', 'strike'],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['insertMention', 'insertRef'],
    ],
    handlers: {
      insertMention: insertMention,
      insertRef: insertRef,
    },
  },
  mention: {
    allowedChars: /^[A-Za-z0-9_]*$/,
    mentionDenotationChars: ['@', '#'],
    source: matcher,
    showDenotationChar: false,
    renderLoading: () => 'Loading...',
  },

  markdownShortcuts: {},
  clipboard: {
    matchers: [['del, strike', strikethrough]],
  },
};

const FeedEditor = forwardRef<editorRef, FeedEditorProp>(
  (
    {
      className,
      editorClass,
      placeHolder,
      onChangeHandler,
      defaultValue = '',
    }: FeedEditorProp,
    ref
  ) => {
    const [value, setValue] = useState<string>(defaultValue);
    const editorRef = useRef<ReactQuill>(null);

    const handleOnChange = (value: string) => {
      setValue(value);
      onChangeHandler?.(value);
    };

    useImperativeHandle(ref, () => ({
      getEditorValue() {
        setValue('');

        return HTMLToMarkdown.turndown(value);
      },
      clearEditorValue() {
        setValue('');
      },
    }));

    return (
      <div className={className}>
        <ReactQuill
          className={classNames('editor-container', editorClass)}
          modules={modules}
          placeholder={placeHolder ?? 'Enter a reply'}
          ref={editorRef}
          theme="snow"
          value={value}
          onChange={handleOnChange}
        />
      </div>
    );
  }
);

export default FeedEditor;
