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
import React, { FC, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PRIMERY_COLOR,
  SECONDARY_COLOR,
  SUCCESS_COLOR,
} from '../../../constants/constants';
import { Column, ColumnProfile } from '../../../generated/entity/data/table';
import { TestCaseStatus } from '../../../generated/tests/tableTest';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import { getCurrentDatasetTab } from '../../../utils/DatasetDetailsUtils';
import { getProfilerDashboardWithFqnPath } from '../../../utils/RouterUtils';
import Ellipses from '../../common/Ellipses/Ellipses';
import Searchbar from '../../common/searchbar/Searchbar';
import TestIndicator from '../../common/TestIndicator/TestIndicator';
import { ColumnProfileTableProps } from '../TableProfiler.interface';
import ProfilerProgressWidget from './ProfilerProgressWidget';

const ColumnProfileTable: FC<ColumnProfileTableProps> = ({
  onAddTestClick,
  columns = [],
}) => {
  const [searchText, setSearchText] = useState<string>('');
  const [data, setData] = useState<Column[]>(columns);
  // TODO:- Once column level test filter is implemented in test case API, remove this hardcoded value
  const testDetails = [
    {
      value: 0,
      type: TestCaseStatus.Success,
    },
    {
      value: 0,
      type: TestCaseStatus.Aborted,
    },
    {
      value: 0,
      type: TestCaseStatus.Failed,
    },
  ];
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
              value={profile.nullProportion || 0}
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
            value={profile.uniqueProportion || 0}
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
            value={profile.distinctProportion || 0}
          />
        ),
      },
      {
        title: 'Value Count',
        dataIndex: 'profile',
        key: 'valuesCount',
        render: (profile: ColumnProfile) =>
          formatNumberWithComma(profile.valuesCount || 0),
      },
      {
        title: 'Test',
        dataIndex: 'dataQualityTest',
        key: 'dataQualityTest',
        render: () => {
          return (
            <Space size={16}>
              {testDetails.map((test, i) => (
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
          <Button
            className="tw-border tw-border-primary tw-rounded tw-text-primary"
            size="small"
            onClick={() =>
              onAddTestClick(
                getCurrentDatasetTab('data-quality'),
                'column',
                record.name
              )
            }>
            Add Test
          </Button>
        ),
      },
    ];
  }, [columns]);

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
