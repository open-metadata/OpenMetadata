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

import { Button, Space, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty, isUndefined } from 'lodash';
import Qs from 'qs';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation } from 'react-router-dom';
import FilterTablePlaceHolder from '../../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import Table from '../../../components/common/Table/Table';
import { TableProfilerTab } from '../../../components/ProfilerDashboard/profilerDashboard.interface';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  DEFAULT_TEST_VALUE,
  INITIAL_TEST_RESULT_SUMMARY,
} from '../../../constants/profiler.constant';
import { Column, ColumnProfile } from '../../../generated/entity/data/table';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import { updateTestResults } from '../../../utils/DataQualityAndProfilerUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import { getTableExpandableConfig } from '../../../utils/TableUtils';
import Searchbar from '../../common/SearchBar/Searchbar';
import TestIndicator from '../../common/TestIndicator/TestIndicator';
import {
  ColumnProfileTableProps,
  columnTestResultType,
  ModifiedColumn,
} from '../TableProfiler.interface';
import ProfilerProgressWidget from './ProfilerProgressWidget';
import SingleColumnProfile from './SingleColumnProfile';

const ColumnProfileTable: FC<ColumnProfileTableProps> = ({
  columnTests,
  columns = [],
  dateRangeObject,
  isLoading,
}) => {
  const location = useLocation();
  const { t } = useTranslation();
  const history = useHistory();

  const [searchText, setSearchText] = useState<string>('');
  const [data, setData] = useState<ModifiedColumn[]>(columns);
  const [columnTestSummary, setColumnTestSummary] =
    useState<columnTestResultType>();

  const { activeColumnFqn, activeTab } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeColumnFqn: string; activeTab: string };
  }, [location.search]);

  const updateActiveColumnFqn = (key: string) =>
    history.push({ search: Qs.stringify({ activeColumnFqn: key, activeTab }) });

  const tableColumn: ColumnsType<ModifiedColumn> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 250,
        fixed: 'left',
        render: (name: string, record) => {
          return (
            <Button
              className="break-word p-0"
              type="link"
              onClick={() =>
                updateActiveColumnFqn(record.fullyQualifiedName || '')
              }>
              {name}
            </Button>
          );
        },
        sorter: (col1, col2) => col1.name.localeCompare(col2.name),
      },
      {
        title: t('label.data-type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataType',
        width: 150,
        render: (dataTypeDisplay: string) => {
          return (
            <Typography.Text className="break-word">
              {dataTypeDisplay || 'N/A'}
            </Typography.Text>
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
          return (
            <ProfilerProgressWidget
              strokeColor="#351b8e"
              value={profile?.nullProportion || 0}
            />
          );
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
        render: (profile: ColumnProfile) => (
          <ProfilerProgressWidget
            strokeColor="#7147e8"
            value={profile?.uniqueProportion || 0}
          />
        ),
        sorter: (col1, col2) =>
          (col1.profile?.uniqueProportion || 0) -
          (col2.profile?.uniqueProportion || 0),
      },
      {
        title: `${t('label.distinct')} %`,
        dataIndex: 'profile',
        key: 'distinctProportion',
        width: 200,
        render: (profile: ColumnProfile) => (
          <ProfilerProgressWidget
            strokeColor="#4E8B9C"
            value={profile?.distinctProportion || 0}
          />
        ),
        sorter: (col1, col2) =>
          (col1.profile?.distinctProportion || 0) -
          (col2.profile?.distinctProportion || 0),
      },
      {
        title: t('label.value-count'),
        dataIndex: 'profile',
        key: 'valuesCount',
        width: 120,
        render: (profile: ColumnProfile) =>
          formatNumberWithComma(profile?.valuesCount || 0),
        sorter: (col1, col2) =>
          (col1.profile?.valuesCount || 0) - (col2.profile?.valuesCount || 0),
      },
      {
        title: t('label.test-plural'),
        dataIndex: 'testCount',
        key: 'Tests',
        render: (_, record) => (
          <Link
            data-testid={`${record.name}-test-count`}
            to={{
              search: Qs.stringify({
                activeTab: TableProfilerTab.DATA_QUALITY,
              }),
            }}>
            {record.testCount ?? 0}
          </Link>
        ),
        sorter: (col1, col2) => (col1.testCount ?? 0) - (col2.testCount ?? 0),
      },
      {
        title: t('label.status'),
        dataIndex: 'dataQualityTest',
        key: 'dataQualityTest',
        render: (_, record) => {
          const summary =
            columnTestSummary?.[
              getEncodedFqn(record.fullyQualifiedName || '', true)
            ]?.results;
          const currentResult = summary
            ? Object.entries(summary).map(([key, value]) => ({
                value,
                type: key,
              }))
            : DEFAULT_TEST_VALUE;

          const hasStatus = currentResult.some(({ value }) => value !== 0);

          return hasStatus ? (
            <Space size={16}>
              {currentResult.map((test, i) => (
                <TestIndicator key={i} type={test.type} value={test.value} />
              ))}
            </Space>
          ) : (
            <Typography.Text> {NO_DATA_PLACEHOLDER} </Typography.Text>
          );
        },
      },
    ];
  }, [columns, columnTestSummary]);

  const handleSearchAction = (searchText: string) => {
    setSearchText(searchText);
    if (searchText) {
      setData(columns.filter((col) => col.name?.includes(searchText)));
    } else {
      setData(columns);
    }
  };

  useEffect(() => {
    if (columnTests.length) {
      const colResult = columnTests.reduce((acc, curr) => {
        const fqn = curr.entityFQN || '';
        if (isUndefined(acc[fqn])) {
          acc[fqn] = { results: { ...INITIAL_TEST_RESULT_SUMMARY }, count: 0 };
        }
        updateTestResults(
          acc[fqn].results,
          curr.testCaseResult?.testCaseStatus || ''
        );
        acc[fqn].count += 1;

        return acc;
      }, {} as columnTestResultType);
      setData(
        columns.map((col) => ({
          ...col,
          testCount:
            colResult?.[getEncodedFqn(col.fullyQualifiedName || '', true)]
              ?.count,
        }))
      );
      setColumnTestSummary(colResult);
    } else {
      setData(columns);
    }
  }, [columnTests, columns]);

  return (
    <div data-testid="column-profile-table-container">
      {isEmpty(activeColumnFqn) ? (
        <>
          <div className="w-max-400">
            <Searchbar
              placeholder={t('message.find-in-table')}
              searchValue={searchText}
              typingInterval={500}
              onSearch={handleSearchAction}
            />
          </div>

          <Table
            bordered
            columns={tableColumn}
            dataSource={data}
            expandable={getTableExpandableConfig<Column>()}
            loading={isLoading}
            locale={{
              emptyText: <FilterTablePlaceHolder />,
            }}
            pagination={false}
            rowKey="name"
            scroll={{ x: true }}
            size="small"
          />
        </>
      ) : (
        <SingleColumnProfile
          activeColumnFqn={activeColumnFqn}
          dateRangeObject={dateRangeObject}
        />
      )}
    </div>
  );
};

export default ColumnProfileTable;
