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

import classNames from 'classnames';
import { noop } from 'lodash';
import {
  forwardRef,
  HTMLAttributes,
  LegacyRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { getBackendFormat, HTMLToMarkdown } from '../../../utils/FeedUtils';
import { EditorContentRef } from '../../common/RichTextEditor/RichTextEditor.interface';
import { FeedEditor } from '../FeedEditor/FeedEditor';
import { KeyHelp } from './KeyHelp';
import { SendButton } from './SendButton';

interface ActivityFeedEditorProp extends HTMLAttributes<HTMLDivElement> {
  placeHolder?: string;
  defaultValue?: string;
  editorClass?: string;
  editAction?: React.ReactNode;
  onSave?: (value: string) => void;
  onTextChange?: (message: string) => void;
  focused?: boolean;
}

const ActivityFeedEditor = forwardRef<EditorContentRef, ActivityFeedEditorProp>(
  (
    {
      className,
      editorClass,
      onSave,
      placeHolder,
      defaultValue,
      onTextChange,
      editAction,
      focused = false,
    },
    ref
  ) => {
    const editorRef = useRef<EditorContentRef>();
    const [editorValue, setEditorValue] = useState<string>('');

    const onChangeHandler = (value: string) => {
      const markdown = HTMLToMarkdown.turndown(value);
      const backendFormat = getBackendFormat(markdown);
      setEditorValue(markdown);
      onTextChange && onTextChange(backendFormat);
    };

    const onSaveHandler = () => {
      if (editorRef.current) {
        if (editorRef.current?.getEditorContent()) {
          setEditorValue('');
          editorRef.current?.clearEditorContent();
          const message = getBackendFormat(
            editorRef.current?.getEditorContent()
          );
          onSave && onSave(message);
        }
      }
    };

    /**
     * Handle forward ref logic and provide method access to parent component
     */
    useImperativeHandle(ref, () => ({
      getEditorContent: editorRef.current?.getEditorContent ?? (() => ''),
      clearEditorContent: editorRef.current?.clearEditorContent ?? noop,
      setEditorContent: editorRef.current?.setEditorContent ?? noop,
    }));

    return (
      <div
        className={classNames('relative', className)}
        data-testid="activity-feed-editor-new"
        onClick={(e) => e.stopPropagation()}>
        <FeedEditor
          defaultValue={defaultValue}
          editorClass={editorClass}
          focused={focused}
          placeHolder={placeHolder}
          ref={editorRef as LegacyRef<EditorContentRef>}
          onChangeHandler={onChangeHandler}
          onSave={onSaveHandler}
        />
        {editAction ?? (
          <>
            <SendButton
              className="activity-feed-editor-send-btn"
              editorValue={editorValue}
              onSaveHandler={onSaveHandler}
            />
            <KeyHelp editorValue={editorValue} />
          </>
        )}
      </div>
    );
  }
);

export default ActivityFeedEditor;
