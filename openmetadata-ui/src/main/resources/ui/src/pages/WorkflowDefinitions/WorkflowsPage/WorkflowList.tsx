/*
 *  Copyright 2024 Collate.
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
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WorkflowCard from '../../../components/WorkflowDefinitions/WorkflowCard/WorkflowCard.component';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { SettingMenuItem } from '../../../utils/GlobalSettingsUtils';
import workflowClassBase from '../../../utils/WorkflowClassBase';

export type WorkflowListItem = SettingMenuItem & WorkflowDefinition;

interface WorkflowListProps {
  workflows: WorkflowListItem[];
  onWorkflowClick: (key: string) => void;
}

const WorkflowList = ({ workflows, onWorkflowClick }: WorkflowListProps) => {
  const { t } = useTranslation();
  const tabs = useMemo(() => workflowClassBase.getWorkflowsPageTabs(), []);
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id);
  const includes = tabs.find((tab) => tab.id === activeTabId)?.includes;
  const visibleWorkflows = includes ? workflows.filter(includes) : workflows;

  return (
    <>
      {tabs.length ? (
        <Tabs
          className="tw:pb-4"
          selectedKey={activeTabId}
          onSelectionChange={(key) => setActiveTabId(String(key))}>
          <Tabs.List
            aria-label={t('label.workflow-plural')}
            size="sm"
            type="underline">
            {tabs.map((tab) => (
              <Tabs.Item id={tab.id} key={tab.id}>
                {t(tab.labelKey)}
              </Tabs.Item>
            ))}
          </Tabs.List>
        </Tabs>
      ) : null}
      <div className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5 tw:pb-4">
        {visibleWorkflows.map((workflow) => (
          <WorkflowCard
            data={workflow}
            key={workflow.key}
            onClick={onWorkflowClick}
          />
        ))}
      </div>
    </>
  );
};

export default WorkflowList;
