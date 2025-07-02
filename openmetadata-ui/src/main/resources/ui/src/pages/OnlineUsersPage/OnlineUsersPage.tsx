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

import { Col, Row, Select, Space, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import moment from 'moment';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import Table from '../../components/common/Table/Table';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { User } from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import { usePaging } from '../../hooks/paging/usePaging';
import { searchData } from '../../rest/miscAPI';
import { getOnlineUsers, OnlineUsersQueryParams } from '../../rest/userAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
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
  } = usePaging(PAGE_SIZE_MEDIUM);

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
    { value: 5, label: t('label.last-n-minutes', { n: 5 }) },
    { value: 60, label: t('label.last-hour') },
    { value: 1440, label: t('label.last-24-hours') },
    { value: 10080, label: t('label.last-7-days') },
    { value: 43200, label: t('label.last-30-days') },
    { value: 0, label: t('label.all-time') },
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
        // For search, we still need to use searchData API and filter client-side
        // as the online users endpoint doesn't support search yet
        const res = await searchData(
          value,
          currentPage,
          pageSize,
          'isBot:false',
          '',
          '',
          SearchIndex.USER,
          false
        );
        const data = res.data.hits.hits.map(({ _source }) => _source);

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

    // Filter out the 'name' column - we only need username
    const filteredColumns = baseColumns.filter((col) => col.key !== 'name');

    // Add Last Activity Time column
    const lastActivityColumn = {
      title: t('label.last-activity'),
      dataIndex: 'lastActivityTime',
      key: 'lastActivityTime',
      render: (lastActivityTime: number, record: User) => {
        // Use lastActivityTime if available, otherwise fall back to lastLoginTime
        const activityTime = lastActivityTime || record.lastLoginTime;

        if (!activityTime) {
          return (
            <Typography.Text type="secondary">
              {t('label.never')}
            </Typography.Text>
          );
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
          <Space direction="vertical" size={0}>
            <Typography.Text style={{ color: statusColor }}>
              {statusText}
            </Typography.Text>
            <Typography.Text style={{ fontSize: '12px' }} type="secondary">
              {formatDateTime(activityTime)}
            </Typography.Text>
          </Space>
        );
      },
    };

    // Insert the last activity column after the username column
    return [
      ...filteredColumns.slice(0, 1),
      lastActivityColumn,
      ...filteredColumns.slice(1),
    ];
  }, [isDataLoading, t]);

  if (!isAdminUser) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.online-user-plural')}>
      <Row data-testid="online-users-page" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>

        <Col span={24}>
          <PageHeader data={PAGE_HEADERS.ONLINE_USERS} />
        </Col>

        <Col span={24}>
          <Table
            bordered
            className="user-list-table"
            columns={columns}
            data-testid="online-users-table"
            dataSource={userList}
            extraTableFilters={
              <Space>
                <Typography.Text>{t('label.time-window')}:</Typography.Text>
                <Select
                  data-testid="time-window-select"
                  options={TIME_WINDOWS}
                  size="small"
                  style={{ width: 180 }}
                  value={timeWindow}
                  onChange={setTimeWindow}
                />
              </Space>
            }
            loading={isDataLoading}
            locale={{
              emptyText: (
                <FilterTablePlaceHolder
                  placeholderText={
                    searchValue
                      ? t('message.no-entity-found-for-query', {
                          entity: t('label.user-lowercase'),
                          query: searchValue,
                        })
                      : t('message.no-online-users-found')
                  }
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            searchProps={{
              placeholder: `${t('label.search-for-type', {
                type: t('label.user'),
              })}...`,
              value: searchValue,
              typingInterval: 400,
              onSearch: handleSearch,
            }}
            size="small"
          />
        </Col>

        {showPagination && (
          <Col span={24}>
            <div className="w-full flex justify-center">
              {paging && (
                <div data-testid="pagination">
                  {/* Add pagination component here if needed */}
                </div>
              )}
            </div>
          </Col>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default OnlineUsersPage;
