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

import React, { FC, HTMLAttributes, useRef } from 'react';
import { Button } from '../../buttons/Button/Button';
import FeedEditor from '../../FeedEditor/FeedEditor';

interface ActivityFeedEditorProp extends HTMLAttributes<HTMLDivElement> {
  onSave?: (value: string) => void;
  buttonClass?: string;
}
type EditorContentRef = {
  getEditorValue: () => string;
};

const ActivityFeedEditor: FC<ActivityFeedEditorProp> = ({
  className,
  buttonClass = '',
  onSave,
}) => {
  const editorRef = useRef<EditorContentRef>();
  const onSaveHandler = () => {
    if (editorRef.current) {
      onSave?.(editorRef.current?.getEditorValue() ?? '');
    }
  };

  return (
    <div className={className}>
      <FeedEditor ref={editorRef} />
      <div className="tw-flex tw-flex-row tw-items-center tw-justify-end">
        <Button className={buttonClass} theme="primary" onClick={onSaveHandler}>
          Send
        </Button>
      </div>
    </div>
  );
};

export default ActivityFeedEditor;
