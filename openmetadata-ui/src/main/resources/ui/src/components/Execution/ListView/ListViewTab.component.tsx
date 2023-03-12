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

import { Table } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PipelineStatus,
  StatusType,
} from '../../../generated/entity/data/pipeline';
import {
  getTableViewData,
  StatusIndicator,
} from '../../../utils/executionUtils';
import Loader from '../../Loader/Loader';

interface ListViewProps {
  executions: Array<PipelineStatus> | undefined;
  status: string;
  loading: boolean;
}

const ListView = ({ executions, status, loading }: ListViewProps) => {
  const { t } = useTranslation();

  const tableData = useMemo(
    () => getTableViewData(executions, status),
    [executions, status]
  );

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        render: (status: StatusType) => <StatusIndicator status={status} />,
      },
      {
        title: t('label.date-and-time'),
        dataIndex: 'timestamp',
        key: 'timestamp',
      },
    ],
    []
  );

  return (
    <Table
      bordered
      className="h-full"
      columns={columns}
      dataSource={tableData}
      loading={{ spinning: loading, indicator: <Loader /> }}
      pagination={false}
      rowKey="name"
    />
  );
};

export default ListView;
