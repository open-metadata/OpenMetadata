/*
 *  Copyright 2025 Collate.
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
import { get } from 'lodash';
import { lazy, Suspense } from 'react';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import Loader from '../components/common/Loader/Loader';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import ModelTab from '../components/Dashboard/DataModel/DataModels/ModelTab/ModelTab.component';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import SchemaEditor from '../components/Database/SchemaEditor/SchemaEditor';
import { ContractTab } from '../components/DataContract/ContractTab/ContractTab';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { CSMode } from '../enums/codemirror.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { Column } from '../generated/entity/data/container';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Operation } from '../generated/entity/policies/policy';
import { PageType } from '../generated/system/ui/page';
import { EntityReference } from '../generated/type/entityReference';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { DashboardDataModelDetailPageTabProps } from './DashboardDataModelClassBase';
import i18n, { t } from './i18next/LocalUtil';
import {
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from './PermissionsUtils';
const EntityLineageTab = lazy(() =>
  import('../components/Lineage/EntityLineageTab/EntityLineageTab').then(
    (module) => ({ default: module.EntityLineageTab })
  )
);

export const getDashboardDataModelDetailPageTabs = ({
  feedCount,
  activeTab,
  handleFeedCount,
  editLineagePermission,
  dataModelData,
  dataModelPermissions,
  deleted,
  getEntityFeedCount,
  fetchDataModel,
  labelMap,
}: DashboardDataModelDetailPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          data-testid={EntityTabs.MODEL}
          id={EntityTabs.MODEL}
          name={labelMap?.[EntityTabs.MODEL] ?? i18n.t('label.model')}
        />
      ),
      key: EntityTabs.MODEL,
      children: <GenericTab type={PageType.DashboardDataModel} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={
            labelMap?.[EntityTabs.ACTIVITY_FEED] ??
            i18n.t('label.activity-feed-and-task-plural')
          }
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DASHBOARD_DATA_MODEL}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
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
                name={
                  labelMap?.[EntityTabs.SQL] ?? i18n.t('label.sql-uppercase')
                }
              />
            ),
            key: EntityTabs.SQL,
            children: (
              <Card>
                <SchemaEditor
                  editorClass="custom-query-editor custom-code-mirror-theme full-screen-editor-height"
                  mode={{ name: CSMode.SQL }}
                  options={{
                    styleActiveLine: false,
                    readOnly: true,
                  }}
                  refreshEditor={activeTab === EntityTabs.SQL}
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
          name={labelMap?.[EntityTabs.LINEAGE] ?? i18n.t('label.lineage')}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: (
        <Suspense fallback={<Loader />}>
          <EntityLineageTab
            deleted={Boolean(deleted)}
            entity={dataModelData as SourceType}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
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
          name={
            labelMap?.[EntityTabs.CUSTOM_PROPERTIES] ??
            i18n.t('label.custom-property-plural')
          }
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: (
        <CustomPropertyTable<EntityType.DASHBOARD_DATA_MODEL>
          entityType={EntityType.DASHBOARD_DATA_MODEL}
          hasEditAccess={getPrioritizedEditPermission(
            dataModelPermissions,
            Operation.EditCustomFields
          )}
          hasPermission={getPrioritizedViewPermission(
            dataModelPermissions,
            Operation.ViewCustomFields
          )}
          isVersionView={false}
        />
      ),
    },
  ];
};

export const extractDataModelColumns = <
  T extends Omit<EntityReference, 'type'>
>(
  data: T
): Column[] => {
  const dataModel = data as Partial<DashboardDataModel>;

  return (dataModel.columns ?? []).map(
    (column) =>
      ({
        ...column,
        tags: column.tags ?? [],
      } as Column)
  );
};

export const getDashboardDataModelWidgetsFromKey = (
  widgetConfig: WidgetConfig
) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DATA_MODEL)) {
    return <ModelTab />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.DASHBOARD_DATA_MODEL}
      widgetConfig={widgetConfig}
    />
  );
};
