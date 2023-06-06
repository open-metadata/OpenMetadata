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
import { Button, Popover } from 'antd';
import AppState from 'AppState';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import Reaction from 'components/Reactions/Reaction';
import { REACTION_LIST } from 'constants/reactions.constant';
import { ReactionOperation } from 'enums/reactions.enum';
import {
  Post,
  ReactionType,
  Thread,
  ThreadType,
} from 'generated/entity/feed/thread';
import { uniqueId } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import DeleteConfirmationModal from '../DeleteConfirmationModal/DeleteConfirmationModal';
import { ReactComponent as RightIcon } from '/assets/svg/arrow-right-light.svg';
import { ReactComponent as DeleteIcon } from '/assets/svg/ic-delete.svg';

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
    isDrawerOpen,
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
    if (!isDrawerOpen) {
      showDrawer(feed);
    }
    updateEditorFocus(true);
  };

  const editCheck = useMemo(() => {
    if (feed.type === ThreadType.Announcement && !isPost) {
      return false;
    } else if (isAuthor || currentUser?.isAdmin) {
      return true;
    }

    return false;
  }, [post, feed, currentUser]);

  const deleteCheck = useMemo(() => {
    return isAuthor || currentUser?.isAdmin;
  }, [post, feed, isAuthor, currentUser]);

  return (
    <>
      <div className="feed-actions">
        <Button
          className="d-flex justify-center items-center expand-button"
          icon={<RightIcon className="rotate-inverse" />}
          size="small"
        />

        <div className="action-buttons">
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
            <Button
              className="toolbar-button"
              data-testid="add-reactions"
              size="small"
              type="text"
              onClick={(e) => e.stopPropagation()}>
              <SVGIcons
                alt="add-reaction"
                icon={Icons.REACTION}
                title={t('label.add-entity', {
                  entity: t('label.reaction-lowercase-plural'),
                })}
                width="16px"
              />
            </Button>
          </Popover>

          {!isPost && (
            <Button
              className="toolbar-button"
              data-testid="add-reply"
              size="small"
              type="text"
              onClick={onReply}>
              <SVGIcons
                alt="add-reply"
                icon={Icons.ADD_REPLY}
                title={t('label.reply')}
                width="16px"
              />
            </Button>
          )}

          {editCheck && (
            <Button
              className="toolbar-button"
              data-testid="edit-message"
              icon={<EditIcon width={14} />}
              size="small"
              title={t('label.edit')}
              type="text"
              onClick={onEditPost}
            />
          )}

          {deleteCheck && (
            <Button
              className="toolbar-button"
              data-testid="delete-message"
              icon={<DeleteIcon width={14} />}
              size="small"
              title={t('label.delete')}
              type="text"
              onClick={() => setShowDeleteDialog(true)}
            />
          )}
        </div>
      </div>
      <DeleteConfirmationModal
        visible={showDeleteDialog}
        onDelete={handleDelete}
        onDiscard={() => setShowDeleteDialog(false)}
      />
    </>
  );
};

export default ActivityFeedActions;
