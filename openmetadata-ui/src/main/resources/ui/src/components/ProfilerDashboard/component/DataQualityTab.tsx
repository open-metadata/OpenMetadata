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

import { Button, Space, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined } from 'lodash';
import moment from 'moment';
import React, { useMemo, useState } from 'react';
import { TestCase, TestCaseResult } from '../../../generated/tests/testCase';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { getTestResultBadgeIcon } from '../../../utils/TableUtils';
import DeleteWidgetModal from '../../common/DeleteWidget/DeleteWidgetModal';
import { DataQualityTabProps } from '../profilerDashboard.interface';
import TestSummary from './TestSummary';

const DataQualityTab: React.FC<DataQualityTabProps> = ({ testCases }) => {
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase>();
  const columns: ColumnsType<TestCase> = useMemo(() => {
    return [
      {
        title: 'Last Run Result',
        dataIndex: 'testCaseResult',
        key: 'testCaseResult',
        render: (result: TestCaseResult) => (
          <Space size={8}>
            {result?.testCaseStatus && (
              <SVGIcons
                alt="result"
                className="tw-w-4"
                icon={getTestResultBadgeIcon(result.testCaseStatus)}
              />
            )}
            <span>{result?.testCaseStatus || '--'}</span>
          </Space>
        ),
      },
      {
        title: 'Last Run',
        dataIndex: 'testCaseResult',
        key: 'lastRun',
        render: (result: TestCaseResult) =>
          result?.timestamp
            ? moment.unix(result.timestamp || 0).format('DD/MMM HH:mm')
            : '--',
      },
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        key: 'actions',
        render: (_, record) => (
          <Space>
            <Tooltip placement="bottom" title="Delete">
              <Button
                icon={
                  <SVGIcons
                    alt="Delete"
                    className="tw-w-4"
                    icon={Icons.DELETE}
                  />
                }
                type="text"
                onClick={() => {
                  setSelectedTestCase(record);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];
  }, []);

  return (
    <>
      <Table
        columns={columns}
        dataSource={testCases.map((test) => ({ ...test, key: test.name }))}
        expandable={{
          rowExpandable: () => true,
          expandedRowRender: (recode) => <TestSummary data={recode} />,
        }}
        pagination={false}
        size="small"
      />

      <DeleteWidgetModal
        entityId={selectedTestCase?.id || ''}
        entityName={selectedTestCase?.name || ''}
        entityType="testCase"
        prepareType={false}
        visible={!isUndefined(selectedTestCase)}
        onCancel={() => {
          setSelectedTestCase(undefined);
        }}
      />
    </>
  );
};

export default DataQualityTab;
