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
import React, { FC, HTMLAttributes, useState } from 'react';
import { getBackendFormat, HTMLToMarkdown } from '../../../utils/FeedUtils';
import { FeedEditor } from '../../FeedEditor/FeedEditor';
import { EditorContentRef } from '../ActivityFeedCard/FeedCardBody/FeedCardBody';
import { KeyHelp } from './KeyHelp';
import { SendButton } from './SendButton';

interface ActivityFeedEditorProp extends HTMLAttributes<HTMLDivElement> {
  editorClass?: string;
  buttonClass?: string;
  placeHolder?: string;
  defaultValue?: string;
  editAction?: React.ReactNode;
  onSave?: (value: string) => void;
  onTextChange?: (message: string) => void;
  editorRef: React.MutableRefObject<EditorContentRef | undefined>;
}

const ActivityFeedEditor: FC<ActivityFeedEditorProp> = ({
  className,
  editorClass = '',
  buttonClass = '',
  onSave,
  placeHolder,
  defaultValue,
  onTextChange,
  editAction,
  editorRef,
}) => {
  const [editorValue, setEditorValue] = useState<string>('');

  const onChangeHandler = (value: string) => {
    const markdown = HTMLToMarkdown.turndown(value);
    const backendFormat = getBackendFormat(markdown);
    setEditorValue(markdown);
    onTextChange && onTextChange(backendFormat);
  };

  const onSaveHandler = () => {
    if (editorRef.current) {
      if (editorRef.current?.getEditorValue()) {
        setEditorValue('');
        editorRef.current?.clearEditorValue();
        const message = getBackendFormat(editorRef.current?.getEditorValue());
        onSave && onSave(message);
      }
    }
  };

  return (
    <div
      className={classNames('tw-relative', className)}
      onClick={(e) => e.stopPropagation()}>
      <FeedEditor
        defaultValue={defaultValue}
        editorClass={editorClass}
        placeHolder={placeHolder}
        ref={editorRef}
        onChangeHandler={onChangeHandler}
        onSave={onSaveHandler}
      />
      {editAction ? (
        editAction
      ) : (
        <>
          <SendButton
            buttonClass={buttonClass}
            editorValue={editorValue}
            onSaveHandler={onSaveHandler}
          />

          <KeyHelp editorValue={editorValue} />
        </>
      )}
    </div>
  );
};

export default ActivityFeedEditor;
