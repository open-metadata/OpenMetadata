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

import { Skeleton, Space, Tag } from 'antd';
import { Popover } from '../components/common/AntdCompat';;
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
import moment from 'moment';
import { Link } from 'react-router-dom';
import UserPopOverCard from '../components/common/PopOverCard/UserPopOverCard';
import { HTTP_STATUS_CODE } from '../constants/Auth.constants';
import { ERROR_MESSAGE, NO_DATA_PLACEHOLDER } from '../constants/constants';
import { MASKED_EMAIL } from '../constants/User.constants';
import { EntityReference, User } from '../generated/entity/teams/user';
import { getIsErrorMatch } from './CommonUtils';
import { getEntityName } from './EntityUtils';
import { t } from './i18next/LocalUtil';
import { LIST_CAP } from './PermissionsUtils';
import { getRoleWithFqnPath, getTeamsWithFqnPath } from './RouterUtils';

export const userCellRenderer = (user: EntityReference | User) => {
  return user.name ? (
    <div className="w-fit-content">
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
    render: (_, record) => userCellRenderer(record),
  },
  {
    title: t('label.name'),
    dataIndex: 'name',
    key: 'name',
    render: (_, record) => getEntityName(record),
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

export const isMaskedEmail = (email: string) => {
  return email === MASKED_EMAIL;
};

export const getUserCreationErrorMessage = ({
  error,
  entity,
  entityLowercase,
  entityName,
}: {
  error?: AxiosError;
  entity: string;
  entityLowercase?: string;
  entityName?: string;
}) => {
  if (error) {
    if (getIsErrorMatch(error, ERROR_MESSAGE.alreadyExist)) {
      return t('server.email-already-exist', {
        entity: entityLowercase ?? '',
        name: entityName ?? '',
      });
    }

    if (error.response?.status === HTTP_STATUS_CODE.LIMIT_REACHED) {
      return t('server.entity-limit-reached', { entity });
    }
  }

  return t('server.create-entity-error', { entity });
};

export const getEmptyTextFromUserProfileItem = (item: string) => {
  const messages = {
    roles: t('message.no-roles-assigned'),
    teams: t('message.no-teams-assigned'),
    inheritedRoles: t('message.no-inherited-roles-found'),
    personas: t('message.no-persona-assigned'),
  };

  return messages[item as keyof typeof messages] || NO_DATA_PLACEHOLDER;
};

export const getUserOnlineStatus = (userData: User, includeTooltip = false) => {
  // Don't show online status for bots or if userData is not provided
  if (!userData || userData.isBot) {
    return null;
  }

  // Use lastActivityTime if available, otherwise fall back to lastLoginTime
  const activityTime = userData.lastActivityTime || userData.lastLoginTime;

  if (!activityTime) {
    return null;
  }

  const lastActivityMoment = moment(activityTime);
  const now = moment();
  const diffMinutes = now.diff(lastActivityMoment, 'minutes');

  if (diffMinutes <= 5) {
    return {
      status: 'success' as const,
      text: t('label.online-now'),
      ...(includeTooltip && {
        tooltip: t('label.last-activity-n-minutes-ago', { count: diffMinutes }),
      }),
    };
  } else if (diffMinutes <= 60) {
    return {
      status: 'success' as const,
      text: t('label.active-recently'),
      ...(includeTooltip && {
        tooltip: t('label.last-activity-n-minutes-ago', { count: diffMinutes }),
      }),
    };
  }

  return null;
};
