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
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Revision } from '../../../../generated/type/metadataCompletionPayload';
import { useUserProfile } from '../../../../hooks/user-profile/useUserProfile';
import { Task, TaskEntityStatus } from '../../../../rest/tasksAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import {
  getMetadataCompletionInstruction,
  getMetadataCompletionPayload,
  getRequiredFieldLabel,
} from './MetadataCompletionTask.utils';

interface MetadataCompletionTaskProps {
  task: Task;
}

/** Who rejected the approval, by display name, with their profile on hover. */
const RevisionRequester = ({ userName }: { userName: string }) => {
  const { t } = useTranslation();
  const [, , user] = useUserProfile({ permission: true, name: userName });

  return (
    <Box
      align="center"
      data-testid="metadata-completion-revision-requested-by"
      gap={2}>
      <Typography as="span" color="secondary" size="text-xs" weight="medium">
        {t('label.requested-by')}
      </Typography>
      <UserPopOverCard
        showUserName
        displayName={user ? getEntityName(user) : userName}
        userName={userName}
      />
    </Box>
  );
};

/** The reviewer's comment on a rejected approval, and who rejected it. */
const RevisionNote = ({ revision }: { revision: Revision }) => {
  const { t } = useTranslation();

  return (
    <Card
      color="secondary"
      data-testid="metadata-completion-revision"
      size="sm">
      <Card.Content>
        <Box direction="col" gap={2}>
          <Box direction="col" gap={1}>
            <Typography
              as="span"
              color="secondary"
              size="text-xs"
              weight="medium">
              {t('label.comment')}
            </Typography>
            <Typography
              as="p"
              color={revision.comment ? undefined : 'secondary'}
              data-testid="metadata-completion-revision-comment"
              size="text-sm">
              {revision.comment ??
                t('message.metadata-completion-revision-no-comment')}
            </Typography>
          </Box>
          {revision.requestedBy && (
            <RevisionRequester userName={revision.requestedBy} />
          )}
        </Box>
      </Card.Content>
    </Card>
  );
};

/** How the task ended, or while it is open, how it closes. */
const CompletionStatus = ({
  status,
  isRevision,
}: {
  status: Task['status'];
  isRevision: boolean;
}) => {
  const { t } = useTranslation();
  let message: ReactNode = null;
  if (status === TaskEntityStatus.Completed) {
    message = (
      <Typography as="p" size="text-sm">
        {isRevision
          ? t('message.metadata-completion-resubmitted')
          : t('message.metadata-completion-filled-in')}
      </Typography>
    );
  } else if (status === TaskEntityStatus.Open && !isRevision) {
    message = (
      <Typography as="p" color="secondary" size="text-xs">
        {t('message.metadata-completion-hint')}
      </Typography>
    );
  }

  return message;
};

/** What a lifecycle stage still needs, which the task's own workflow keeps current. */
const MetadataCompletionTask = ({ task }: MetadataCompletionTaskProps) => {
  const { t } = useTranslation();
  const payload = getMetadataCompletionPayload(task);
  const missingFields = payload.missingFields ?? [];
  const isOpen = task.status === TaskEntityStatus.Open;
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
          {payload.revision && <RevisionNote revision={payload.revision} />}
          {conditionsUnmet && (
            <Typography
              as="p"
              className="tw:text-warning-primary"
              data-testid="metadata-completion-conditions"
              size="text-sm">
              {t('message.lifecycle-conditions-not-met')}
            </Typography>
          )}
          <CompletionStatus
            isRevision={Boolean(payload.revision)}
            status={task.status}
          />
        </Box>
      </Card.Content>
    </Card>
  );
};

export default MetadataCompletionTask;
