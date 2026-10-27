/*
 *  Copyright 2023 Collate.
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
import { Dropdown } from '@openmetadata/ui-core-components';
import { Edit01, Trash01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../../components/AppRouter/withSuspenseFallback';
import {
  Conversation,
  ConversationReply,
} from '../../../generated/entity/feed/conversation';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { canManageFeedPost } from '../../../utils/FeedUtilsPure';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';

const ConfirmationModal = withSuspenseFallback(
  lazy(
    () =>
      import('../../../components/Modals/ConfirmationModal/ConfirmationModal')
  )
);

interface ActivityFeedActionsProps {
  conversation?: Conversation;
  conversationId?: string;
  reply?: ConversationReply;
  isReply: boolean;
  /**
   * Whether this user may edit / delete. Default to the feed's own
   * author-or-admin rule so existing call sites are unaffected; a caller whose
   * backend applies a different rule per action - task comments, where the
   * author edits but the author *or* an admin deletes - passes them
   * explicitly.
   */
  canEdit?: boolean;
  canDelete?: boolean;
  onEditPost?: () => void;
  /**
   * Replaces the provider-backed delete. Required by callers outside the
   * activity feed, which have no conversation to delete a post from.
   */
  onDelete?: () => void | Promise<void>;
  /** Places the menu trigger within the owning card. */
  className?: string;
}

/**
 * Fall back to the feed's own author-or-admin rule for whichever action the
 * caller did not state a permission for.
 *
 * This default is the *conversation* rule, not the task-comment one. A
 * conversation reply is authorized through RBAC
 * (ConversationRepository#patchReply / #deleteReply ask the authorizer for
 * EDIT_ALL / DELETE), which an admin passes for both. A task comment is not:
 * TaskRepository#editComment takes no `isAdmin` at all and permits the author
 * only, while #deleteComment takes one and permits author-or-admin. The two
 * rules are deliberately different - do not collapse them. Callers rendering
 * task comments pass `canEdit`/`canDelete` explicitly, derived from
 * `resolveCommentPermissions` in utils/TaskCommentUtils.
 */
const resolveActionVisibility = (
  canManage: boolean,
  canEdit?: boolean,
  canDelete?: boolean
) => ({
  showEdit: canEdit ?? canManage,
  showDelete: canDelete ?? canManage,
});

const ActivityFeedActions = ({
  conversation,
  conversationId,
  reply,
  isReply,
  canEdit,
  canDelete,
  onEditPost,
  onDelete,
  className,
}: ActivityFeedActionsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteFeed, hideDrawer } = useActivityFeedProvider();

  const handleDelete = async () => {
    if (onDelete) {
      // The confirmation stays open for the length of the request, so without
      // this the button remains clickable and a second click fires a
      // concurrent delete - the first succeeds, the second 404s, and the user
      // is shown a failure for a delete that actually worked.
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

      return;
    }

    setShowDeleteDialog(false);

    if (!conversationId) {
      return;
    }

    deleteFeed(conversationId, reply?.id ?? conversationId, !isReply).catch(
      () => {
        // ignore since error is displayed in toast in the parent promise.
      }
    );

    if (!isReply) {
      hideDrawer();
    }
  };

  const { showEdit, showDelete } = resolveActionVisibility(
    canManageFeedPost(
      currentUser,
      isReply ? reply?.author : conversation?.createdBy
    ),
    canEdit,
    canDelete
  );

  if (!showEdit && !showDelete) {
    return null;
  }

  return (
    <>
      <Dropdown.Root>
        {/* The menu trigger stays pressed while the menu is open; only a
            keyboard focus keeps the ring. size-6: a 24px target around the
            20px glyph, which a long name beside it must not shrink. */}
        <Dropdown.DotsButton
          className={({ isFocusVisible, isPressed }) =>
            classNames(
              'tw:size-6 tw:shrink-0',
              isPressed && !isFocusVisible && 'tw:outline-0',
              className
            )
          }
          data-testid="conversation-actions"
        />
        <Dropdown.Popover className="tw:w-min">
          <Dropdown.Menu
            aria-label={t('label.action-plural')}
            selectionMode="none"
            onAction={(key) =>
              key === 'delete' ? setShowDeleteDialog(true) : onEditPost?.()
            }>
            {showEdit ? (
              <Dropdown.Item
                data-testid="edit-message"
                icon={Edit01}
                id="edit"
                label={t('label.edit')}
              />
            ) : null}
            {showDelete ? (
              <Dropdown.Item
                data-testid="delete-message"
                icon={Trash01}
                id="delete"
                label={t('label.delete')}
              />
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
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
    </>
  );
};

export default ActivityFeedActions;
