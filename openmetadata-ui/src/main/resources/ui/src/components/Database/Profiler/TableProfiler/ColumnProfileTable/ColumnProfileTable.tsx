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

import { Typography } from '@openmetadata/ui-core-components';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty, isUndefined } from 'lodash';
import Qs from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { PAGE_SIZE_LARGE } from '../../../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../../../../enums/entity.enum';
import {
  Column,
  ColumnProfile,
  Table as TableType,
} from '../../../../../generated/entity/data/table';
import { Operation } from '../../../../../generated/entity/policies/policy';
import { usePaging } from '../../../../../hooks/paging/usePaging';
import useCustomLocation from '../../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../../hooks/useFqn';
import {
  getTableColumnsByFQN,
  searchTableColumnsByFQN,
} from '../../../../../rest/tableAPI';
import {
  calculatePercentage,
  formatNumberWithComma,
  getTableFQNFromColumnFQN,
} from '../../../../../utils/CommonUtils';
import { getEntityName } from '../../../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../../../utils/RouterUtils';
import {
  getTableExpandableConfig,
  pruneEmptyChildren,
} from '../../../../../utils/TableUtils';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { PagingHandlerParams } from '../../../../common/NextPrevious/NextPrevious.interface';
import SummaryCardV1 from '../../../../common/SummaryCard/SummaryCardV1';
import Table from '../../../../common/Table/Table';
import { ProfilerTabPath } from '../../ProfilerDashboard/profilerDashboard.interface';
import NoProfilerBanner from '../NoProfilerBanner/NoProfilerBanner.component';
import SingleColumnProfile from '../SingleColumnProfile';
import { ModifiedColumn } from '../TableProfiler.interface';
import { useTableProfiler } from '../TableProfilerProvider';

const ColumnProfileTable = () => {
  const location = useCustomLocation();
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const { subTab: activeTab } = useParams<{ subTab: ProfilerTabPath }>();
  const tableFqn = useMemo(() => getTableFQNFromColumnFQN(fqn), [fqn]);
  const {
    isTestsLoading,
    isProfilerDataLoading,
    overallSummary,
    permissions,
    isProfilingEnabled,
    tableProfiler,
    testCaseSummary,
  } = useTableProfiler();

  const isLoading = isTestsLoading || isProfilerDataLoading;
  const [searchText, setSearchText] = useState<string>('');
  const [data, setData] = useState<ModifiedColumn[]>([]);
  const [isColumnsLoading, setIsColumnsLoading] = useState(false);
  const {
    currentPage,
    paging,
    pageSize,
    showPagination,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
  } = usePaging(PAGE_SIZE_LARGE);

  // SingleColumnProfile needs tableDetailsWithColumns to be passed as props
  const tableDetailsWithColumns = useMemo(
    () => ({ ...tableProfiler, columns: data as Column[] } as TableType),
    [tableProfiler, data]
  );

  const searchData = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeColumnFqn: string };
  }, [location.search]);

  const { activeColumnFqn } = searchData;

  const tableColumn: ColumnsType<ModifiedColumn> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 250,
        fixed: 'left',
        render: (_, record) => {
          return (
            <div
              className="d-inline-flex flex-column hover-icon-group"
              style={{ maxWidth: '75%' }}>
              <div className="d-inline-flex items-start gap-1 flex-column">
                <div className="d-inline-flex items-baseline">
                  <Link
                    className="break-word p-0 d-block text-link-color tw:font-medium hover:tw:underline"
                    to={{
                      pathname: getEntityDetailsPath(
                        EntityType.TABLE,
                        tableFqn,
                        EntityTabs.PROFILER,
                        activeTab
                      ),
                      search: Qs.stringify({
                        ...searchData,
                        activeColumnFqn: record.fullyQualifiedName || '',
                      }),
                    }}>
                    {getEntityName(record)}
                  </Link>
                </div>
              </div>
            </div>
          );
        },
        sorter: (col1, col2) => col1.name.localeCompare(col2.name),
      },
      {
        title: t('label.data-type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataType',
        width: 200,
        render: (dataTypeDisplay: string) => {
          return (
            <Typography>
              <span className="break-word">{dataTypeDisplay || 'N/A'}</span>
            </Typography>
          );
        },
        sorter: (col1, col2) => col1.dataType.localeCompare(col2.dataType),
      },
      {
        title: `${t('label.null')} %`,
        dataIndex: 'profile',
        key: 'nullProportion',
        width: 200,
        render: (profile: ColumnProfile) => {
          return profile?.nullProportion !== undefined &&
            profile?.nullProportion !== null
            ? calculatePercentage(profile.nullProportion, 1, 2, true)
            : '--';
        },
        sorter: (col1, col2) =>
          (col1.profile?.nullProportion || 0) -
          (col2.profile?.nullProportion || 0),
      },
      {
        title: `${t('label.unique')} %`,
        dataIndex: 'profile',
        key: 'uniqueProportion',
        width: 200,
        render: (profile: ColumnProfile) =>
          profile?.uniqueProportion !== undefined &&
          profile?.uniqueProportion !== null
            ? calculatePercentage(profile.uniqueProportion, 1, 2, true)
            : '--',
        sorter: (col1, col2) =>
          (col1.profile?.uniqueProportion || 0) -
          (col2.profile?.uniqueProportion || 0),
      },
      {
        title: `${t('label.distinct')} %`,
        dataIndex: 'profile',
        key: 'distinctProportion',
        width: 200,
        render: (profile: ColumnProfile) =>
          profile?.distinctProportion !== undefined &&
          profile?.distinctProportion !== null
            ? calculatePercentage(profile.distinctProportion, 1, 2, true)
            : '--',
        sorter: (col1, col2) =>
          (col1.profile?.distinctProportion || 0) -
          (col2.profile?.distinctProportion || 0),
      },
      {
        title: t('label.value-count'),
        dataIndex: 'profile',
        key: 'valuesCount',
        width: 200,
        render: (profile: ColumnProfile) =>
          profile?.valuesCount !== undefined && profile?.valuesCount !== null
            ? formatNumberWithComma(profile.valuesCount)
            : '--',
        sorter: (col1, col2) =>
          (col1.profile?.valuesCount || 0) - (col2.profile?.valuesCount || 0),
      },
      {
        title: t('label.success'),
        dataIndex: 'success',
        key: 'success',
        width: 110,
        render: (_, record) => {
          const testCounts =
            testCaseSummary?.[
              record.fullyQualifiedName?.toLocaleLowerCase() ?? ''
            ];

          if (isUndefined(testCounts?.success) || testCounts?.success === 0) {
            return '--';
          }

          return (
            <Link
              data-testid={`${record.name}-test-success-count`}
              to={getEntityDetailsPath(
                EntityType.TABLE,
                tableFqn,
                EntityTabs.PROFILER,
                ProfilerTabPath.DATA_QUALITY
              )}>
              <span className="tw:text-success-primary">
                {testCounts?.success}
              </span>
            </Link>
          );
        },
      },
      {
        title: t('label.failed'),
        dataIndex: 'failed',
        key: 'failed',
        width: 100,
        render: (_, record) => {
          const testCounts =
            testCaseSummary?.[
              record.fullyQualifiedName?.toLocaleLowerCase() ?? ''
            ];

          if (isUndefined(testCounts?.failed) || testCounts?.failed === 0) {
            return '--';
          }

          return (
            <Link
              data-testid={`${record.name}-test-failed-count`}
              to={getEntityDetailsPath(
                EntityType.TABLE,
                tableFqn,
                EntityTabs.PROFILER,
                ProfilerTabPath.DATA_QUALITY
              )}>
              <span className="tw:text-error-primary">
                {testCounts?.failed}
              </span>
            </Link>
          );
        },
      },
      {
        title: t('label.aborted'),
        dataIndex: 'aborted',
        key: 'aborted',
        width: 100,
        render: (_, record) => {
          const testCounts =
            testCaseSummary?.[
              record.fullyQualifiedName?.toLocaleLowerCase() ?? ''
            ];

          if (isUndefined(testCounts?.aborted) || testCounts?.aborted === 0) {
            return '--';
          }

          return (
            <Link
              data-testid={`${record.name}-test-aborted-count`}
              to={getEntityDetailsPath(
                EntityType.TABLE,
                tableFqn,
                EntityTabs.PROFILER,
                ProfilerTabPath.DATA_QUALITY
              )}>
              <span className="tw:text-warning-primary">
                {testCounts?.aborted}
              </span>
            </Link>
          );
        },
      },
    ];
  }, [testCaseSummary, searchData, tableFqn, activeTab]);

  const handleSearchAction = (searchText: string) => {
    setSearchText(searchText);
    handlePageChange(1);
  };

  const fetchTableColumnWithProfiler = useCallback(
    async (page: number, searchText: string) => {
      if (!tableFqn) {
        return;
      }

      setIsColumnsLoading(true);
      try {
        const offset = (page - 1) * pageSize;
        // Use search API if there's a search query, otherwise use regular pagination
        const response = searchText
          ? await searchTableColumnsByFQN(tableFqn, {
              q: searchText,
              limit: pageSize,
              offset: offset,
              fields: TabSpecificField.PROFILE,
            })
          : await getTableColumnsByFQN(tableFqn, {
              limit: pageSize,
              offset: offset,
              fields: TabSpecificField.PROFILE,
            });

        setData(pruneEmptyChildren(response.data) || []);
        handlePagingChange(response.paging);
      } catch {
        setData([]);
        handlePagingChange({
          offset: 1,
          total: 0,
        });
      } finally {
        setIsColumnsLoading(false);
      }
    },
    [tableFqn, pageSize, searchText]
  );

  const handleColumnProfilePageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      handlePageChange(currentPage);
    },
    [paging, fetchTableColumnWithProfiler, searchText]
  );

  useEffect(() => {
    if (tableFqn) {
      fetchTableColumnWithProfiler(currentPage, searchText);
    }
  }, [tableFqn, currentPage, searchText, pageSize]);

  const pagingProps = useMemo(() => {
    return {
      currentPage: currentPage,
      pageSize: pageSize,
      showPagination: showPagination,
      paging: paging,
      isLoading: isColumnsLoading,
      isNumberBased: !isEmpty(searchText),
      pagingHandler: handleColumnProfilePageChange,
      onShowSizeChange: handlePageSizeChange,
    };
  }, [currentPage, pageSize, showPagination, searchText, isColumnsLoading]);

  const searchProps = useMemo(() => {
    return {
      placeholder: t('message.find-in-table'),
      value: searchText,
      typingInterval: 500,
      onSearch: handleSearchAction,
    };
  }, [searchText, handleSearchAction]);

  if (permissions && !permissions?.ViewDataProfile) {
    return (
      <ErrorPlaceHolder
        permissionValue={Operation.ViewDataProfile}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-7.5"
      data-testid="column-profile-table-container">
      {!isLoading && !isProfilingEnabled && <NoProfilerBanner />}

      <div className="tw:grid tw:grid-cols-5 tw:gap-6">
        {overallSummary?.map((summary) => (
          <SummaryCardV1
            extra={summary.extra}
            icon={summary.icon}
            isLoading={isLoading}
            key={summary.title}
            title={summary.title}
            value={summary.value}
          />
        ))}
      </div>

      {isEmpty(activeColumnFqn) ? (
        <Table
          columns={tableColumn}
          customPaginationProps={pagingProps}
          dataSource={data}
          expandable={getTableExpandableConfig<Column>()}
          loading={isColumnsLoading || isLoading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          rowKey="fullyQualifiedName"
          scroll={{ x: true, y: 500 }}
          searchProps={searchProps}
        />
      ) : (
        <SingleColumnProfile
          activeColumnFqn={activeColumnFqn}
          tableDetails={tableDetailsWithColumns}
        />
      )}
    </div>
  );
};

export default ColumnProfileTable;
