/*
 *  Copyright 2022 Collate.
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

import { Popover, Skeleton, Space, Tag } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import { getUserPath } from '../../constants/constants';
import { User } from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/entity/type';
import { getEntityName } from '../../utils/EntityUtils';
import { LIST_CAP } from '../../utils/PermissionsUtils';
import {
  getRoleWithFqnPath,
  getTeamsWithFqnPath,
} from '../../utils/RouterUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';

export const userCellRenderer = (user: EntityReference | User) => {
  return (
    <Link
      className="d-flex gap-2 items-center "
      data-testid={user.name}
      to={getUserPath(user.fullyQualifiedName ?? user.name ?? '')}>
      <ProfilePicture
        displayName={user.displayName}
        name={user.name ?? ''}
        type="circle"
        width="16"
      />
      {getEntityName(user)}
    </Link>
  );
};

export const commonUserDetailColumns = (
  isLoading?: boolean
): ColumnsType<User> => [
  {
    title: t('label.username'),
    dataIndex: 'username',
    key: 'username',
    render: (_, record) => userCellRenderer(record),
  },
  {
    title: t('label.team-plural'),
    dataIndex: 'teams',
    key: 'teams',

    render: (_, record) => {
      if (isLoading) {
        return <Skeleton active paragraph={false} />;
      }
      const listLength = record.teams?.length ?? 0;
      const hasMore = listLength > LIST_CAP;

      if (isUndefined(record.teams) || isEmpty(record.teams)) {
        return <>{t('label.no-entity', { entity: t('label.team') })}</>;
      } else {
        return (
          <Space wrap data-testid="policy-link" size={4}>
            {record.teams.slice(0, LIST_CAP).map((team) => (
              <Link
                className="cursor-pointer"
                key={uniqueId()}
                to={getTeamsWithFqnPath(team.fullyQualifiedName ?? '')}>
                {getEntityName(team)}
              </Link>
            ))}
            {hasMore && (
              <Popover
                className="cursor-pointer"
                content={
                  <Space wrap size={4}>
                    {record.teams.slice(LIST_CAP).map((team) => (
                      <Link
                        className="cursor-pointer"
                        key={uniqueId()}
                        to={getTeamsWithFqnPath(team.fullyQualifiedName ?? '')}>
                        {getEntityName(team)}
                      </Link>
                    ))}
                  </Space>
                }
                overlayClassName="w-40"
                trigger="click">
                <Tag className="m-l-xs" data-testid="plus-more-count">{`+${
                  listLength - LIST_CAP
                } more`}</Tag>
              </Popover>
            )}
          </Space>
        );
      }
    },
  },
  {
    title: t('label.role-plural'),
    dataIndex: 'roles',
    key: 'roles',
    render: (_, record) => {
      const listLength = record.roles?.length ?? 0;
      const hasMore = listLength > LIST_CAP;

      if (isLoading) {
        return <Skeleton active paragraph={false} />;
      }

      if (isUndefined(record.roles) || isEmpty(record.roles)) {
        return <>{t('label.no-entity', { entity: t('label.role') })}</>;
      } else {
        return (
          <Space wrap data-testid="policy-link" size={4}>
            {record.roles.slice(0, LIST_CAP).map((role) => (
              <Link
                className="cursor-pointer"
                key={uniqueId()}
                to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
                {getEntityName(role)}
              </Link>
            ))}
            {hasMore && (
              <Popover
                className="cursor-pointer"
                content={
                  <Space wrap size={4}>
                    {record.roles.slice(LIST_CAP).map((role) => (
                      <Link
                        className="cursor-pointer"
                        key={uniqueId()}
                        to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
                        {getEntityName(role)}
                      </Link>
                    ))}
                  </Space>
                }
                overlayClassName="w-40"
                trigger="click">
                <Tag className="m-l-xs" data-testid="plus-more-count">{`+${
                  listLength - LIST_CAP
                } more`}</Tag>
              </Popover>
            )}
          </Space>
        );
      }
    },
  },
];
