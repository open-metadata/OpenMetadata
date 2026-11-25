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

import {
  Badge,
  Box,
  ButtonGroup,
  ButtonGroupItem,
} from '@openmetadata/ui-core-components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WorkflowCard from '../../../components/WorkflowDefinitions/WorkflowCard/WorkflowCard.component';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { SettingMenuItem } from '../../../utils/GlobalSettingsUtils';
import workflowClassBase, {
  WorkflowsPageTab,
} from '../../../utils/WorkflowClassBase';

export type WorkflowListItem = SettingMenuItem & WorkflowDefinition;

interface WorkflowListProps {
  workflows: WorkflowListItem[];
  /** Count of workflows across all pages, shown when no tab filters the list. */
  total: number;
  onWorkflowClick: (key: string) => void;
}

interface WorkflowListHeaderProps {
  tabs: WorkflowsPageTab[];
  activeTabId?: string;
  count: number;
  onTabChange: (id: string) => void;
}

/** The list's title and count, with the tabs a downstream build adds as a filter. */
const WorkflowListHeader = ({
  tabs,
  activeTabId,
  count,
  onTabChange,
}: WorkflowListHeaderProps) => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:pb-3" gap={3} justify="between">
      <Box align="center" gap={2}>
        {/* A plain heading: Typography styles h1 to h6 through its prose wrapper. */}
        <h2 className="tw:m-0 tw:text-md tw:font-semibold tw:text-primary">
          {t('label.all-entity', { entity: t('label.workflow-plural') })}
        </h2>
        <Badge data-testid="workflow-count" size="sm">
          {count}
        </Badge>
      </Box>
      <ButtonGroup
        disallowEmptySelection
        aria-label={t('label.workflow-plural')}
        selectedKeys={activeTabId ? [activeTabId] : []}
        size="sm"
        onSelectionChange={(keys) => {
          const [id] = keys;
          if (id !== undefined) {
            onTabChange(String(id));
          }
        }}>
        {tabs.map((tab) => (
          <ButtonGroupItem id={tab.id} key={tab.id}>
            {t(tab.labelKey)}
          </ButtonGroupItem>
        ))}
      </ButtonGroup>
    </Box>
  );
};

const WorkflowList = ({
  workflows,
  total,
  onWorkflowClick,
}: WorkflowListProps) => {
  const tabs = useMemo(() => workflowClassBase.getWorkflowsPageTabs(), []);
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id);
  const includes = tabs.find((tab) => tab.id === activeTabId)?.includes;
  const visibleWorkflows = includes ? workflows.filter(includes) : workflows;

  return (
    <>
      {tabs.length ? (
        <WorkflowListHeader
          activeTabId={activeTabId}
          // A tab filters only the loaded page, so its count cannot use the server total.
          count={includes ? visibleWorkflows.length : total}
          tabs={tabs}
          onTabChange={setActiveTabId}
        />
      ) : null}
      <div className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5 tw:pb-4">
        {visibleWorkflows.map((workflow) => (
          <WorkflowCard
            data={workflow}
            key={workflow.key}
            workflow={workflow}
            onClick={onWorkflowClick}
          />
        ))}
      </div>
    </>
  );
};

export default WorkflowList;
