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

import { isUndefined } from 'lodash';
import { FC, useCallback } from 'react';
import ActivityFeedCardNew from '../ActivityFeedCardNew/ActivityFeedcardNew.component';
import {
  CARD_CONTAINER_CLASS_NAME,
  handleCardContainerKeyDown,
} from '../ActivityFeedCardNew/ActivityFeedcardNew.utils';
import './feed-panel-body-v1.less';
import { FeedPanelBodyPropV1 } from './FeedPanelBodyV1.interface';

const FeedPanelBodyV1: FC<FeedPanelBodyPropV1> = ({
  feed,
  activity,
  showThread,
  onFeedClick,
  onActivityClick,
  isActive,
  showActivityFeedEditor = false,
  isForFeedTab = false,
  isOpenInDrawer = false,
  isFeedWidget = false,
  isFullSizeWidget = false,
}) => {
  const isActivityEvent = !isUndefined(activity);

  const handleFeedClick = useCallback(() => {
    if (feed) {
      onFeedClick?.(feed);
    }
  }, [onFeedClick, feed]);

  const handleActivityClick = useCallback(() => {
    if (activity) {
      onActivityClick?.(activity);
    }
  }, [onActivityClick, activity]);

  if (isActivityEvent) {
    return (
      <div
        className={`activity-feed-card-container ${CARD_CONTAINER_CLASS_NAME}`}
        data-testid="message-container"
        role="button"
        tabIndex={0}
        onClick={handleActivityClick}
        onKeyDown={handleCardContainerKeyDown(handleActivityClick)}>
        <ActivityFeedCardNew
          activity={activity}
          isActive={isActive}
          isFeedWidget={isFeedWidget}
          isForFeedTab={isForFeedTab}
          isFullSizeWidget={isFullSizeWidget}
          isOpenInDrawer={isOpenInDrawer}
          isPost={false}
          showActivityFeedEditor={showActivityFeedEditor}
          showThread={showThread}
          onActivityClick={onActivityClick}
        />
      </div>
    );
  }

  if (!feed) {
    return null;
  }

  return (
    <div
      className={`activity-feed-card-container ${CARD_CONTAINER_CLASS_NAME}`}
      data-testid="message-container"
      role="button"
      tabIndex={0}
      onClick={handleFeedClick}
      onKeyDown={handleCardContainerKeyDown(handleFeedClick)}>
      <ActivityFeedCardNew
        feed={feed}
        isActive={isActive}
        isFeedWidget={isFeedWidget}
        isForFeedTab={isForFeedTab}
        isFullSizeWidget={isFullSizeWidget}
        isPost={false}
        showActivityFeedEditor={showActivityFeedEditor}
        showThread={showThread}
      />
    </div>
  );
};

export default FeedPanelBodyV1;
