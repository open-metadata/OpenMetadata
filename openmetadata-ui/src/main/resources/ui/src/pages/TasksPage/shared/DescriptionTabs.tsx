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

import { Tabs } from 'antd';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from 'components/common/rich-text-editor/RichTextEditor.interface';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { Change } from 'diff';
import { isEqual } from 'lodash';
import React, { useState } from 'react';
import { getDescriptionDiff } from '../../../utils/TasksUtils';
import { DiffView } from './DiffView';

interface Props {
  description: string;
  suggestion: string;
  markdownRef: React.MutableRefObject<EditorContentRef | undefined>;
  placeHolder?: string;
  onChange?: (value: string) => void;
}

export const DescriptionTabs = ({
  description,
  suggestion,
  markdownRef,
  placeHolder,
  onChange,
}: Props) => {
  const { TabPane } = Tabs;

  const [diffs, setDiffs] = useState<Change[]>([]);
  const [activeTab, setActiveTab] = useState<string>('3');

  const onTabChange = (key: string) => {
    setActiveTab(key);
    if (isEqual(key, '2')) {
      const newDescription = markdownRef.current?.getEditorContent();
      if (newDescription) {
        setDiffs(getDescriptionDiff(description, newDescription));
      }
    } else {
      setDiffs([]);
    }
  };

  return (
    <Tabs
      activeKey={activeTab}
      className="ant-tabs-description"
      data-testid="tabs"
      size="small"
      type="card"
      onChange={onTabChange}>
      <TabPane data-testid="current-tab" key="1" tab="Current">
        <div className="tw-flex tw-border tw-border-main tw-rounded tw-mb-4 tw-mt-4">
          {description.trim() ? (
            <RichTextEditorPreviewer
              className="tw-p-2"
              enableSeeMoreVariant={false}
              markdown={description}
            />
          ) : (
            <span className="tw-no-description tw-p-2">No description </span>
          )}
        </div>
      </TabPane>
      <TabPane data-testid="diff-tab" key="2" tab="Diff">
        <DiffView
          className="tw-border tw-border-main tw-p-2 tw-rounded tw-my-3"
          diffArr={diffs}
        />
      </TabPane>
      <TabPane data-testid="new-tab" key="3" tab="New">
        <RichTextEditor
          className="tw-my-0"
          height="208px"
          initialValue={suggestion}
          placeHolder={placeHolder ?? 'Update description'}
          ref={markdownRef}
          onTextChange={onChange}
        />
      </TabPane>
    </Tabs>
  );
};
