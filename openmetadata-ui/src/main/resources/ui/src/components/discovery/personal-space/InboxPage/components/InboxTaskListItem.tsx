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
import { MessageCircle01 } from '@untitledui/icons';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { Task } from '../../../../../generated/entity/tasks/task';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getTaskTypeBadge } from '../taskDetail.utils';
import { getTaskTitleParts } from '../taskTitle.utils';
import ClampedText from './ClampedText';
import TaskTitleEntityBadge from './TaskTitleEntityBadge';
import TaskTypeIcon from './TaskTypeIcon';

export interface InboxTaskListItemProps {
  task: Task;
  isActive?: boolean;
  onClick: (task: Task) => void;
}

// The list reads ids as a short reference ("#00357"); the detail header keeps
// the full "TASK-00357".
const TASK_ID_PREFIX = 'TASK-';

/**
 * The card's second line: task id, who raised it and the asset it concerns,
 * with the comment count, when there is one, at the far end.
 */
const TaskCardMeta: React.FC<{ task: Task }> = ({ task }) => {
  const requester = task.createdBy;
  const requesterName = requester?.displayName ?? requester?.name;
  const assetName = task.about ? getEntityName(task.about) : '';
  const commentCount = task.commentCount ?? task.comments?.length ?? 0;
  const shortId = (task.taskId ?? '').replace(TASK_ID_PREFIX, '');

  return (
    <Box align="center" className="tw:flex-wrap tw:gap-x-2 tw:gap-y-1">
      <Typography className="tw:text-tertiary" size="text-xs" weight="medium">
        {`#${shortId}`}
      </Typography>
      {requesterName && (
        <Box align="center" className="tw:gap-1.5">
          <ProfilePicture
            displayName={requester?.name}
            name={requester?.name ?? ''}
            width="16"
          />
          <Typography className="tw:text-tertiary" size="text-xs">
            {requesterName}
          </Typography>
        </Box>
      )}
      {assetName && (
        <Badge
          className="tw:max-w-40 tw:text-tertiary tw:font-medium"
          size="sm"
          type="modern">
          <span className="tw:truncate">{assetName}</span>
        </Badge>
      )}
      {commentCount > 0 && (
        <Box
          align="center"
          className="tw:ml-auto tw:shrink-0 tw:gap-1"
          data-testid="inbox-task-comment-count">
          <MessageCircle01
            className="tw:text-fg-quaternary"
            height={14}
            width={14}
          />
          <Typography className="tw:text-tertiary" size="text-xs">
            {commentCount}
          </Typography>
        </Box>
      )}
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
  // getTaskTitleParts composes a title from the task type and the entity it is about
  // instead of repeating the id shown in the meta row.
  const { title: taskTitle, entityType } = getTaskTitleParts(task, t);

  return (
    <Box
      align="start"
      className={classNames(
        'tw:cursor-pointer tw:rounded-xl tw:border tw:p-3 tw:transition',
        isActive
          ? 'tw:border-utility-brand-300 tw:bg-primary tw:shadow-xs'
          : 'tw:border-transparent tw:hover:bg-secondary'
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
          <ClampedText text={taskTitle}>
            <Typography className="tw:text-primary" size="text-sm">
              {taskTitle}
            </Typography>
            <TaskTitleEntityBadge entityType={entityType} />
          </ClampedText>
        )}
        <TaskCardMeta task={task} />
      </Box>
    </Box>
  );
};

export default InboxTaskListItem;
