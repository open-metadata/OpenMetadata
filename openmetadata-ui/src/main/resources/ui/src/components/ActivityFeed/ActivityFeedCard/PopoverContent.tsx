/*
 *  Copyright 2022 Collate.
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

import Icon from '@ant-design/icons';
import { Popover, Space } from 'antd';
import { isNil, isUndefined, uniqueId } from 'lodash';
import { FC, useMemo, useState } from 'react';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconFeedDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconReaction } from '../../../assets/svg/ic-reaction.svg';
import { ReactComponent as IconReplyFeed } from '../../../assets/svg/ic-reply.svg';
import { REACTION_LIST } from '../../../constants/reactions.constant';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { Post } from '../../../generated/entity/feed/thread';
import { ReactionType } from '../../../generated/type/reaction';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import Reaction from '../Reactions/Reaction';
import { ConfirmState } from './ActivityFeedCard.interface';

interface Props {
  isAuthor: boolean;
  isAnnouncement?: boolean;
  isThread?: boolean;
  threadId?: string;
  postId?: string;
  editAnnouncementPermission?: boolean;
  reactions: Post['reactions'];
  onReactionSelect: (
    reactionType: ReactionType,
    reactionOperation: ReactionOperation
  ) => void;
  onPopoverHide: () => void;
  onConfirmation?: (data: ConfirmState) => void;
  onReply?: () => void;
  onEdit?: () => void;
}

const PopoverContent: FC<Props> = ({
  isAuthor,
  isThread,
  threadId,
  postId,
  onConfirmation,
  onReply,
  reactions = [],
  onReactionSelect,
  onPopoverHide,
  onEdit,
  isAnnouncement,
  editAnnouncementPermission,
}) => {
  const { currentUser } = useApplicationStore();
  const [visible, setVisible] = useState<boolean>(false);

  const hide = () => {
    setVisible(false);
  };

  const handleVisibleChange = (newVisible: boolean) => {
    setVisible(newVisible);
  };

  const deleteButtonCheck = useMemo(() => {
    const baseCheck = Boolean(threadId && postId && onConfirmation);

    return Boolean(baseCheck && (isAuthor || currentUser?.isAdmin));
  }, [threadId, postId, onConfirmation, isAuthor, currentUser]);

  const editCheck = useMemo(() => {
    if (isAnnouncement) {
      return editAnnouncementPermission;
    } else {
      return isAuthor || currentUser?.isAdmin;
    }
  }, [isAuthor, currentUser, isAnnouncement, editAnnouncementPermission]);

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onConfirmation?.({
      state: true,
      postId: postId,
      threadId,
      isThread: Boolean(isThread),
    });
    onPopoverHide();
  };

  const handleReply = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onReply?.();
    onPopoverHide();

    /**
     * if on reply method is undefined then get the panel element
     * and scroll to the bottom
     */
    if (isUndefined(onReply) && isThread) {
      const feedPanel = document.getElementById('feed-panel') as HTMLElement;
      const threadPanel = document.getElementById(
        'thread-panel'
      ) as HTMLElement;
      const taskFeed = document.querySelector(
        '.ant-layout-sider-task-detail'
      ) as HTMLElement;
      if (!isNil(feedPanel)) {
        feedPanel.scrollTop = feedPanel.scrollHeight;
      }
      if (!isNil(threadPanel)) {
        threadPanel.scrollTop = threadPanel.scrollHeight;
      }
      if (!isNil(taskFeed)) {
        taskFeed.scrollTop = taskFeed.scrollHeight;
      }
    }
  };

  /**
   *
   * @param reactionType
   * @returns true if current user has reacted with {reactionType}
   */
  const isReacted = (reactionType: ReactionType) => {
    return reactions.some(
      (reactionItem) =>
        reactionItem.user.id === currentUser?.id &&
        reactionType === reactionItem.reactionType
    );
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
          onPopoverHide();
        }}
        onReactionSelect={onReactionSelect}
      />
    );
  });

  const handleEdit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onEdit?.();
  };

  return (
    <Space size={12}>
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
          component={IconReaction}
          data-testid="add-reactions"
          style={{ fontSize: '16px' }}
        />
      </Popover>

      {(onReply || isThread) && (
        <Icon
          component={IconReplyFeed}
          data-testid="add-reply"
          style={{ fontSize: '16px' }}
          onClick={handleReply}
        />
      )}

      {editCheck && (
        <Icon
          component={IconEdit}
          data-testid="edit-message"
          style={{ fontSize: '16px' }}
          onClick={handleEdit}
        />
      )}

      {deleteButtonCheck ? (
        <Icon
          component={IconFeedDelete}
          data-testid="delete-message"
          style={{ fontSize: '16px' }}
          onClick={handleDelete}
        />
      ) : null}
    </Space>
  );
};

export default PopoverContent;
