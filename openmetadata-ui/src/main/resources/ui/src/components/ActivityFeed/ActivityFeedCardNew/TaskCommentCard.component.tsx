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

import { ButtonUtility } from '@openmetadata/ui-core-components';
import { Delete as DeleteIcon } from '@openmetadata/ui-core-components/icons';
import { Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { deleteTaskComment, Task, TaskComment } from '../../../rest/tasksAPI';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getFrontEndFormat } from '../../../utils/FeedUtilsPure';
import { showErrorToast } from '../../../utils/ToastUtils';
import DeleteModal from '../../common/DeleteModal/DeleteModal';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
interface TaskCommentCardProps {
  comment: TaskComment;
  task: Task;
  isLastReply?: boolean;
  closeFeedEditor?: () => void;
  currentUser?: { name?: string; isAdmin?: boolean };
  onCommentDeleted?: () => void;
}

const TaskCommentCard: FC<TaskCommentCardProps> = ({
  comment,
  task,
  isLastReply = false,
  currentUser,
  onCommentDeleted,
}) => {
  const { t } = useTranslation();
  const [, , user] = useUserProfile({
    permission: true,
    name: comment.author?.name ?? '',
  });

  const authorName = useMemo(
    () => getEntityName(user) || comment.author?.name || 'Unknown',
    [user, comment.author]
  );

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = useMemo(
    () =>
      (Boolean(currentUser?.name) &&
        comment.author?.name === currentUser?.name) ||
      Boolean(currentUser?.isAdmin),
    [currentUser, comment.author]
  );

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTaskComment(task.id, comment.id);
      setShowDeleteDialog(false);
      onCommentDeleted?.();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`p-y-md p-x-sm relative tw:group ${
        !isLastReply ? 'border-bottom' : ''
      }`}
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
              markdown={getFrontEndFormat(comment.message)}
            />
          </div>
        </div>
      </Space>
      {canDelete && (
        // Stays mounted so it is reachable by Tab, and is revealed on card hover or
        // on its own focus rather than on a mouse-only hover state.
        <ButtonUtility
          className="tw:absolute tw:top-3 tw:right-2 tw:opacity-0 tw:transition-opacity tw:group-hover:opacity-100 tw:focus-visible:opacity-100"
          color="tertiary"
          data-testid="delete-task-comment"
          icon={DeleteIcon}
          size="xs"
          tooltip={t('label.delete')}
          onClick={() => setShowDeleteDialog(true)}
        />
      )}
      <DeleteModal
        entityTitle={t('label.comment')}
        isDeleting={isDeleting}
        message={t('message.confirm-delete-message')}
        open={showDeleteDialog}
        onCancel={() => setShowDeleteDialog(false)}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default TaskCommentCard;
