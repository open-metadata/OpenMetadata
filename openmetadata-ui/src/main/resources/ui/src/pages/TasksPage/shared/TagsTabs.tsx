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

import { Tabs, Tag } from 'antd';
import { ArrayChange, diffArrays } from 'diff';
import { uniqueId } from 'lodash';
import React, { useState } from 'react';
import { TagLabel } from '../../../generated/type/tagLabel';
import { TaskTabs } from '../TasksPage.interface';
import { TagsDiffView } from './TagsDiffView';
import TagSuggestion from './TagSuggestion';

interface Props {
  tags: TagLabel[];
  suggestedTags: TagLabel[];
  onChange: (value: TagLabel[]) => void;
}

export const TagsTabs = ({ tags, suggestedTags, onChange }: Props) => {
  const { TabPane } = Tabs;

  const [diffs, setDiffs] = useState<ArrayChange<TagLabel>[]>([]);
  const [activeTab, setActiveTab] = useState<string>(TaskTabs.NEW);

  const onTabChange = (key: string) => {
    setActiveTab(key);
    if (key === TaskTabs.DIFF) {
      setDiffs(diffArrays(tags, suggestedTags));
    } else {
      setDiffs([]);
    }
  };

  return (
    <Tabs
      activeKey={activeTab}
      className="ant-tabs-description"
      size="small"
      type="card"
      onChange={onTabChange}>
      <TabPane data-testid="current-tab" key={TaskTabs.CURRENT} tab="Current">
        <div
          className="tw-my-2 tw-flex tw-flex-wrap tw-gap-y-1"
          data-testid="tags">
          {tags.map((tag) => (
            <Tag key={uniqueId()}>{tag.tagFQN}</Tag>
          ))}
        </div>
      </TabPane>
      <TabPane data-testid="diff-tab" key={TaskTabs.DIFF} tab="Diff">
        <TagsDiffView diffArr={diffs} />
      </TabPane>
      <TabPane data-testid="new-tab" key={TaskTabs.NEW} tab="New">
        <TagSuggestion selectedTags={suggestedTags} onChange={onChange} />
      </TabPane>
    </Tabs>
  );
};
