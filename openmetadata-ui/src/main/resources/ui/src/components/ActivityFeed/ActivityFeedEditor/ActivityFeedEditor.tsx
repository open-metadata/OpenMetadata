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
import { HTMLToMarkdown } from '../../../utils/FeedUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import PopOver from '../../common/popover/PopOver';
import FeedEditor from '../../FeedEditor/FeedEditor';

interface ActivityFeedEditorProp extends HTMLAttributes<HTMLDivElement> {
  onSave?: (value: string) => void;
  buttonClass?: string;
  placeHolder?: string;
}
type EditorContentRef = {
  getEditorValue: () => string;
  clearEditorValue: () => string;
};

const ActivityFeedEditor: FC<ActivityFeedEditorProp> = ({
  className,
  buttonClass = '',
  onSave,
  placeHolder,
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
        onSave?.(editorRef.current?.getEditorValue());
      }
    }
  };

  return (
    <div className={classNames('tw-relative', className)}>
      <FeedEditor
        defaultValue={editorValue}
        placeHolder={placeHolder}
        ref={editorRef}
        onChangeHandler={onChangeHandler}
        onSave={onSaveHandler}
      />
      <div className="tw-absolute tw-right-2 tw-bottom-2 tw-flex tw-flex-row tw-items-center tw-justify-end">
        <PopOver
          html={
            <>
              <strong>Send now</strong>
            </>
          }
          position="top"
          size="small"
          trigger="mouseenter">
          <Button
            className={classNames(
              'tw-bg-gray-400 tw-py-0.5 tw-px-1 tw-rounded',
              buttonClass
            )}
            disabled={editorValue.length === 0}
            size="custom"
            theme={editorValue.length > 0 ? 'primary' : 'default'}
            variant="contained"
            onClick={onSaveHandler}>
            <SVGIcons alt="paper-plane" icon="icon-paper-plane" width="18px" />
          </Button>
        </PopOver>
      </div>
    </div>
  );
};

export default ActivityFeedEditor;
