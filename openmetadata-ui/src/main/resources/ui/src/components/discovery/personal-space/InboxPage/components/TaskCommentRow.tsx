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

import {
  Badge,
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ActivityFeedEditorNew from '../../../../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import DeleteModal from '../../../../../components/common/DeleteModal/DeleteModal';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import {
  deleteTaskComment,
  editTaskComment,
  TaskComment,
} from '../../../../../rest/tasksAPI';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../../utils/FeedUtilsPure';
import { resolveCommentPermissions } from '../../../../../utils/TaskCommentUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { formatInboxDateTime } from '../inbox.utils';

export interface TaskCommentRowProps {
  comment: TaskComment;
  taskId: string;
  // Reload the task after an edit or delete so the comment list stays in sync.
  onChanged: () => void;
}

interface TaskCommentActionsProps {
  canDelete: boolean;
  canEdit: boolean;
  onDeleteRequest: () => void;
  onEditRequest: () => void;
}

/**
 * Edit/delete affordances for a comment row.
 *
 * Real buttons, kept mounted and revealed with opacity: unmounting them until
 * hover puts them out of reach of the keyboard.
 */
const TaskCommentActions = ({
  canDelete,
  canEdit,
  onDeleteRequest,
  onEditRequest,
}: TaskCommentActionsProps) => {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t('label.action-plural')}
      className="tw:flex tw:items-center tw:gap-1 tw:opacity-0 tw:motion-safe:transition-opacity tw:group-hover:opacity-100 tw:focus-within:opacity-100"
      data-testid="task-comment-actions"
      role="group">
      {canEdit && (
        <ButtonUtility
          color="tertiary"
          data-testid="edit-task-comment"
          icon={EditIcon}
          size="xs"
          tooltip={t('label.edit')}
          onClick={onEditRequest}
        />
      )}
      {canDelete && (
        <ButtonUtility
          color="tertiary"
          data-testid="delete-task-comment"
          icon={DeleteIcon}
          size="xs"
          tooltip={t('label.delete')}
          onClick={onDeleteRequest}
        />
      )}
    </div>
  );
};

interface TaskCommentBodyProps {
  comment: TaskComment;
  isEditing: boolean;
  onCancelEdit: () => void;
  onSave: (message: string) => Promise<void>;
}

/** The comment's editor when editing, else its rendered markdown. */
const TaskCommentBody = ({
  comment,
  isEditing,
  onCancelEdit,
  onSave,
}: TaskCommentBodyProps) => {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <Box data-testid="edit-task-comment-editor" direction="col" gap={2}>
        <ActivityFeedEditorNew
          focused
          defaultValue={MarkdownToHTMLConverter.makeHtml(
            getFrontEndFormat(comment.message)
          )}
          onSave={onSave}
        />
        <Box align="center" className="tw:justify-end">
          <Button
            color="link-gray"
            data-testid="cancel-edit-task-comment"
            size="sm"
            onPress={onCancelEdit}>
            {t('label.cancel')}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <RichTextEditorPreviewerV1
      className="inbox-feed-message tw:text-sm"
      markdown={getFrontEndFormat(comment.message)}
    />
  );
};

/**
 * A task comment as a bordered bubble: author, timestamp and message, with the
 * author's own comments flagged so a thread reads at a glance. The author can
 * edit or delete it (admins can also delete); the actions surface on hover.
 *
 * The avatar gutter belongs to the timeline row that renders this, so a comment
 * and an event line up on the same rail.
 */
const TaskCommentRow: React.FC<TaskCommentRowProps> = ({
  comment,
  taskId,
  onChanged,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const authorName = getEntityName(comment.author);

  const {
    canEdit,
    canDelete,
    canModify: canModifyComment,
  } = resolveCommentPermissions(currentUser, comment);
  const isOwnComment =
    Boolean(currentUser?.name) && comment.author?.name === currentUser?.name;

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditSave = useCallback(
    async (message: string) => {
      if (!message) {
        return;
      }
      try {
        await editTaskComment(taskId, comment.id, message);
        setIsEditing(false);
        onChanged();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [taskId, comment.id, onChanged]
  );

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteTaskComment(taskId, comment.id);
      setShowDeleteDialog(false);
      onChanged();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  }, [taskId, comment.id, onChanged]);

  return (
    <Box
      className="tw:group tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-4 tw:py-3"
      data-testid="task-comment-card"
      direction="col"
      gap={2}>
      <Box align="center" className="tw:justify-between" gap={2}>
        <Box align="center" className="tw:min-w-0" gap={2}>
          <Typography size="text-sm" weight="semibold">
            {authorName}
          </Typography>
          <Typography className="tw:text-secondary" size="text-xs">
            {formatInboxDateTime(comment.createdAt)}
          </Typography>
        </Box>
        <Box align="center" className="tw:shrink-0" gap={2}>
          {!isEditing && canModifyComment && (
            <TaskCommentActions
              canDelete={canDelete}
              canEdit={canEdit}
              onDeleteRequest={() => setShowDeleteDialog(true)}
              onEditRequest={() => setIsEditing(true)}
            />
          )}
          {isOwnComment && (
            <Badge color="gray" size="sm" type="pill-color">
              {t('label.you')}
            </Badge>
          )}
        </Box>
      </Box>
      <TaskCommentBody
        comment={comment}
        isEditing={isEditing}
        onCancelEdit={() => setIsEditing(false)}
        onSave={handleEditSave}
      />

      <DeleteModal
        entityTitle={t('label.comment')}
        isDeleting={isDeleting}
        message={t('message.confirm-delete-message')}
        open={showDeleteDialog}
        onCancel={() => setShowDeleteDialog(false)}
        onDelete={handleDelete}
      />
    </Box>
  );
};

export default TaskCommentRow;
