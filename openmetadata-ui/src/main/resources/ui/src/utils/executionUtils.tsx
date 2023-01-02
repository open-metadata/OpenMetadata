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

import { Col, Row, Space, Tooltip } from 'antd';
import { DataNode } from 'antd/lib/tree';
import { groupBy, isUndefined, map, toLower, uniqueId } from 'lodash';
import React, { ReactNode } from 'react';
import { MenuOptions } from '../constants/execution.constants';
import {
  PipelineStatus,
  StatusType,
  Task,
} from '../generated/entity/data/pipeline';
import { getStatusBadgeIcon } from './PipelineDetailsUtils';
import SVGIcons from './SvgUtils';
import { formatDateTimeFromSeconds } from './TimeUtils';

interface StatusIndicatorInterface {
  status: StatusType;
}

export interface ViewDataInterface {
  name: string;
  status?: StatusType;
  timestamp?: string;
  executionStatus?: StatusType;
  type?: string;
}

export const StatusIndicator = ({ status }: StatusIndicatorInterface) => (
  <Space>
    <SVGIcons
      alt="result"
      className="tw-w-4"
      icon={getStatusBadgeIcon(status)}
    />
    <p>
      {status === StatusType.Successful
        ? MenuOptions[StatusType.Successful]
        : ''}
      {status === StatusType.Failed ? MenuOptions[StatusType.Failed] : ''}
      {status === StatusType.Pending ? MenuOptions[StatusType.Pending] : ''}
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
  status: string | undefined
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
        timestamp: formatDateTimeFromSeconds(execution.timestamp as number),
        executionStatus: execute.executionStatus,
        type: '--',
      });
    });
  });

  return viewData.filter((data) =>
    status !== MenuOptions.all
      ? toLower(data.status)?.includes(toLower(status))
      : data
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
  const taskStatusArr = getTableViewData(executions, status);

  return groupBy(taskStatusArr, 'name');
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case StatusType.Successful:
    case StatusType.Pending:
    case StatusType.Failed:
      return MenuOptions[status];

    default:
      return;
  }
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

export const getTreeData = (
  tasks: Task[],
  viewData: Record<string, ViewDataInterface[]>
) => {
  const icon = <div className="tree-view-dot" />;
  let treeDataList: DataNode[] = [];
  let treeLabelList: DataNode[] = [];

  // map execution element to task name
  const viewElements = map(viewData, (value, key) => ({
    key,
    value: (
      <Row gutter={16} key={uniqueId()}>
        <Col>
          <div className="execution-node-container">
            {value.map((status) => (
              <Tooltip
                key={uniqueId()}
                placement="top"
                title={
                  <Space direction="vertical">
                    <div>{status.timestamp}</div>
                    <div>{status.executionStatus}</div>
                  </Space>
                }>
                <SVGIcons
                  alt="result"
                  className="tw-w-6 mr-2 mb-2"
                  icon={getStatusBadgeIcon(status.executionStatus)}
                />
              </Tooltip>
            ))}
          </div>
        </Col>
      </Row>
    ),
  }));

  for (const task of tasks) {
    const taskName = task.name;

    // list of downstream tasks
    const downstreamTasks = task.downstreamTasks ?? [];

    // check has downstream tasks or not
    const hasDownStream = Boolean(downstreamTasks.length);

    // check if current task is downstream task
    const isDownStreamTask = checkIsDownStreamTask(task, tasks);

    // check if it's an existing tree data
    const existingData = treeDataList.find((tData) => tData.key === taskName);

    // check if it's an existing label data
    const existingLabel = treeLabelList.find((lData) => lData.key === taskName);

    // get the execution element for current task
    const currentViewElement = getExecutionElementByKey(taskName, viewElements);
    const currentTreeData = {
      key: taskName,
      title: currentViewElement?.value ?? null,
    };

    const currentLabelData = {
      key: taskName,
      title: taskName,
      icon,
    };

    // skip the down stream node as it will be render by the parent task
    if (isDownStreamTask) {
      continue;
    } else if (hasDownStream) {
      const dataChildren: DataNode[] = [];
      const labelChildren: DataNode[] = [];
      // get execution list of downstream tasks

      for (const downstreamTask of downstreamTasks) {
        const taskElement = getExecutionElementByKey(
          downstreamTask,
          viewElements
        );

        dataChildren.push({
          key: downstreamTask,
          title: taskElement?.value ?? null,
        });

        labelChildren.push({
          key: downstreamTask,
          title: downstreamTask,
          icon,
        });
      }

      /**
       * if not existing data then push current tree data to tree data list
       * else modified the existing data
       */
      treeDataList = isUndefined(existingData)
        ? [...treeDataList, { ...currentTreeData, children: dataChildren }]
        : treeDataList.map((currentData) => {
            if (currentData.key === existingData.key) {
              return { ...existingData, children: dataChildren };
            } else {
              return currentData;
            }
          });

      treeLabelList = isUndefined(existingLabel)
        ? [...treeLabelList, { ...currentLabelData, children: labelChildren }]
        : treeLabelList.map((currentData) => {
            if (currentData.key === existingLabel.key) {
              return { ...existingLabel, children: labelChildren };
            } else {
              return currentData;
            }
          });
    } else {
      treeDataList = isUndefined(existingData)
        ? [...treeDataList, currentTreeData]
        : treeDataList;

      treeLabelList = isUndefined(existingLabel)
        ? [...treeLabelList, currentLabelData]
        : treeLabelList;
    }
  }

  return { treeDataList, treeLabelList };
};
