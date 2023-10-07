/*
 *  Copyright 2023 Collate.
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
import { Space, Tooltip } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import './last-run-graph.style.less';

export const StatusBox = ({ status }: { status?: string }) => {
  return <div className={classNames('last-run-box', status)} />;
};

export const LastRunGraph = () => {
  const data = [
    {
      status: TestCaseStatus.Success,
      percent: 100,
    },
    {
      status: TestCaseStatus.Aborted,
      percent: 0,
    },
    {
      status: TestCaseStatus.Failed,
      percent: 0,
    },
    {
      status: TestCaseStatus.Success,
      percent: 80,
    },
    {
      status: TestCaseStatus.Success,
      percent: 100,
    },
    {
      status: TestCaseStatus.Failed,
      percent: 0,
    },
    {
      status: TestCaseStatus.Success,
      percent: 100,
    },
  ];

  return (
    <Space className="last-run-container" size={8}>
      {data.map((value, i) => (
        <Tooltip
          key={i}
          placement="bottom"
          title={`2 ${value.status} on, 13th June 2023`}>
          <div>
            <StatusBox status={value.status.toLocaleLowerCase()} />
          </div>
        </Tooltip>
      ))}
    </Space>
  );
};
