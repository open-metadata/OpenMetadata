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

import { Popover, Space, Tag } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import { getUserPath } from '../../constants/constants';
import { User } from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityName } from '../../utils/CommonUtils';
import { LIST_CAP } from '../../utils/PermissionsUtils';
import {
  getRoleWithFqnPath,
  getTeamsWithFqnPath,
} from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

export const userPageFilterList = [
  {
    name: t('label.my-data'),
    value: 'OWNER',
    icon: (
      <SVGIcons
        alt="My Data"
        className="tw-mr-2"
        icon={Icons.FOLDER}
        width="16px"
      />
    ),
  },
  {
    name: t('label.mention-plural'),
    value: 'MENTIONS',
    icon: (
      <SVGIcons
        alt="Mentions"
        className="tw-mr-2"
        icon={Icons.MENTIONS}
        width="16px"
      />
    ),
  },
  {
    name: t('label.following'),
    value: 'FOLLOWS',
    icon: (
      <SVGIcons
        alt="Following"
        className="tw-mr-2"
        icon={Icons.STAR}
        width="16px"
      />
    ),
  },
];

export const getEntityReferenceFromUser = (user: User): EntityReference => {
  return {
    deleted: user.deleted,
    href: user.href,
    fullyQualifiedName: user.fullyQualifiedName,
    id: user.id,
    type: 'user',
    description: user.description,
    displayName: user.displayName,
    name: user.name,
  };
};

export const getUserFromEntityReference = (entity: EntityReference): User => {
  return {
    deleted: entity.deleted,
    href: entity.href ?? '',
    fullyQualifiedName: entity.fullyQualifiedName,
    id: entity.id,
    description: entity.description,
    displayName: entity.displayName,
    name: entity.name ?? '',
    email: '',
  };
};

export const commonUserDetailColumns = (): ColumnsType<User> => [
  {
    title: t('label.username'),
    dataIndex: 'username',
    key: 'username',
    render: (_, record) => (
      <Link
        className="hover:tw-underline tw-cursor-pointer"
        data-testid={record.name}
        to={getUserPath(record.fullyQualifiedName || record.name)}>
        {getEntityName(record)}
      </Link>
    ),
  },
  {
    title: t('label.team-plural'),
    dataIndex: 'teams',
    key: 'teams',
    render: (_, record) => {
      const listLength = record.teams?.length ?? 0;
      const hasMore = listLength > LIST_CAP;

      if (isUndefined(record.teams) || isEmpty(record.teams)) {
        return <>{t('label.no-entity', { entity: t('label.team') })}</>;
      } else {
        return (
          <Space wrap data-testid="policy-link" size={4}>
            {record.teams.slice(0, LIST_CAP).map((team) => (
              <Link
                className="hover:tw-underline tw-cursor-pointer"
                key={uniqueId()}
                to={getTeamsWithFqnPath(team.fullyQualifiedName ?? '')}>
                {getEntityName(team)}
              </Link>
            ))}
            {hasMore && (
              <Popover
                className="tw-cursor-pointer"
                content={
                  <Space wrap size={4}>
                    {record.teams.slice(LIST_CAP).map((team) => (
                      <Link
                        className="hover:tw-underline tw-cursor-pointer"
                        key={uniqueId()}
                        to={getTeamsWithFqnPath(team.fullyQualifiedName ?? '')}>
                        {getEntityName(team)}
                      </Link>
                    ))}
                  </Space>
                }
                overlayClassName="tw-w-40 tw-text-center"
                trigger="click">
                <Tag className="tw-ml-1" data-testid="plus-more-count">{`+${
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

      if (isUndefined(record.roles) || isEmpty(record.roles)) {
        return <>{t('label.no-entity', { entity: t('label.role') })}</>;
      } else {
        return (
          <Space wrap data-testid="policy-link" size={4}>
            {record.roles.slice(0, LIST_CAP).map((role) => (
              <Link
                className="hover:tw-underline tw-cursor-pointer"
                key={uniqueId()}
                to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
                {getEntityName(role)}
              </Link>
            ))}
            {hasMore && (
              <Popover
                className="tw-cursor-pointer"
                content={
                  <Space wrap size={4}>
                    {record.roles.slice(LIST_CAP).map((role) => (
                      <Link
                        className="hover:tw-underline tw-cursor-pointer"
                        key={uniqueId()}
                        to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
                        {getEntityName(role)}
                      </Link>
                    ))}
                  </Space>
                }
                overlayClassName="tw-w-40 tw-text-center"
                trigger="click">
                <Tag className="tw-ml-1" data-testid="plus-more-count">{`+${
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
