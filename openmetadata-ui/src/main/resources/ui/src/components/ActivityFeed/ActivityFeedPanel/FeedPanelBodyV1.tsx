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

import { Button } from 'antd';
import classNames from 'classnames';
import React, { FC, useCallback, useMemo } from 'react';
import {
  Post,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import ActivityFeedCardV2 from '../../ActivityFeedV2/ActivityFeedCardV2/ActivityFeedCardV2';
import TaskFeedCard from '../TaskFeedCard/TaskFeedCard.component';

interface FeedPanelBodyPropV1 {
  feed: Thread;
  className?: string;
  FeedContainerClassName?: string;
  showThread?: boolean;
  isOpenInDrawer?: boolean;
  onFeedClick?: (feed: Thread) => void;
  isActive?: boolean;
  isForFeedTab?: boolean;
  componentsVisibility?: {
    showThreadIcon?: boolean;
    showRepliesContainer?: boolean;
  };
  hidePopover: boolean;
}

const FeedPanelBodyV1: FC<FeedPanelBodyPropV1> = ({
  feed,
  className,
  FeedContainerClassName = '',
  showThread = true,
  componentsVisibility = {
    showThreadIcon: true,
    showRepliesContainer: true,
  },
  isOpenInDrawer = false,
  onFeedClick,
  isActive,
  hidePopover = false,
  isForFeedTab = false,
}) => {
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

  const handleFeedClick = useCallback(() => {
    onFeedClick?.(feed);
  }, [onFeedClick, feed]);

  return (
    <Button
      block
      ghost
      className={classNames(
        className,
        'activity-feed-card-container h-auto text-left p-0 border-none'
      )}
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
        <ActivityFeedCardV2
          className={FeedContainerClassName}
          componentsVisibility={componentsVisibility}
          feed={feed}
          isActive={isActive}
          isOpenInDrawer={isOpenInDrawer}
          post={mainFeed}
          showThread={showThread}
        />
      )}
    </Button>
  );
};

export default FeedPanelBodyV1;
