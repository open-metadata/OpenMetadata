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
import { formatDateTime, formatDuration } from './date-time/DateTimeUtils';
import { t } from './i18next/LocalUtil';
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
  startTime?: number;
  endTime?: number;
  duration?: string;
}

const StatusBadge = ({ status }: { status?: StatusType }) => {
  const Badge = getStatusBadgeIcon(status);

  return (
    <Badge
      aria-label="result"
      // the badge supplies its own colours; stop currentColor tinting it
      className="tw:align-middle tw:size-6 tw:shrink-0 tw:text-transparent"
      role="img"
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
        // the badge supplies its own colours; stop currentColor tinting it
        className="tw:align-middle tw:size-4 tw:shrink-0 tw:text-transparent"
        role="img"
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

// Upper bound on the number of tree nodes a single root expansion can
// produce. The backtracking `visited` set in `buildCompleteTree` is what
// keeps cycles terminating, but it also lets a branching cycle expand every
// distinct path through it (e.g. a complete graph of 10 tasks yields ~10!
// nodes per root). Real pipeline task graphs are far smaller than this, so
// the cap is invisible to them while preventing Tree View from freezing or
// exhausting memory on a pathological cyclic graph.
const MAX_TREE_NODES = 10000;

// Function to build a tree for all nodes
export const buildCompleteTree = (
  data: Task[],
  viewElements: {
    key: string;
    value: React.ReactNode;
  }[],
  icon: React.ReactNode | null,
  key: string,
  parentKey: string,
  visited: Set<string> = new Set(),
  budget: { remaining: number } = { remaining: MAX_TREE_NODES }
) => {
  let node: TreeNode;

  const nodeKey: string = parentKey + '-' + key;

  // Charge every created node against the shared budget so the total
  // expansion is bounded regardless of graph shape.
  budget.remaining -= 1;

  const title = viewElements.find((item) => item.key === key)?.value ?? null;

  if (icon != null) {
    node = {
      key: nodeKey,
      title,
      children: [],
      icon,
    };
  } else {
    node = {
      key: nodeKey,
      title,
      children: [],
    };
  }
  const entry = data.find((item) => item.name === key);

  // Expand children only while the path hasn't revisited this key (cycle
  // termination) and the shared node budget hasn't been spent. The budget
  // bounds the total expansion so branching cycles can't freeze Tree View.
  if (entry && !visited.has(key) && budget.remaining > 0) {
    visited.add(key);

    const childrenKeys = entry.downstreamTasks ?? [];

    for (const childKey of childrenKeys) {
      if (budget.remaining <= 0) {
        break;
      }
      const childNode = buildCompleteTree(
        data,
        viewElements,
        icon,
        childKey,
        parentKey + '-' + entry.name,
        visited,
        budget
      );
      node.children?.push(childNode);
    }

    // Backtrack so a shared task (e.g. a diamond merge node) is still
    // expanded under a different parent branch. This keeps cycle
    // termination (a node is only visited once per path) while not
    // pruning valid acyclic paths that converge on the same task.
    visited.delete(key);
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

  const roots: string[] = [];

  for (const task of tasks) {
    if (!checkIsDownStreamTask(task, tasks)) {
      roots.push(task.name);
    }
  }

  // Compute the set of tasks reachable from the detected roots so that
  // disconnected components (e.g. a cycle C<->D alongside A->B) are still
  // shown. When roots is empty (a pure cycle), nothing is reachable yet and
  // every task becomes a root — matching the previous fallback behaviour.
  const reached = new Set<string>();
  const reachQueue: string[] = [...roots];
  while (reachQueue.length > 0) {
    const name = reachQueue.shift() as string;
    if (reached.has(name)) {
      continue;
    }
    reached.add(name);
    const task = tasks.find((t) => t.name === name);
    for (const child of task?.downstreamTasks ?? []) {
      if (!reached.has(child)) {
        reachQueue.push(child);
      }
    }
  }

  // Any task not reached from the detected roots (a disconnected cycle or
  // any other disconnected component) gets its own root so it is visible.
  const unreachedRoots = tasks
    .map((task) => task.name)
    .filter((name) => !reached.has(name));

  const effectiveRoots = [...roots, ...unreachedRoots];

  effectiveRoots.forEach((taskName) => {
    treeDataList.push(
      buildCompleteTree(tasks, viewElements, null, taskName, 'root')
    );
    treeLabelList.push(
      buildCompleteTree(tasks, labelElements, icon, taskName, 'root')
    );
  });

  return { treeDataList, treeLabelList };
};
