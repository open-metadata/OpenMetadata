/*
 *  Copyright 2025 Collate.
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
import { Switch, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { INITIAL_PAGING_VALUE } from '../../../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_SERVICE_TAB_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../../constants/TableKeys.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useTableFilters } from '../../../../hooks/useTableFilters';
import { ServicePageData } from '../../../../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import { buildSchemaQueryFilter } from '../../../../utils/DatabaseSchemaDetailsUtils';
import {
  getColumnSorter,
  getEntityName,
  highlightSearchText,
} from '../../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { stringToHTML } from '../../../../utils/StringsUtils';
import {
  descriptionTableObject,
  tagTableObject,
} from '../../../../utils/TableColumn.util';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Table from '../../../common/Table/Table';
import { SpreadsheetsTableProps } from './SpreadsheetsTable.interface';

function SpreadsheetsTable({
  showDeleted,
  handleShowDeleted,
  paging,
  handlePageChange,
  spreadsheets,
  isLoading,
  setSpreadsheets,
  setIsLoading,
  serviceFqn,
}: Readonly<SpreadsheetsTableProps>) {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const { setFilters } = useTableFilters({});

  const searchValue = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData.spreadsheet as string | undefined;
  }, [location.search]);

  const searchSpreadsheets = useCallback(
    async (searchValue: string, pageNumber = INITIAL_PAGING_VALUE) => {
      setIsLoading(true);
      try {
        const response = await searchQuery({
          query: '',
          pageNumber,
          pageSize: paging.pageSize,
          queryFilter: buildSchemaQueryFilter(
            'service.fullyQualifiedName.keyword',
            serviceFqn,
            searchValue
          ),
          searchIndex: SearchIndex.SPREADSHEET_SEARCH_INDEX,
          includeDeleted: showDeleted,
          trackTotalHits: true,
        });
        const data = response.hits.hits.map(
          (spreadsheet) => spreadsheet._source
        );
        const total = response.hits.total.value;
        setSpreadsheets(data);
        paging.handlePagingChange({ total });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [serviceFqn, showDeleted, paging, setSpreadsheets, setIsLoading]
  );

  const onSpreadsheetSearch = useCallback(
    (value: string) => {
      setFilters({ spreadsheet: isEmpty(value) ? undefined : value });
      paging.handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
    },
    [setFilters, paging]
  );

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 300,
        sorter: getColumnSorter<ServicePageData, 'name'>('name'),
        render: (_, record: ServicePageData) => {
          const spreadsheetDisplayName = getEntityName(record);

          return (
            <div className="d-inline-flex w-max-90">
              <Link
                className="break-word"
                data-testid={`spreadsheet-${spreadsheetDisplayName}`}
                to={getEntityDetailsPath(
                  EntityType.SPREADSHEET,
                  record.fullyQualifiedName || ''
                )}>
                {stringToHTML(
                  highlightSearchText(spreadsheetDisplayName, searchValue)
                )}
              </Link>
            </div>
          );
        },
      },
      ...descriptionTableObject<ServicePageData>({ width: 400 }),
      ...tagTableObject<ServicePageData>(),
    ],
    [searchValue, t]
  );

  const handleShowDeletedChange = (checked: boolean) => {
    handleShowDeleted(checked);
    paging.handlePageChange(INITIAL_PAGING_VALUE, {
      cursorType: null,
      cursorValue: undefined,
    });
  };

  const searchProps = useMemo(
    () => ({
      placeholder: t('label.search-for-type', {
        type: t('label.spreadsheet'),
      }),
      typingInterval: 500,
      searchValue: searchValue,
      onSearch: onSpreadsheetSearch,
    }),
    [onSpreadsheetSearch, searchValue, t]
  );

  useEffect(() => {
    if (searchValue) {
      searchSpreadsheets(searchValue, paging.currentPage);
    }
  }, [searchValue, paging?.currentPage, showDeleted]);

  return (
    <Table
      columns={tableColumn}
      customPaginationProps={{
        currentPage: paging.currentPage,
        isLoading,
        pageSize: paging.pageSize,
        paging: paging.paging,
        isNumberBased: Boolean(searchValue),
        pagingHandler: handlePageChange,
        onShowSizeChange: paging.handlePageSizeChange,
        showPagination: paging.showPagination,
      }}
      data-testid="data-models-table"
      dataSource={spreadsheets}
      defaultVisibleColumns={DEFAULT_SERVICE_TAB_VISIBLE_COLUMNS}
      entityType="dashboardDataModelTable"
      extraTableFilters={
        <span>
          <Switch
            checked={showDeleted}
            data-testid="show-deleted"
            onClick={handleShowDeletedChange}
          />
          <Typography.Text className="m-l-xs">
            {t('label.deleted')}
          </Typography.Text>
        </span>
      }
      loading={isLoading}
      locale={{
        emptyText: <ErrorPlaceHolder className="m-y-md" />,
      }}
      pagination={false}
      rowKey="id"
      scroll={TABLE_SCROLL_VALUE}
      searchProps={searchProps}
      size="small"
      staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
    />
  );
}

export default SpreadsheetsTable;
