/*
 *  Copyright 2022 Collate.
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
import { Link } from 'react-router-dom';
import { INCIDENT_TASK_TYPES } from '../../constants/Task.constant';
import { getRelativeTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../utils/ObservabilityRouterClassBase';
import { TaskCommentMention } from '../../utils/tasks/TaskMentions.utils';
import { getTaskDetailPath } from '../../utils/TaskUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';

export const TaskMentionCard = ({
  mention,
}: {
  mention: TaskCommentMention;
}) => {
  const { t } = useTranslation();
  const { task, comment } = mention;
  const authorName = getEntityName(comment.author);
  const path = INCIDENT_TASK_TYPES.has(task.type)
    ? observabilityRouterClassBase.getIncidentTaskPath(task)
    : getTaskDetailPath(task);

  return (
    <Link data-testid="task-mention-notification" to={path}>
      <Box align="start" gap={3}>
        <ProfilePicture name={comment.author.name ?? ''} width="32" />
        <Box direction="col" gap={1}>
          <Typography size="text-sm">
            <strong>{authorName}</strong>{' '}
            {t('message.mentioned-you-on-the-lowercase')}{' '}
            {t('label.task-lowercase')} {getEntityName(task.about) || task.name}
          </Typography>
          <Typography color="secondary" size="text-xs">
            {getRelativeTime(comment.createdAt)}
          </Typography>
        </Box>
      </Box>
    </Link>
  );
};
