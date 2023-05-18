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
import React from 'react';
import { getFeedListWithRelativeDays } from 'utils/FeedUtils';
import ActivityFeedCardV1 from '../ActivityFeedCard/ActivityFeedCardV1';

interface ActivityFeedListV1Props {
  feedList: Thread[];
  isLoading: boolean;
}

const ActivityFeedListV1 = ({
  feedList,
  isLoading,
}: ActivityFeedListV1Props) => {
  const { updatedFeedList } = getFeedListWithRelativeDays(feedList);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="feed-list-container" id="feedData">
      {updatedFeedList.length === 0 && (
        <div data-testid="no-data-placeholder-container">
          <ErrorPlaceHolder
            className="mt-0-important p-16"
            size={SIZE.MEDIUM}
            type={ERROR_PLACEHOLDER_TYPE.FILTER}
          />
        </div>
      )}
      {updatedFeedList.map((item) => {
        return <ActivityFeedCardV1 feed={item} key={item.id} />;
      })}
    </div>
  );
};

export default ActivityFeedListV1;
