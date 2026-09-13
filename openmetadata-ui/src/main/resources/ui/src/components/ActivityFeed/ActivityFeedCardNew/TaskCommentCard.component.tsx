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
import classNames from 'classnames';
import {
  FC,
  RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { User } from '../../../generated/entity/teams/user';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { deleteTaskComment, Task, TaskComment } from '../../../rest/tasksAPI';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getFrontEndFormat } from '../../../utils/FeedUtilsPure';
import { getUserPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DeleteModal from '../../common/DeleteModal/DeleteModal';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
interface TaskCommentCardProps {
  comment: TaskComment;
  task: Task;
  isLastReply?: boolean;
  closeFeedEditor?: () => void;
  currentUser?: Pick<User, 'name' | 'isAdmin'>;
  onCommentDeleted?: () => void;
  /**
   * Focus fallback for when a deleted comment has no sibling comment left to
   * hand focus to. Must already carry a stable `tabIndex={-1}` - this
   * component only ever calls `.focus()` on it, it never mutates a foreign
   * parent node's attributes.
   */
  repliesContainerRef?: RefObject<HTMLElement>;
}

const TaskCommentCard: FC<TaskCommentCardProps> = ({
  comment,
  task,
  isLastReply = false,
  currentUser,
  onCommentDeleted,
  repliesContainerRef,
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

  const cardRef = useRef<HTMLDivElement>(null);

  // Removing the focused node (deleting this comment) must not let keyboard
  // focus fall through to <body> - move it to a sensible neighbour first.
  // This runs on unmount rather than inside handleDelete because the card
  // doesn't disappear until the parent's refetch resolves and re-renders;
  // by then react-aria has already restored focus to our own (about to be
  // removed) delete button, so redirecting it earlier would just get
  // overwritten. See frontend-a11y.md's focus-management rule.
  useLayoutEffect(
    () => () => {
      const card = cardRef.current;
      if (!card || !card.contains(document.activeElement)) {
        return;
      }

      const nextFocusTarget =
        (card.nextElementSibling as HTMLElement | null) ??
        (card.previousElementSibling as HTMLElement | null);

      if (nextFocusTarget) {
        nextFocusTarget.focus();
      } else {
        // No sibling comments left - fall back to the replies container,
        // which the parent already keeps focusable (tabIndex={-1}) for
        // exactly this case, rather than leaving focus on a node that's
        // about to be removed. Never mutate it ourselves - it's foreign,
        // shared DOM we don't own.
        repliesContainerRef?.current?.focus();
      }
    },
    [repliesContainerRef]
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

  const authorUserName = comment.author?.name;

  const profilePicture = (
    <ProfilePicture
      displayName={authorName}
      name={authorUserName ?? ''}
      width="32"
    />
  );

  const authorNameText = (
    <Typography.Text className="font-medium" data-testid="author-name">
      {authorName}
    </Typography.Text>
  );

  return (
    <div
      className={classNames('p-y-md p-x-sm tw:relative tw:group', {
        'border-bottom': !isLastReply,
      })}
      data-testid="task-comment-card"
      ref={cardRef}
      tabIndex={-1}>
      <Space align="start" className="w-full" size={12}>
        {authorUserName ? (
          <UserPopOverCard userName={authorUserName}>
            {profilePicture}
          </UserPopOverCard>
        ) : (
          profilePicture
        )}
        <div className="flex-1">
          <Space className="w-full" size={4}>
            {authorUserName ? (
              <UserPopOverCard userName={authorUserName}>
                <Link
                  className="font-medium"
                  data-testid="author-name"
                  to={getUserPath(authorUserName)}>
                  {authorName}
                </Link>
              </UserPopOverCard>
            ) : (
              authorNameText
            )}
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
        <>
          {/* Stays mounted so it is reachable by Tab, and is revealed on card
              hover or on its own focus rather than on a mouse-only hover state. */}
          <ButtonUtility
            className="tw:absolute tw:top-3 tw:right-2 tw:opacity-0 tw:motion-safe:transition-opacity tw:group-hover:opacity-100 tw:focus-visible:opacity-100"
            color="tertiary"
            data-testid="delete-task-comment"
            icon={DeleteIcon}
            size="xs"
            tooltip={t('label.delete')}
            onClick={() => setShowDeleteDialog(true)}
          />
          <DeleteModal
            elevated
            entityTitle={t('label.comment')}
            isDeleting={isDeleting}
            message={t('message.confirm-delete-message')}
            open={showDeleteDialog}
            onCancel={() => setShowDeleteDialog(false)}
            onDelete={handleDelete}
          />
        </>
      )}
    </div>
  );
};

export default TaskCommentCard;
