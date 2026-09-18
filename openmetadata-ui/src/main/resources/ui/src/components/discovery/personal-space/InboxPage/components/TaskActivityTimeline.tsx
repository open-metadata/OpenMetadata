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
import {
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  UserPlus01,
  XCircle,
} from '@untitledui/icons';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { Task } from '../../../../../generated/entity/tasks/task';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { formatInboxDateTime } from '../inbox.utils';
import {
  buildTaskTimeline,
  TaskTimelineEntry,
  TaskTimelineEvent,
  TaskTimelineIcon,
  TaskTimelineTone,
} from '../taskTimeline.utils';
import TaskCommentRow from './TaskCommentRow';

export interface TaskActivityTimelineProps {
  task: Task;
  /** Reload the task after a comment is edited or deleted. */
  onCommentChanged: () => void;
}

const EVENT_ICON: Record<TaskTimelineIcon, typeof CheckCircle> = {
  approved: CheckCircle,
  assigned: UserPlus01,
  created: PlusCircle,
  incident: AlertTriangle,
  rejected: XCircle,
  resolved: CheckCircle,
};

const TONE_TEXT_CLASS: Record<TaskTimelineTone, string> = {
  default: 'tw:text-secondary',
  error: 'tw:text-error-primary',
  success: 'tw:text-secondary',
};

const TONE_ICON_CLASS: Record<TaskTimelineTone, string> = {
  default: 'tw:text-fg-quaternary',
  error: 'tw:text-error-primary',
  success: 'tw:text-utility-success-600',
};

/** One system event: icon, sentence and the moment it happened. */
const TimelineEventRow: React.FC<{ event: TaskTimelineEvent }> = ({
  event,
}) => {
  const { t } = useTranslation();
  const Icon = EVENT_ICON[event.icon];

  return (
    <Box align="start" className="tw:justify-between tw:gap-4">
      <Box align="start" className="tw:min-w-0" gap={2}>
        <span
          className={classNames(
            'tw:mt-0.5 tw:flex tw:size-5 tw:shrink-0 tw:items-center tw:justify-center',
            TONE_ICON_CLASS[event.tone]
          )}>
          <Icon height={16} width={16} />
        </span>
        <Typography
          className={TONE_TEXT_CLASS[event.tone]}
          data-testid="task-timeline-event"
          size="text-sm">
          {t(event.textKey, {
            user: event.actor ? getEntityName(event.actor) : '',
          })}
        </Typography>
      </Box>
      {event.timestamp && (
        <Typography
          className="tw:shrink-0 tw:text-secondary"
          size="text-xs"
          weight="medium">
          {formatInboxDateTime(event.timestamp)}
        </Typography>
      )}
    </Box>
  );
};

/**
 * The task's events and comments as one timestamp-ordered stream, so a
 * conversation reads in the order it happened. Events are synthesized from the
 * task's own fields (see {@link buildTaskTimeline}) — there is no per-task event
 * endpoint, so changes the task does not stamp are not shown.
 */
const TaskActivityTimeline: React.FC<TaskActivityTimelineProps> = ({
  task,
  onCommentChanged,
}) => {
  const { t } = useTranslation();
  const entries = useMemo(() => buildTaskTimeline(task), [task]);

  const renderEntry = (entry: TaskTimelineEntry) => {
    if (entry.kind === 'event') {
      return <TimelineEventRow event={entry} />;
    }

    return (
      <Box align="start" className="tw:min-w-0" gap={2}>
        <ProfilePicture
          displayName={getEntityName(entry.comment.author)}
          name={entry.comment.author?.name ?? ''}
          width="28"
        />
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <TaskCommentRow
            comment={entry.comment}
            taskId={task.id}
            onChanged={onCommentChanged}
          />
        </Box>
      </Box>
    );
  };

  return (
    <Box data-testid="task-activity-timeline" direction="col" gap={5}>
      <Box align="center" className="tw:justify-between" gap={3}>
        <Box align="center" gap={2}>
          <Typography size="text-md" weight="semibold">
            {t('label.activity')}
          </Typography>
          <Badge color="gray" size="sm" type="pill-color">
            {entries.length}
          </Badge>
        </Box>
        <span className="tw:h-px tw:flex-1 tw:bg-border-secondary" />
        <Typography className="tw:shrink-0 tw:text-secondary" size="text-xs">
          {t('label.comments-and-events')}
        </Typography>
      </Box>

      <Box direction="col" gap={5}>
        {entries.map((entry) => (
          <div key={entry.id}>{renderEntry(entry)}</div>
        ))}
      </Box>
    </Box>
  );
};

export default TaskActivityTimeline;
