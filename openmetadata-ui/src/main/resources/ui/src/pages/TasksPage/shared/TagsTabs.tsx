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

import { Tabs } from '@openmetadata/ui-core-components';
import { Tag } from 'antd';
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
    <Tabs
      className="tw:gap-3"
      selectedKey={activeTab}
      onSelectionChange={(key) => onTabChange(String(key))}>
      <Tabs.List className="tw:self-start" size="sm" type="button-border">
        <Tabs.Item
          data-testid="current-tab"
          id={TaskTabs.CURRENT}
          label="Current"
        />
        <Tabs.Item data-testid="diff-tab" id={TaskTabs.DIFF} label="Diff" />
        <Tabs.Item data-testid="new-tab" id={TaskTabs.NEW} label="New" />
      </Tabs.List>
      <Tabs.Panel id={TaskTabs.CURRENT}>
        <div className="d-flex flex-wrap m-y-xs" data-testid="tags">
          {tags.map((tag) => (
            <Tag key={uniqueId()}>{tag.tagFQN}</Tag>
          ))}
        </div>
      </Tabs.Panel>
      <Tabs.Panel id={TaskTabs.DIFF}>
        <TagsDiffView diffArr={diffs} />
      </Tabs.Panel>
      <Tabs.Panel id={TaskTabs.NEW}>
        <div className="m-t-xs">
          <TagSuggestion value={suggestedTags} onChange={onChange} />
        </div>
      </Tabs.Panel>
    </Tabs>
  );
};
