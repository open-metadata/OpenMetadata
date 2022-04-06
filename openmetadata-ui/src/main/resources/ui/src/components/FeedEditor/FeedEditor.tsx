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
import 'quill-mention';
import QuillMarkdown from 'quilljs-markdown';
import React, {
  forwardRef,
  HTMLAttributes,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import ReactQuill, { Quill } from 'react-quill';
import {
  EditorPlaceHolder,
  MENTION_ALLOWED_CHARS,
  MENTION_DENOTATION_CHARS,
  TOOLBAR_ITEMS,
} from '../../constants/feed.constants';
import { HTMLToMarkdown, matcher } from '../../utils/FeedUtils';
import { insertMention, insertRef } from '../../utils/QuillUtils';
import { editorRef } from '../common/rich-text-editor/RichTextEditor.interface';
import './FeedEditor.css';

Quill.register('modules/markdownOptions', QuillMarkdown);
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

export const FeedEditor = forwardRef<editorRef, FeedEditorProp>(
  (
    {
      className,
      editorClass,
      onChangeHandler,
      defaultValue,
      onSave,
    }: FeedEditorProp,
    ref
  ) => {
    const [value, setValue] = useState<string>(defaultValue ?? '');
    const [isMentionListOpen, toggleMentionList] = useState(false);
    const [isFocused, toggleFocus] = useState(false);

    /**
     * Prepare modules for editor
     */
    const modules = useMemo(
      () => ({
        toolbar: {
          container: TOOLBAR_ITEMS,
          handlers: {
            insertMention: insertMention,
            insertRef: insertRef,
          },
        },
        mention: {
          allowedChars: MENTION_ALLOWED_CHARS,
          mentionDenotationChars: MENTION_DENOTATION_CHARS,
          onOpen: () => {
            toggleMentionList(false);
          },
          onClose: () => {
            toggleMentionList(true);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSelect: (item: Record<string, any>, insertItem: Function) => {
            toggleMentionList(true);
            insertItem(item);
          },
          source: matcher,
          showDenotationChar: false,
          renderLoading: () => 'Loading...',
        },
        markdownOptions: {},
        clipboard: {
          matchers: [['del, strike', strikethrough]],
        },
      }),
      []
    );

    const onSaveHandle = () => {
      if (onSave) {
        onSave();
      }
    };

    const onFocusHandle = () => {
      toggleFocus(true);
    };

    const onBlurHandle = () => {
      toggleFocus(false);
    };

    const getEditorStyles = () => {
      return isFocused ? { border: '1px solid #868687' } : {};
    };

    /**
     * handle onKeyDown logic
     * @param e - keyboard event
     */
    const handleKeyDown = (e: KeyboardEvent) => {
      // This logic will handle Enter key binding
      if (e.key === 'Enter' && !e.shiftKey && !isMentionListOpen) {
        e.preventDefault();
        onSaveHandle();
      }
      // handle enter keybinding for mention popup
      // set mention list state to false when mention item is selected
      else if (e.key === 'Enter') {
        toggleMentionList(false);
      }
    };

    /**
     * Handle onChange logic and set updated value to state
     * @param value - updated value
     */
    const handleOnChange = (value: string) => {
      setValue(value);
      onChangeHandler?.(value);
    };

    /**
     * Handle forward ref logic and provide method access to parent component
     */
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
      <div className={className} data-testid="editor-wrapper">
        <ReactQuill
          className={classNames('editor-container', editorClass)}
          modules={modules}
          placeholder={EditorPlaceHolder}
          style={getEditorStyles()}
          theme="snow"
          value={value}
          onBlur={onBlurHandle}
          onChange={handleOnChange}
          onFocus={onFocusHandle}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }
);

FeedEditor.displayName = 'FeedEditor';
