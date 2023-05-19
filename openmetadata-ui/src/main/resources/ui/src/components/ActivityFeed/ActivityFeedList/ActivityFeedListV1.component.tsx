/*
 *  Copyright 2023 Collate.
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
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from 'components/Loader/Loader';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from 'enums/common.enum';
import { Thread } from 'generated/entity/feed/thread';
import React, { useEffect, useState } from 'react';
import { getFeedListWithRelativeDays } from 'utils/FeedUtils';
import ActivityFeedDrawer from '../ActivityFeedDrawer/ActivityFeedDrawer';
import FeedPanelBodyV1 from '../ActivityFeedPanel/FeedPanelBodyV1';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './activity-feed-list.less';

interface ActivityFeedListV1Props {
  feedList: Thread[];
  isLoading: boolean;
  showThread?: boolean;
}

const ActivityFeedListV1 = ({
  feedList,
  isLoading,
  showThread = true,
}: ActivityFeedListV1Props) => {
  const [entityThread, setEntityThread] = useState<Thread[]>([]);

  const { isDrawerOpen } = useActivityFeedProvider();

  useEffect(() => {
    const { updatedFeedList } = getFeedListWithRelativeDays(feedList);
    setEntityThread(updatedFeedList);
  }, [feedList]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="feed-list-container p-b-md" id="feedData">
      {entityThread.length === 0 && (
        <div data-testid="no-data-placeholder-container">
          <ErrorPlaceHolder
            className="mt-0-important p-16"
            size={SIZE.MEDIUM}
            type={ERROR_PLACEHOLDER_TYPE.FILTER}
          />
        </div>
      )}
      {entityThread.map((feed) => (
        <FeedPanelBodyV1 feed={feed} key={feed.id} showThread={showThread} />
      ))}
      {isDrawerOpen && (
        <>
          <ActivityFeedDrawer open={isDrawerOpen} />
        </>
      )}
    </div>
  );
};

export default ActivityFeedListV1;
