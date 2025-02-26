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
import { ManageButtonItemLabel } from '../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { useEntityExportModalProvider } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import {
  getEntityDetailsPath,
  NO_DATA_PLACEHOLDER,
} from '../../constants/constants';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { EntityReference } from '../../generated/entity/type';
import { UsageDetails } from '../../generated/type/entityUsage';
import LimitWrapper from '../../hoc/LimitWrapper';
import { exportDatabaseDetailsInCSV } from '../../rest/databaseAPI';
import { getEntityImportPath, getEntityName } from '../EntityUtils';
import i18n from '../i18next/LocalUtil';
import { getUsagePercentile } from '../TableUtils';

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

export const getDatabaseDetailsPageDefaultLayout = (tab: EntityTabs) => {
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
