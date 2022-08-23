import { Space, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import moment from 'moment';
import React, { useMemo } from 'react';
import { TestCase, TestCaseResult } from '../../../generated/tests/testCase';
import SVGIcons from '../../../utils/SvgUtils';
import { getTestResultBadgeIcon } from '../../../utils/TableUtils';
import { DataQualityTabProps } from '../profilerDashboard.interface';

const DataQualityTab: React.FC<DataQualityTabProps> = ({ testCases }) => {
  const columns: ColumnsType<TestCase> = useMemo(() => {
    return [
      {
        title: 'Last Run Result',
        dataIndex: 'testCaseResult',
        key: 'testCaseResult',
        render: (result: TestCaseResult) => (
          <Space size={8}>
            <SVGIcons
              alt="result"
              className="tw-w-4"
              icon={getTestResultBadgeIcon(result.testCaseStatus)}
            />
            <span>{result.testCaseStatus}</span>
          </Space>
        ),
      },
      {
        title: 'Last Run',
        dataIndex: 'testCaseResult',
        key: 'lastRun',
        render: (result: TestCaseResult) =>
          moment.unix(result.timestamp || 0).format('DD/MMM HH:mm'),
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
        render: () => <span>action</span>,
      },
    ];
  }, []);

  return (
    <Table
      columns={columns}
      dataSource={testCases}
      expandable={{
        rowExpandable: () => true,
        expandedRowRender: (recode) => recode.description,
      }}
      pagination={false}
      size="small"
    />
  );
};

export default DataQualityTab;
