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
import { Popover, Space } from 'antd';
import { uniqueId } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppState from '../../../AppState';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconEdit } from '../../../assets/svg/ic-edit.svg';
import { ReactComponent as IconReaction } from '../../../assets/svg/ic-reaction.svg';
import { ReactComponent as IconReply } from '../../../assets/svg/ic-reply.svg';
import ConfirmationModal from '../../../components/Modals/ConfirmationModal/ConfirmationModal';
import Reaction from '../../../components/Reactions/Reaction';
import { REACTION_LIST } from '../../../constants/reactions.constant';
import { ReactionOperation } from '../../../enums/reactions.enum';
import {
  Post,
  ReactionType,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './activity-feed-actions.less';

interface ActivityFeedActionsProps {
  post: Post;
  feed: Thread;
  isPost: boolean;
  onEditPost?: () => void;
}

const ActivityFeedActions = ({
  post,
  feed,
  isPost,
  onEditPost,
}: ActivityFeedActionsProps) => {
  const { t } = useTranslation();
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );
  const isAuthor = post.from === currentUser?.name;
  const [visible, setVisible] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const {
    deleteFeed,
    showDrawer,
    hideDrawer,
    updateReactions,
    updateEditorFocus,
  } = useActivityFeedProvider();

  const hide = () => {
    setVisible(false);
  };

  const handleVisibleChange = (newVisible: boolean) => {
    setVisible(newVisible);
  };

  const handleDelete = () => {
    deleteFeed(feed.id, post.id, !isPost).catch(() => {
      // ignore since error is displayed in toast in the parent promise.
    });
    setShowDeleteDialog(false);
    if (!isPost) {
      hideDrawer();
    }
  };

  const isReacted = (reactionType: ReactionType) => {
    return (post.reactions ?? []).some(
      (reactionItem) =>
        reactionItem.user.id === currentUser?.id &&
        reactionType === reactionItem.reactionType
    );
  };

  const onReactionUpdate = (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => {
    updateReactions(post, feed.id, !isPost, reaction, operation);
  };

  // prepare reaction list for reaction popover
  const reactionList = REACTION_LIST.map((reaction) => {
    return (
      <Reaction
        isReacted={isReacted(reaction.reaction)}
        key={uniqueId()}
        reaction={reaction}
        onHide={() => {
          hide();
        }}
        onReactionSelect={onReactionUpdate}
      />
    );
  });

  const onReply = () => {
    showDrawer(feed);

    updateEditorFocus(true);
  };

  const editCheck = useMemo(() => {
    if (feed.type === ThreadType.Announcement && !isPost) {
      return false;
    } else if (feed.type === ThreadType.Task && !isPost) {
      return false;
    } else if (isAuthor) {
      return true;
    }

    return false;
  }, [post, feed, currentUser]);

  const deleteCheck = useMemo(() => {
    if (feed.type === ThreadType.Task && !isPost) {
      return false;
    } else if (isAuthor || currentUser?.isAdmin) {
      return true;
    }

    return false;
  }, [post, feed, isAuthor, currentUser]);

  return (
    <>
      <Space className="feed-actions" data-testid="feed-actions" size={12}>
        {feed.type !== ThreadType.Task && !isPost && (
          <Popover
            destroyTooltipOnHide
            align={{ targetOffset: [0, -10] }}
            content={reactionList}
            id="reaction-popover"
            open={visible}
            overlayClassName="ant-popover-feed-reactions"
            placement="topLeft"
            trigger="click"
            zIndex={9999}
            onOpenChange={handleVisibleChange}>
            <Icon
              className="toolbar-button"
              component={IconReaction}
              data-testid="add-reactions"
              style={{ fontSize: '16px' }}
            />
          </Popover>
        )}

        {!isPost && (
          <Icon
            className="toolbar-button"
            component={IconReply}
            data-testid="add-reply"
            style={{ fontSize: '16px' }}
            onClick={onReply}
          />
        )}

        {editCheck && (
          <Icon
            className="toolbar-button"
            component={IconEdit}
            data-testid="edit-message"
            style={{ fontSize: '16px' }}
            onClick={onEditPost}
          />
        )}

        {deleteCheck && (
          <Icon
            className="toolbar-button"
            component={DeleteIcon}
            data-testid="delete-message"
            style={{ fontSize: '16px' }}
            onClick={() => setShowDeleteDialog(true)}
          />
        )}
        {/* </div> */}
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
