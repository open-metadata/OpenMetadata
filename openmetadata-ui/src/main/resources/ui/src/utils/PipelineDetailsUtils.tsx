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

import { Col, Radio, Row, Table } from 'antd';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React from 'react';
import { ReactComponent as IconFailBadge } from '../assets/svg/fail-badge.svg';
import { ReactComponent as IconSkippedBadge } from '../assets/svg/skipped-badge.svg';
import { ReactComponent as IconSuccessBadge } from '../assets/svg/success-badge.svg';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../components/common/EntityDescription/DescriptionV1';
import ResizablePanels from '../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import EntityRightPanel from '../components/Entity/EntityRightPanel/EntityRightPanel';
import Lineage from '../components/Lineage/Lineage.component';
import ExecutionsTab from '../components/Pipeline/Execution/Execution.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { PIPELINE_TASK_TABS } from '../constants/pipeline.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../constants/ResizablePanel.constants';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { StatusType, TaskStatus } from '../generated/entity/data/pipeline';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { PipelineDetailPageTabProps } from './PipelineClassBase';

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS}, ${TabSpecificField.OWNERS},${TabSpecificField.TASKS}, ${TabSpecificField.PIPELINE_STATUS}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.VOTES},${TabSpecificField.EXTENSION}`;

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
  description,
  editDescriptionPermission,
  editGlossaryTermsPermission,
  editTagsPermission,
  entityName,
  feedCount,
  getEntityFeedCount,
  handleFeedCount,
  handleTagSelection,
  onDescriptionUpdate,
  onExtensionUpdate,
  pipelineDetails,
  pipelineFQN,
  tasksInternal,
  tasksDAGView,
  tags,
  viewAllPermission,
  editLineagePermission,
  editCustomAttributePermission,
  deleted,
  activeTab,
  setActiveTab,
  taskColumns,
  owners,
  fetchPipeline,
  tab,
}: PipelineDetailPageTabProps) => {
  return [
    {
      label: <TabsLabel id={EntityTabs.TASKS} name={t('label.task-plural')} />,
      key: EntityTabs.TASKS,
      children: (
        <Row gutter={[0, 16]} wrap={false}>
          <Col className="tab-content-height-with-resizable-panel" span={24}>
            <ResizablePanels
              firstPanel={{
                className: 'entity-resizable-panel-container',
                children: (
                  <div className="p-t-sm m-x-lg">
                    <Row gutter={[0, 16]}>
                      <Col span={24}>
                        <DescriptionV1
                          description={description}
                          entityName={entityName}
                          entityType={EntityType.PIPELINE}
                          hasEditAccess={editDescriptionPermission}
                          isDescriptionExpanded={isEmpty(tasksInternal)}
                          owner={owners}
                          showActions={!deleted}
                          onDescriptionUpdate={onDescriptionUpdate}
                        />
                      </Col>
                      <Col span={24}>
                        <Radio.Group
                          buttonStyle="solid"
                          className="radio-switch"
                          data-testid="pipeline-task-switch"
                          optionType="button"
                          options={Object.values(PIPELINE_TASK_TABS)}
                          value={activeTab}
                          onChange={(e) => setActiveTab(e.target.value)}
                        />
                      </Col>
                      <Col span={24}>
                        {activeTab === PIPELINE_TASK_TABS.LIST_VIEW ? (
                          <Table
                            bordered
                            className="align-table-filter-left"
                            columns={taskColumns}
                            data-testid="task-table"
                            dataSource={tasksInternal}
                            pagination={false}
                            rowKey="name"
                            scroll={{ x: 1200 }}
                            size="small"
                          />
                        ) : (
                          tasksDAGView
                        )}
                      </Col>
                    </Row>
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
              }}
              secondPanel={{
                children: (
                  <div data-testid="entity-right-panel">
                    <EntityRightPanel<EntityType.PIPELINE>
                      editCustomAttributePermission={
                        editCustomAttributePermission
                      }
                      editGlossaryTermsPermission={editGlossaryTermsPermission}
                      editTagPermission={editTagsPermission}
                      entityType={EntityType.PIPELINE}
                      selectedTags={tags}
                      viewAllPermission={viewAllPermission}
                      onExtensionUpdate={onExtensionUpdate}
                      onTagSelectionChange={handleTagSelection}
                    />
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
                className:
                  'entity-resizable-right-panel-container entity-resizable-panel-container',
              }}
            />
          </Col>
        </Row>
      ),
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
        <LineageProvider>
          <Lineage
            deleted={deleted}
            entity={pipelineDetails as SourceType}
            entityType={EntityType.PIPELINE}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
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
        <div className="m-sm">
          <CustomPropertyTable<EntityType.PIPELINE>
            entityType={EntityType.PIPELINE}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
          />
        </div>
      ),
    },
  ];
};

export const getPipelineWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  return <CommonWidgets widgetConfig={widgetConfig} />;
};
