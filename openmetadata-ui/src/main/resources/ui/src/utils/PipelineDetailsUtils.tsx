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

import { get } from 'lodash';
import { lazy, Suspense } from 'react';
import { ReactComponent as IconFailBadge } from '../assets/svg/fail-badge.svg';
import { ReactComponent as IconSkippedBadge } from '../assets/svg/skipped-badge.svg';
import { ReactComponent as IconSuccessBadge } from '../assets/svg/success-badge.svg';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import Loader from '../components/common/Loader/Loader';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { ContractTab } from '../components/DataContract/ContractTab/ContractTab';
import ExecutionsTab from '../components/Pipeline/Execution/Execution.component';
import { PipelineTaskTab } from '../components/Pipeline/PipelineTaskTab/PipelineTaskTab';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import {
  Pipeline,
  StatusType,
  Task,
  TaskStatus,
} from '../generated/entity/data/pipeline';
import { PageType } from '../generated/system/ui/page';
import { EntityReference } from '../generated/type/entityReference';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { t } from './i18next/LocalUtil';
import { PipelineDetailPageTabProps } from './PipelineClassBase';
const EntityLineageTab = lazy(() =>
  import('../components/Lineage/EntityLineageTab/EntityLineageTab').then(
    (module) => ({ default: module.EntityLineageTab })
  )
);

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS}, ${TabSpecificField.OWNERS},${TabSpecificField.TASKS}, ${TabSpecificField.PIPELINE_STATUS}, ${TabSpecificField.DOMAINS},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.VOTES},${TabSpecificField.EXTENSION}`;

export const getTaskExecStatus = (taskName: string, tasks: TaskStatus[]) => {
  return tasks.find((task) => task.name === taskName)?.executionStatus;
};

export const getStatusBadgeIcon = (status?: StatusType) => {
  switch (status) {
    case StatusType.Successful:
      return IconSuccessBadge;

    case StatusType.Failed:
      return IconFailBadge;

    default:
      return IconSkippedBadge;
  }
};

export const getPipelineDetailPageTabs = ({
  feedCount,
  getEntityFeedCount,
  handleFeedCount,
  pipelineDetails,
  pipelineFQN,
  viewCustomPropertiesPermission,
  editLineagePermission,
  editCustomAttributePermission,
  deleted,
  fetchPipeline,
  tab,
  labelMap,
}: PipelineDetailPageTabProps) => {
  return [
    {
      label: <TabsLabel id={EntityTabs.TASKS} name={t('label.task-plural')} />,
      key: EntityTabs.TASKS,
      children: <GenericTab type={PageType.Pipeline} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={tab === EntityTabs.ACTIVITY_FEED}
          name={t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.PIPELINE}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchPipeline}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.EXECUTIONS}
          name={t('label.execution-plural')}
        />
      ),
      key: EntityTabs.EXECUTIONS,
      children: (
        <ExecutionsTab
          pipelineFQN={pipelineFQN}
          tasks={pipelineDetails.tasks ?? []}
        />
      ),
    },
    {
      label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
      key: EntityTabs.LINEAGE,
      children: (
        <Suspense fallback={<Loader />}>
          <EntityLineageTab
            deleted={Boolean(deleted)}
            entity={pipelineDetails as SourceType}
            entityType={EntityType.PIPELINE}
            hasEditAccess={editLineagePermission}
          />
        </Suspense>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CONTRACT}
          name={get(labelMap, EntityTabs.CONTRACT, t('label.contract'))}
        />
      ),
      key: EntityTabs.CONTRACT,
      children: <ContractTab />,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={t('label.custom-property-plural')}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: pipelineDetails && (
        <CustomPropertyTable<EntityType.PIPELINE>
          entityType={EntityType.PIPELINE}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewCustomPropertiesPermission}
        />
      ),
    },
  ];
};

export const getPipelineWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.PIPELINE_TASKS)) {
    return <PipelineTaskTab />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.PIPELINE}
      widgetConfig={widgetConfig}
    />
  );
};

export const extractPipelineTasks = <T extends Omit<EntityReference, 'type'>>(
  data: T
): Task[] => {
  const pipeline = data as Partial<Pipeline>;

  return (pipeline.tasks ?? []).map(
    (task) => ({ ...task, tags: task.tags ?? [] } as Task)
  );
};
