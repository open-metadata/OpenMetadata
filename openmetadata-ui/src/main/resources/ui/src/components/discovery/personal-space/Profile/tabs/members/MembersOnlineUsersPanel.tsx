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
  PaginationCardWithControls,
  Select,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import { User01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WILD_CARD_CHAR } from '../../../../../../constants/char.constants';
import {
  INITIAL_PAGING_VALUE,
  LIST_PAGE_SIZE_OPTIONS,
  pagingObject,
} from '../../../../../../constants/constants';
import { SearchIndex } from '../../../../../../enums/search.enum';
import type { User } from '../../../../../../generated/entity/teams/user';
import { Paging } from '../../../../../../generated/type/paging';
import {
  useHashPagingParams,
  useSettingsHash,
} from '../../../../../../hooks/useSettingsHash';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
  getOnlineUsers,
  OnlineUsersQueryParams,
} from '../../../../../../rest/userAPI';
import { formatDateTime } from '../../../../../../utils/date-time/DateTimeUtils';
import { getTermQuery } from '../../../../../../utils/SearchPureUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import NoDataPlaceholder from '../../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import type { ColumnsType } from '../../../../../common/Table/Table.interface';
import Table from '../../../../../common/Table/TableV2';

import {
  PageCursor,
  useCursorPageJump,
} from '../../../../../../hooks/paging/useCursorPageJump';
import { shouldShowPager } from '../../../../../../utils/PaginationUtils';
import { getUserIdentifier } from '../../../../../../utils/UsersPureUtils';
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

  // Only page + size go to the settings hash; cursors stay in state, so a
  // reloaded page > 1 has no cursor to resume from and restarts at page 1.
  const {
    page: currentPage,
    resolvedPageSize: pageSize,
    savePageSize,
    setPage: setHashPage,
  } = useHashPagingParams(LIST_PAGE_SIZE_OPTIONS);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const showPagination = shouldShowPager(users);

  const handlePageChange = useCallback(
    (page: number) => setHashPage(page, undefined, undefined, pageSize),
    [setHashPage, pageSize]
  );
  const handlePageSizeChange = useCallback(
    (size: number) => {
      savePageSize(size);
      setHashPage(INITIAL_PAGING_VALUE, undefined, undefined, size);
    },
    [savePageSize, setHashPage]
  );

  const listParams = useMemo<OnlineUsersQueryParams>(
    () => ({
      // 0 means "All time" — a valid server value; `|| undefined` dropped it
      // and the backend silently fell back to its 5-minute default.
      timeWindow,
      fields: USER_FIELDS,
      limit: pageSize,
    }),
    [timeWindow, pageSize]
  );
  const fetchPaging = useCallback(
    // A walk keeps only the cursors, so it skips the row fields.
    async (after: string) =>
      (await getOnlineUsers({ ...listParams, fields: undefined, after }))
        .paging,
    [listParams]
  );
  const {
    cursorFor,
    remember: rememberPage,
    reset: resetPages,
  } = useCursorPageJump(fetchPaging);

  // Only the latest list or search load may fill the table: the pager stays
  // clickable while a page loads.
  const latestLoadIdRef = useRef(0);

  const fetchOnlineUsers = useCallback(
    async (params?: PageCursor, page = INITIAL_PAGING_VALUE) => {
      const loadId = ++latestLoadIdRef.current;
      setLoading(true);

      try {
        const response = await getOnlineUsers({ ...listParams, ...params });
        if (loadId !== latestLoadIdRef.current) {
          return;
        }
        // Page 1 is a fresh load (window, size, search cleared), so older
        // cursors may no longer line up.
        if (page === INITIAL_PAGING_VALUE) {
          resetPages();
        }
        rememberPage(page, response.paging);

        setUsers(response.data);
        setPaging(response.paging);
      } catch (error) {
        if (loadId === latestLoadIdRef.current) {
          showErrorToast(error as AxiosError);
          setUsers([]);
        }
      } finally {
        if (loadId === latestLoadIdRef.current) {
          setLoading(false);
        }
      }
    },
    [listParams, rememberPage, resetPages, setPaging]
  );

  const handlePageNavigation = async (newPage: number) => {
    // Search results are filtered client-side into a single page.
    if (searchText) {
      return;
    }
    let cursor: PageCursor | undefined;
    try {
      cursor = await cursorFor(newPage, currentPage);
    } catch (error) {
      showErrorToast(error as AxiosError);

      return;
    }
    if (!cursor) {
      return;
    }
    handlePageChange(newPage);
    void fetchOnlineUsers(cursor, newPage);
  };

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchText(query);
      // Drops a page jump still walking, so it cannot replace the results.
      resetPages();

      if (!query.trim()) {
        handlePageChange(INITIAL_PAGING_VALUE);
        void fetchOnlineUsers();

        return;
      }

      const loadId = ++latestLoadIdRef.current;
      setLoading(true);

      try {
        const response = await searchQuery({
          query: `${WILD_CARD_CHAR}${query}${WILD_CARD_CHAR}`,
          searchIndex: SearchIndex.USER,
          pageSize,
          pageNumber: INITIAL_PAGING_VALUE,
          queryFilter: getTermQuery({ isBot: 'false' }),
        });
        if (loadId !== latestLoadIdRef.current) {
          return;
        }

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
        setPaging({
          total: filtered.length,
        });
        handlePageChange(INITIAL_PAGING_VALUE);
      } catch (error) {
        if (loadId === latestLoadIdRef.current) {
          showErrorToast(error as AxiosError);
          setUsers([]);
        }
      } finally {
        if (loadId === latestLoadIdRef.current) {
          setLoading(false);
        }
      }
    },
    [
      timeWindow,
      pageSize,
      setPaging,
      handlePageChange,
      fetchOnlineUsers,
      resetPages,
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
    if (currentPage !== INITIAL_PAGING_VALUE) {
      handlePageChange(INITIAL_PAGING_VALUE);
    }
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
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (_: string, record: User) => (
          <UserNameCell goTo={goTo} record={record} />
        ),
      },
      {
        title: t('label.email'),
        dataIndex: 'email',
        key: 'email',
        ellipsis: true,
        render: (_: string, record: User) => (
          <Typography size="text-sm">{getUserIdentifier(record)}</Typography>
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

  return (
    <Box
      className="tw:px-8 tw:pb-8 tw:pt-1"
      data-testid="online-users-panel"
      direction="col">
      <TableCard.Root
        className="tw:flex tw:flex-col"
        size="compact"
        variant="muted">
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
                <NoDataPlaceholder
                  icon={<User01 />}
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
          variant="muted"
        />

        {showPagination && (
          <PaginationCardWithControls
            // Same compact pager as the Teams list.
            minimal
            page={currentPage}
            pageSize={pageSize}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            total={Math.max(1, Math.ceil((paging.total ?? 0) / pageSize))}
            onPageChange={handlePageNavigation}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </TableCard.Root>
    </Box>
  );
};

export default MembersOnlineUsersPanel;
