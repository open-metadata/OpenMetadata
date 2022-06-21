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

import { Tabs } from 'antd';
import { isEqual, uniqueId } from 'lodash';
import { Diff, EditorContentRef } from 'Models';
import React, { useRef, useState } from 'react';
import RichTextEditor from '../../components/common/rich-text-editor/RichTextEditor';
import { getDescriptionDiff } from '../../utils/TasksUtils';

interface Props {
  description: string;
  suggestion: string;
}

export const DescriptionTabs = ({ description, suggestion }: Props) => {
  const { TabPane } = Tabs;
  const markdownRef = useRef<EditorContentRef>();

  const [diffs, setDiffs] = useState<Diff[]>([]);
  const [activeTab, setActiveTab] = useState<string>('3');

  const onChange = (key: string) => {
    setActiveTab(key);
    if (isEqual(key, '2')) {
      const newDescription = markdownRef.current?.getEditorContent();
      if (newDescription) {
        setDiffs(getDescriptionDiff(description, newDescription));
      }
    }
  };

  const DiffView = ({ diffArr }: { diffArr: Diff[] }) => {
    const elements = diffArr.map((diff) => {
      if (diff.added) {
        return (
          <ins className="diff-added" key={uniqueId()}>
            {diff.value}
          </ins>
        );
      }
      if (diff.removed) {
        return (
          <del
            key={uniqueId()}
            style={{ color: '#b30000', background: '#fadad7' }}>
            {diff.value}
          </del>
        );
      }

      return <div key={uniqueId()}>{diff.value}</div>;
    });

    return (
      <div className="tw-w-full tw-border tw-border-main tw-p-2 tw-rounded tw-my-3 tw-max-h-52 tw-overflow-y-auto">
        <pre className="tw-whitespace-pre-wrap">
          {diffArr.length ? (
            elements
          ) : (
            <span className="tw-text-grey-muted">No diff available</span>
          )}
        </pre>
      </div>
    );
  };

  return (
    <Tabs
      activeKey={activeTab}
      className="ant-tabs-description"
      size="small"
      type="card"
      onChange={onChange}>
      <TabPane key="1" tab="Current">
        <RichTextEditor
          readonly
          className="tw-my-0"
          height="208px"
          initialValue={description}
        />
      </TabPane>
      <TabPane key="2" tab="Diff">
        <DiffView diffArr={diffs} />
      </TabPane>
      <TabPane key="3" tab="New">
        <RichTextEditor
          className="tw-my-0"
          height="208px"
          initialValue={suggestion}
          ref={markdownRef}
        />
      </TabPane>
    </Tabs>
  );
};
