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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Col, Row, Space, Tooltip } from 'antd';
import { DataNode } from 'antd/lib/tree';
import { groupBy, isUndefined, map, toLower } from 'lodash';
import React, { ReactNode } from 'react';
import { MenuOptions } from '../constants/execution.constants';
import {
  PipelineStatus,
  StatusType,
  Task,
} from '../generated/entity/data/pipeline';
import { formatDateTime } from './date-time/DateTimeUtils';
import { getStatusBadgeIcon } from './PipelineDetailsUtils';

interface StatusIndicatorInterface {
  status: StatusType;
}

export interface ViewDataInterface {
  name: string;
  status?: StatusType;
  timestamp?: string;
  executionStatus?: StatusType;
  type?: string;
  key: number;
}

export const StatusIndicator = ({ status }: StatusIndicatorInterface) => (
  <Space>
    <Icon
      alt="result"
      className="align-middle"
      component={getStatusBadgeIcon(status)}
      // by default, color is set to inherit for Icon in ANTD, so we need to set it to transparent
      style={{ fontSize: '16px', color: 'transparent' }}
    />
    <p>
      {status === StatusType.Successful
        ? MenuOptions[StatusType.Successful]
        : ''}
      {status === StatusType.Failed ? MenuOptions[StatusType.Failed] : ''}
      {status === StatusType.Pending ? MenuOptions[StatusType.Pending] : ''}
      {status === StatusType.Skipped ? MenuOptions[StatusType.Skipped] : ''}
    </p>
  </Space>
);

/**
 * It takes in an array of PipelineStatus objects and a string, and returns an array of
 * ViewDataInterface objects
 * @param {PipelineStatus[] | undefined} executions - PipelineStatus[] | undefined
 * @param {string | undefined} status - The status of the pipeline.
 */
export const getTableViewData = (
  executions: PipelineStatus[] | undefined,
  status: string | undefined,
  searchString: string | undefined
): Array<ViewDataInterface> | undefined => {
  if (isUndefined(executions)) {
    return;
  }

  const viewData: Array<ViewDataInterface> = [];
  executions?.map((execution) => {
    execution.taskStatus?.map((execute) => {
      viewData.push({
        name: execute.name,
        status: execute.executionStatus,
        timestamp: formatDateTime(execution.timestamp),
        executionStatus: execute.executionStatus,
        type: '--',
        key: execution.timestamp,
      });
    });
  });

  return viewData
    .filter((view) =>
      searchString && searchString.length > 0
        ? toLower(view.name)?.includes(toLower(searchString))
        : true
    )
    .filter((view) =>
      status !== MenuOptions.all
        ? toLower(view.status)?.includes(toLower(status))
        : true
    );
};

/**
 * It takes an array of objects and groups them by a property
 * @param {PipelineStatus[]} executions - PipelineStatus[] - This is the array of pipeline status
 * objects that we get from the API.
 * @param {string | undefined} status - The status of the pipeline.
 */
export const getTreeViewData = (
  executions: PipelineStatus[],
  status: string | undefined
) => {
  const taskStatusArr = getTableViewData(executions, status, undefined);

  return groupBy(taskStatusArr, 'name');
};

export const getExecutionElementByKey = (
  key: string,
  viewElements: {
    key: string;
    value: ReactNode;
  }[]
) => viewElements.find((v) => v.key === key);

// check if current task is downstream task of other tasks
const checkIsDownStreamTask = (currentTask: Task, tasks: Task[]) =>
  tasks.some((taskData) =>
    taskData.downstreamTasks?.includes(currentTask.name)
  );

// Function to build a tree for all nodes
export const buildCompleteTree = (
  data: Task[],
  viewElements: {
    key: string;
    value: any;
  }[],
  icon: any,
  key: string,
  parentKey: string
) => {
  let node: DataNode;

  const nodeKey: string = parentKey + '-' + key;

  if (icon != null) {
    node = {
      key: nodeKey,
      title: viewElements.find((item) => item.key === key)?.value ?? null,
      children: [],
      icon,
    };
  } else {
    node = {
      key: nodeKey,
      title: viewElements.find((item) => item.key === key)?.value ?? null,
      children: [],
    };
  }
  const entry = data.find((item) => item.name === key);

  if (entry) {
    const childrenKeys = entry.downstreamTasks ?? [];

    for (const childKey of childrenKeys) {
      const childNode = buildCompleteTree(
        data,
        viewElements,
        icon,
        childKey,
        parentKey + '-' + entry.name
      );
      node.children?.push(childNode);
    }
  }

  if (node.children?.length === 0) {
    delete node.children;
  }

  return node;
};

export const getTreeData = (
  tasks: Task[],
  viewData: Record<string, ViewDataInterface[]>
) => {
  const icon = <div className="tree-view-dot" />;
  const treeDataList: DataNode[] = [];
  const treeLabelList: DataNode[] = [];

  // map execution element to task name
  const viewElements = map(viewData, (value, key) => ({
    key,
    value: (
      <Row gutter={16} key={key}>
        <Col>
          <div className="execution-node-container">
            {value.map((status) => (
              <Tooltip
                key={`${status.timestamp}-${status.executionStatus}`}
                placement="top"
                title={
                  <Space direction="vertical">
                    <div>{status.timestamp}</div>
                    <div>{status.executionStatus}</div>
                  </Space>
                }>
                <Icon
                  alt="result"
                  className="align-middle"
                  component={getStatusBadgeIcon(status.executionStatus)}
                  // by default, color is set to inherit for Icon in ANTD, so we need to set it to transparent
                  style={{ fontSize: '24px', color: 'transparent' }}
                />
              </Tooltip>
            ))}
          </div>
        </Col>
      </Row>
    ),
  }));

  const labelElements: { key: string; value: string }[] = [];

  viewElements.forEach((value) => {
    const object = { key: value.key, value: value.key };
    labelElements.push(object);
  });

  const roots: string[] = [];

  for (const task of tasks) {
    if (!checkIsDownStreamTask(task, tasks)) {
      roots.push(task.name);
    }
  }

  roots.forEach((taskName) => {
    treeDataList.push(
      buildCompleteTree(tasks, viewElements, null, taskName, 'root')
    );
    treeLabelList.push(
      buildCompleteTree(tasks, labelElements, icon, taskName, 'root')
    );
  });

  return { treeDataList, treeLabelList };
};
