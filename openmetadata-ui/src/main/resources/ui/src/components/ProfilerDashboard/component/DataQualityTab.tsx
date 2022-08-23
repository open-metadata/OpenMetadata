import { Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import moment from 'moment';
import React, { useMemo } from 'react';
import { TestCase, TestCaseResult } from '../../../generated/tests/testCase';
import { DataQualityTabProps } from '../profilerDashboard.interface';

const DataQualityTab: React.FC<DataQualityTabProps> = ({ testCases }) => {
  const columns: ColumnsType<TestCase> = useMemo(() => {
    return [
      {
        title: 'Last Run Result',
        dataIndex: 'testCaseResult',
        key: 'testCaseResult',
        render: (result: TestCaseResult) => result.testCaseStatus,
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
      pagination={false}
      size="small"
    />
  );
};

export default DataQualityTab;
