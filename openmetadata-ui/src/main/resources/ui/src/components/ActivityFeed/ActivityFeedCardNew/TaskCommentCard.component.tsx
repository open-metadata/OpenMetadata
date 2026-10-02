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
import { Space, Tooltip, Typography } from 'antd';
import { FC, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import withSuspenseFallback from '../../../components/AppRouter/withSuspenseFallback';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { TaskComment } from '../../../rest/tasksAPI';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../utils/FeedUtilsPure';
import { getUserPath } from '../../../utils/RouterUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import '../Shared/activity-feed-actions.less';

const ActivityFeedEditor = withSuspenseFallback(
  lazy(() => import('../ActivityFeedEditor/ActivityFeedEditorNew'))
);
const ConfirmationModal = withSuspenseFallback(
  lazy(
    () =>
      import('../../../components/Modals/ConfirmationModal/ConfirmationModal')
  )
);

interface TaskCommentCardProps {
  comment: TaskComment;
  isLastReply?: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (message: string) => Promise<void>;
  onDelete: () => Promise<void>;
  closeFeedEditor?: () => void;
}

const TaskCommentCard: FC<TaskCommentCardProps> = ({
  comment,
  isLastReply = false,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  closeFeedEditor,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const [, , user] = useUserProfile({
    permission: true,
    name: comment.author?.name ?? '',
  });

  const authorName = useMemo(
    () => getEntityName(user) || comment.author?.name || 'Unknown',
    [user, comment.author]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isEditing &&
        editorRef.current &&
        !editorRef.current.contains(event.target as Node)
      ) {
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing]);

  const handleEditClick = () => {
    closeFeedEditor?.();
    setIsEditing((prev) => !prev);
  };

  const handleSave = useCallback(async () => {
    // The editor stays open while the save is in flight, so guard against a
    // second submit firing a concurrent edit.
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onEdit(draft);
      setIsEditing(false);
    } catch {
      // Keep the editor open and the draft intact so the edit can be retried.
      // The caller owns reporting the failure.
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onEdit, draft]);

  const handleDelete = async () => {
    // The confirmation stays open for the length of the request, so without
    // this a second click fires a concurrent delete - the first succeeds, the
    // second 404s, and the user is shown a failure for a delete that worked.
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete();
      setShowDeleteDialog(false);
    } catch {
      // Leave the confirmation open so the delete can be retried. The caller
      // owns reporting the failure.
    } finally {
      setIsDeleting(false);
    }
  };

  const defaultValue = useMemo(
    () => MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(comment.message)),
    [comment.message]
  );

  return (
    <div
      className={`task-comment-card p-y-md p-x-sm ${
        isLastReply ? '' : 'border-bottom'
      }`}
      data-testid="task-comment-card">
      <Space align="start" className="w-full" size={12}>
        <ProfilePicture
          displayName={authorName}
          name={comment.author?.name ?? ''}
          width="32"
        />
        <div className="flex-1">
          <div className="d-flex items-center justify-between gap-2">
            <Space size={4}>
              <Link
                className="font-medium"
                data-testid="author-name"
                to={getUserPath(comment.author?.name ?? '')}>
                {authorName}
              </Link>
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
            {(canEdit || canDelete) && (
              <Space
                aria-label={t('label.action-plural')}
                className="task-comment-actions"
                data-testid="feed-actions"
                role="group"
                size={4}>
                {canEdit && (
                  <ButtonUtility
                    className="toolbar-button"
                    color="tertiary"
                    data-testid="edit-message"
                    icon={IconEdit}
                    size="xs"
                    tooltip={t('label.edit')}
                    onClick={handleEditClick}
                  />
                )}
                {canDelete && (
                  <ButtonUtility
                    className="toolbar-button"
                    color="tertiary"
                    data-testid="delete-message"
                    icon={DeleteIcon}
                    size="xs"
                    tooltip={t('label.delete')}
                    onClick={() => setShowDeleteDialog(true)}
                  />
                )}
              </Space>
            )}
          </div>
          <div className="m-t-xs">
            {isEditing ? (
              <div ref={editorRef}>
                <ActivityFeedEditor
                  focused
                  className="mb-8 reply-feed-editor"
                  defaultValue={defaultValue}
                  editorClass="is_edit_post"
                  onSave={handleSave}
                  onTextChange={setDraft}
                />
              </div>
            ) : (
              <RichTextEditorPreviewNew
                markdown={getFrontEndFormat(comment.message)}
              />
            )}
          </div>
        </div>
      </Space>
      <ConfirmationModal
        bodyText={t('message.confirm-delete-message')}
        cancelText={t('label.cancel')}
        confirmText={t('label.delete')}
        header={t('message.delete-message-question-mark')}
        isLoading={isDeleting}
        visible={showDeleteDialog}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default TaskCommentCard;
