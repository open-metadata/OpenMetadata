/*
 *  Copyright 2021 Collate
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

import { Popover } from 'antd';
import { isNil, isUndefined, uniqueId } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
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
}) => {
  const [visible, setVisible] = useState<boolean>(false);

  const hide = () => {
    setVisible(false);
  };

  const handleVisibleChange = (newVisible: boolean) => {
    setVisible(newVisible);
  };

  const deleteButtonCheck =
    threadId && postId && onConfirmation && isAuthor && !isThread;

  const handleDelete = () => {
    onConfirmation && onConfirmation({ state: true, postId: postId, threadId });
    onPopoverHide();
  };

  const handleReply = () => {
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

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

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

  return (
    <div className="tw-flex tw-gap-x-2">
      <Popover
        destroyTooltipOnHide
        align={{ targetOffset: [0, -10] }}
        content={reactionList}
        overlayClassName="ant-popover-feed-reactions"
        placement="topLeft"
        trigger="click"
        visible={visible}
        zIndex={9999}
        onVisibleChange={handleVisibleChange}>
        <button>
          <SVGIcons
            alt="add-reaction"
            icon={Icons.REACTION}
            title="Add reactions"
            width="20px"
          />
        </button>
      </Popover>

      {(onReply || isThread) && (
        <button onClick={handleReply}>
          <SVGIcons
            alt="add-reply"
            icon={Icons.ADD_REPLY}
            title="Reply"
            width="20px"
          />
        </button>
      )}

      {deleteButtonCheck ? (
        <button onClick={handleDelete}>
          <SVGIcons
            alt="delete-reply"
            icon={Icons.FEED_DELETE}
            title="Delete"
            width="20px"
          />
        </button>
      ) : null}
    </div>
  );
};

export default PopoverContent;
