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
import { Badge, Box, Card, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { Task, TaskEntityStatus } from '../../../../rest/tasksAPI';
import {
  getMetadataCompletionInstruction,
  getMetadataCompletionPayload,
  getRequiredFieldLabel,
  isRevisionTask,
} from './MetadataCompletionTask.utils';

interface MetadataCompletionTaskProps {
  task: Task;
}

/** What a lifecycle stage still needs, which the task's own workflow keeps current. */
const MetadataCompletionTask = ({ task }: MetadataCompletionTaskProps) => {
  const { t } = useTranslation();
  const payload = getMetadataCompletionPayload(task);
  const missingFields = payload.missingFields ?? [];
  const isOpen = task.status === TaskEntityStatus.Open;
  const revision = isRevisionTask(payload) ? payload.revision : undefined;
  // The task names missing fields; an unmet condition is reported, not spelled out.
  const conditionsUnmet = isOpen && payload.conditionsMet === false;

  return (
    <Card data-testid="metadata-completion-task" variant="default">
      <Card.Content>
        <Box direction="col" gap={3}>
          <Typography as="p" className="tw:text-secondary" size="text-sm">
            {getMetadataCompletionInstruction(payload, t)}
          </Typography>
          {isOpen && missingFields.length > 0 && (
            <ul
              className="tw:flex tw:flex-wrap tw:gap-2"
              data-testid="metadata-completion-missing-fields">
              {missingFields.map((field) => (
                <li key={field}>
                  <Badge color="warning" size="md" type="color">
                    {getRequiredFieldLabel(field, t)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {revision && (
            <Box
              className="tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-3"
              data-testid="metadata-completion-revision"
              direction="col"
              gap={1}>
              <Typography
                as="span"
                className="tw:text-secondary"
                size="text-xs"
                weight="medium">
                {revision.requestedBy
                  ? `${t('label.comment')} · ${t('label.requested-by')}: ${
                      revision.requestedBy
                    }`
                  : t('label.comment')}
              </Typography>
              <Typography
                as="p"
                className={
                  revision.comment ? 'tw:text-primary' : 'tw:text-tertiary'
                }
                data-testid="metadata-completion-revision-comment"
                size="text-sm">
                {revision.comment ??
                  t('message.metadata-completion-revision-no-comment')}
              </Typography>
            </Box>
          )}
          {conditionsUnmet && (
            <Typography
              as="p"
              className="tw:text-warning-primary"
              data-testid="metadata-completion-conditions"
              size="text-sm">
              {t('message.lifecycle-conditions-not-met')}
            </Typography>
          )}
          {task.status === TaskEntityStatus.Completed && (
            <Typography as="p" className="tw:text-primary" size="text-sm">
              {revision
                ? t('message.metadata-completion-resubmitted')
                : t('message.metadata-completion-filled-in')}
            </Typography>
          )}
          {isOpen && !revision && (
            <Typography as="p" className="tw:text-tertiary" size="text-xs">
              {t('message.metadata-completion-hint')}
            </Typography>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
};

export default MetadataCompletionTask;
