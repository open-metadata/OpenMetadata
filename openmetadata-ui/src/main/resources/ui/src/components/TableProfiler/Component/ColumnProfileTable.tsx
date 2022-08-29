/*
 *  Copyright 2022 Collate
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

import { Button, Space, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PRIMERY_COLOR,
  SECONDARY_COLOR,
  SUCCESS_COLOR,
} from '../../../constants/constants';
import {
  DEFAULT_TEST_VALUE,
  INITIAL_TEST_RESULT_SUMMARY,
} from '../../../constants/profiler.constant';
import { ProfilerDashboardType } from '../../../enums/table.enum';
import { Column, ColumnProfile } from '../../../generated/entity/data/table';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import { updateTestResults } from '../../../utils/DataQualityAndProfilerUtils';
import {
  getAddDataQualityTableTestPath,
  getProfilerDashboardWithFqnPath,
} from '../../../utils/RouterUtils';
import Ellipses from '../../common/Ellipses/Ellipses';
import Searchbar from '../../common/searchbar/Searchbar';
import TestIndicator from '../../common/TestIndicator/TestIndicator';
import {
  ColumnProfileTableProps,
  columnTestResultType,
} from '../TableProfiler.interface';
import ProfilerProgressWidget from './ProfilerProgressWidget';

const ColumnProfileTable: FC<ColumnProfileTableProps> = ({
  columnTests,
  columns = [],
}) => {
  const [searchText, setSearchText] = useState<string>('');
  const [data, setData] = useState<Column[]>(columns);
  const [columnTestSummary, setColumnTestSummary] =
    useState<columnTestResultType>();

  const tableColumn: ColumnsType<Column> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record) => {
          return (
            <Link
              to={getProfilerDashboardWithFqnPath(
                ProfilerDashboardType.COLUMN,
                record.fullyQualifiedName || ''
              )}>
              {name}
            </Link>
          );
        },
      },
      {
        title: 'Data Type',
        dataIndex: 'dataTypeDisplay',
        key: 'dataType',
        render: (dataTypeDisplay: string) => {
          return (
            <Ellipses tooltip className="tw-w-24">
              {dataTypeDisplay || 'N/A'}
            </Ellipses>
          );
        },
      },
      {
        title: 'Null %',
        dataIndex: 'profile',
        key: 'nullProportion',
        width: 200,
        render: (profile: ColumnProfile) => {
          return (
            <ProfilerProgressWidget
              strokeColor={PRIMERY_COLOR}
              value={profile?.nullProportion || 0}
            />
          );
        },
      },
      {
        title: 'Unique %',
        dataIndex: 'profile',
        key: 'uniqueProportion',
        width: 200,
        render: (profile: ColumnProfile) => (
          <ProfilerProgressWidget
            strokeColor={SECONDARY_COLOR}
            value={profile?.uniqueProportion || 0}
          />
        ),
      },
      {
        title: 'Distinct %',
        dataIndex: 'profile',
        key: 'distinctProportion',
        width: 200,
        render: (profile: ColumnProfile) => (
          <ProfilerProgressWidget
            strokeColor={SUCCESS_COLOR}
            value={profile?.distinctProportion || 0}
          />
        ),
      },
      {
        title: 'Value Count',
        dataIndex: 'profile',
        key: 'valuesCount',
        render: (profile: ColumnProfile) =>
          formatNumberWithComma(profile?.valuesCount || 0),
      },
      {
        title: 'Test',
        dataIndex: 'dataQualityTest',
        key: 'dataQualityTest',
        render: (_, record) => {
          const summary = columnTestSummary?.[record.fullyQualifiedName || ''];
          const currentResult = summary
            ? Object.entries(summary).map(([key, value]) => ({
                value,
                type: key,
              }))
            : DEFAULT_TEST_VALUE;

          return (
            <Space size={16}>
              {currentResult.map((test, i) => (
                <TestIndicator key={i} type={test.type} value={test.value} />
              ))}
            </Space>
          );
        },
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        key: 'actions',
        render: (_, record) => (
          <Link
            to={getAddDataQualityTableTestPath(
              ProfilerDashboardType.COLUMN,
              record.fullyQualifiedName || ''
            )}>
            <Button
              className="tw-border tw-border-primary tw-rounded tw-text-primary"
              size="small">
              Add Test
            </Button>
          </Link>
        ),
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
    setData(columns);
  }, [columns]);

  useEffect(() => {
    if (columnTests.length) {
      const colResult = columnTests.reduce((acc, curr) => {
        const fqn = curr.entityFQN || '';
        if (isUndefined(acc[fqn])) {
          acc[fqn] = { ...INITIAL_TEST_RESULT_SUMMARY };
        }
        updateTestResults(acc[fqn], curr.testCaseResult?.testCaseStatus || '');

        return acc;
      }, {} as columnTestResultType);
      setColumnTestSummary(colResult);
    }
  }, [columnTests]);

  return (
    <div data-testid="column-profile-table-container">
      <div className="tw-w-2/6">
        <Searchbar
          placeholder="Find in table..."
          searchValue={searchText}
          typingInterval={500}
          onSearch={handleSearchAction}
        />
      </div>
      <Table
        columns={tableColumn}
        dataSource={data}
        pagination={false}
        size="small"
      />
    </div>
  );
};

export default ColumnProfileTable;
