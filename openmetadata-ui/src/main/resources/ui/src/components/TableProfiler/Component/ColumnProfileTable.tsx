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

import { Button, Space, Table, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  NO_DATA_PLACEHOLDER,
  PRIMERY_COLOR,
  SECONDARY_COLOR,
  SUCCESS_COLOR,
} from '../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import {
  DEFAULT_TEST_VALUE,
  INITIAL_TEST_RESULT_SUMMARY,
} from '../../../constants/profiler.constant';
import { ProfilerDashboardType } from '../../../enums/table.enum';
import { ColumnProfile } from '../../../generated/entity/data/table';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import { updateTestResults } from '../../../utils/DataQualityAndProfilerUtils';
import {
  getAddDataQualityTableTestPath,
  getProfilerDashboardWithFqnPath,
} from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import Searchbar from '../../common/searchbar/Searchbar';
import TestIndicator from '../../common/TestIndicator/TestIndicator';
import { ProfilerDashboardTab } from '../../ProfilerDashboard/profilerDashboard.interface';
import {
  ColumnProfileTableProps,
  columnTestResultType,
  ModifiedColumn,
} from '../TableProfiler.interface';
import ProfilerProgressWidget from './ProfilerProgressWidget';

const ColumnProfileTable: FC<ColumnProfileTableProps> = ({
  columnTests,
  hasEditAccess,
  columns = [],
}) => {
  const [searchText, setSearchText] = useState<string>('');
  const [data, setData] = useState<ModifiedColumn[]>(columns);
  const [columnTestSummary, setColumnTestSummary] =
    useState<columnTestResultType>();

  const tableColumn: ColumnsType<ModifiedColumn> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: 250,
        fixed: 'left',
        render: (name: string, record) => {
          return (
            <Link
              className="break-word"
              to={getProfilerDashboardWithFqnPath(
                ProfilerDashboardType.COLUMN,
                record.fullyQualifiedName || ''
              )}>
              {name}
            </Link>
          );
        },
        sorter: (col1, col2) => col1.name.localeCompare(col2.name),
      },
      {
        title: 'Data Type',
        dataIndex: 'dataTypeDisplay',
        key: 'dataType',
        width: 250,
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
        sorter: (col1, col2) =>
          (col1.profile?.nullProportion || 0) -
          (col2.profile?.nullProportion || 0),
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
        sorter: (col1, col2) =>
          (col1.profile?.uniqueProportion || 0) -
          (col2.profile?.uniqueProportion || 0),
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
        sorter: (col1, col2) =>
          (col1.profile?.distinctProportion || 0) -
          (col2.profile?.distinctProportion || 0),
      },
      {
        title: 'Value Count',
        dataIndex: 'profile',
        key: 'valuesCount',
        width: 120,
        render: (profile: ColumnProfile) =>
          formatNumberWithComma(profile?.valuesCount || 0),
        sorter: (col1, col2) =>
          (col1.profile?.valuesCount || 0) - (col2.profile?.valuesCount || 0),
      },
      {
        title: 'Tests',
        dataIndex: 'testCount',
        key: 'Tests',
        render: (_, record) => (
          <Link
            data-testid={`${record.name}-test-count`}
            to={getProfilerDashboardWithFqnPath(
              ProfilerDashboardType.COLUMN,
              record.fullyQualifiedName || '',
              ProfilerDashboardTab.DATA_QUALITY
            )}>
            {record.testCount || 0}
          </Link>
        ),
        sorter: (col1, col2) => (col1.testCount || 0) - (col2.testCount || 0),
      },
      {
        title: 'Status',
        dataIndex: 'dataQualityTest',
        key: 'dataQualityTest',
        width: 120,
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
      {
        title: 'Actions',
        dataIndex: 'actions',
        key: 'actions',
        render: (_, record) => (
          <Tooltip
            placement="bottom"
            title={hasEditAccess ? 'Add Test' : NO_PERMISSION_FOR_ACTION}>
            <Link
              to={getAddDataQualityTableTestPath(
                ProfilerDashboardType.COLUMN,
                record.fullyQualifiedName || ''
              )}>
              <Button
                className="flex-center"
                data-testid={`add-test-${record.name}`}
                disabled={!hasEditAccess}
                icon={
                  <SVGIcons
                    alt="add test"
                    className="tw-h-4"
                    icon={Icons.ADD_TEST}
                  />
                }
                type="link"
              />
            </Link>
          </Tooltip>
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
      <div className="tw-w-2/6">
        <Searchbar
          placeholder="Find in table..."
          searchValue={searchText}
          typingInterval={500}
          onSearch={handleSearchAction}
        />
      </div>
      <Table
        bordered
        columns={tableColumn}
        dataSource={data}
        pagination={false}
        scroll={{ x: 1500 }}
        size="small"
      />
    </div>
  );
};

export default ColumnProfileTable;
