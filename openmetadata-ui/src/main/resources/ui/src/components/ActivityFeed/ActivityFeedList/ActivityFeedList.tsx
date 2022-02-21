/*
 *  Copyright 2021 Collate
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
import { isUndefined } from 'lodash';
import { EntityThread, Post } from 'Models';
import React, { FC, Fragment, HTMLAttributes, useState } from 'react';
import { withLoader } from '../../../hoc/withLoader';
import { getRelativeDateByTimeStamp } from '../../../utils/TimeUtils';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import ActivityFeedPanel from '../ActivityFeedPanel/ActivityFeedPanel';

interface ActivityFeedListProp extends HTMLAttributes<HTMLDivElement> {
  feedList: EntityThread[];
  withSidePanel?: boolean;
  isEntityFeed?: boolean;
}

const getFeedListWithRelativeDays = (feedList: EntityThread[]) => {
  const updatedFeedList = feedList.map((feed) => ({
    ...feed,
    relativeDay: getRelativeDateByTimeStamp(feed.updatedAt),
  }));
  const relativeDays = [...new Set(updatedFeedList.map((f) => f.relativeDay))];

  return { updatedFeedList, relativeDays };
};

const ActivityFeedList: FC<ActivityFeedListProp> = ({
  className,
  feedList,
  withSidePanel = false,
  isEntityFeed = false,
}) => {
  const { updatedFeedList, relativeDays } =
    getFeedListWithRelativeDays(feedList);
  const [selectedThread, setSelectedThread] = useState<EntityThread>();

  const onThreadSelect = (id: string) => {
    const thread = feedList.find((f) => f.id === id);
    if (thread) {
      setSelectedThread(thread);
    }
  };

  const onCancel = () => {
    setSelectedThread(undefined);
  };

  return (
    <div className={classNames(className)}>
      {relativeDays.map((d, i) => {
        return (
          <div key={i}>
            <div className="tw-relative tw-mt-1 tw-mb-3.5">
              <div className="tw-flex tw-justify-center">
                <hr className="tw-absolute tw-top-3 tw-border-b tw-border-main tw-w-full tw-z-0" />
                <span className="tw-bg-white tw-px-4 tw-py-px tw-border tw-border-primary tw-rounded tw-z-10 tw-text-primary tw-font-medium">
                  {d}
                </span>
              </div>
            </div>
            {updatedFeedList
              .filter((f) => f.relativeDay === d)
              .map((feed, index) => {
                const mainFeed = feed.posts?.[0];
                const replies = feed.posts.length;
                const repliedUsers = feed.posts.map((f) => f.from);

                return (
                  <ActivityFeedCard
                    className="tw-mb-3"
                    entityLink={feed.about}
                    feed={mainFeed}
                    isEntityFeed={isEntityFeed}
                    key={index}
                    repliedUsers={repliedUsers}
                    replies={replies}
                    threadId={feed.id}
                    onThreadSelect={onThreadSelect}
                  />
                );
              })}
          </div>
        );
      })}
      {withSidePanel && selectedThread ? (
        <Fragment>
          <ActivityFeedPanel
            open={!isUndefined(selectedThread)}
            replies={selectedThread?.posts as Post[]}
            threadLink={selectedThread?.about as string}
            onCancel={onCancel}
          />
        </Fragment>
      ) : null}
    </div>
  );
};

export default withLoader<ActivityFeedListProp>(ActivityFeedList);
