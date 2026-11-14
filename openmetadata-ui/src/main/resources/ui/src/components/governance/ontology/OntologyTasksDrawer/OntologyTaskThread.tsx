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
import { FileCheck02 } from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyReleaseReview } from '../../../../generated/api/data/ontologyReleaseReview';
import { Task } from '../../../../generated/entity/tasks/task';
import {
  EventType,
  OntologyReleaseEvent,
} from '../../../../generated/type/ontologyReleaseEvent';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import TaskCommentRow from '../../../discovery/personal-space/InboxPage/components/TaskCommentRow';
import {
  buildThreadEntries,
  reviewDecisionAppearance,
} from './OntologyTaskThread.utils';

type Props = {
  task: Task;
  review: OntologyReleaseReview;
  events: readonly OntologyReleaseEvent[];
  /** Reloads the task after a comment is edited or deleted. */
  onCommentChanged: () => void;
};

type Appearance = {
  color: 'gray' | 'blue' | 'success' | 'error' | 'warning';
  label: string;
};

const entryAppearance = (
  entry: ReturnType<typeof buildThreadEntries>[number]
): Appearance => {
  if (entry.decision) {
    return reviewDecisionAppearance(entry.decision);
  }
  if (entry.event?.eventType === EventType.Activated) {
    return { color: 'blue', label: 'label.published' };
  }

  return { color: 'gray', label: 'label.captured' };
};

const OntologyTaskThread = ({
  task,
  review,
  events,
  onCommentChanged,
}: Props) => {
  const { t } = useTranslation();
  const entries = useMemo(
    () => buildThreadEntries(task, review, events),
    [task, review, events]
  );

  return (
    <Box data-testid="ontology-task-activity" direction="col" gap={3}>
      <Box align="center" gap={2}>
        <Typography
          as="h3"
          className="not-prose tw:m-0"
          size="text-md"
          weight="semibold">
          {t('label.activity')}
        </Typography>
        <Badge color="gray" size="sm" type="pill-color">
          {entries.length}
        </Badge>
      </Box>
      <ol className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-4 tw:p-0">
        {entries.map((entry) => {
          // Comments read as they do in the Inbox, so they can be edited and deleted the same way.
          if (entry.comment) {
            return (
              <li
                className="tw:flex tw:min-w-0 tw:gap-3"
                data-testid={entry.id}
                key={entry.id}>
                <ProfilePicture
                  matchRingToFill
                  displayName={entry.actor}
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
              </li>
            );
          }
          const appearance = entryAppearance(entry);

          return (
            <li
              className="tw:flex tw:gap-3"
              data-testid={entry.id}
              key={entry.id}>
              <span className="tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-secondary">
                <FileCheck02
                  aria-hidden
                  className="tw:size-3.5 tw:text-fg-quaternary"
                />
              </span>
              <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={2}>
                <Box align="center" gap={2} wrap="wrap">
                  <Typography size="text-sm" weight="semibold">
                    {entry.actor}
                  </Typography>
                  <Badge color={appearance.color} size="sm">
                    {t(appearance.label)}
                  </Badge>
                  <Typography
                    className="tw:ml-auto"
                    color="secondary"
                    size="text-xs">
                    <time dateTime={new Date(entry.timestamp).toISOString()}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </time>
                  </Typography>
                </Box>
                {entry.message && (
                  <Typography
                    as="p"
                    className="tw:m-0 tw:whitespace-pre-wrap tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary_subtle tw:px-4 tw:py-3"
                    size="text-sm">
                    {entry.message}
                  </Typography>
                )}
              </Box>
            </li>
          );
        })}
      </ol>
    </Box>
  );
};

export default OntologyTaskThread;
