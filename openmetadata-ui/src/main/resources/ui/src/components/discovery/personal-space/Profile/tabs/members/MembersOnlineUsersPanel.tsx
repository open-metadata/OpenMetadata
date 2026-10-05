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
  Button,
  EmptyPlaceholder,
  PaginationCardWithControls,
  Popover,
  PopoverTrigger,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
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
import type { EntityReference } from '../../../../../../generated/entity/type';
import { usePaging } from '../../../../../../hooks/paging/usePaging';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
  getOnlineUsers,
  OnlineUsersQueryParams,
} from '../../../../../../rest/userAPI';
import { formatDateTime } from '../../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { LIST_CAP } from '../../../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import UserPopOverCard from '../../../../../common/PopOverCard/UserPopOverCard';
import type { ColumnsType } from '../../../../../common/Table/Table.interface';
import Table from '../../../../../common/Table/TableV2';

import { DEFAULT_TIME_WINDOW, TIME_WINDOW_OPTIONS } from './Members.constants';
import type { MembersSubPanelProps } from './Members.types';
import { formatOnlineStatus } from './Members.utils';
import {
  profileHash,
  ProfileHashTarget,
  toHashLocation,
} from './profileHash.utils';
import ProfileHashLink from './ProfileHashLink';

const USER_FIELDS = 'profile,teams,roles,lastLoginTime,lastActivityTime';

const MembersOnlineUsersPanel: FC<MembersSubPanelProps> = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [timeWindow, setTimeWindow] = useState<number>(DEFAULT_TIME_WINDOW);
  const { setHash } = useSettingsHash();

  // In-app clicks must write the hash synchronously; a plain react-router push
  // is not mirrored into useSettingsHash (popstate-only), so href-only links
  // leave the panel view on the stale tab. href stays for open-in-new-tab.
  const goTo = useCallback(
    (target: ProfileHashTarget) => setHash(target.tab, target.subPath),
    [setHash]
  );

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
          timeWindow: timeWindow || undefined,
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
      void fetchOnlineUsers();
    }
    // Refetch on time-window / page-size change; search is handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow, pageSize]);

  const renderEntityLinks = useCallback(
    (
      items: User['teams'] | User['roles'],
      targetFn: (fqn: string) => ProfileHashTarget
    ) => {
      if (!items || items.length === 0) {
        return '-';
      }

      const visible = items.slice(0, LIST_CAP);
      const overflow = items.length - LIST_CAP;

      return (
        <Box align="center" direction="row" gap={1}>
          {visible.map((item) => (
            <ProfileHashLink
              key={item.id}
              target={targetFn(item.fullyQualifiedName ?? item.name ?? '')}
              onNavigate={goTo}>
              {getEntityName(item)}
            </ProfileHashLink>
          ))}
          {overflow > 0 && (
            <Typography
              as="span"
              className="tw:text-tertiary"
              data-testid="plus-more-count"
              size="text-xs">
              {`+${overflow} ${t('label.more')}`}
            </Typography>
          )}
        </Box>
      );
    },
    [t, goTo]
  );

  const renderRolesCell = useCallback(
    (roles: User['roles']) => {
      if (!roles || roles.length === 0) {
        return '-';
      }

      const renderRoleItem = (role: EntityReference) => (
        <ProfileHashLink
          key={role.id}
          target={profileHash.role(role.fullyQualifiedName ?? role.name ?? '')}
          onNavigate={goTo}>
          {getEntityName(role)}
        </ProfileHashLink>
      );

      return (
        <Box data-testid="role-link" direction="row" gap={1} wrap="wrap">
          {roles.slice(0, LIST_CAP).map(renderRoleItem)}
          {roles.length > LIST_CAP && (
            <PopoverTrigger>
              <Button
                className="tw:py-0.5 tw:bg-tertiary"
                color="secondary"
                data-testid="plus-more-count"
                size="xs">
                {t('label.plus-count-more', { count: roles.length - LIST_CAP })}
              </Button>
              <Popover className="tw:max-h-80! tw:overflow-scroll">
                <Box className="tw:p-3" direction="col" gap={1}>
                  {roles.slice(LIST_CAP).map(renderRoleItem)}
                </Box>
              </Popover>
            </PopoverTrigger>
          )}
        </Box>
      );
    },
    [t, goTo]
  );

  const columns = useMemo(
    (): ColumnsType<User> => [
      {
        title: t('label.username'),
        dataIndex: 'name',
        key: 'username',
        ellipsis: true,
        render: (_: string, record: User) =>
          record.name ? (
            <UserPopOverCard
              showUserName
              profileWidth={16}
              to={toHashLocation(profileHash.user(record.name))}
              userName={record.name}
              onTitleClick={() => goTo(profileHash.user(record.name ?? ''))}
            />
          ) : (
            <Typography size="text-sm">{getEntityName(record)}</Typography>
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
        render: (_: unknown, record: User) =>
          renderEntityLinks(record.teams, (fqn) => profileHash.team(fqn)),
      },
      {
        title: t('label.role-plural'),
        dataIndex: 'roles',
        key: 'roles',
        render: (_: unknown, record: User) => renderRolesCell(record.roles),
      },
    ],
    [t, goTo, renderEntityLinks, renderRolesCell]
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
