/*
 *  Copyright 2024 Collate.
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

import { isEmpty } from 'lodash';
import {
  MutableRefObject,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { ReactComponent as FeedEmptyIcon } from '../../../assets/svg/ic-task-empty.svg';
import { getTaskById, Task } from '../../../rest/tasksAPI';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import Loader from '../../common/Loader/Loader';
import { useLinkedTaskId } from '../../discovery/personal-space/InboxPage/useLinkedTaskId';
import TaskFeedCardFromTask from '../TaskFeedCard/TaskFeedCardFromTask.component';

// What the task panel shows, as the feed provider fetches a single task.
const LINKED_TASK_FIELDS = 'assignees,createdBy,about,comments,payload';

/**
 * Opens the task a link names, loading it when it is not on the loaded page. A load still in
 * flight is recorded in `pendingLinkRef`; its result is dropped once that is cleared, by the user
 * picking a task or the list unmounting, so a late response never replaces their pick.
 */
const openLinkedTask = (
  linkedTaskId: string,
  taskList: Task[],
  selectedTask: Task | undefined,
  onTaskClick: (task: Task) => void,
  pendingLinkRef: MutableRefObject<string | undefined>
) => {
  const linked = taskList.find((t) => t.id === linkedTaskId);
  if (linked) {
    if (selectedTask?.id !== linked.id) {
      onTaskClick(linked);
    }

    return;
  }
  // The list loads a page at a time, so the linked task may not be on this page yet.
  pendingLinkRef.current = linkedTaskId;
  const settle = (task: Task) => {
    if (pendingLinkRef.current === linkedTaskId) {
      pendingLinkRef.current = undefined;
      onTaskClick(task);
    }
  };
  getTaskById(linkedTaskId, { fields: LINKED_TASK_FIELDS })
    .then(({ data }) => settle(data))
    .catch(() => settle(taskList[0]));
};

interface TaskListV1Props {
  taskList: Task[];
  isLoading: boolean;
  onTaskClick?: (task: Task) => void;
  activeFeedId?: string;
  emptyPlaceholderText: ReactNode;
  emptyPlaceholderDescription?: ReactNode;
  selectedTask?: Task;
  onAfterClose?: () => void;
  handlePanelResize?: (isFullWidth: boolean) => void;
  isFullWidth?: boolean;
}

const TaskListV1 = ({
  // The ActivityFeedProvider context defaults to `{}`, so this can be undefined
  taskList = [],
  isLoading,
  onTaskClick,
  activeFeedId,
  emptyPlaceholderText,
  emptyPlaceholderDescription,
  selectedTask,
  onAfterClose,
  handlePanelResize,
}: TaskListV1Props) => {
  const linkedTaskId = useLinkedTaskId();
  // The linked task is opened once; afterwards the user's own picks win.
  const openedLinkRef = useRef<string>();
  const pendingLinkRef = useRef<string>();

  useEffect(
    () => () => {
      pendingLinkRef.current = undefined;
    },
    []
  );

  // A task the user picks cancels a linked task still loading.
  const handleTaskPick = useCallback(
    (task: Task) => {
      pendingLinkRef.current = undefined;
      onTaskClick?.(task);
    },
    [onTaskClick]
  );

  useEffect(() => {
    if (!onTaskClick || taskList.length === 0) {
      return;
    }
    if (linkedTaskId && openedLinkRef.current !== linkedTaskId) {
      openedLinkRef.current = linkedTaskId;
      openLinkedTask(
        linkedTaskId,
        taskList,
        selectedTask,
        onTaskClick,
        pendingLinkRef
      );

      return;
    }
    const task = taskList.find((t) => t.id === selectedTask?.id);
    // The linked task stays open even when it is not on a loaded page.
    const isLinkedTask =
      selectedTask !== undefined && selectedTask.id === openedLinkRef.current;

    if (!selectedTask || (!task && !isLinkedTask)) {
      onTaskClick(taskList[0]);
    }
  }, [taskList, selectedTask, onTaskClick, linkedTaskId]);

  useEffect(() => {
    // While a fetch is in flight the list is intentionally empty; collapsing the
    // right panel here would flash the layout on every sub-tab/filter switch.
    if (isLoading) {
      return;
    }
    if (isEmpty(taskList) && handlePanelResize) {
      handlePanelResize?.(true);
    } else {
      handlePanelResize?.(false);
    }
  }, [taskList, isLoading, handlePanelResize]);

  const tasks = useMemo(
    () =>
      taskList.map((task) => (
        <TaskFeedCardFromTask
          isActive={activeFeedId === task.id}
          key={task.id}
          task={task}
          onAfterClose={onAfterClose}
          onTaskClick={handleTaskPick}
        />
      )),
    [taskList, activeFeedId, onAfterClose, handleTaskPick]
  );

  if (isLoading) {
    return <Loader />;
  }

  if (isEmpty(taskList) && !isLoading) {
    return (
      <div
        className="p-x-md no-data-placeholder-container h-full"
        data-testid="no-data-placeholder-container"
        id="taskData">
        <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
          <NoDataPlaceholder
            data-testid="no-data-placeholder"
            description={emptyPlaceholderDescription}
            icon={<FeedEmptyIcon height={140} width={140} />}
            title={emptyPlaceholderText}
          />
        </div>
      </div>
    );
  }

  return (
    // Padding lives here, not in .activity-feed-tab-padding: that rule's stylesheet
    // is not loaded on every page that renders this list (e.g. the incident tab).
    <div className="tw:p-5" id="taskData">
      {tasks}
    </div>
  );
};

export default TaskListV1;
