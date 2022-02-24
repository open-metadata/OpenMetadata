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
import React, { FC, HTMLAttributes, useRef } from 'react';
import SVGIcons from '../../../utils/SvgUtils';
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
      if (editorRef.current?.getEditorValue()) {
        onSave?.(editorRef.current?.getEditorValue());
      }
    }
  };

  return (
    <div className={classNames('tw-relative', className)}>
      <FeedEditor ref={editorRef} />
      <div className="tw-absolute tw-right-2 tw-bottom-2 tw-flex tw-flex-row tw-items-center tw-justify-end">
        <Button
          className={classNames('tw-bg-gray-400', buttonClass)}
          size="small"
          theme="default"
          onClick={onSaveHandler}>
          <SVGIcons alt="paper-plane" icon="icon-paper-plane" width="18px" />
        </Button>
      </div>
    </div>
  );
};

export default ActivityFeedEditor;
