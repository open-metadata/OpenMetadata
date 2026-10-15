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
import { Badge, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { Task, TaskEntityStatus } from '../../../../rest/tasksAPI';
import {
  getMetadataCompletionInstruction,
  getMetadataCompletionPayload,
  getRequiredFieldLabel,
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
  // The task names missing fields; an unmet condition is reported, not spelled out.
  const conditionsUnmet = isOpen && payload.conditionsMet === false;

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-secondary tw:p-4"
      data-testid="metadata-completion-task">
      <Typography as="p" className="tw:text-sm tw:text-secondary">
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
      {conditionsUnmet && (
        <Typography
          as="p"
          className="tw:text-sm tw:text-warning-primary"
          data-testid="metadata-completion-conditions">
          {t('message.lifecycle-conditions-not-met')}
        </Typography>
      )}
      {task.status === TaskEntityStatus.Completed && (
        <Typography as="p" className="tw:text-sm tw:text-primary">
          {t('message.metadata-completion-filled-in')}
        </Typography>
      )}
      {isOpen && (
        <Typography as="p" className="tw:text-xs tw:text-tertiary">
          {t('message.metadata-completion-hint')}
        </Typography>
      )}
    </div>
  );
};

export default MetadataCompletionTask;
