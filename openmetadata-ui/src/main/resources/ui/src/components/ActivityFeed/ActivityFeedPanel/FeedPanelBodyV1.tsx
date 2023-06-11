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

import classNames from 'classnames';
import { Post, Thread, ThreadType } from 'generated/entity/feed/thread';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { getReplyText } from '../../../utils/FeedUtils';
import ActivityFeedCardV1 from '../ActivityFeedCard/ActivityFeedCardV1';
import TaskFeedCard from '../TaskFeedCard/TaskFeedCard.component';

interface FeedPanelBodyPropV1 {
  feed: Thread;
  className?: string;
  showThread?: boolean;
  isOpenInDrawer?: boolean;
}

const FeedPanelBodyV1: FC<FeedPanelBodyPropV1> = ({
  feed,
  className,
  showThread = true,
  isOpenInDrawer = false,
}) => {
  const { t } = useTranslation();
  const mainFeed = {
    message: feed.message,
    postTs: feed.threadTs,
    from: feed.createdBy,
    id: feed.id,
    reactions: feed.reactions,
  } as Post;
  const postLength = feed?.posts?.length ?? 0;

  return (
    <div
      className={classNames(className, 'activity-feed-card-container', {
        'has-replies': showThread && postLength > 0,
      })}
      data-testid="message-container">
      {feed.type === ThreadType.Task ? (
        <TaskFeedCard
          feed={feed}
          isOpenInDrawer={isOpenInDrawer}
          key={feed.id}
          post={mainFeed}
          showThread={showThread}
        />
      ) : (
        <ActivityFeedCardV1
          feed={feed}
          isPost={false}
          key={feed.id}
          post={mainFeed}
          showThread={showThread}
        />
      )}

      {showThread && postLength > 0 ? (
        <div className="feed-posts" data-testid="replies">
          <div className="d-flex">
            <span data-testid="replies-count">
              {getReplyText(
                postLength,
                t('label.reply-lowercase'),
                t('label.reply-lowercase-plural')
              )}
            </span>
            <span className="flex-auto self-center tw-ml-1.5">
              <hr />
            </span>
          </div>
          {feed?.posts?.map((reply) => (
            <ActivityFeedCardV1
              isPost
              feed={feed}
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
