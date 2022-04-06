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
import React, { FC, HTMLAttributes, useRef, useState } from 'react';
import { getBackendFormat, HTMLToMarkdown } from '../../../utils/FeedUtils';
import { FeedEditor } from '../../FeedEditor/FeedEditor';
import { KeyHelp } from './KeyHelp';
import { SendButton } from './SendButton';

interface ActivityFeedEditorProp extends HTMLAttributes<HTMLDivElement> {
  onSave?: (value: string) => void;
  buttonClass?: string;
  placeHolder?: string;
  defaultValue?: string;
}

export type EditorContentRef = {
  getEditorValue: () => string;
  clearEditorValue: () => string;
};

const ActivityFeedEditor: FC<ActivityFeedEditorProp> = ({
  className,
  buttonClass = '',
  onSave,
  placeHolder,
  defaultValue,
}) => {
  const editorRef = useRef<EditorContentRef>();
  const [editorValue, setEditorValue] = useState<string>('');

  const onChangeHandler = (value: string) => {
    setEditorValue(HTMLToMarkdown.turndown(value));
  };

  const onSaveHandler = () => {
    if (editorRef.current) {
      if (editorRef.current?.getEditorValue()) {
        setEditorValue('');
        editorRef.current?.clearEditorValue();
        onSave?.(getBackendFormat(editorRef.current?.getEditorValue()));
      }
    }
  };

  return (
    <div className={classNames('tw-relative', className)}>
      <FeedEditor
        defaultValue={defaultValue}
        placeHolder={placeHolder}
        ref={editorRef}
        onChangeHandler={onChangeHandler}
        onSave={onSaveHandler}
      />

      <SendButton
        buttonClass={buttonClass}
        editorValue={editorValue}
        onSaveHandler={onSaveHandler}
      />

      <KeyHelp editorValue={editorValue} />
    </div>
  );
};

export default ActivityFeedEditor;
