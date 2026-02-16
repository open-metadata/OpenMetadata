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

import { CloseOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import classNames from 'classnames';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { TASK_ENTITY_TYPES } from '../../../constants/Task.constant';
import { Task, TaskEntityStatus } from '../../../rest/tasksAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import './feed-panel-header.less';

interface TaskPanelHeaderProps {
  task: Task;
  className?: string;
  onCancel?: () => void;
}

const TaskPanelHeader: FC<TaskPanelHeaderProps> = ({
  task,
  className,
  onCancel,
}) => {
  const { t } = useTranslation();

  const taskTypeLabel = TASK_ENTITY_TYPES[task.type] ?? 'label.task';
  const isOpen = task.status === TaskEntityStatus.Open;

  return (
    <div className={classNames('feed-panel-header', className)}>
      <Space className="w-full justify-between">
        <Space direction="vertical" size={0}>
          <Typography.Text className="font-semibold text-md">
            {`#${task.taskId} `}
            {t(taskTypeLabel)}
          </Typography.Text>
          {task.about && (
            <Typography.Text className="text-grey-muted text-sm">
              {getEntityName(task.about)}
            </Typography.Text>
          )}
        </Space>
        <Space>
          <Typography.Text
            className={classNames('task-status-badge', {
              open: isOpen,
              closed: !isOpen,
            })}>
            {task.status}
          </Typography.Text>
          {onCancel && (
            <Button
              data-testid="close-drawer-button"
              icon={<CloseOutlined />}
              type="text"
              onClick={onCancel}
            />
          )}
        </Space>
      </Space>
    </div>
  );
};

export default TaskPanelHeader;
