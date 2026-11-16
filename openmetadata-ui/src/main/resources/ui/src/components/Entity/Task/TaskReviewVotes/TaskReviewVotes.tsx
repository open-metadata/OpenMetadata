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
import { useTranslation } from 'react-i18next';
import {
  ReviewVoteDecision,
  Task,
} from '../../../../generated/entity/tasks/task';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getCurrentStageVotes,
  hasVotedInCurrentStage,
  isTaskPendingFurtherApproval,
} from '../../../../utils/TaskNavigationUtils';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';

interface TaskReviewVotesProps {
  task: Task;
  currentUserId?: string;
}

/** Who has already decided a multi-approver task, so a counted vote is visible before the threshold. */
const TaskReviewVotes = ({ task, currentUserId }: TaskReviewVotesProps) => {
  const { t } = useTranslation();
  const votes = getCurrentStageVotes(task);

  if (votes.length === 0) {
    return null;
  }

  return (
    <Box data-testid="task-review-votes" direction="col" gap={2}>
      {votes.map((vote) => {
        const user = getEntityName(vote.voter);

        return (
          <Box align="center" gap={2} key={vote.voter.id}>
            <ProfilePicture
              displayName={user}
              name={vote.voter.name ?? ''}
              width="20"
            />
            <Typography size="text-sm">
              {vote.decision === ReviewVoteDecision.Approved
                ? t('message.user-approved-task', { user })
                : t('message.user-rejected-task', { user })}
            </Typography>
          </Box>
        );
      })}
      {isTaskPendingFurtherApproval(task) &&
        hasVotedInCurrentStage(task, { id: currentUserId }) && (
          <Typography
            className="tw:text-tertiary"
            data-testid="task-review-votes-waiting"
            size="text-sm">
            {t('message.vote-recorded-waiting-for-other-approvers')}
          </Typography>
        )}
    </Box>
  );
};

export default TaskReviewVotes;
