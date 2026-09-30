/*
 *  Copyright 2026 Collate.
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
    Box,
    EmptyPlaceholder,
    Select,
    Typography
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { INITIAL_PAGING_VALUE } from '../../../../../../constants/constants';
import { SearchIndex } from '../../../../../../enums/search.enum';
import type { User } from '../../../../../../generated/entity/teams/user';
import { usePaging } from '../../../../../../hooks/paging/usePaging';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
    getOnlineUsers,
    OnlineUsersQueryParams
} from '../../../../../../rest/userAPI';
import { formatDateTime } from '../../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { LIST_CAP } from '../../../../../../utils/PermissionsUtils';
import {
    getRoleWithFqnPath,
    getTeamsWithFqnPath
} from '../../../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import UserPopOverCard from '../../../../../common/PopOverCard/UserPopOverCard';
import type { ColumnsType } from '../../../../../common/Table/Table.interface';
import Table from '../../../../../common/Table/TableV2';

import { DEFAULT_TIME_WINDOW, TIME_WINDOW_OPTIONS } from './Members.constants';
import type { MembersSubPanelProps } from './Members.types';
import { formatOnlineStatus } from './Members.utils';
import MembersPagination from './MembersPagination';

const USER_FIELDS = 'profile,teams,roles,lastLoginTime,lastActivityTime';

const MembersOnlineUsersPanel: FC<MembersSubPanelProps> = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [timeWindow, setTimeWindow] = useState<number>(DEFAULT_TIME_WINDOW);

  const {
    paging,
    handlePagingChange,
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    showPagination,
  } = usePaging();

  const fetchOnlineUsers = useCallback(
    async (page = INITIAL_PAGING_VALUE, size = pageSize) => {
      setLoading(true);

      try {
        const params: OnlineUsersQueryParams = {
          timeWindow: timeWindow || undefined,
          fields: USER_FIELDS,
          limit: size,
        };

        if (page > INITIAL_PAGING_VALUE && paging.after) {
          params.after = paging.after;
        }

        const response = await getOnlineUsers(params);

        setUsers(response.data);
        handlePagingChange(response.paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [timeWindow, pageSize, paging.after, handlePagingChange]
  );

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchText(query);

      if (!query.trim()) {
        handlePageChange(INITIAL_PAGING_VALUE);
        fetchOnlineUsers();

        return;
      }

      setLoading(true);

      try {
        const response = await searchQuery({
          query,
          searchIndex: SearchIndex.USER,
          pageSize,
          pageNumber: INITIAL_PAGING_VALUE,
        });

        const now = Date.now();
        const windowMs = timeWindow * 60 * 1000;
        const filtered = response.hits.hits
          .map((hit) => hit._source as User)
          .filter((user) => {
            if (!timeWindow) {
              return true;
            }
            const activity = user.lastActivityTime ?? user.lastLoginTime ?? 0;

            return now - activity <= windowMs;
          });

        setUsers(filtered);
        handlePagingChange({
          total: filtered.length,
        });
        handlePageChange(INITIAL_PAGING_VALUE);
      } catch (error) {
        showErrorToast(error as AxiosError);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [
      timeWindow,
      pageSize,
      handlePagingChange,
      handlePageChange,
      fetchOnlineUsers,
    ]
  );

  useEffect(() => {
    if (!searchText) {
      fetchOnlineUsers();
    }
  }, [timeWindow]);

  const renderEntityLinks = useCallback(
    (
      items: User['teams'] | User['roles'],
      pathFn: (fqn: string) => string
    ) => {
      if (!items || items.length === 0) {
        return '-';
      }

      const visible = items.slice(0, LIST_CAP);
      const overflow = items.length - LIST_CAP;

      return (
        <Box align="center" direction="row" gap={1}>
          {visible.map((item) => (
            <Link
              key={item.id}
              to={pathFn(item.fullyQualifiedName ?? '')}>
              {getEntityName(item)}
            </Link>
          ))}
          {overflow > 0 && (
            <span
              className="tw:text-xs tw:text-tertiary"
              data-testid="plus-more-count">
              {`+${overflow} ${t('label.more')}`}
            </span>
          )}
        </Box>
      );
    },
    [t]
  );

  const columns = useMemo(
    (): ColumnsType<User> => [
      {
        title: t('label.username'),
        dataIndex: 'name',
        key: 'username',
        render: (_: string, record: User) =>
          record.name ? (
            <UserPopOverCard
              showUserName
              profileWidth={16}
              userName={record.name}
            />
          ) : (
            <Typography size="text-sm">{getEntityName(record)}</Typography>
          ),
      },
      {
        title: t('label.name'),
        dataIndex: 'displayName',
        key: 'name',
        render: (_: string, record: User) => (
          <Typography size="text-sm">{getEntityName(record)}</Typography>
        ),
      },
      {
        title: t('label.last-activity'),
        dataIndex: 'lastActivityTime',
        key: 'lastActivity',
        render: (_: number | undefined, record: User) => {
          const activityTime =
            record.lastActivityTime ?? record.lastLoginTime;
          const status = formatOnlineStatus(activityTime, t);

          return (
            <Box className="tw:flex tw:flex-col tw:gap-0.5">
              <Typography className={status.colorClass} size="text-sm">
                {status.label}
              </Typography>
              {activityTime ? (
                <Typography
                  className="tw:text-tertiary"
                  size="text-xs">
                  {formatDateTime(activityTime)}
                </Typography>
              ) : null}
            </Box>
          );
        },
      },
      {
        title: t('label.team-plural'),
        dataIndex: 'teams',
        key: 'teams',
        render: (_: unknown, record: User) =>
          renderEntityLinks(record.teams, getTeamsWithFqnPath),
      },
      {
        title: t('label.role-plural'),
        dataIndex: 'roles',
        key: 'roles',
        render: (_: unknown, record: User) =>
          renderEntityLinks(record.roles, getRoleWithFqnPath),
      },
    ],
    [t, renderEntityLinks]
  );

  return (
    <Box
      className="tw:px-8 tw:pb-8 tw:pt-1"
      data-testid="online-users-panel"
      direction="col"
      gap={4}>
      <Table<User>
        columns={columns}
        data-testid="online-users-table"
        dataSource={users}
        extraTableFilters={
          <Box align="center" direction="row" gap={2}>
            <Typography size="text-sm">
              {t('label.time-window')}:
            </Typography>
            <Select
              data-testid="time-window-select"
              selectedKey={String(timeWindow)}
              size="sm"
              onSelectionChange={(key) => setTimeWindow(Number(key))}>
              {TIME_WINDOW_OPTIONS.map((opt) => (
                <Select.Item
                  id={String(opt.value)}
                  key={String(opt.value)}
                  textValue={t(opt.labelKey, opt.labelParams)}>
                  {t(opt.labelKey, opt.labelParams)}
                </Select.Item>
              ))}
            </Select>
          </Box>
        }
        loading={loading}
        locale={{
          emptyText: (
            <Box
              align="center"
              className="tw:min-h-32 tw:relative"
              justify="center">
              <EmptyPlaceholder
                title={t('label.no-entity-found', {
                  entity: t('label.online-user-plural'),
                })}
              />
            </Box>
          ),
        }}
        pagination={false}
        rowKey="id"
        searchProps={{
          onSearch: handleSearch,
          searchValue: searchText,
          typingInterval: 500,
          placeholder: t('label.search-entity', {
            entity: t('label.user-plural'),
          }),
        }}
        size="small"
      />

      {showPagination && (
        <MembersPagination
          currentPage={currentPage}
          isLoading={loading}
          pageSize={pageSize}
          paging={paging}
          pagingHandler={({ currentPage: page }) =>
            handlePageChange(page, undefined, pageSize)
          }
          onShowSizeChange={handlePageSizeChange}
        />
      )}
    </Box>
  );
};

export default MembersOnlineUsersPanel;
