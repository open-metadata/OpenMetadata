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
import { Col, Row } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import { get } from 'lodash';
import React from 'react';
import { DomainLabel } from '../components/common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../components/common/OwnerLabel/OwnerLabel.component';
import TitleBreadcrumb from '../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import TableTags from '../components/Database/TableTags/TableTags.component';
import EntityHeaderTitle from '../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { EntityType } from '../enums/entity.enum';
import {
  EntityReference,
  Table,
  TagLabel,
  TagSource,
  UsageDetails,
} from '../generated/entity/data/table';
import { SearchSourceAlias } from '../interface/search.interface';
import { getDataAssetsHeaderInfo } from './DataAssetsHeader.utils';
import entityUtilClassBase from './EntityUtilClassBase';
import serviceUtilClassBase from './ServiceUtilClassBase';
import { getUsagePercentile } from './TableUtils';

export const getMostUsedAssetsWidgetColumns = (): ColumnsType<Table> => {
  return [
    {
      title: t('label.name'),
      className: 'name-column',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      render: (_, record: Table) => {
        const { breadcrumbs } = getDataAssetsHeaderInfo(
          EntityType.TABLE,
          record,
          record.name,
          []
        );
        const serviceType = get(record, 'serviceType', '');

        const icon = serviceType ? (
          <img
            className="h-7"
            src={serviceUtilClassBase.getServiceTypeLogo(
              record as SearchSourceAlias
            )}
          />
        ) : null;

        return (
          <Row gutter={[4, 4]}>
            <Col span={24}>
              <TitleBreadcrumb titleLinks={breadcrumbs} />
            </Col>
            <Col span={24}>
              <EntityHeaderTitle
                certification={(record as Table)?.certification}
                deleted={record?.deleted}
                displayName={record.displayName}
                displayNameClassName="text-md"
                icon={icon}
                link={entityUtilClassBase.getEntityLink(
                  EntityType.TABLE,
                  record.fullyQualifiedName ?? ''
                )}
                name={record?.name}
                nameClassName="text-sm"
                serviceName={record.service?.name ?? ''}
              />
            </Col>
          </Row>
        );
      },
    },
    {
      title: t('label.usage'),
      dataIndex: 'usageSummary',
      key: 'usageSummary',
      render: (text: UsageDetails) =>
        getUsagePercentile(text?.weeklyStats?.percentileRank ?? 0),
    },
    {
      title: t('label.owner-plural'),
      dataIndex: 'owners',
      key: 'owners',
      render: (owners: EntityReference[]) => <OwnerLabel owners={owners} />,
    },
    {
      title: t('label.domain'),
      dataIndex: 'domain',
      key: 'domain',
      render: (domain: EntityReference) => (
        <DomainLabel
          domain={domain}
          entityFqn={domain?.fullyQualifiedName as string}
          entityId={domain?.id as string}
          entityType={EntityType.TABLE}
          hasPermission={false}
        />
      ),
    },
    {
      title: t('label.tag-plural'),
      dataIndex: 'tags',
      key: 'tags',
      width: 230,
      render: (tags: TagLabel[], record: Table, index: number) => (
        <TableTags<Table>
          entityFqn={record.fullyQualifiedName as string}
          entityType={EntityType.TABLE}
          handleTagSelection={() => Promise.resolve()}
          hasTagEditAccess={false}
          index={index}
          isReadOnly={false}
          record={record}
          tags={tags}
          type={TagSource.Classification}
        />
      ),
    },
  ];
};
