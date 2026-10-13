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
  PaginationCardWithControls,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../../../constants/constants';
import { CursorType } from '../../../../../../enums/pagination.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import type { User } from '../../../../../../generated/entity/teams/user';
import { usePaging } from '../../../../../../hooks/paging/usePaging';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
  getOnlineUsers,
  OnlineUsersQueryParams,
} from '../../../../../../rest/userAPI';
import { formatDateTime } from '../../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getTermQuery } from '../../../../../../utils/SearchPureUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import type { ColumnsType } from '../../../../../common/Table/Table.interface';
import Table from '../../../../../common/Table/TableV2';

import { DEFAULT_TIME_WINDOW, TIME_WINDOW_OPTIONS } from './Members.constants';
import type { MembersSubPanelProps } from './Members.types';
import { formatOnlineStatus } from './Members.utils';
import { EntityLinksCell, UserNameCell } from './MembersUserColumns';
import { profileHash } from './profileHash.utils';

const USER_FIELDS = 'profile,teams,roles,lastLoginTime,lastActivityTime';

const MembersOnlineUsersPanel: FC<MembersSubPanelProps> = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [timeWindow, setTimeWindow] = useState<number>(DEFAULT_TIME_WINDOW);
  const { goTo } = useSettingsHash();

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
    async (params?: { after?: string; before?: string }) => {
      setLoading(true);

      try {
        const queryParams: OnlineUsersQueryParams = {
          // 0 means "All time" — a valid server value; `|| undefined` dropped it
          // and the backend silently fell back to its 5-minute default.
          timeWindow,
          fields: USER_FIELDS,
          limit: pageSize,
          ...params,
        };

        const response = await getOnlineUsers(queryParams);

        setUsers(response.data);
        handlePagingChange(response.paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [timeWindow, pageSize, handlePagingChange]
  );

  const handlePageNavigation = (newPage: number) => {
    if (newPage === currentPage || searchText) {
      return;
    }

    // ponytail: cursor paging only supports ±1 steps; numbered/jump beyond adjacent no-ops.
    const cursorType =
      newPage > currentPage ? CursorType.AFTER : CursorType.BEFORE;
    const cursor = paging[cursorType];

    if (Math.abs(newPage - currentPage) !== 1 || !cursor) {
      return;
    }

    handlePageChange(newPage);
    void fetchOnlineUsers({ [cursorType]: cursor });
  };

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchText(query);

      if (!query.trim()) {
        handlePageChange(INITIAL_PAGING_VALUE);
        void fetchOnlineUsers();

        return;
      }

      setLoading(true);

      try {
        const response = await searchQuery({
          query,
          searchIndex: SearchIndex.USER,
          pageSize,
          pageNumber: INITIAL_PAGING_VALUE,
          queryFilter: getTermQuery({ isBot: 'false' }),
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

  const handleTimeWindowChange = useCallback((key: string | number | null) => {
    setTimeWindow(Number(key));
  }, []);

  // Latest "reset + re-run the active query" closure. The effect runs on
  // timeWindow/pageSize only (plus mount); searchText is read fresh here rather
  // than being an effect dep, so a running search re-filters without the effect
  // re-firing on every keystroke.
  const refetchOnlineUsers = useRef<() => void>(() => undefined);
  refetchOnlineUsers.current = () => {
    handlePageChange(INITIAL_PAGING_VALUE);
    if (searchText) {
      void handleSearch(searchText);
    } else {
      void fetchOnlineUsers();
    }
  };

  useEffect(() => {
    refetchOnlineUsers.current();
  }, [timeWindow, pageSize]);

  const columns = useMemo(
    (): ColumnsType<User> => [
      {
        title: t('label.username'),
        dataIndex: 'name',
        key: 'username',
        ellipsis: true,
        render: (_: string, record: User) => (
          <UserNameCell goTo={goTo} record={record} />
        ),
      },
      {
        title: t('label.name'),
        dataIndex: 'displayName',
        key: 'name',
        ellipsis: true,
        render: (_: string, record: User) => (
          <Typography size="text-sm">{getEntityName(record)}</Typography>
        ),
      },
      {
        title: t('label.last-activity'),
        dataIndex: 'lastActivityTime',
        key: 'lastActivity',
        render: (_: number | undefined, record: User) => {
          const activityTime = record.lastActivityTime ?? record.lastLoginTime;
          const status = formatOnlineStatus(activityTime, t);

          return (
            <Box className="tw:gap-0.5" direction="col">
              <Typography className={status.colorClass} size="text-sm">
                {status.label}
              </Typography>
              {activityTime ? (
                <Typography className="tw:text-tertiary" size="text-xs">
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
        render: (_: unknown, record: User) => (
          <EntityLinksCell
            emptyLabel="-"
            goTo={goTo}
            items={record.teams}
            targetFn={profileHash.team}
          />
        ),
      },
      {
        title: t('label.role-plural'),
        dataIndex: 'roles',
        key: 'roles',
        render: (_: unknown, record: User) => (
          <EntityLinksCell
            emptyLabel="-"
            goTo={goTo}
            items={record.roles}
            targetFn={profileHash.role}
            testId="role-link"
          />
        ),
      },
    ],
    [t, goTo]
  );

  const totalPages = Math.max(1, Math.ceil((paging.total ?? 0) / pageSize));

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
            <Typography size="text-sm">{t('label.time-window')}:</Typography>
            <Select
              data-testid="time-window-select"
              selectedKey={String(timeWindow)} // NOSONAR react-aria's controlled Select API; no non-deprecated alternative exists
              size="sm"
              onSelectionChange={handleTimeWindowChange} // NOSONAR react-aria's controlled Select API; no non-deprecated alternative exists
            >
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
          containerClassName: 'tw:w-80!',
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
        <PaginationCardWithControls
          minimal
          page={currentPage}
          pageSize={pageSize}
          pageSizeOptions={[PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE]}
          total={totalPages}
          onPageChange={handlePageNavigation}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </Box>
  );
};

export default MembersOnlineUsersPanel;
