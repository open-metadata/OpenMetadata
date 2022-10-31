/*
 *  Copyright 2021 Collate
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

import { Card, Table, Tag, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TOP_VIEW_ENTITIES } from '../../pages/DataInsightPage/DataInsight.mock';
import './DataInsightTables.less';

interface EntityView {
  entityName: string;
  owner: string;
  tags: string[];
  entityType: string;
  totalViews: number;
  uniqueViews: number;
}

const TopViewEntities = () => {
  const { t } = useTranslation();

  const columns: ColumnsType<EntityView> = useMemo(
    () => [
      {
        title: 'Entity Name',
        dataIndex: 'entityName',
        key: 'entityName',
        render: (entityName: string) => (
          <Typography.Text>{entityName}</Typography.Text>
        ),
      },
      {
        title: 'Owner',
        dataIndex: 'owner',
        key: 'owner',
        render: (owner: string) => <Typography.Text>{owner}</Typography.Text>,
      },
      {
        title: 'Tags',
        dataIndex: 'tags',
        key: 'tags',
        render: (tags: string[]) => (
          <Typography.Text>
            {tags.map((tag, i) => (
              <Tag key={i}>{tag}</Tag>
            ))}
          </Typography.Text>
        ),
      },
      {
        title: 'Entity Type',
        dataIndex: 'entityType',
        key: 'entityType',
        render: (entityType: string) => (
          <Typography.Text>{entityType}</Typography.Text>
        ),
      },
      {
        title: 'Total Views',
        dataIndex: 'totalViews',
        key: 'totalViews',
        render: (totalViews: number) => (
          <Typography.Text>{totalViews}</Typography.Text>
        ),
      },
      {
        title: 'Unique Views',
        dataIndex: 'uniqueViews',
        key: 'uniqueViews',
        render: (uniqueViews: number) => (
          <Typography.Text>{uniqueViews}</Typography.Text>
        ),
      },
    ],
    []
  );

  return (
    <Card className="mt-4" data-testid="entity-summary-card-percentage">
      <div data-testid="entity-summary-card-percentage-heder">
        <Typography.Title level={5}>
          {t('label.data-insight-top-viewed-entity-summary')}
        </Typography.Title>
      </div>
      <Table
        bordered={false}
        className="mt-4 data-insight-table-wrapper"
        columns={columns}
        dataSource={TOP_VIEW_ENTITIES}
        pagination={false}
        size="small"
      />
    </Card>
  );
};

export default TopViewEntities;
