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
import { MessageDotsCircle } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import AgentBadge from '../../../../../components/common/AgentBadge/AgentBadge';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { Task } from '../../../../../generated/entity/tasks/task';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getProposingAgent, getTaskTypeBadge } from '../taskDetail.utils';
import { TaskStatusBadge } from '../taskResolution.utils';
import { getTaskTitleParts } from '../taskTitle.utils';
import TaskTitle from './TaskTitle';
import TaskTypeIcon from './TaskTypeIcon';

export interface InboxTaskListItemProps {
  task: Task;
  isActive?: boolean;
  // Shown at the row's end where no detail pane beside the list carries it.
  statusBadge?: TaskStatusBadge;
  onClick: (task: Task) => void;
}

// The list reads ids as a short reference ("#00357"); the detail header keeps
// the full "TASK-00357".
const TASK_ID_PREFIX = 'TASK-';

/** Who raised the task: the AI agent that proposed its subject, else the person. */
const TaskRequester: React.FC<{ task: Task }> = ({ task }) => {
  const { t } = useTranslation();
  const agent = getProposingAgent(task, t);
  const requester = task.createdBy;
  const requesterName = requester?.displayName ?? requester?.name;

  if (agent) {
    return <AgentBadge name={agent} />;
  }

  return requesterName ? (
    <Box align="center" className="tw:gap-1.5">
      <ProfilePicture
        matchRingToFill
        displayName={requesterName}
        name={requester?.name ?? ''}
        width="16"
      />
      <Typography className="tw:text-tertiary" size="text-xs">
        {requesterName}
      </Typography>
    </Box>
  ) : null;
};

/** The row's far end: the comment count, when there is one, and the status. */
const TaskCardTrailing: React.FC<{
  commentCount: number;
  statusBadge?: TaskStatusBadge;
}> = ({ commentCount, statusBadge }) => (
  <Box align="center" className="tw:ml-auto tw:shrink-0 tw:gap-2">
    {commentCount > 0 && (
      <Box
        align="center"
        className="tw:gap-1"
        data-testid="inbox-task-comment-count">
        <MessageDotsCircle
          className="tw:text-quaternary"
          height={14}
          width={14}
        />
        <Typography className="tw:text-tertiary" size="text-xs">
          {commentCount}
        </Typography>
      </Box>
    )}
    {statusBadge && (
      <Badge
        color={statusBadge.tone}
        data-testid="inbox-task-status"
        size="sm"
        type="pill-color">
        {statusBadge.label}
      </Badge>
    )}
  </Box>
);

/**
 * The card's second line: task id, who raised it and the asset it concerns,
 * with the comment count, when there is one, at the far end.
 */
const TaskCardMeta: React.FC<{
  task: Task;
  statusBadge?: TaskStatusBadge;
}> = ({ task, statusBadge }) => {
  const assetName = task.about ? getEntityName(task.about) : '';
  const commentCount = task.commentCount ?? task.comments?.length ?? 0;
  const shortId = (task.taskId ?? '').replace(TASK_ID_PREFIX, '');

  return (
    <Box align="center" className="tw:flex-wrap tw:gap-x-2 tw:gap-y-1">
      <Typography
        className="tw:font-mono tw:text-tertiary"
        size="text-xs"
        weight="medium">
        {`#${shortId}`}
      </Typography>
      <TaskRequester task={task} />
      {assetName && (
        <Badge className="tw:max-w-40" size="sm" type="modern">
          <span className="tw:truncate">{assetName}</span>
        </Badge>
      )}
      <TaskCardTrailing commentCount={commentCount} statusBadge={statusBadge} />
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
  statusBadge,
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
        // Hover on primary_hover, not bg-secondary: in dark mode the list
        // itself sits on bg-secondary, so that hover never showed.
        isActive
          ? 'tw:border-utility-blue-light-100 tw:bg-utility-blue-light-50'
          : 'tw:border-transparent tw:hover:bg-primary_hover'
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
          <TaskTitle entityType={entityType} size="text-sm" text={taskTitle}>
            <Typography
              className="tw:text-primary"
              size="text-sm"
              weight="medium">
              {taskTitle}
            </Typography>
          </TaskTitle>
        )}
        <TaskCardMeta statusBadge={statusBadge} task={task} />
      </Box>
    </Box>
  );
};

export default InboxTaskListItem;
