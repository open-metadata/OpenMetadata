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

import { Card } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FC, useCallback } from 'react';
import ActivityFeedCardNew from '../ActivityFeedCardNew/ActivityFeedcardNew.component';
import {
  CARD_CONTAINER_CLASS_NAME,
  handleCardContainerKeyDown,
} from '../ActivityFeedCardNew/ActivityFeedcardNew.utils';
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
        showThread={showThread}
      />
    );
  };

  return (
    <Card
      className={classNames(
        'activity-feed-card-container',
        'tw:cursor-pointer',
        CARD_CONTAINER_CLASS_NAME,
        className
      )}
      data-testid="message-container"
      role="button"
      tabIndex={0}
      variant="ghost"
      onClick={handleFeedClick}
      onKeyDown={handleCardContainerKeyDown(handleFeedClick)}>
      {renderFeedContent()}
    </Card>
  );
};

export default FeedPanelBodyV1;
