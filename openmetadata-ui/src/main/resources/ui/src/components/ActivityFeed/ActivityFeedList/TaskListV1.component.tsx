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

import { Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { ReactNode, useEffect, useMemo } from 'react';
import { ReactComponent as FeedEmptyIcon } from '../../../assets/svg/ic-task-empty.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { Task } from '../../../rest/tasksAPI';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../common/Loader/Loader';
import TaskFeedCardFromTask from '../TaskFeedCard/TaskFeedCardFromTask.component';

interface TaskListV1Props {
  taskList: Task[];
  isLoading: boolean;
  onTaskClick?: (task: Task) => void;
  activeFeedId?: string;
  emptyPlaceholderText: ReactNode;
  selectedTask?: Task;
  onAfterClose?: () => void;
  handlePanelResize?: (isFullWidth: boolean) => void;
  isFullWidth?: boolean;
}

const TaskListV1 = ({
  taskList,
  isLoading,
  onTaskClick,
  activeFeedId,
  emptyPlaceholderText,
  selectedTask,
  onAfterClose,
  handlePanelResize,
}: TaskListV1Props) => {
  useEffect(() => {
    const task = taskList.find((t) => t.id === selectedTask?.id);

    if (onTaskClick && (!selectedTask || !task) && taskList.length > 0) {
      onTaskClick(taskList[0]);
    }
  }, [taskList, selectedTask, onTaskClick]);

  useEffect(() => {
    if (isEmpty(taskList) && handlePanelResize) {
      handlePanelResize?.(true);
    } else {
      handlePanelResize?.(false);
    }
  }, [taskList]);

  const tasks = useMemo(
    () =>
      taskList.map((task) => (
        <TaskFeedCardFromTask
          isActive={activeFeedId === task.id}
          key={task.id}
          task={task}
          onAfterClose={onAfterClose}
          onTaskClick={onTaskClick}
        />
      )),
    [taskList, activeFeedId, onAfterClose, onTaskClick]
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
        <ErrorPlaceHolderNew
          icon={<FeedEmptyIcon height={140} width={140} />}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography.Paragraph
            className="placeholder-text"
            style={{ marginBottom: '0' }}>
            {emptyPlaceholderText}
          </Typography.Paragraph>
        </ErrorPlaceHolderNew>
      </div>
    );
  }

  return (
    <div className={classNames('activity-feed-tab-padding')} id="taskData">
      {tasks}
    </div>
  );
};

export default TaskListV1;
