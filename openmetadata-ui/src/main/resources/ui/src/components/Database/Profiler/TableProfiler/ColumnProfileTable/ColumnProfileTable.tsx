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

import { Table, Typography } from '@openmetadata/ui-core-components';
import { ChevronDown, ChevronRight } from '@untitledui/icons';
import { isEmpty, isNil, isUndefined } from 'lodash';
import Qs from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
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
import { getEntityName } from '../../../../../utils/EntityUtils';
import { getTableFQNFromColumnFQN } from '../../../../../utils/FqnUtils';
import {
  calculatePercentage,
  formatNumberWithComma,
} from '../../../../../utils/NumberUtils';
import { getEntityDetailsPath } from '../../../../../utils/RouterUtils';
import { pruneEmptyChildren } from '../../../../../utils/TableUtils';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import NextPrevious from '../../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../../../common/SearchBarComponent/SearchBar.component';
import SummaryCardV1 from '../../../../common/SummaryCard/SummaryCardV1';
import { ProfilerTabPath } from '../../ProfilerDashboard/profilerDashboard.interface';
import NoProfilerBanner from '../NoProfilerBanner/NoProfilerBanner.component';
import SingleColumnProfile from '../SingleColumnProfile';
import { ModifiedColumn } from '../TableProfiler.interface';
import { useTableProfiler } from '../TableProfilerProvider';

interface FlatRow {
  id: string;
  record: ModifiedColumn;
  depth: number;
  hasChildren: boolean;
}

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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [sortDescriptor, setSortDescriptor] = useState<
    SortDescriptor | undefined
  >(undefined);
  const {
    currentPage,
    paging,
    pageSize,
    showPagination,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
  } = usePaging(PAGE_SIZE_LARGE);

  const tableDetailsWithColumns = useMemo(
    () => ({ ...tableProfiler, columns: data as Column[] } as TableType),
    [tableProfiler, data]
  );

  const searchData = useMemo(() => {
    const param = location.search;
    const parsed = Qs.parse(param.startsWith('?') ? param.substring(1) : param);

    return parsed as { activeColumnFqn: string };
  }, [location.search]);

  const { activeColumnFqn } = searchData;

  const columnList = useMemo(
    () => [
      { id: 'name', name: t('label.name'), allowsSorting: true },
      { id: 'dataType', name: t('label.data-type'), allowsSorting: true },
      {
        id: 'nullProportion',
        name: `${t('label.null')} %`,
        allowsSorting: true,
      },
      {
        id: 'uniqueProportion',
        name: `${t('label.unique')} %`,
        allowsSorting: true,
      },
      {
        id: 'distinctProportion',
        name: `${t('label.distinct')} %`,
        allowsSorting: true,
      },
      { id: 'valuesCount', name: t('label.value-count'), allowsSorting: true },
      { id: 'success', name: t('label.success') },
      { id: 'failed', name: t('label.failed') },
      { id: 'aborted', name: t('label.aborted') },
    ],
    [t]
  );

  const sortedData = useMemo((): ModifiedColumn[] => {
    if (!sortDescriptor?.column) {
      return data;
    }

    const sorted = [...data].sort((a, b) => {
      switch (sortDescriptor.column) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'dataType':
          return a.dataType.localeCompare(b.dataType);
        case 'nullProportion':
          return (
            (a.profile?.nullProportion || 0) - (b.profile?.nullProportion || 0)
          );
        case 'uniqueProportion':
          return (
            (a.profile?.uniqueProportion || 0) -
            (b.profile?.uniqueProportion || 0)
          );
        case 'distinctProportion':
          return (
            (a.profile?.distinctProportion || 0) -
            (b.profile?.distinctProportion || 0)
          );
        case 'valuesCount':
          return (a.profile?.valuesCount || 0) - (b.profile?.valuesCount || 0);
        default:
          return 0;
      }
    });

    return sortDescriptor?.direction === 'descending'
      ? sorted.reverse()
      : sorted;
  }, [data, sortDescriptor]);

  const flatRows = useMemo((): FlatRow[] => {
    const result: FlatRow[] = [];

    const addRows = (rows: ModifiedColumn[], depth: number) => {
      rows.forEach((row) => {
        const children = pruneEmptyChildren(
          (row.children as Column[]) ?? []
        ) as ModifiedColumn[];
        const hasChildren = children.length > 0;

        result.push({
          id: row.fullyQualifiedName ?? row.name,
          record: row,
          depth,
          hasChildren,
        });

        if (hasChildren && expandedKeys.has(row.fullyQualifiedName ?? '')) {
          addRows(children, depth + 1);
        }
      });
    };

    addRows(sortedData, 0);

    return result;
  }, [sortedData, expandedKeys]);

  const handleToggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }, []);

  const handleSearchAction = (value: string) => {
    setSearchText(value);
    handlePageChange(1);
  };

  const fetchTableColumnWithProfiler = useCallback(
    async (page: number, search: string) => {
      if (!tableFqn) {
        return;
      }

      setIsColumnsLoading(true);
      try {
        const offset = (page - 1) * pageSize;
        const response = search
          ? await searchTableColumnsByFQN(tableFqn, {
              q: search,
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

  const renderRow = (
    id: string,
    record: ModifiedColumn,
    depth: number,
    hasChildren: boolean
  ) => {
    const rowKey = id;
    const isExpanded = expandedKeys.has(rowKey);
    const testCounts =
      testCaseSummary?.[record.fullyQualifiedName?.toLocaleLowerCase() ?? ''];

    return (
      <Table.Row data-row-key={rowKey} id={rowKey} key={rowKey}>
        <Table.Cell
          className="tw:w-62.5"
          style={{ paddingLeft: `${16 + depth * 12}px` }}>
          <div
            className="d-inline-flex flex-column hover-icon-group"
            style={{ maxWidth: '75%' }}>
            <div className="d-inline-flex items-start gap-1 flex-column">
              <div className="d-inline-flex items-baseline tw:gap-1">
                {hasChildren ? (
                  <button
                    aria-expanded={isExpanded}
                    className="tw:p-0 tw:bg-transparent tw:border-0 tw:cursor-pointer tw:inline-flex"
                    data-testid="expand-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleExpand(rowKey);
                    }}>
                    {isExpanded ? (
                      <ChevronDown className="tw:size-4" />
                    ) : (
                      <ChevronRight className="tw:size-4" />
                    )}
                  </button>
                ) : (
                  <span className="tw:inline-block tw:w-4" />
                )}
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
        </Table.Cell>

        <Table.Cell className="tw:w-50">
          <Typography>
            <span className="break-word">
              {record.dataTypeDisplay || t('label.n-a')}
            </span>
          </Typography>
        </Table.Cell>

        <Table.Cell className="tw:w-50">
          {!isNil(record.profile?.nullProportion)
            ? calculatePercentage(record.profile!.nullProportion, 1, 2, true)
            : '--'}
        </Table.Cell>

        <Table.Cell className="tw:w-50">
          {!isNil(record.profile?.uniqueProportion)
            ? calculatePercentage(record.profile!.uniqueProportion, 1, 2, true)
            : '--'}
        </Table.Cell>

        <Table.Cell className="tw:w-50">
          {!isNil(record.profile?.distinctProportion)
            ? calculatePercentage(
                record.profile!.distinctProportion,
                1,
                2,
                true
              )
            : '--'}
        </Table.Cell>

        <Table.Cell className="tw:w-50">
          {record.profile?.valuesCount !== undefined &&
          record.profile?.valuesCount !== null
            ? formatNumberWithComma(record.profile.valuesCount)
            : '--'}
        </Table.Cell>

        <Table.Cell className="tw:w-27.5">
          {isUndefined(testCounts?.success) || testCounts?.success === 0 ? (
            '--'
          ) : (
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
          )}
        </Table.Cell>

        <Table.Cell className="tw:w-25">
          {isUndefined(testCounts?.failed) || testCounts?.failed === 0 ? (
            '--'
          ) : (
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
          )}
        </Table.Cell>

        <Table.Cell className="tw:w-25">
          {isUndefined(testCounts?.aborted) || testCounts?.aborted === 0 ? (
            '--'
          ) : (
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
          )}
        </Table.Cell>
      </Table.Row>
    );
  };

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
        <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:ring-1 tw:ring-secondary tw:overflow-hidden">
          <div className="p-x-md p-y-md">
            <Searchbar
              removeMargin
              placeholder={t('message.find-in-table')}
              searchValue={searchText}
              typingInterval={500}
              onSearch={handleSearchAction}
            />
          </div>

          <div className="tw:overflow-x-auto">
            <Table
              aria-label={t('label.column-plural')}
              containerStyle={{ maxHeight: 500, overflowY: 'auto' }}
              data-testid="column-profile-table"
              sortDescriptor={sortDescriptor}
              onSortChange={setSortDescriptor}>
              <Table.Header columns={columnList}>
                {(col) => (
                  <Table.Head
                    allowsSorting={col.allowsSorting}
                    id={col.id}
                    key={col.id}
                    label={col.name}
                  />
                )}
              </Table.Header>
              <Table.Body
                items={isColumnsLoading || isLoading ? [] : flatRows}
                renderEmptyState={() =>
                  isColumnsLoading || isLoading ? null : (
                    <FilterTablePlaceHolder />
                  )
                }>
                {({ id, record, depth, hasChildren }) =>
                  renderRow(id, record, depth, hasChildren)
                }
              </Table.Body>
            </Table>
          </div>

          {showPagination && (
            <NextPrevious
              currentPage={currentPage}
              isLoading={isColumnsLoading}
              isNumberBased={!isEmpty(searchText)}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handleColumnProfilePageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          )}
        </div>
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
