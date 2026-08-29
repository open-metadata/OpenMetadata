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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Space } from 'antd';
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
  conversationId: string;
  reply?: ConversationReply;
  isReply: boolean;
  onEditPost?: () => void;
}

const ActivityFeedActions = ({
  conversation,
  conversationId,
  reply,
  isReply,
  onEditPost,
}: ActivityFeedActionsProps) => {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const { currentUser } = useApplicationStore();
  const author = isReply
    ? reply?.author.name ?? reply?.author.fullyQualifiedName
    : conversation?.createdBy?.name ??
      conversation?.createdBy?.fullyQualifiedName;
  const authorId = isReply ? reply?.author.id : conversation?.createdBy?.id;
  const isAuthor = authorId
    ? authorId === currentUser?.id
    : author === currentUser?.name;
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
    const targetId = reply?.id ?? conversationId;
    deleteFeed(conversationId, targetId, !isReply).catch(() => {
      // ignore since error is displayed in toast in the parent promise.
    });
    setShowDeleteDialog(false);
    if (!isReply) {
      hideDrawer();
    }
  };

  const canManage = isAuthor || Boolean(currentUser?.isAdmin);

  const handleResolvedChange = () => {
    if (!conversation || isReply) {
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
        className="feed-actions"
        data-testid="feed-actions"
        dir={dir}
        size={12}>
        {!isReply && conversation && (
          <Icon
            className="toolbar-button"
            component={IconReply}
            data-testid="add-reply"
            style={{ fontSize: '16px' }}
            onClick={onReply}
          />
        )}

        {!isReply && conversation && canManage && (
          <Icon
            aria-label={
              conversation.resolved ? t('label.open') : t('label.resolve')
            }
            className="toolbar-button"
            component={ResolveIcon}
            data-testid="toggle-resolved"
            style={{ fontSize: '16px' }}
            onClick={handleResolvedChange}
          />
        )}

        {canManage && (
          <Icon
            className="toolbar-button"
            component={IconEdit}
            data-testid="edit-message"
            style={{ fontSize: '16px' }}
            onClick={onEditPost}
          />
        )}

        {canManage && (
          <Icon
            className="toolbar-button"
            component={DeleteIcon}
            data-testid="delete-message"
            style={{ fontSize: '16px' }}
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
