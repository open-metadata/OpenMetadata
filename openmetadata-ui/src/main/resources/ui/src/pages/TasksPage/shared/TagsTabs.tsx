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

import { Tabs, Tag } from 'antd';
import { ArrayChange, diffArrays } from 'diff';
import { uniqueId } from 'lodash';
import { useState } from 'react';
import { TagLabel } from '../../../generated/type/tagLabel';
import { TaskTabs } from '../TasksPage.interface';
import { TagsDiffView } from './TagsDiffView';
import TagSuggestion from './TagSuggestion';

interface Props {
  tags: TagLabel[];
  value: TagLabel[];
  onChange?: (value: TagLabel[]) => void;
}

export const TagsTabs = ({
  tags,
  value: suggestedTags = [],
  onChange,
}: Props) => {
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
    <Tabs activeKey={activeTab} size="small" type="card" onChange={onTabChange}>
      <Tabs.TabPane
        data-testid="current-tab"
        key={TaskTabs.CURRENT}
        tab="Current">
        <div className="d-flex flex-wrap m-y-xs" data-testid="tags">
          {tags.map((tag) => (
            <Tag key={uniqueId()}>{tag.tagFQN}</Tag>
          ))}
        </div>
      </Tabs.TabPane>
      <Tabs.TabPane data-testid="diff-tab" key={TaskTabs.DIFF} tab="Diff">
        <TagsDiffView diffArr={diffs} />
      </Tabs.TabPane>
      <Tabs.TabPane data-testid="new-tab" key={TaskTabs.NEW} tab="New">
        <div className="m-t-xs">
          <TagSuggestion value={suggestedTags} onChange={onChange} />
        </div>
      </Tabs.TabPane>
    </Tabs>
  );
};
