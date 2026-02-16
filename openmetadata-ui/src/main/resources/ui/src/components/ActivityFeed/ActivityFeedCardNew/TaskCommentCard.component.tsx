/*
 *  Copyright 2024 Collate.
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

import { Space, Tooltip, Typography } from 'antd';
import { FC, useMemo } from 'react';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { Task, TaskComment } from '../../../rest/tasksAPI';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getFrontEndFormat } from '../../../utils/FeedUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';

interface TaskCommentCardProps {
  comment: TaskComment;
  task: Task;
  isLastReply?: boolean;
  closeFeedEditor?: () => void;
}

const TaskCommentCard: FC<TaskCommentCardProps> = ({
  comment,
  isLastReply = false,
}) => {
  const [, , user] = useUserProfile({
    permission: true,
    name: comment.author?.name ?? '',
  });

  const authorName = useMemo(
    () => getEntityName(user) || comment.author?.name || 'Unknown',
    [user, comment.author]
  );

  return (
    <div
      className={`p-y-md p-x-sm ${!isLastReply ? 'border-bottom' : ''}`}
      data-testid="task-comment-card">
      <Space align="start" className="w-full" size={12}>
        <ProfilePicture
          displayName={authorName}
          name={comment.author?.name ?? ''}
          width="32"
        />
        <div className="flex-1">
          <Space className="w-full" size={4}>
            <Typography.Text className="font-medium" data-testid="author-name">
              {authorName}
            </Typography.Text>
            {comment.createdAt && (
              <Tooltip title={formatDateTime(comment.createdAt)}>
                <Typography.Text
                  className="text-grey-muted text-xs"
                  data-testid="comment-time">
                  {getRelativeTime(comment.createdAt)}
                </Typography.Text>
              </Tooltip>
            )}
          </Space>
          <div className="m-t-xs">
            <RichTextEditorPreviewNew
              enableSeeMoreVariant={false}
              markdown={getFrontEndFormat(comment.message)}
            />
          </div>
        </div>
      </Space>
    </div>
  );
};

export default TaskCommentCard;
