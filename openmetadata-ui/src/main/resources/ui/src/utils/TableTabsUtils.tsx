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

import { Divider, Space, Typography } from 'antd';
import { get, isUndefined } from 'lodash';
import { lazy, Suspense } from 'react';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import Loader from '../components/common/Loader/Loader';
import type { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import type { SourceType } from '../components/SearchedData/SearchedData.interface';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../enums/common.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/uiCustomization';
import { useApplicationStore } from '../hooks/useApplicationStore';
import type { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { t } from './i18next/LocalUtil';
import type { TableDetailPageTabProps } from './TableClassBase';

const TabsLabel = withSuspenseFallback(
  lazy(() => import('../components/common/TabsLabel/TabsLabel.component'))
);

const ActivityFeedTab = withSuspenseFallback(
  lazy(() =>
    import(
      '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component'
    ).then((module) => ({ default: module.ActivityFeedTab }))
  )
);

const ErrorPlaceHolder = withSuspenseFallback(
  lazy(
    () => import('../components/common/ErrorWithPlaceholder/ErrorPlaceHolder')
  )
);

const GenericTab = withSuspenseFallback(
  lazy(() =>
    import('../components/Customization/GenericTab/GenericTab').then(
      (module) => ({ default: module.GenericTab })
    )
  )
);

const CommonWidgets = withSuspenseFallback(
  lazy(() =>
    import('../components/DataAssets/CommonWidgets/CommonWidgets').then(
      (module) => ({ default: module.CommonWidgets })
    )
  )
);

const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import('../components/common/CustomPropertyTable/CustomPropertyTable').then(
      (module) => ({ default: module.CustomPropertyTable })
    )
  )
) as <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

const SchemaTable = withSuspenseFallback(
  lazy(() => import('../components/Database/SchemaTable/SchemaTable.component'))
);

const AssetHealthWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/DataAssets/AssetHealthWidget/AssetHealthWidget.component'
      )
  )
);

const SampleDataTableComponent = withSuspenseFallback(
  lazy(
    () =>
      import('../components/Database/SampleDataTable/SampleDataTable.component')
  )
);

const TableQueries = withSuspenseFallback(
  lazy(() => import('../components/Database/TableQueries/TableQueries'))
);

const ContractTab = withSuspenseFallback(
  lazy(() =>
    import('../components/DataContract/ContractTab/ContractTab').then(
      (module) => ({ default: module.ContractTab })
    )
  )
);

const DataObservabilityTab = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/Database/Profiler/DataObservability/DataObservabilityTab'
      )
  )
);

const EntityLineageTab = withSuspenseFallback(
  lazy(() =>
    import('../components/Lineage/EntityLineageTab/EntityLineageTab').then(
      (module) => ({ default: module.EntityLineageTab })
    )
  )
);

const TableConstraints = withSuspenseFallback(
  lazy(
    () =>
      import('../pages/TableDetailsPageV1/TableConstraints/TableConstraints')
  )
);

const KnowledgeGraph = withSuspenseFallback(
  lazy(() => import('../components/KnowledgeGraph3D/KnowledgeGraph3D'))
);

const QueryViewer = withSuspenseFallback(
  lazy(() => import('../components/common/QueryViewer/QueryViewer.component'))
);

const FrequentlyJoinedTables = withSuspenseFallback(
  lazy(() =>
    import(
      '../pages/TableDetailsPageV1/FrequentlyJoinedTables/FrequentlyJoinedTables.component'
    ).then((module) => ({ default: module.FrequentlyJoinedTables }))
  )
);

const PartitionedKeys = withSuspenseFallback(
  lazy(() =>
    import(
      '../pages/TableDetailsPageV1/PartitionedKeys/PartitionedKeys.component'
    ).then((module) => ({ default: module.PartitionedKeys }))
  )
);

export const getTableDetailPageBaseTabs = ({
  queryCount,
  isTourOpen,
  tablePermissions,
  activeTab,
  deleted,
  tableDetails,
  feedCount,
  getEntityFeedCount,
  handleFeedCount,
  viewCustomPropertiesPermission,
  editCustomAttributePermission,
  viewSampleDataPermission,
  viewQueriesPermission,
  editLineagePermission,
  fetchTableDetails,
  isViewTableType,
  labelMap,
}: TableDetailPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          count={tableDetails?.columns.length}
          id={EntityTabs.SCHEMA}
          isActive={activeTab === EntityTabs.SCHEMA}
          name={get(labelMap, EntityTabs.SCHEMA, t('label.column-plural'))}
        />
      ),
      key: EntityTabs.SCHEMA,
      children: <GenericTab type={PageType.Table} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={get(
            labelMap,
            EntityTabs.ACTIVITY_FEED,
            t('label.activity-feed-and-task-plural')
          )}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          columns={tableDetails?.columns}
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.TABLE}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
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
          name={get(labelMap, EntityTabs.SAMPLE_DATA, t('label.sample-data'))}
        />
      ),

      key: EntityTabs.SAMPLE_DATA,
      children:
        !isTourOpen && !viewSampleDataPermission ? (
          <ErrorPlaceHolder
            className="border-none"
            permissionValue={t('label.view-entity', {
              entity: t('label.sample-data'),
            })}
            type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
          />
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
          name={get(
            labelMap,
            EntityTabs.TABLE_QUERIES,
            t('label.query-plural')
          )}
        />
      ),
      key: EntityTabs.TABLE_QUERIES,
      children: viewQueriesPermission ? (
        <TableQueries
          isTableDeleted={deleted}
          tableId={tableDetails?.id ?? ''}
        />
      ) : (
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.query-plural'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.PROFILER}
          name={get(
            labelMap,
            EntityTabs.PROFILER,
            t('label.data-observability')
          )}
        />
      ),
      key: EntityTabs.PROFILER,
      children: (
        <DataObservabilityTab
          permissions={tablePermissions}
          table={tableDetails}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.LINEAGE}
          name={get(labelMap, EntityTabs.LINEAGE, t('label.lineage'))}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: (
        <Suspense fallback={<Loader />}>
          <EntityLineageTab
            deleted={Boolean(deleted)}
            entity={tableDetails as SourceType}
            entityType={EntityType.TABLE}
            hasEditAccess={editLineagePermission}
          />
        </Suspense>
      ),
    },
    {
      label: (
        <TabsLabel
          isBeta
          id={EntityTabs.KNOWLEDGE_GRAPH}
          name={get(
            labelMap,
            EntityTabs.KNOWLEDGE_GRAPH,
            t('label.knowledge-graph')
          )}
        />
      ),
      key: EntityTabs.KNOWLEDGE_GRAPH,
      children: (
        <Suspense fallback={<Loader />}>
          <KnowledgeGraph
            depth={1}
            entity={
              tableDetails
                ? {
                    ...tableDetails,
                    type: EntityType.TABLE,
                  }
                : undefined
            }
            entityType={EntityType.TABLE}
          />
        </Suspense>
      ),
      isHidden: !useApplicationStore.getState().rdfEnabled,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.DBT}
          name={get(labelMap, EntityTabs.DBT, t('label.dbt-lowercase'))}
        />
      ),
      isHidden: !(
        tableDetails?.dataModel?.sql ||
        tableDetails?.dataModel?.rawSql ||
        tableDetails?.dataModel?.path ||
        tableDetails?.dataModel?.dbtSourceProject
      ),
      key: EntityTabs.DBT,
      children: (
        <QueryViewer
          isActive={activeTab === EntityTabs.DBT}
          sqlQuery={
            get(tableDetails, 'dataModel.sql', '') ??
            get(tableDetails, 'dataModel.rawSql', '')
          }
          title={
            <Space className="p-y-xss" size="small">
              <div>
                <Typography.Text className="text-grey-muted">
                  {`${t('label.dbt-source-project')}: `}
                </Typography.Text>
                <Typography.Text data-testid="dbt-source-project-id">
                  {tableDetails?.dataModel?.dbtSourceProject ??
                    NO_DATA_PLACEHOLDER}
                </Typography.Text>
              </div>

              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />

              <div>
                <Typography.Text className="text-grey-muted">
                  {`${t('label.path')}: `}
                </Typography.Text>
                <Typography.Text>
                  {tableDetails?.dataModel?.path}
                </Typography.Text>
              </div>
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
          name={get(
            labelMap,
            EntityTabs.VIEW_DEFINITION,
            isViewTableType
              ? t('label.view-definition')
              : t('label.schema-definition')
          )}
        />
      ),
      isHidden: isUndefined(tableDetails?.schemaDefinition),
      key: EntityTabs.VIEW_DEFINITION,
      children: (
        <QueryViewer
          isActive={[
            EntityTabs.VIEW_DEFINITION,
            EntityTabs.SCHEMA_DEFINITION,
          ].includes(activeTab)}
          sqlQuery={tableDetails?.schemaDefinition ?? ''}
        />
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
          name={get(
            labelMap,
            EntityTabs.CUSTOM_PROPERTIES,
            t('label.custom-property-plural')
          )}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: (
        <CustomPropertyTable<EntityType.TABLE>
          entityType={EntityType.TABLE}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewCustomPropertiesPermission}
        />
      ),
    },
  ];
};

export const getTableWidgetFromKey = (
  widgetConfig: WidgetConfig
): JSX.Element | null => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.TABLE_SCHEMA)) {
    return <SchemaTable />;
  } else if (
    widgetConfig.i.startsWith(DetailPageWidgetKeys.TABLE_CONSTRAINTS)
  ) {
    return <TableConstraints />;
  } else if (
    widgetConfig.i.startsWith(DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES)
  ) {
    return <FrequentlyJoinedTables />;
  } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.PARTITIONED_KEYS)) {
    return <PartitionedKeys />;
  } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.ASSET_HEALTH)) {
    return <AssetHealthWidget />;
  } else {
    return (
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );
  }
};
