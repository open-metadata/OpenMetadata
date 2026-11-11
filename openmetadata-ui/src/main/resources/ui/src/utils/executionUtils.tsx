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

import { Box, Tooltip } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { groupBy, isUndefined, map, toLower } from 'lodash';
import React from 'react';
import { MenuOptions } from '../constants/execution.constants';
import {
  PipelineStatus,
  StatusType,
  Task,
  TaskStatus,
} from '../generated/entity/data/pipeline';
import { TreeNode } from '../interface/tree.interface';
import { getLayoutGutter } from './common/layout.utils';
import { formatDateTime, formatRunDuration } from './date-time/DateTimeUtils';
import { t } from './i18next/LocalUtil';
import {
  getStatusBadgeClassName,
  getStatusBadgeIcon,
} from './PipelineDetailsUtils';
import { getSafeHttpUrl } from './StringUtils';
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
  startTime?: number;
  endTime?: number;
  duration?: string;
  rowsRead?: number;
  rowsWritten?: number;
  logLink?: string;
}

const StatusBadge = ({ status }: { status?: StatusType }) => {
  const Badge = getStatusBadgeIcon(status);

  return (
    <Badge
      aria-label="result"
      className={classNames(
        'tw:align-middle tw:shrink-0',
        getStatusBadgeClassName(status)
      )}
      role="img"
      size={24}
    />
  );
};

export const StatusIndicator = ({ status }: StatusIndicatorInterface) => {
  const StatusBadgeIcon = getStatusBadgeIcon(status);

  return (
    <Box
      inline
      align="center"
      className="layout-space layout-space-horizontal"
      gap={2}
      itemClassName="layout-space-item">
      <StatusBadgeIcon
        aria-label="result"
        className={classNames(
          'tw:align-middle tw:shrink-0',
          getStatusBadgeClassName(status)
        )}
        role="img"
        size={16}
      />
      <p>
        {status === StatusType.Successful
          ? MenuOptions[StatusType.Successful]
          : ''}
        {status === StatusType.Failed ? MenuOptions[StatusType.Failed] : ''}
        {status === StatusType.Pending ? MenuOptions[StatusType.Pending] : ''}
        {status === StatusType.Skipped ? MenuOptions[StatusType.Skipped] : ''}
      </p>
    </Box>
  );
};

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
    execution.taskStatus?.map((execute: TaskStatus) => {
      const startTime = execute.startTime;
      const endTime = execute.endTime;
      const executionTimeMs = execute.metrics?.executionTimeMs;
      // Wall-clock duration wins; the producer-reported execution time only
      // fills the gap when start/end are missing, so the two never compete for
      // a column (ADR:2026-11-04-pipeline-execution-metric-columns-render-only-when-reported).
      let duration = '--';
      if (startTime && endTime) {
        duration = formatRunDuration(endTime - startTime);
      } else if (!isUndefined(executionTimeMs)) {
        duration = formatRunDuration(executionTimeMs);
      }

      viewData.push({
        name: execute.name,
        status: execute.executionStatus,
        timestamp: formatDateTime(execution.timestamp),
        executionStatus: execute.executionStatus,
        type: '--',
        key: execution.timestamp,
        startTime,
        endTime,
        duration,
        rowsRead: execute.metrics?.rowsRead,
        rowsWritten: execute.metrics?.rowsWritten,
        logLink: getSafeHttpUrl(execute.logLink),
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

// check if current task is downstream task of other tasks
const checkIsDownStreamTask = (currentTask: Task, tasks: Task[]) =>
  tasks.some((taskData) =>
    taskData.downstreamTasks?.includes(currentTask.name)
  );

type ViewElement = { key: string; value: React.ReactNode };

const createNode = (
  nodeKey: string,
  title: React.ReactNode,
  icon: React.ReactNode | null
): TreeNode => {
  if (icon != null) {
    return { key: nodeKey, title, children: [], icon };
  }

  return { key: nodeKey, title, children: [] };
};

export function buildCompleteTree(
  data: Task[],
  viewElements: ViewElement[],
  icon: React.ReactNode | null,
  key: string,
  parentKey: string,
  expanded = new Set<string>()
): TreeNode {
  const nodeKey: string = parentKey + '-' + key;
  const title = viewElements.find((item) => item.key === key)?.value ?? null;
  const node = createNode(nodeKey, title, icon);
  const entry = data.find((item) => item.name === key);

  if (entry && !expanded.has(key)) {
    expanded.add(key);
    for (const childKey of new Set(entry.downstreamTasks ?? [])) {
      node.children?.push(
        buildCompleteTree(data, viewElements, icon, childKey, nodeKey, expanded)
      );
    }
  }

  if (node.children?.length === 0) {
    delete node.children;
  }

  return node;
}

export const getTreeData = (
  tasks: Task[],
  viewData: Record<string, ViewDataInterface[]>
) => {
  const icon = <div className="tree-view-dot" />;

  // map execution element to task name
  const viewElements = map(
    viewData,
    (value: ViewDataInterface[], key: string) => ({
      key,
      value: (
        <Box
          className="layout-row"
          key={key}
          style={{ ...getLayoutGutter(16) }}
          wrap="wrap">
          <Box className="layout-column tw:block">
            <div className="execution-node-container">
              {value.map((status: ViewDataInterface) => (
                <Tooltip
                  arrow
                  excludeTriggerFromTabOrder
                  key={`${status.timestamp}-${status.executionStatus}`}
                  placement="top"
                  title={
                    <Box
                      inline
                      align="stretch"
                      className="layout-space"
                      direction="col"
                      gap={2}
                      itemClassName="layout-space-item">
                      <div>{status.timestamp}</div>
                      <div>{status.executionStatus}</div>
                      {status.startTime && (
                        <div>
                          {t('label.start-entity', { entity: t('label.time') })}
                          :{formatDateTime(status.startTime)}
                        </div>
                      )}
                      {status.endTime && (
                        <div>
                          {t('label.end-entity', { entity: t('label.time') })}:
                          {formatDateTime(status.endTime)}
                        </div>
                      )}
                      {status.duration && status.duration !== '--' && (
                        <div>
                          {t('label.duration')}: {status.duration}
                        </div>
                      )}
                    </Box>
                  }
                  triggerClassName="tw:inline-flex">
                  <StatusBadge status={status.executionStatus} />
                </Tooltip>
              ))}
            </div>
          </Box>
        </Box>
      ),
    })
  );

  const labelElements: { key: string; value: string }[] = [];

  viewElements.forEach((value: { key: string; value: React.ReactNode }) => {
    const object = { key: value.key, value: value.key };
    labelElements.push(object);
  });

  const roots = new Set(
    tasks
      .filter((task) => !checkIsDownStreamTask(task, tasks))
      .map((task) => task.name)
  );
  const buildTreeList = (
    elements: ViewElement[],
    nodeIcon: React.ReactNode | null
  ) => {
    const expanded = new Set<string>();
    const trees = [...roots].map((taskName) =>
      buildCompleteTree(tasks, elements, nodeIcon, taskName, 'root', expanded)
    );
    tasks.forEach((task) => {
      if (!expanded.has(task.name)) {
        trees.push(
          buildCompleteTree(
            tasks,
            elements,
            nodeIcon,
            task.name,
            'root',
            expanded
          )
        );
      }
    });

    return trees;
  };

  return {
    treeDataList: buildTreeList(viewElements, null),
    treeLabelList: buildTreeList(labelElements, icon),
  };
};
