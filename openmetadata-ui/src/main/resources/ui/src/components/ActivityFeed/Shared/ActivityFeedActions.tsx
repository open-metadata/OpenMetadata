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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import { Space } from 'antd';
import classNames from 'classnames';
import { lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as ResolveIcon } from '../../../assets/svg/ic-check-circle.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import withSuspenseFallback from '../../../components/AppRouter/withSuspenseFallback';
import {
  Conversation,
  ConversationReply,
} from '../../../generated/entity/feed/conversation';

import { ReactComponent as IconReply } from '../../../assets/svg/ic-reply.svg';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { isFeedPostAuthor } from '../../../utils/FeedUtilsPure';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './activity-feed-actions.less';

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
  onDelete?: () => void;
  /**
   * Reveal styling from the owning card. These actions stay mounted so they
   * remain reachable by Tab and by a screen reader; a consumer that wants them
   * revealed on pointer hover does that with opacity on a `tw:group` ancestor,
   * never by unmounting them.
   */
  className?: string;
}

/**
 * Fall back to the feed's own author-or-admin rule for whichever action the
 * caller did not state a permission for.
 */
const resolveActionVisibility = (
  isAuthor: boolean,
  isAdmin: boolean,
  canEdit?: boolean,
  canDelete?: boolean
) => {
  const canManage = isAuthor || isAdmin;

  return {
    canManage,
    showDelete: canDelete ?? canManage,
    showEdit: canEdit ?? canManage,
  };
};

const getIsAuthor = (
  isReply: boolean,
  currentUser: { id?: string; name?: string } | undefined,
  conversation?: Conversation,
  reply?: ConversationReply
): boolean =>
  isFeedPostAuthor(
    currentUser,
    isReply ? reply?.author : conversation?.createdBy
  );

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
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const { currentUser } = useApplicationStore();
  const isAuthor = getIsAuthor(isReply, currentUser, conversation, reply);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { deleteFeed, showDrawer, hideDrawer, updateEditorFocus, updateFeed } =
    useActivityFeedProvider();

  const onReply = () => {
    if (!conversation) {
      return;
    }
    showDrawer(conversation);

    updateEditorFocus(true);
  };

  const handleDelete = () => {
    setShowDeleteDialog(false);

    if (onDelete) {
      onDelete();

      return;
    }

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

  const { canManage, showEdit, showDelete } = resolveActionVisibility(
    isAuthor,
    Boolean(currentUser?.isAdmin),
    canEdit,
    canDelete
  );

  const handleResolvedChange = () => {
    if (!conversation || isReply || !conversationId) {
      return;
    }
    updateFeed(conversationId, conversationId, true, [
      {
        op: 'replace',
        path: '/resolved',
        value: !conversation.resolved,
      },
    ]);
  };

  return (
    <>
      <Space
        aria-label={t('label.action-plural')}
        className={classNames('feed-actions', className)}
        data-testid="feed-actions"
        dir={dir}
        role="group"
        size={12}>
        {!isReply && conversation && (
          <ButtonUtility
            className="toolbar-button"
            color="tertiary"
            data-testid="add-reply"
            icon={IconReply}
            size="xs"
            tooltip={t('label.reply')}
            onClick={onReply}
          />
        )}

        {!isReply && conversation && canManage && (
          <ButtonUtility
            className="toolbar-button"
            color="tertiary"
            data-testid="toggle-resolved"
            icon={ResolveIcon}
            size="xs"
            tooltip={
              conversation.resolved ? t('label.open') : t('label.resolve')
            }
            onClick={handleResolvedChange}
          />
        )}

        {showEdit && (
          <ButtonUtility
            className="toolbar-button"
            color="tertiary"
            data-testid="edit-message"
            icon={IconEdit}
            size="xs"
            tooltip={t('label.edit')}
            onClick={onEditPost}
          />
        )}

        {showDelete && (
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
      <ConfirmationModal
        bodyText={t('message.confirm-delete-message')}
        cancelText={t('label.cancel')}
        confirmText={t('label.delete')}
        header={t('message.delete-message-question-mark')}
        visible={showDeleteDialog}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default ActivityFeedActions;
