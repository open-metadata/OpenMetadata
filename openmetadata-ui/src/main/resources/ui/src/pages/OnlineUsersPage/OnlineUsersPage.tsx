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
  Box,
  Grid,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import moment from 'moment';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NoSearchResultsPlaceholder from '../../components/common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import PermissionPlaceholder from '../../components/common/EmptyPlaceholder/PermissionPlaceholder';
import { ColumnsType } from '../../components/common/Table/Table.interface';
import Table from '../../components/common/Table/TableV2';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { INITIAL_PAGING_VALUE } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { User } from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import { usePaging } from '../../hooks/paging/usePaging';
import { searchQuery } from '../../rest/searchAPI';
import { getOnlineUsers, OnlineUsersQueryParams } from '../../rest/userAPI';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { getTermQuery } from '../../utils/SearchPureUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { commonUserDetailColumns } from '../../utils/Users.util';

const OnlineUsersPage = () => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [userList, setUserList] = useState<User[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');

  const {
    currentPage,
    handlePageChange,
    handlePagingChange,
    pageSize,
    paging,
    showPagination,
  } = usePaging();

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.MEMBERS,
        t('label.online-user-plural')
      ),
    []
  );

  // Time window options
  const TIME_WINDOWS = [
    { id: '5', label: t('label.last-n-minutes', { n: 5 }) },
    { id: '60', label: t('label.last-hour') },
    { id: '1440', label: t('label.last-24-hours') },
    { id: '10080', label: t('label.last-7-days') },
    { id: '43200', label: t('label.last-30-days') },
    { id: '0', label: t('label.all-time') },
  ];

  const [timeWindow, setTimeWindow] = useState<number>(1440); // Default: 24 hours

  const fetchUsersList = useCallback(
    async (params?: OnlineUsersQueryParams) => {
      setIsDataLoading(true);
      try {
        // Use the new online users endpoint
        const response = await getOnlineUsers({
          timeWindow: timeWindow,
          fields: [
            TabSpecificField.PROFILE,
            TabSpecificField.TEAMS,
            TabSpecificField.ROLES,
            TabSpecificField.LAST_LOGIN_TIME,
            TabSpecificField.LAST_ACTIVITY_TIME,
          ].join(','),
          limit: pageSize,
          ...params,
        });

        setUserList(response.data);
        handlePagingChange(response.paging);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.user'),
          })
        );
        setUserList([]);
      } finally {
        setIsDataLoading(false);
      }
    },
    [pageSize, handlePagingChange, timeWindow]
  );

  const searchUsers = useCallback(
    async (value: string) => {
      setIsDataLoading(true);
      try {
        // For search, we still need to use searchQuery API and filter client-side
        // as the online users endpoint doesn't support search yet
        const res = await searchQuery({
          query: value,
          pageNumber: currentPage,
          pageSize,
          queryFilter: getTermQuery({ isBot: 'false' }),
          searchIndex: SearchIndex.USER,
        });
        const data = res.hits.hits.map(({ _source }) => _source);

        // Filter users based on lastLoginTime
        const onlineUsers = data.filter((user: User) => {
          if (!user.lastLoginTime) {
            return false;
          }
          const lastLoginMoment = moment(user.lastLoginTime);
          const minutesAgo = moment().diff(lastLoginMoment, 'minutes');

          return timeWindow === 0 || minutesAgo <= timeWindow;
        });

        handlePagingChange({
          total: onlineUsers.length,
        });
        setUserList(onlineUsers);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.user'),
          })
        );
        setUserList([]);
      } finally {
        setIsDataLoading(false);
      }
    },
    [currentPage, pageSize, handlePagingChange]
  );

  const handleSearch = useCallback(
    (value: string) => {
      handlePageChange(INITIAL_PAGING_VALUE);
      setSearchValue(value);
      if (value) {
        searchUsers(value);
      } else {
        fetchUsersList();
      }
    },
    [handlePageChange, fetchUsersList, searchUsers]
  );

  useEffect(() => {
    if (!isAdminUser) {
      return;
    }
    handlePageChange(INITIAL_PAGING_VALUE);
    fetchUsersList();
  }, [pageSize, isAdminUser, timeWindow]);

  const columns: ColumnsType<User> = useMemo(() => {
    const baseColumns = commonUserDetailColumns(isDataLoading);

    // Add Last Activity Time column
    const lastActivityColumn = {
      title: t('label.last-activity'),
      dataIndex: 'lastActivityTime',
      key: 'lastActivityTime',
      render: (lastActivityTime: number, record: User) => {
        // Use lastActivityTime if available, otherwise fall back to lastLoginTime
        const activityTime = lastActivityTime || record.lastLoginTime;

        if (!activityTime) {
          return <Typography color="secondary">{t('label.never')}</Typography>;
        }

        const lastActivityMoment = moment(activityTime);
        const now = moment();
        const diffMinutes = now.diff(lastActivityMoment, 'minutes');
        const diffHours = now.diff(lastActivityMoment, 'hours');
        const diffDays = now.diff(lastActivityMoment, 'days');

        let statusText = '';
        let statusColor = '';

        if (diffMinutes < 5) {
          statusText = t('label.online-now');
          statusColor = '#52c41a'; // green
        } else if (diffMinutes < 60) {
          statusText = t('label.n-minutes-ago', { count: diffMinutes });
          statusColor = '#52c41a'; // green
        } else if (diffHours < 24) {
          statusText = t('label.n-hours-ago', { count: diffHours });
          statusColor = '#faad14'; // yellow
        } else {
          statusText = t('label.n-days-ago', { count: diffDays });
          statusColor = '#ff4d4f'; // red
        }

        return (
          <Box
            inline
            align="stretch"
            className="layout-space"
            direction="col"
            gap={0}
            itemClassName="layout-space-item">
            <Typography
              className="tw:text-primary"
              style={{ color: statusColor }}>
              {statusText}
            </Typography>
            <Typography color="secondary" style={{ fontSize: '12px' }}>
              {formatDateTime(activityTime)}
            </Typography>
          </Box>
        );
      },
    };

    // Insert the last activity column after the username column
    return [
      ...baseColumns.slice(0, 2),
      lastActivityColumn,
      ...baseColumns.slice(2),
    ];
  }, [isDataLoading, t]);

  if (!isAdminUser) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
        <PermissionPlaceholder data-testid="permission-error-placeholder" />
      </div>
    );
  }

  return (
    <PageLayoutV1 pageTitle={t('label.online-user-plural')}>
      <Grid
        className="layout-row layout-grid"
        data-testid="online-users-page"
        style={{ ...getLayoutGutter(0, 16) }}>
        <Grid.Item className="layout-column" span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Grid.Item>

        <Grid.Item className="layout-column" span={24}>
          <PageHeader
            data={{
              header: t(PAGE_HEADERS.ONLINE_USERS.header),
              subHeader: t(PAGE_HEADERS.ONLINE_USERS.subHeader),
            }}
          />
        </Grid.Item>

        <Grid.Item className="layout-column" span={24}>
          <Table
            className="user-list-table"
            columns={columns}
            data-testid="online-users-table"
            dataSource={userList}
            extraTableFilters={
              <Box
                inline
                align="center"
                className="layout-space layout-space-horizontal"
                gap={2}
                itemClassName="layout-space-item">
                <Typography>{t('label.time-window')}:</Typography>
                <Select
                  aria-label={t('label.time-window')}
                  className="tw:w-45"
                  data-testid="time-window-select"
                  items={TIME_WINDOWS}
                  value={String(timeWindow)}
                  onChange={(key) => setTimeWindow(Number(key))}>
                  {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
              </Box>
            }
            loading={isDataLoading}
            locale={{
              emptyText: (
                <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
                  <NoSearchResultsPlaceholder
                    data-testid="search-error-placeholder"
                    description={
                      searchValue
                        ? t('message.no-entity-found-for-name', {
                            entity: t('label.user-lowercase'),
                            name: searchValue,
                          })
                        : t('message.no-online-users-found')
                    }
                  />
                </div>
              ),
            }}
            pagination={false}
            rowKey="id"
            searchProps={{
              placeholder: `${t('label.search-for-type', {
                type: t('label.user'),
              })}...`,
              searchValue: searchValue,
              typingInterval: 400,
              onSearch: handleSearch,
            }}
            size="small"
          />
        </Grid.Item>

        {showPagination && (
          <Grid.Item className="layout-column" span={24}>
            <div className="w-full flex justify-center">
              {paging && (
                <div data-testid="pagination">
                  {/* Add pagination component here if needed */}
                </div>
              )}
            </div>
          </Grid.Item>
        )}
      </Grid>
    </PageLayoutV1>
  );
};

export default OnlineUsersPage;
