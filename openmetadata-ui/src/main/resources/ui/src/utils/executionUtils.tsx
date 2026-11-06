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
import { groupBy, isEmpty, isUndefined, map, toLower } from 'lodash';
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
import { formatDateTime, formatDuration } from './date-time/DateTimeUtils';
import { t } from './i18next/LocalUtil';
import {
  getStatusBadgeClassName,
  getStatusBadgeIcon,
} from './PipelineDetailsUtils';
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
      const duration =
        startTime && endTime ? formatDuration(endTime - startTime) : '--';

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

export const MAX_TREE_NODES = 5000;

type ViewElement = { key: string; value: React.ReactNode };

export type TreeBuildState = {
  visited: Set<string>;
  rendered: Set<string>;
  remaining: number;
  truncated: boolean;
};

type TreeBuildContext = {
  data: Task[];
  viewElements: ViewElement[];
  icon: React.ReactNode | null;
  state: TreeBuildState;
};

export const createTreeBuildState = (
  remaining = MAX_TREE_NODES
): TreeBuildState => ({
  visited: new Set(),
  rendered: new Set(),
  remaining,
  truncated: false,
});

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

const makeLeafNode = (
  parentNodeKey: string,
  childKey: string,
  { data, viewElements, icon, state }: TreeBuildContext
): TreeNode => {
  state.rendered.add(childKey);
  if (!isEmpty(data.find((item) => item.name === childKey)?.downstreamTasks)) {
    state.truncated = true;
  }

  const leaf: TreeNode = {
    key: parentNodeKey + '-' + childKey,
    title: viewElements.find((item) => item.key === childKey)?.value ?? null,
  };
  if (icon != null) {
    leaf.icon = icon;
  }

  return leaf;
};

function expandNodeChildren(
  node: TreeNode,
  entry: Task | undefined,
  nodeKey: string,
  context: TreeBuildContext
): void {
  const { data, viewElements, icon, state } = context;
  if (!entry || state.visited.has(entry.name)) {
    return;
  }

  state.visited.add(entry.name);
  for (const childKey of new Set(entry.downstreamTasks ?? [])) {
    node.children?.push(
      state.remaining > 0
        ? // eslint-disable-next-line @typescript-eslint/no-use-before-define -- mutual recursion with buildCompleteTree
          buildCompleteTree(data, viewElements, icon, childKey, nodeKey, state)
        : makeLeafNode(nodeKey, childKey, context)
    );
  }
  state.visited.delete(entry.name);
}

export function buildCompleteTree(
  data: Task[],
  viewElements: ViewElement[],
  icon: React.ReactNode | null,
  key: string,
  parentKey: string,
  state?: TreeBuildState
) {
  const nodeKey: string = parentKey + '-' + key;
  const buildState = state ?? createTreeBuildState();
  buildState.remaining -= 1;
  buildState.rendered.add(key);

  const title = viewElements.find((item) => item.key === key)?.value ?? null;
  const node = createNode(nodeKey, title, icon);
  const entry = data.find((item) => item.name === key);

  expandNodeChildren(node, entry, nodeKey, {
    data,
    viewElements,
    icon,
    state: buildState,
  });

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
  const treeDataList: TreeNode[] = [];
  const treeLabelList: TreeNode[] = [];

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
  const dataState = createTreeBuildState();
  const labelState = createTreeBuildState();

  const addRoot = (taskName: string) => {
    treeDataList.push(
      buildCompleteTree(tasks, viewElements, null, taskName, 'root', dataState)
    );
    treeLabelList.push(
      buildCompleteTree(
        tasks,
        labelElements,
        icon,
        taskName,
        'root',
        labelState
      )
    );
  };

  roots.forEach(addRoot);
  tasks.forEach((task) => {
    if (!labelState.rendered.has(task.name)) {
      addRoot(task.name);
    }
  });

  return { treeDataList, treeLabelList, isTruncated: labelState.truncated };
};
