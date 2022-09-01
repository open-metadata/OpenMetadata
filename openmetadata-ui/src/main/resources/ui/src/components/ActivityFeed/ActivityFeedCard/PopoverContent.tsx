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

import { Button, Space } from 'antd';
import { isNil, isUndefined } from 'lodash';
import React, { FC } from 'react';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { Post } from '../../../generated/entity/feed/thread';
import { ReactionType } from '../../../generated/type/reaction';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
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
  onPopoverHide,
  onEdit,
  isAnnouncement,
}) => {
  const deleteButtonCheck = threadId && postId && onConfirmation && isAuthor;

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

  const handleEdit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onEdit && onEdit();
  };

  const editCheck = (isAnnouncement || !isThread) && isAuthor;

  return (
    <Space>
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
            title="Reply"
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
          <SVGIcons alt="edit" icon={Icons.EDIT} title="Edit" width="18px" />
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
            title="Delete"
            width="20px"
          />
        </Button>
      ) : null}
    </Space>
  );
};

export default PopoverContent;
