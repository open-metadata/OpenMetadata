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
import { Space, Typography } from 'antd';
import { t } from 'i18next';
import { get, isUndefined } from 'lodash';
import React from 'react';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import QueryViewer from '../../components/common/QueryViewer/QueryViewer.component';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import TableProfiler from '../../components/Database/Profiler/TableProfiler/TableProfiler';
import SampleDataTableComponent from '../../components/Database/SampleDataTable/SampleDataTable.component';
import TableQueries from '../../components/Database/TableQueries/TableQueries';
import IncidentManager from '../../components/IncidentManager/IncidentManager.component';
import Lineage from '../../components/Lineage/Lineage.component';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import LineageProvider from '../../context/LineageProvider/LineageProvider';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Table } from '../../generated/entity/data/table';
import { TestSummary } from '../../generated/tests/testCase';
import { FeedCounts } from '../../interface/feed.interface';

interface TableDetailPageTabProps {
  schemaTab: JSX.Element;
  queryCount: number;
  isTourOpen: boolean;
  tablePermissions: OperationPermission;
  activeTab: EntityTabs;
  deleted: boolean | undefined;
  tableDetails: Table | undefined;
  totalFeedCount: number;
  onExtensionUpdate: (updatedData: Table) => Promise<void>;
  getEntityFeedCount: () => void;
  handleFeedCount: (data: FeedCounts) => void;
  viewAllPermission: boolean;
  editCustomAttributePermission: boolean;
  viewSampleDataPermission: boolean;
  viewQueriesPermission: boolean;
  viewProfilerPermission: boolean;
  editLineagePermission: boolean;
  fetchTableDetails: () => Promise<void>;
  testCaseSummary?: TestSummary;
  isViewTableType: boolean;
}

class TableDetailPageClassBase {
  public getPageTabs({
    schemaTab,
    queryCount,
    isTourOpen,
    tablePermissions,
    activeTab,
    deleted,
    tableDetails,
    totalFeedCount,
    onExtensionUpdate,
    getEntityFeedCount,
    handleFeedCount,
    viewAllPermission,
    editCustomAttributePermission,
    viewSampleDataPermission,
    viewQueriesPermission,
    viewProfilerPermission,
    editLineagePermission,
    fetchTableDetails,
    testCaseSummary,
    isViewTableType,
  }: TableDetailPageTabProps) {
    return [
      {
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        key: EntityTabs.SCHEMA,
        children: schemaTab,
      },
      {
        label: (
          <TabsLabel
            count={totalFeedCount}
            id={EntityTabs.ACTIVITY_FEED}
            isActive={activeTab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
        children: (
          <ActivityFeedTab
            refetchFeed
            columns={tableDetails?.columns}
            entityFeedTotalCount={totalFeedCount}
            entityType={EntityType.TABLE}
            fqn={tableDetails?.fullyQualifiedName ?? ''}
            owners={tableDetails?.owners}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={fetchTableDetails}
            onUpdateFeedCount={handleFeedCount}
          />
        ),
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.SAMPLE_DATA}
            name={t('label.sample-data')}
          />
        ),

        key: EntityTabs.SAMPLE_DATA,
        children:
          !isTourOpen && !viewSampleDataPermission ? (
            <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
          ) : (
            <SampleDataTableComponent
              isTableDeleted={deleted}
              owners={tableDetails?.owners ?? []}
              permissions={tablePermissions}
              tableId={tableDetails?.id ?? ''}
            />
          ),
      },
      {
        label: (
          <TabsLabel
            count={queryCount}
            id={EntityTabs.TABLE_QUERIES}
            isActive={activeTab === EntityTabs.TABLE_QUERIES}
            name={t('label.query-plural')}
          />
        ),
        key: EntityTabs.TABLE_QUERIES,
        children: !viewQueriesPermission ? (
          <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
        ) : (
          <TableQueries
            isTableDeleted={deleted}
            tableId={tableDetails?.id ?? ''}
          />
        ),
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.PROFILER}
            name={t('label.profiler-amp-data-quality')}
          />
        ),
        key: EntityTabs.PROFILER,
        children:
          !isTourOpen && !viewProfilerPermission ? (
            <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
          ) : (
            <TableProfiler
              permissions={tablePermissions}
              table={tableDetails}
              testCaseSummary={testCaseSummary}
            />
          ),
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.INCIDENTS}
            name={t('label.incident-plural')}
          />
        ),
        key: EntityTabs.INCIDENTS,
        children:
          tablePermissions.ViewAll || tablePermissions.ViewTests ? (
            <div className="p-x-lg p-b-lg p-t-md">
              <IncidentManager
                isIncidentPage={false}
                tableDetails={tableDetails}
              />
            </div>
          ) : (
            <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
          ),
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
        children: (
          <LineageProvider>
            <Lineage
              deleted={deleted}
              entity={tableDetails as SourceType}
              entityType={EntityType.TABLE}
              hasEditAccess={editLineagePermission}
            />
          </LineageProvider>
        ),
      },
      {
        label: (
          <TabsLabel id={EntityTabs.DBT} name={t('label.dbt-lowercase')} />
        ),
        isHidden: !(
          tableDetails?.dataModel?.sql || tableDetails?.dataModel?.rawSql
        ),
        key: EntityTabs.DBT,
        children: (
          <QueryViewer
            sqlQuery={
              get(tableDetails, 'dataModel.sql', '') ||
              get(tableDetails, 'dataModel.rawSql', '')
            }
            title={
              <Space className="p-y-xss">
                <Typography.Text className="text-grey-muted">
                  {`${t('label.path')}:`}
                </Typography.Text>
                <Typography.Text>
                  {tableDetails?.dataModel?.path}
                </Typography.Text>
              </Space>
            }
          />
        ),
      },
      {
        label: (
          <TabsLabel
            id={
              isViewTableType
                ? EntityTabs.VIEW_DEFINITION
                : EntityTabs.SCHEMA_DEFINITION
            }
            name={
              isViewTableType
                ? t('label.view-definition')
                : t('label.schema-definition')
            }
          />
        ),
        isHidden: isUndefined(tableDetails?.schemaDefinition),
        key: isViewTableType
          ? EntityTabs.VIEW_DEFINITION
          : EntityTabs.SCHEMA_DEFINITION,
        children: (
          <QueryViewer sqlQuery={tableDetails?.schemaDefinition ?? ''} />
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
        children: tableDetails && (
          <div className="m-sm">
            <CustomPropertyTable<EntityType.TABLE>
              entityDetails={tableDetails}
              entityType={EntityType.TABLE}
              handleExtensionUpdate={onExtensionUpdate}
              hasEditAccess={editCustomAttributePermission}
              hasPermission={viewAllPermission}
            />
          </div>
        ),
      },
    ];
  }
}

const tableDetailPageClassBase = new TableDetailPageClassBase();

export default tableDetailPageClassBase;
export { TableDetailPageClassBase };
