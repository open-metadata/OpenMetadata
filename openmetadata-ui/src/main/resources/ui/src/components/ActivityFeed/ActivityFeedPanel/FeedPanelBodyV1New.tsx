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
import { FC, useCallback, useMemo } from 'react';
import { Post, ThreadType } from '../../../generated/entity/feed/thread';
import ActivityFeedCardNew from '../ActivityFeedCardNew/ActivityFeedcardNew.component';
import TaskFeedCardNew from '../TaskFeedCard/TaskFeedCardNew.component';
import './feed-panel-body-v1.less';
import { FeedPanelBodyPropV1 } from './FeedPanelBodyV1.interface';

const FeedPanelBodyV1: FC<FeedPanelBodyPropV1> = ({
  feed,
  showThread,
  onFeedClick,
  isActive,
  showActivityFeedEditor = false,
  onAfterClose,
  onUpdateEntityDetails,
  isForFeedTab = false,
  isOpenInDrawer = false,
  hideCardBorder = false,
  isFeedWidget = false,
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
      className={classNames('activity-feed-card-container')}
      data-testid="message-container"
      type="text"
      onClick={handleFeedClick}>
      {feed.type === ThreadType.Task ? (
        <TaskFeedCardNew
          feed={feed}
          hideCardBorder={hideCardBorder}
          isActive={isActive}
          isForFeedTab={isForFeedTab}
          isOpenInDrawer={isOpenInDrawer}
          key={feed.id}
          onAfterClose={onAfterClose}
          onUpdateEntityDetails={onUpdateEntityDetails}
        />
      ) : (
        <ActivityFeedCardNew
          feed={feed}
          isActive={isActive}
          isFeedWidget={isFeedWidget}
          isForFeedTab={isForFeedTab}
          isPost={false}
          post={mainFeed}
          showActivityFeedEditor={showActivityFeedEditor}
          showThread={showThread}
        />
      )}
    </Button>
  );
};

export default FeedPanelBodyV1;
