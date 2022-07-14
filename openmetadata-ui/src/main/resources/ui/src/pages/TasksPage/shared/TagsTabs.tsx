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
import { isEqual, uniqueId } from 'lodash';
import React, { useState } from 'react';
import { TagLabel } from '../../../generated/type/tagLabel';
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
  const [activeTab, setActiveTab] = useState<string>('3');

  const onTabChange = (key: string) => {
    setActiveTab(key);
    if (isEqual(key, '2')) {
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
      <TabPane key="1" tab="Current">
        <div className="tw-my-2">
          {tags.map((tag) => (
            <Tag key={uniqueId()}>{tag.tagFQN}</Tag>
          ))}
        </div>
      </TabPane>
      <TabPane key="2" tab="Diff">
        <TagsDiffView diffArr={diffs} />
      </TabPane>
      <TabPane key="3" tab="New">
        <TagSuggestion selectedTags={suggestedTags} onChange={onChange} />
      </TabPane>
    </Tabs>
  );
};
