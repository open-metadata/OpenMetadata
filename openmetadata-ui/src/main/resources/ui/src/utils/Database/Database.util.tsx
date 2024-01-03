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
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import { toLower } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import {
  getDatabaseSchemaDetailsPath,
  NO_DATA_PLACEHOLDER,
} from '../../constants/constants';
import { TabSpecificField } from '../../enums/entity.enum';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { EntityReference } from '../../generated/entity/type';
import { UsageDetails } from '../../generated/type/entityUsage';
import { getEntityName } from '../EntityUtils';
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

export const DatabaseFields = `${TabSpecificField.TAGS}, ${TabSpecificField.OWNER}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;

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
          data-testid="database-schema-name-link"
          to={
            record.fullyQualifiedName
              ? getDatabaseSchemaDetailsPath(record.fullyQualifiedName)
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
        <RichTextEditorPreviewer markdown={text} />
      ) : (
        <span className="text-grey-muted">
          {t('label.no-entity', { entity: t('label.description') })}
        </span>
      ),
  },
  {
    title: t('label.owner'),
    dataIndex: 'owner',
    key: 'owner',
    width: 120,
    render: (text: EntityReference) =>
      getEntityName(text) || NO_DATA_PLACEHOLDER,
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
