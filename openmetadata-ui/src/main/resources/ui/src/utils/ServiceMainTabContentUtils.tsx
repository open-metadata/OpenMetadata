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
import { isUndefined } from 'lodash';
import { ServiceTypes } from 'Models';
import React from 'react';
import { Link } from 'react-router-dom';
import { UserTeam } from '../components/common/AssigneeList/AssigneeList.interface';
import UserPopOverCard from '../components/common/PopOverCard/UserPopOverCard';
import RichTextEditorPreviewer from '../components/common/RichTextEditor/RichTextEditorPreviewer';
import TagsViewer from '../components/Tag/TagsViewer/TagsViewer';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { ServiceCategory } from '../enums/service.enum';
import { Database } from '../generated/entity/data/database';
import { Pipeline } from '../generated/entity/data/pipeline';
import { ServicePageData } from '../pages/ServiceDetailsPage/ServiceDetailsPage';
import { getEntityName } from './EntityUtils';
import { getLinkForFqn } from './ServiceUtils';
import { getUsagePercentile } from './TableUtils';

export const getServiceMainTabColumns = (
  serviceCategory: ServiceTypes
): ColumnsType<ServicePageData> => [
  {
    title: t('label.name'),
    dataIndex: 'name',
    key: 'name',
    width: 280,
    render: (_, record: ServicePageData) => {
      return (
        <Link
          data-testid={record.name}
          to={getLinkForFqn(serviceCategory, record.fullyQualifiedName ?? '')}>
          <Typography.Paragraph
            data-testid="child-asset-name-link"
            ellipsis={{
              rows: 2,
              tooltip: true,
            }}
            style={{ width: 280, color: 'inherit' }}>
            {getEntityName(record)}
          </Typography.Paragraph>
        </Link>
      );
    },
  },
  {
    title: t('label.description'),
    dataIndex: 'description',
    key: 'description',
    render: (description: ServicePageData['description']) =>
      !isUndefined(description) && description.trim() ? (
        <RichTextEditorPreviewer markdown={description} />
      ) : (
        <span className="text-grey-muted">
          {t('label.no-entity', {
            entity: t('label.description'),
          })}
        </span>
      ),
  },
  ...(ServiceCategory.PIPELINE_SERVICES === serviceCategory
    ? [
        {
          title: t('label.schedule-interval'),
          dataIndex: 'scheduleInterval',
          key: 'scheduleInterval',
          render: (scheduleInterval: Pipeline['scheduleInterval']) =>
            scheduleInterval ? (
              <span>{scheduleInterval}</span>
            ) : (
              <Typography.Text>{NO_DATA_PLACEHOLDER}</Typography.Text>
            ),
        },
      ]
    : []),
  {
    title: t('label.owner'),
    dataIndex: 'owner',
    key: 'owner',
    render: (owner: ServicePageData['owner']) =>
      !isUndefined(owner) ? (
        <UserPopOverCard
          showUserName
          data-testid="owner-data"
          displayName={owner.displayName}
          profileWidth={20}
          type={owner.type as UserTeam}
          userName={owner.name ?? ''}
        />
      ) : (
        <Typography.Text data-testid="no-owner-text">--</Typography.Text>
      ),
  },
  {
    title: t('label.tag-plural'),
    dataIndex: 'tags',
    width: 200,
    key: 'tags',
    render: (_, record: ServicePageData) => (
      <TagsViewer tags={record.tags ?? []} />
    ),
  },
  ...(ServiceCategory.DATABASE_SERVICES === serviceCategory
    ? [
        {
          title: t('label.usage'),
          dataIndex: 'usageSummary',
          key: 'usageSummary',
          render: (usageSummary: Database['usageSummary']) => (
            <Typography.Text>
              {getUsagePercentile(
                usageSummary?.weeklyStats?.percentileRank ?? 0
              )}
            </Typography.Text>
          ),
        },
      ]
    : []),
];
