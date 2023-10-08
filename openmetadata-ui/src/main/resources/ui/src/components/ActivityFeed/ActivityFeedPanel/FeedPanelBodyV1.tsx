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

import { Divider } from 'antd';
import classNames from 'classnames';
import React, { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Post,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { getReplyText } from '../../../utils/FeedUtils';
import ActivityFeedCardV1 from '../ActivityFeedCard/ActivityFeedCardV1';
import TaskFeedCard from '../TaskFeedCard/TaskFeedCard.component';

interface FeedPanelBodyPropV1 {
  feed: Thread;
  className?: string;
  showThread?: boolean;
  isOpenInDrawer?: boolean;
  onFeedClick?: (feed: Thread) => void;
  isActive?: boolean;
  isForFeedTab?: boolean;
  hidePopover: boolean;
}

const FeedPanelBodyV1: FC<FeedPanelBodyPropV1> = ({
  feed,
  className,
  showThread = true,
  isOpenInDrawer = false,
  onFeedClick,
  isActive,
  hidePopover = false,
  isForFeedTab = false,
}) => {
  const { t } = useTranslation();

  const mainFeed = useMemo(
    () =>
      ({
        message: feed.message,
        postTs: feed.threadTs,
        from: feed.createdBy,
        id: feed.id,
        reactions: feed.reactions,
      } as Post),
    [feed]
  );

  const postLength = feed?.posts?.length ?? 0;

  const handleFeedClick = useCallback(() => {
    onFeedClick?.(feed);
  }, [onFeedClick, feed]);

  return (
    <div
      className={classNames(className, 'activity-feed-card-container', {
        'has-replies': showThread && postLength > 0,
      })}
      data-testid="message-container"
      onClick={handleFeedClick}>
      {feed.type === ThreadType.Task ? (
        <TaskFeedCard
          feed={feed}
          hidePopover={hidePopover}
          isActive={isActive}
          isForFeedTab={isForFeedTab}
          isOpenInDrawer={isOpenInDrawer}
          key={feed.id}
          post={mainFeed}
          showThread={showThread}
        />
      ) : (
        <ActivityFeedCardV1
          feed={feed}
          hidePopover={hidePopover}
          isActive={isActive}
          isPost={false}
          key={feed.id}
          post={mainFeed}
          showThread={showThread}
        />
      )}

      {showThread && postLength > 0 ? (
        <div className="feed-posts" data-testid="replies">
          <Divider
            plain
            className="m-y-sm"
            data-testid="replies-count"
            orientation="left">
            {getReplyText(
              postLength,
              t('label.reply-lowercase'),
              t('label.reply-lowercase-plural')
            )}
          </Divider>

          {feed?.posts?.map((reply) => (
            <ActivityFeedCardV1
              isPost
              feed={feed}
              hidePopover={hidePopover}
              key={reply.id}
              post={reply}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default FeedPanelBodyV1;
