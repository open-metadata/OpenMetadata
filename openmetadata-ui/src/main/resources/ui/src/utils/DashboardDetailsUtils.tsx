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

import { Card } from 'antd';
import { AxiosError } from 'axios';
import React from 'react';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import SchemaEditor from '../components/Database/SchemaEditor/SchemaEditor';
import Lineage from '../components/Lineage/Lineage.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { CSMode } from '../enums/codemirror.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { ChartType } from '../pages/DashboardDetailsPage/DashboardDetailsPage.component';
import { getChartById } from '../rest/chartAPI';
import { sortTagsCaseInsensitive } from './CommonUtils';
import { DashboardDataModelDetailPageTabProps } from './DashboardDataModelBase';
import i18next from './i18next/LocalUtil';

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
    case EntityTabs.SCHEMA:
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
          h: 8,
          i: DetailPageWidgetKeys.TABLE_SCHEMA,
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

export const getDashboardDataModelDetailsPageDefaultLayout = (
  tab: EntityTabs
) => {
  switch (tab) {
    case EntityTabs.SCHEMA:
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
          h: 8,
          i: DetailPageWidgetKeys.TABLE_SCHEMA,
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

export const getDashboardDataModelDetailPageTabs = ({
  modelComponent,
  feedCount,
  activeTab,
  handleFeedCount,
  editLineagePermission,
  dataModelData,
  dataModelPermissions,
  deleted,
  handelExtensionUpdate,
  getEntityFeedCount,
  fetchDataModel,
}: DashboardDataModelDetailPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          data-testid={EntityTabs.MODEL}
          id={EntityTabs.MODEL}
          name={i18next.t('label.model')}
        />
      ),
      key: EntityTabs.MODEL,
      children: modelComponent,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={i18next.t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DASHBOARD_DATA_MODEL}
          fqn={dataModelData?.fullyQualifiedName ?? ''}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchDataModel}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    ...(dataModelData?.sql
      ? [
          {
            label: (
              <TabsLabel
                data-testid={EntityTabs.SQL}
                id={EntityTabs.SQL}
                name={i18next.t('label.sql-uppercase')}
              />
            ),
            key: EntityTabs.SQL,
            children: (
              <Card>
                <SchemaEditor
                  editorClass="custom-code-mirror-theme full-screen-editor-height"
                  mode={{ name: CSMode.SQL }}
                  options={{
                    styleActiveLine: false,
                    readOnly: true,
                  }}
                  value={dataModelData?.sql}
                />
              </Card>
            ),
          },
        ]
      : []),
    {
      label: (
        <TabsLabel
          data-testid={EntityTabs.LINEAGE}
          id={EntityTabs.LINEAGE}
          name={i18next.t('label.lineage')}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: (
        <LineageProvider>
          <Lineage
            deleted={deleted}
            entity={dataModelData as SourceType}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={i18next.t('label.custom-property-plural')}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: (
        <div className="p-md">
          <CustomPropertyTable<EntityType.DASHBOARD_DATA_MODEL>
            entityDetails={dataModelData}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            handleExtensionUpdate={handelExtensionUpdate}
            hasEditAccess={
              dataModelPermissions.EditAll ||
              dataModelPermissions.EditCustomFields
            }
            hasPermission={dataModelPermissions.ViewAll}
            isVersionView={false}
          />
        </div>
      ),
    },
  ];
};
