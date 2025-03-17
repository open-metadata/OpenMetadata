/*
 *  Copyright 2023 Collate.
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
import { Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import { isUndefined, toLower } from 'lodash';
import React from 'react';
import { Link, useHistory } from 'react-router-dom';
import { ReactComponent as ExportIcon } from '../../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../../assets/svg/ic-import.svg';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import { ManageButtonItemLabel } from '../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../../components/DataAssets/CommonWidgets/CommonWidgets';
import { DatabaseSchemaTable } from '../../components/Database/DatabaseSchema/DatabaseSchemaTable/DatabaseSchemaTable';
import { useEntityExportModalProvider } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { EntityReference } from '../../generated/entity/type';
import { PageType } from '../../generated/system/ui/page';
import { UsageDetails } from '../../generated/type/entityUsage';
import LimitWrapper from '../../hoc/LimitWrapper';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { exportDatabaseDetailsInCSV } from '../../rest/databaseAPI';
import { getEntityImportPath, getEntityName } from '../EntityUtils';
import i18n from '../i18next/LocalUtil';
import { getEntityDetailsPath } from '../RouterUtils';
import { getUsagePercentile } from '../TableUtils';
import { DatabaseDetailPageTabProps } from './DatabaseClassBase';

export const getQueryFilterForDatabase = (
  serviceType: string,
  databaseName: string
) =>
  JSON.stringify({
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [{ term: { serviceType: [toLower(serviceType)] } }],
            },
          },
          {
            bool: {
              should: [{ term: { 'database.name.keyword': [databaseName] } }],
            },
          },
        ],
      },
    },
  });

export const DatabaseFields = `${TabSpecificField.TAGS}, ${TabSpecificField.OWNERS}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;

export const schemaTableColumns: ColumnsType<DatabaseSchema> = [
  {
    title: t('label.schema-name'),
    dataIndex: 'name',
    key: 'name',
    width: 250,
    render: (_, record: DatabaseSchema) => (
      <div className="d-inline-flex w-max-90">
        <Link
          className="break-word"
          data-testid={record.name}
          to={
            record.fullyQualifiedName
              ? getEntityDetailsPath(
                  EntityType.DATABASE_SCHEMA,
                  record.fullyQualifiedName
                )
              : ''
          }>
          {getEntityName(record)}
        </Link>
      </div>
    ),
  },
  {
    title: t('label.description'),
    dataIndex: 'description',
    key: 'description',
    render: (text: string) =>
      text?.trim() ? (
        <RichTextEditorPreviewerV1 markdown={text} />
      ) : (
        <span className="text-grey-muted">
          {t('label.no-entity', { entity: t('label.description') })}
        </span>
      ),
  },
  {
    title: t('label.owner-plural'),
    dataIndex: 'owners',
    key: 'owners',
    width: 120,

    render: (owners: EntityReference[]) =>
      !isUndefined(owners) && owners.length > 0 ? (
        <OwnerLabel owners={owners} />
      ) : (
        <Typography.Text data-testid="no-owner-text">
          {NO_DATA_PLACEHOLDER}
        </Typography.Text>
      ),
  },
  {
    title: t('label.usage'),
    dataIndex: 'usageSummary',
    key: 'usageSummary',
    width: 120,
    render: (text: UsageDetails) =>
      getUsagePercentile(text?.weeklyStats?.percentileRank ?? 0),
  },
];

export const getDatabasePageBaseTabs = ({
  activeTab,
  database,
  viewAllPermission,
  schemaInstanceCount,
  feedCount,
  handleFeedCount,
  getEntityFeedCount,
  editCustomAttributePermission,
  getDetailsByFQN,
}: DatabaseDetailPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          count={schemaInstanceCount}
          id={EntityTabs.SCHEMA}
          isActive={activeTab === EntityTabs.SCHEMA}
          name={t('label.schema-plural')}
        />
      ),
      key: EntityTabs.SCHEMA,
      children: <GenericTab type={PageType.Database} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={t('label.activity-feed-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DATABASE}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={getDetailsByFQN}
          onUpdateFeedCount={handleFeedCount}
        />
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
      children: database && (
        <div className="m-sm">
          <CustomPropertyTable<EntityType.DATABASE>
            entityType={EntityType.DATABASE}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
            isVersionView={false}
          />
        </div>
      ),
    },
  ];
};

export const getDatabaseWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DATABASE_SCHEMA)) {
    return <DatabaseSchemaTable />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.DATABASE}
      widgetConfig={widgetConfig}
    />
  );
};

export const ExtraDatabaseDropdownOptions = (
  fqn: string,
  permission: OperationPermission
) => {
  const { showModal } = useEntityExportModalProvider();
  const history = useHistory();

  const { ViewAll, EditAll } = permission;

  return [
    ...(EditAll
      ? [
          {
            label: (
              <LimitWrapper resource="database">
                <ManageButtonItemLabel
                  description={i18n.t('message.import-entity-help', {
                    entity: i18n.t('label.database'),
                  })}
                  icon={ImportIcon}
                  id="import-button"
                  name={i18n.t('label.import')}
                  onClick={() =>
                    history.push(getEntityImportPath(EntityType.DATABASE, fqn))
                  }
                />
              </LimitWrapper>
            ),
            key: 'import-button',
          },
        ]
      : []),
    ...(ViewAll
      ? [
          {
            label: (
              <ManageButtonItemLabel
                description={i18n.t('message.export-entity-help', {
                  entity: i18n.t('label.database'),
                })}
                icon={ExportIcon}
                id="export-button"
                name={i18n.t('label.export')}
                onClick={() =>
                  showModal({
                    name: fqn,
                    onExport: exportDatabaseDetailsInCSV,
                  })
                }
              />
            ),
            key: 'export-button',
          },
        ]
      : []),
  ];
};
