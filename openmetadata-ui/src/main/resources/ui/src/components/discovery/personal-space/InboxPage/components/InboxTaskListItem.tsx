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
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { Task } from '../../../../../generated/entity/tasks/task';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getTaskTitle } from '../taskTitle.utils';
import { formatEntityType } from '../taskList.utils';
import { formatInboxDate } from '../inbox.utils';

export interface InboxTaskListItemProps {
  task: Task;
  isActive?: boolean;
  onClick: (task: Task) => void;
}

const Dot: React.FC = () => (
  <span className="tw:h-1 tw:w-1 tw:shrink-0 tw:rounded-full tw:bg-utility-gray-blue-300" />
);

/**
 * Compact task card in the Inbox Tasks tab: the title + comment count on top,
 * then a single meta row of id · type · requester · date. Cards are spaced,
 * lightly bordered, and highlight when selected (matches the figma).
 */
const InboxTaskListItem: React.FC<InboxTaskListItemProps> = ({
  task,
  isActive,
  onClick,
}) => {
  const { t } = useTranslation();
  const entityType = formatEntityType(task.about?.type);
  const createdByName = task.createdBy?.displayName ?? task.createdBy?.name;
  const commentCount = task.commentCount ?? task.comments?.length ?? 0;
  // Titleless tasks (governance workflows) carry the taskId as their name, so
  // getTaskTitle composes a title from the task type and the entity it is about
  // instead of repeating the id shown in the meta row.
  const taskTitle = getTaskTitle(task, t);

  return (
    <Box
      className={classNames(
        'tw:cursor-pointer tw:rounded-xl tw:border tw:px-4 tw:py-3 tw:transition',
        isActive
          ? 'tw:border-utility-brand-300 tw:bg-utility-brand-50'
          : 'tw:border-utility-gray-blue-100 tw:hover:bg-utility-gray-blue-50'
      )}
      data-testid={`inbox-task-${task.id}`}
      direction="col"
      gap={2}
      role="button"
      tabIndex={0}
      onClick={() => onClick(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(task);
        }
      }}>
      <Box align="start" className="tw:justify-between tw:gap-2">
        {taskTitle && (
          <Typography
            className="tw:text-left tw:text-primary-900"
            ellipsis={{ rows: 1 }}
            size="text-sm"
            weight="medium">
            {taskTitle}
          </Typography>
        )}
        {/* ml-auto, not justify-between alone: a titleless card leaves this as
        the row's only child, which justify-between would push to the start. */}
        <Box align="center" className="tw:ml-auto tw:shrink-0 tw:gap-1">
          <MessageDotsCircle
            className="tw:text-secondary"
            height={14}
            width={14}
          />
          <Typography className="tw:text-secondary" size="text-xs">
            {commentCount}
          </Typography>
        </Box>
      </Box>

      <Box align="center" className="tw:flex-wrap tw:gap-x-2 tw:gap-y-1">
        <Typography
          className="tw:text-utility-blue-dark-500"
          size="text-xs"
          weight="medium">
          {`#${task.taskId ?? ''}`}
        </Typography>
        {entityType && (
          <Badge className="tw:shrink-0" size="sm" type="modern">
            {entityType}
          </Badge>
        )}
        {createdByName && (
          <>
            <Dot />
            <ProfilePicture
              displayName={task.createdBy?.name}
              name={task.createdBy?.name ?? ''}
              width="18"
            />
            <Typography
              className="tw:text-secondary"
              size="text-xs"
              weight="medium">
              {createdByName}
            </Typography>
          </>
        )}
        <Dot />
        <Typography className="tw:text-secondary" size="text-xs">
          {formatInboxDate(task.createdAt)}
        </Typography>
      </Box>
    </Box>
  );
};

export default InboxTaskListItem;
