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
import { Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import React from 'react';
import { OwnerLabel } from '../components/common/OwnerLabel/OwnerLabel.component';
import { EntityReference, Query } from '../generated/entity/data/query';
import { convertMillisecondsToHumanReadableFormat } from './date-time/DateTimeUtils';
import { getQueryPath } from './RouterUtils';

export const getMostExpensiveQueriesWidgetColumns = (): ColumnsType<Query> => {
  return [
    {
      title: t('label.query'),
      className: 'name-column',
      dataIndex: 'query',
      key: 'query',
      width: 300,
      render: (_, record: Query) => {
        return (
          <Typography.Link
            ellipsis
            href={getQueryPath(
              record.queryUsedIn?.[0]?.fullyQualifiedName ?? '',
              record.id ?? ''
            )}
            target="_blank">
            {record.query}
          </Typography.Link>
        );
      },
    },
    {
      title: t('label.total-entity', { entity: t('label.execution-time') }),
      dataIndex: 'totalExecutionTime',
      key: 'totalExecutionTime',
      render: (time: number) => (
        <Typography.Text>
          {convertMillisecondsToHumanReadableFormat(time)}
        </Typography.Text>
      ),
    },
    {
      title: t('label.average-entity', {
        entity: t('label.execution-time'),
      }),
      dataIndex: 'averageExecutionTime',
      key: 'averageExecutionTime',
      render: (time: number) => (
        <Typography.Text>
          {convertMillisecondsToHumanReadableFormat(time)}
        </Typography.Text>
      ),
    },
    {
      title: t('label.hash-of-execution-plural'),
      dataIndex: 'hashOfExecutions',
      key: 'hashOfExecutions',
      render: (hashOfExecutions: number) => (
        <Typography.Text>{hashOfExecutions}</Typography.Text>
      ),
    },
    {
      title: t('label.total-entity', { entity: t('label.cost') }),
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (totalCost: number) => (
        <Typography.Text>{`$${totalCost}`}</Typography.Text>
      ),
    },
    {
      title: t('label.owner-plural'),
      dataIndex: 'owners',
      key: 'owners',
      width: 200,
      render: (owners: EntityReference[]) => <OwnerLabel owners={owners} />,
    },
  ];
};
