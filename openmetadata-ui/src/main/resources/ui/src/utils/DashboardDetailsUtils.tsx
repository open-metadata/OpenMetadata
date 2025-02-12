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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React from 'react';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../components/common/EntityDescription/DescriptionV1';
import ResizablePanels from '../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { DashboardChartTable } from '../components/Dashboard/DashboardChartTable/DashboardChartTable';
import EntityRightPanel from '../components/Entity/EntityRightPanel/EntityRightPanel';
import Lineage from '../components/Lineage/Lineage.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../constants/ResizablePanel.constants';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { ChartType } from '../pages/DashboardDetailsPage/DashboardDetailsPage.component';
import { getChartById } from '../rest/chartAPI';
import { sortTagsCaseInsensitive } from './CommonUtils';
import { DashboardDetailsTabsProps } from './DashboardDetailsClassBase';

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.DOMAIN},${TabSpecificField.OWNERS}, ${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS}, ${TabSpecificField.CHARTS},${TabSpecificField.VOTES},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.EXTENSION}`;

export const sortTagsForCharts = (charts: ChartType[]) => {
  return charts.map((chart) => ({
    ...chart,
    tags: sortTagsCaseInsensitive(chart.tags || []),
  }));
};

export const fetchCharts = async (charts: Dashboard['charts']) => {
  let chartsData: ChartType[] = [];
  let promiseArr: Array<Promise<ChartType>> = [];
  try {
    if (charts?.length) {
      promiseArr = charts.map((chart) =>
        getChartById(chart.id, { fields: TabSpecificField.TAGS })
      );
      const res = await Promise.allSettled(promiseArr);

      if (res.length) {
        chartsData = res
          .filter((chart) => chart.status === 'fulfilled')
          .map((chart) => (chart as PromiseFulfilledResult<ChartType>).value);
      }
    }
  } catch (err) {
    throw new Error((err as AxiosError).message);
  }

  return chartsData;
};

export const getDashboardDetailsPageDefaultLayout = (tab: EntityTabs) => {
  switch (tab) {
    case EntityTabs.DETAILS:
      return [
        {
          h: 2,
          i: DetailPageWidgetKeys.DESCRIPTION,
          w: 6,
          x: 0,
          y: 0,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
          w: 2,
          x: 6,
          y: 0,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.DATA_PRODUCTS,
          w: 2,
          x: 6,
          y: 1,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.TAGS,
          w: 2,
          x: 6,
          y: 2,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.GLOSSARY_TERMS,
          w: 2,
          x: 6,
          y: 3,
          static: false,
        },
        {
          h: 3,
          i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
          w: 2,
          x: 6,
          y: 4,
          static: false,
        },
      ];

    default:
      return [];
  }
};

export const getDashboardDetailPageTabs = ({
  dashboardDetails,
  charts,
  entityName,
  editDescriptionPermission,
  editTagsPermission,
  editGlossaryTermsPermission,
  editLineagePermission,
  editCustomAttributePermission,
  viewAllPermission,
  dashboardTags,
  handleFeedCount,
  onDescriptionUpdate,
  onThreadLinkSelect,
  handleTagSelection,
  onExtensionUpdate,
  feedCount,
  activeTab,
  deleted,
  getEntityFeedCount,
  fetchDashboard,
}: DashboardDetailsTabsProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel id={EntityTabs.DETAILS} name={t('label.detail-plural')} />
      ),
      key: EntityTabs.DETAILS,
      children: (
        <Row gutter={[0, 16]} wrap={false}>
          <Col className="tab-content-height-with-resizable-panel" span={24}>
            <ResizablePanels
              firstPanel={{
                className: 'entity-resizable-panel-container',
                children: (
                  <div className="d-flex flex-col gap-4 p-t-sm m-x-lg">
                    <DescriptionV1
                      description={dashboardDetails.description}
                      entityName={entityName}
                      entityType={EntityType.DASHBOARD}
                      hasEditAccess={editDescriptionPermission}
                      isDescriptionExpanded={isEmpty(charts)}
                      owner={dashboardDetails.owners}
                      showActions={!deleted}
                      onDescriptionUpdate={onDescriptionUpdate}
                      onThreadLinkSelect={onThreadLinkSelect}
                    />

                    <DashboardChartTable
                      onThreadLinkSelect={onThreadLinkSelect}
                    />
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
              }}
              secondPanel={{
                children: (
                  <div data-testid="entity-right-panel">
                    <EntityRightPanel<EntityType.DASHBOARD>
                      customProperties={dashboardDetails}
                      dataProducts={dashboardDetails?.dataProducts ?? []}
                      domain={dashboardDetails?.domain}
                      editCustomAttributePermission={
                        editCustomAttributePermission
                      }
                      editGlossaryTermsPermission={editGlossaryTermsPermission}
                      editTagPermission={editTagsPermission}
                      entityId={dashboardDetails.id}
                      entityType={EntityType.DASHBOARD}
                      selectedTags={dashboardTags}
                      viewAllPermission={viewAllPermission}
                      onExtensionUpdate={onExtensionUpdate}
                      onTagSelectionChange={handleTagSelection}
                      onThreadLinkSelect={onThreadLinkSelect}
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
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DASHBOARD}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchDashboard}
          onUpdateFeedCount={handleFeedCount}
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
            entity={dashboardDetails as SourceType}
            entityType={EntityType.DASHBOARD}
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
      children: dashboardDetails && (
        <div className="m-sm">
          <CustomPropertyTable<EntityType.DASHBOARD>
            entityDetails={dashboardDetails}
            entityType={EntityType.DASHBOARD}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
          />
        </div>
      ),
    },
  ];
};
