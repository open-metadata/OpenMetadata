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
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { DashboardDataModelDetailPageTabProps } from './DashboardDataModelBase';
import i18n from './i18next/LocalUtil';

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
          name={i18n.t('label.model')}
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
          name={i18n.t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DASHBOARD_DATA_MODEL}
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
                name={i18n.t('label.sql-uppercase')}
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
          name={i18n.t('label.lineage')}
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
          name={i18n.t('label.custom-property-plural')}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: (
        <div className="p-md">
          <CustomPropertyTable<EntityType.DASHBOARD_DATA_MODEL>
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
