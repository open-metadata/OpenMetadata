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

import { Box, Typography } from '@openmetadata/ui-core-components';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { EntityReference } from '../../../../../generated/entity/type';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../../../generated/entity/tasks/task';
import { formatActivityTime } from '../inbox.utils';

export interface TaskActivityTimelineProps {
  task: Task;
}

interface TimelineEvent {
  id: string;
  actor?: EntityReference;
  action: string;
  timestamp?: number;
}

/**
 * Lifecycle timeline for a task: creation, assignment and each comment,
 * synthesized from the task fields (no dedicated activity endpoint).
 */
const TaskActivityTimeline: React.FC<TaskActivityTimelineProps> = ({
  task,
}) => {
  const { t } = useTranslation();

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    (task.comments ?? []).forEach((comment) => {
      list.push({
        id: `comment-${comment.id}`,
        actor: comment.author,
        action: t('label.added-a-comment'),
        timestamp: comment.createdAt,
      });
    });

    const firstAssignee = task.assignees?.[0];
    if (firstAssignee) {
      list.push({
        id: `assigned-${firstAssignee.id}`,
        actor: firstAssignee,
        action: t('label.assigned-to'),
        timestamp: task.createdAt,
      });
    }

    list.push({
      id: 'created',
      actor: task.createdBy,
      action: t('label.request-created-by'),
      timestamp: task.createdAt,
    });

    return list;
  }, [task, t]);

  return (
    <Box className="tw:relative" direction="col" gap={5}>
      {/* Connector line behind the avatars (they sit at z-1 and cover it, so it
          only shows through the gaps between events). left-[11px] centers it on
          the 24px avatar. */}
      <span className="tw:pointer-events-none tw:absolute tw:top-3 tw:bottom-3 tw:left-[11px] tw:z-0 tw:w-px tw:bg-utility-gray-blue-200" />
      {events.map((event) => (
        <Box
          align="start"
          className="tw:relative tw:z-[1]"
          gap={2}
          key={event.id}>
          {event.actor ? (
            <ProfilePicture
              displayName={event.actor.displayName}
              name={event.actor.name ?? ''}
              width="24"
            />
          ) : (
            // Reserve the 24px avatar gutter so actor-less rows still indent
            // past the connector line instead of overlapping it.
            <span className="tw:size-6 tw:shrink-0" />
          )}
          <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
            <Typography size="text-sm">
              <span className="tw:font-medium">
                {event.actor ? getEntityName(event.actor) : ''}
              </span>{' '}
              <span className="tw:text-secondary">{event.action}</span>
            </Typography>
            {event.timestamp && (
              <Typography className="tw:text-secondary" size="text-xs">
                {formatActivityTime(event.timestamp)}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default TaskActivityTimeline;
