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
import { EntityType } from '../../../enums/entity.enum';
import { Post, ThreadType } from '../../../generated/entity/feed/thread';
import { ENTITY_LINK_SEPARATOR } from '../../../utils/EntityUtils';
import { getEntityType } from '../../../utils/FeedUtils';
import { TaskTabNew } from '../../Entity/Task/TaskTab/TaskTabNew.component';
import ActivityFeedCardNew from '../ActivityFeedCardNew/ActivityFeedcardNew.component';
import '../ActivityFeedTab/activity-feed-tab.less';
import TaskFeedCard from '../TaskFeedCard/TaskFeedCard.component';
import './feed-panel-body-v1.less';
import { FeedPanelBodyPropV1 } from './FeedPanelBodyV1.interface';

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

  const isUserEntity = useMemo(
    () => feed.entityRef?.type === EntityType.USER,
    [feed.entityRef?.type]
  );

  const entityTypeTask = useMemo(
    () =>
      feed?.about?.split(ENTITY_LINK_SEPARATOR)?.[1] as Exclude<
        EntityType,
        EntityType.TABLE
      >,
    [feed]
  );

  const renderFeedContent = () => {
    if (feed.type === ThreadType.Task) {
      if (!isForFeedTab) {
        return (
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
        );
      }

      return (
        <TaskTabNew
          isOpenInDrawer
          entityType={isUserEntity ? entityTypeTask : getEntityType(feed.about)}
          isForFeedTab={isForFeedTab}
          taskThread={feed}
        />
      );
    }

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
