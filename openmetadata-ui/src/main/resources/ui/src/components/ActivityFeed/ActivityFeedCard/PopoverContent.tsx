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

import { Button, Popover, Space } from 'antd';
import { isNil, isUndefined, uniqueId } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppState from '../../../AppState';
import { REACTION_LIST } from '../../../constants/reactions.constant';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { Post } from '../../../generated/entity/feed/thread';
import { ReactionType } from '../../../generated/type/reaction';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import Reaction from '../../Reactions/Reaction';
import { ConfirmState } from './ActivityFeedCard.interface';

interface Props {
  isAuthor: boolean;
  isAnnouncement?: boolean;
  isThread?: boolean;
  threadId?: string;
  postId?: string;
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
}) => {
  const { t } = useTranslation();
  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

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

  const editCheck = useMemo(
    () => isAuthor || currentUser?.isAdmin,
    [isAuthor, currentUser]
  );

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onConfirmation &&
      onConfirmation({
        state: true,
        postId: postId,
        threadId,
        isThread: Boolean(isThread),
      });
    onPopoverHide();
  };

  const handleReply = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onReply && onReply();
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
    onEdit && onEdit();
  };

  return (
    <Space>
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
          className="tw-p-0"
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
            width="20px"
          />
        </Button>
      </Popover>

      {(onReply || isThread) && (
        <Button
          className="tw-p-0"
          data-testid="add-reply"
          size="small"
          type="text"
          onClick={handleReply}>
          <SVGIcons
            alt="add-reply"
            icon={Icons.ADD_REPLY}
            title={t('label.reply')}
            width="20px"
          />
        </Button>
      )}

      {editCheck && (
        <Button
          className="tw-p-0"
          data-testid="edit-message"
          size="small"
          type="text"
          onClick={handleEdit}>
          <SVGIcons
            alt="edit"
            icon={Icons.EDIT}
            title={t('label.edit')}
            width="18px"
          />
        </Button>
      )}

      {deleteButtonCheck ? (
        <Button
          className="tw-p-0"
          data-testid="delete-message"
          type="text"
          onClick={handleDelete}>
          <SVGIcons
            alt="delete-reply"
            icon={Icons.FEED_DELETE}
            title={t('label.delete')}
            width="20px"
          />
        </Button>
      ) : null}
    </Space>
  );
};

export default PopoverContent;
