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

import {
  Badge,
  Box,
  Popover,
  PopoverTrigger,
  Skeleton,
} from '@openmetadata/ui-core-components';
import { Tooltip } from 'antd';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
import { Button as AriaButton } from 'react-aria-components';
import { Link } from 'react-router-dom';
import { ReactComponent as BotIcon } from '../assets/svg/bot.svg';
import UserPopOverCard from '../components/common/PopOverCard/UserPopOverCard';
import { ColumnsType } from '../components/common/Table/Table.interface';
import { TEXT_GREY_MUTED } from '../constants/constants';
import { EntityReference, User } from '../generated/entity/teams/user';
import { getEntityName } from './EntityNameUtils';
import { t } from './i18next/LocalUtil';
import { LIST_CAP } from './PermissionsUtils';
import { getRoleWithFqnPath, getTeamsWithFqnPath } from './RouterUtils';

export const userCellRenderer = (user: EntityReference | User) => {
  return user.name ? (
    <div className="w-max-full">
      <UserPopOverCard showUserName profileWidth={16} userName={user.name} />
    </div>
  ) : (
    getEntityName(user)
  );
};

export const commonUserDetailColumns = (
  isLoading?: boolean
): ColumnsType<User> => [
  {
    title: t('label.username'),
    dataIndex: 'username',
    key: 'username',
    ellipsis: { showTitle: false },
    render: (_, record) => (
      <Box
        inline
        align="center"
        className="layout-space layout-space-horizontal"
        gap={1}
        itemClassName="layout-space-item">
        {record.isBot && (
          <Tooltip title={t('label.bot')}>
            <BotIcon
              aria-label={t('label.bot')}
              color={TEXT_GREY_MUTED}
              data-testid="bot-icon"
              height={16}
              width={16}
            />
          </Tooltip>
        )}
        {userCellRenderer(record)}
      </Box>
    ),
  },
  {
    title: t('label.name'),
    dataIndex: 'name',
    key: 'name',
    ellipsis: { showTitle: false },
    render: (_, record) => getEntityName(record),
  },
  {
    title: t('label.team-plural'),
    dataIndex: 'teams',
    key: 'teams',

    render: (_, record) => {
      if (isLoading) {
        return <Skeleton height={16} />;
      }
      const listLength = record.teams?.length ?? 0;
      const hasMore = listLength > LIST_CAP;

      if (isUndefined(record.teams) || isEmpty(record.teams)) {
        return <>{t('label.no-entity', { entity: t('label.team') })}</>;
      } else {
        return (
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal"
            data-testid="policy-link"
            gap={1}
            itemClassName="layout-space-item"
            wrap="wrap">
            {record.teams.slice(0, LIST_CAP).map((team) => (
              <Link
                className="cursor-pointer"
                key={uniqueId()}
                to={getTeamsWithFqnPath(team.fullyQualifiedName ?? '')}>
                {getEntityName(team)}
              </Link>
            ))}
            {hasMore && (
              <PopoverTrigger>
                <AriaButton
                  className="tw:cursor-pointer tw:rounded-md tw:outline-focus-ring tw:focus-visible:outline-2"
                  data-testid="plus-more-count">
                  <Badge
                    className="tw:inline-flex tw:mr-2 m-l-xs"
                    color="gray"
                    size="sm"
                    type="color">{`+${listLength - LIST_CAP} more`}</Badge>
                </AriaButton>
                <Popover
                  arrow
                  containerClassName="tw:w-40 tw:px-4 tw:py-3"
                  placement="bottom">
                  <Box
                    inline
                    align="center"
                    className="layout-space layout-space-horizontal"
                    gap={1}
                    itemClassName="layout-space-item"
                    wrap="wrap">
                    {record.teams.slice(LIST_CAP).map((team) => (
                      <Link
                        className="cursor-pointer"
                        key={uniqueId()}
                        to={getTeamsWithFqnPath(team.fullyQualifiedName ?? '')}>
                        {getEntityName(team)}
                      </Link>
                    ))}
                  </Box>
                </Popover>
              </PopoverTrigger>
            )}
          </Box>
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
        return <Skeleton height={16} />;
      }

      if (isUndefined(record.roles) || isEmpty(record.roles)) {
        return <>{t('label.no-entity', { entity: t('label.role') })}</>;
      } else {
        return (
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal"
            data-testid="policy-link"
            gap={1}
            itemClassName="layout-space-item"
            wrap="wrap">
            {record.roles.slice(0, LIST_CAP).map((role) => (
              <Link
                className="cursor-pointer"
                key={uniqueId()}
                to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
                {getEntityName(role)}
              </Link>
            ))}
            {hasMore && (
              <PopoverTrigger>
                <AriaButton
                  className="tw:cursor-pointer tw:rounded-md tw:outline-focus-ring tw:focus-visible:outline-2"
                  data-testid="plus-more-count">
                  <Badge
                    className="tw:inline-flex tw:mr-2 m-l-xs"
                    color="gray"
                    size="sm"
                    type="color">{`+${listLength - LIST_CAP} more`}</Badge>
                </AriaButton>
                <Popover
                  arrow
                  containerClassName="tw:w-40 tw:px-4 tw:py-3"
                  placement="bottom">
                  <Box
                    inline
                    align="center"
                    className="layout-space layout-space-horizontal"
                    gap={1}
                    itemClassName="layout-space-item"
                    wrap="wrap">
                    {record.roles.slice(LIST_CAP).map((role) => (
                      <Link
                        className="cursor-pointer"
                        key={uniqueId()}
                        to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
                        {getEntityName(role)}
                      </Link>
                    ))}
                  </Box>
                </Popover>
              </PopoverTrigger>
            )}
          </Box>
        );
      }
    },
  },
];
