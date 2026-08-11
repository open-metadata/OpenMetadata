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
import { Post } from '../../../generated/entity/feed/thread';
import ActivityFeedCardNew from '../ActivityFeedCardNew/ActivityFeedcardNew.component';
import '../ActivityFeedTab/activity-feed-tab.less';
import './feed-panel-body-v1.less';
import { FeedPanelBodyPropV1 } from './FeedPanelBodyV1.interface';

const FeedPanelBodyV1: FC<FeedPanelBodyPropV1> = ({
  feed,
  className,
  showThread = true,
  onFeedClick,
  isActive,
}) => {
  const mainFeed = useMemo(
    () =>
      feed
        ? ({
            message: feed.message,
            postTs: feed.threadTs,
            from: feed.createdBy,
            id: feed.id,
            reactions: feed.reactions,
          } as Post)
        : undefined,
    [feed]
  );

  const handleFeedClick = useCallback(() => {
    if (feed) {
      onFeedClick?.(feed);
    }
  }, [onFeedClick, feed]);

  if (!feed) {
    return null;
  }

  const renderFeedContent = () => {
    return (
      <ActivityFeedCardNew
        isForFeedTab
        isOpenInDrawer
        feed={feed}
        isActive={isActive}
        post={mainFeed}
        showThread={showThread}
      />
    );
  };

  return (
    <Button
      block
      className={classNames('activity-feed-card-container ', className)}
      data-testid="message-container"
      type="text"
      onClick={handleFeedClick}>
      {renderFeedContent()}
    </Button>
  );
};

export default FeedPanelBodyV1;
