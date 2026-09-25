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
  Check,
  Plus,
  UserPlus01,
  XClose,
} from '@untitledui/icons';
import classNames from 'classnames';
import { mapValues } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { Task } from '../../../../../generated/entity/tasks/task';
import { TestCaseResolutionStatus } from '../../../../../generated/tests/testCaseResolutionStatus';
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
  /** An incident's status records; they replace the guessed events. */
  incidentStatuses?: TestCaseResolutionStatus[];
  /** Reload the task after a comment is edited or deleted. */
  onCommentChanged: () => void;
}

// Bare glyphs: the event row already draws the ring around them.
const EVENT_ICON: Record<TaskTimelineIcon, typeof Check> = {
  approved: Check,
  assigned: UserPlus01,
  created: Plus,
  incident: AlertTriangle,
  rejected: XClose,
  resolved: Check,
};

const TONE_TEXT_CLASS: Record<TaskTimelineTone, string> = {
  default: 'tw:text-tertiary',
  error: 'tw:text-error-primary',
  success: 'tw:text-tertiary',
};

// Each event sits in a ringed circle; an alert's circle is tinted so it reads
// at a glance.
const TONE_ICON_CLASS: Record<TaskTimelineTone, string> = {
  default: 'tw:border-secondary tw:bg-primary tw:text-fg-quaternary',
  error:
    'tw:border-utility-error-200 tw:bg-utility-error-50 tw:text-utility-error-600',
  success:
    'tw:border-utility-success-200 tw:bg-utility-success-50 tw:text-utility-success-600',
};

/** One system event: icon, sentence and the moment it happened. */
const TimelineEventRow: React.FC<{ event: TaskTimelineEvent }> = ({
  event,
}) => {
  const { t } = useTranslation();
  const Icon = EVENT_ICON[event.icon];

  return (
    <Box align="start" className="tw:justify-between tw:gap-4">
      <Box align="start" className="tw:min-w-0" gap={3}>
        <span
          className={classNames(
            'tw:flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border',
            TONE_ICON_CLASS[event.tone]
          )}>
          <Icon height={14} width={14} />
        </span>
        <Typography
          className={classNames('tw:pt-0.5', TONE_TEXT_CLASS[event.tone])}
          data-testid="task-timeline-event"
          size="text-xs">
          {t(event.textKey, {
            user: event.actor ? getEntityName(event.actor) : '',
            ...mapValues(event.textParams, (value) =>
              typeof value === 'string' ? value : getEntityName(value)
            ),
          })}
        </Typography>
      </Box>
      {event.timestamp && (
        <Typography
          className="tw:shrink-0 tw:pt-0.5 tw:text-tertiary"
          size="text-xs">
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
  incidentStatuses,
  onCommentChanged,
}) => {
  const { t } = useTranslation();
  const entries = useMemo(
    () => buildTaskTimeline(task, incidentStatuses),
    [task, incidentStatuses]
  );

  const renderEntry = (entry: TaskTimelineEntry) => {
    if (entry.kind === 'event') {
      return <TimelineEventRow event={entry} />;
    }

    return (
      <Box align="start" className="tw:min-w-0" gap={3}>
        <ProfilePicture
          displayName={getEntityName(entry.comment.author)}
          name={entry.comment.author?.name ?? ''}
          width="24"
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
        <Typography
          className="tw:shrink-0 tw:text-tertiary"
          size="text-xs"
          weight="medium">
          {t('label.comments-and-events')}
        </Typography>
      </Box>

      <Box direction="col" gap={4}>
        {entries.map((entry) => (
          <div key={entry.id}>{renderEntry(entry)}</div>
        ))}
      </Box>
    </Box>
  );
};

export default TaskActivityTimeline;
