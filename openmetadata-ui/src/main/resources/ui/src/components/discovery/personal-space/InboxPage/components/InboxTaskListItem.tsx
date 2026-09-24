/*
 *  Copyright 2026 Collate.
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

import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { MessageDotsCircle } from '@untitledui/icons';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { Task } from '../../../../../generated/entity/tasks/task';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getTaskTypeBadge } from '../taskDetail.utils';
import { getTaskTitle } from '../taskTitle.utils';
import TaskTypeIcon from './TaskTypeIcon';

export interface InboxTaskListItemProps {
  task: Task;
  isActive?: boolean;
  onClick: (task: Task) => void;
}

const Dot: React.FC = () => (
  <span className="tw:h-1 tw:w-1 tw:shrink-0 tw:rounded-full tw:bg-utility-gray-blue-300" />
);

/**
 * The card's second line: task id, who raised it and the asset it concerns,
 * with the comment count at the far end.
 */
const TaskCardMeta: React.FC<{ task: Task }> = ({ task }) => {
  const requester = task.createdBy;
  const requesterName = requester?.displayName ?? requester?.name;
  const assetName = task.about ? getEntityName(task.about) : '';

  return (
    <Box align="center" className="tw:flex-wrap tw:gap-x-2 tw:gap-y-1">
      <Typography
        className="tw:font-mono tw:text-utility-blue-dark-500"
        size="text-xs"
        weight="medium">
        {`#${task.taskId ?? ''}`}
      </Typography>
      {requesterName && (
        <>
          <Dot />
          <ProfilePicture
            displayName={requester?.name}
            name={requester?.name ?? ''}
            width="18"
          />
          <Typography
            className="tw:text-secondary"
            size="text-xs"
            weight="medium">
            {requesterName}
          </Typography>
        </>
      )}
      {assetName && (
        <Badge className="tw:shrink-0 tw:font-mono" size="sm" type="modern">
          {assetName}
        </Badge>
      )}
      <Box align="center" className="tw:ml-auto tw:shrink-0 tw:gap-1">
        <MessageDotsCircle
          className="tw:text-secondary"
          height={14}
          width={14}
        />
        <Typography className="tw:text-secondary" size="text-xs">
          {task.commentCount ?? task.comments?.length ?? 0}
        </Typography>
      </Box>
    </Box>
  );
};

/**
 * Compact task card in the Inbox Triage list: the type's tinted icon, the title,
 * then a meta row of id · requester · the asset it concerns · comment count.
 */
const InboxTaskListItem: React.FC<InboxTaskListItemProps> = ({
  task,
  isActive,
  onClick,
}) => {
  const { t } = useTranslation();
  // Titleless tasks (governance workflows) carry the taskId as their name, so
  // getTaskTitle composes a title from the task type and the entity it is about
  // instead of repeating the id shown in the meta row.
  const taskTitle = getTaskTitle(task, t);

  return (
    <Box
      align="start"
      className={classNames(
        'tw:cursor-pointer tw:rounded-xl tw:border tw:px-4 tw:py-3 tw:transition',
        isActive
          ? 'tw:border-utility-brand-300 tw:bg-utility-brand-50'
          : 'tw:border-transparent tw:hover:bg-utility-gray-blue-50'
      )}
      data-testid={`inbox-task-${task.id}`}
      gap={3}
      role="button"
      tabIndex={0}
      onClick={() => onClick(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(task);
        }
      }}>
      <TaskTypeIcon badge={getTaskTypeBadge(task, t)} />
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={2}>
        {taskTitle && (
          <Typography
            className="tw:text-left tw:text-primary-900"
            ellipsis={{ rows: 2 }}
            size="text-sm"
            weight="medium">
            {taskTitle}
          </Typography>
        )}
        <TaskCardMeta task={task} />
      </Box>
    </Box>
  );
};

export default InboxTaskListItem;
