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
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import ActivityFeedPanel from '../ActivityFeedPanel/ActivityFeedPanel';

interface ActivityFeedListProp extends HTMLAttributes<HTMLDivElement> {
  feedList: EntityThread[];
  withSidePanel?: boolean;
  isEntityFeed?: boolean;
}
interface FeedListSeparatorProp extends HTMLAttributes<HTMLDivElement> {
  relativeDay: string;
}
interface LatestReplyFeedListProp extends HTMLAttributes<HTMLDivElement> {
  feeds: Post[];
}
interface FeedListBodyProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<FeedListSeparatorProp, 'relativeDay'>,
    Pick<ActivityFeedListProp, 'isEntityFeed'> {
  updatedFeedList: Array<EntityThread & { relativeDay: string }>;
  selctedThreadId: string;
  onThreadIdSelect: (value: string) => void;
  onThreadIdDeselect: () => void;
  onThreadSelect: (value: string) => void;
}

const FeedListSeparator: FC<FeedListSeparatorProp> = ({
  className,
  relativeDay,
}) => {
  return (
    <div className={className}>
      <div className="tw-flex tw-justify-center">
        <hr className="tw-absolute tw-top-3 tw-border-b tw-border-main tw-w-full tw-z-0" />
        <span className="tw-bg-white tw-px-4 tw-py-px tw-border tw-border-primary tw-rounded tw-z-10 tw-text-primary tw-font-medium">
          {relativeDay}
        </span>
      </div>
    </div>
  );
};

const LatestReplyFeedList: FC<LatestReplyFeedListProp> = ({
  className,
  feeds,
}) => {
  return (
    <div className={className}>
      {feeds.map((feed, index) => (
        <ActivityFeedCard className="tw-mb-6" feed={feed} key={index} />
      ))}
    </div>
  );
};

const FeedListBody: FC<FeedListBodyProp> = ({
  updatedFeedList,
  relativeDay,
  isEntityFeed,
  onThreadSelect,
  selctedThreadId,
  onThreadIdSelect,
  onThreadIdDeselect,
}) => {
  return (
    <Fragment>
      {updatedFeedList
        .filter((f) => f.relativeDay === relativeDay)
        .map((feed, index) => {
          const mainFeed = feed.posts?.[0];
          const replies = feed.posts.length;
          const repliedUsers = feed.posts.map((f) => f.from).slice(0, 3);
          const lastPost = feed.posts?.[replies - 1];

          return (
            <Fragment key={index}>
              <ActivityFeedCard
                className="tw-mb-6"
                entityLink={feed.about}
                feed={mainFeed}
                isEntityFeed={isEntityFeed}
                isFooterVisible={selctedThreadId !== feed.id}
                lastReplyTimeStamp={lastPost.postTs}
                repliedUsers={repliedUsers}
                replies={replies}
                threadId={feed.id}
                onThreadSelect={onThreadIdSelect}
              />
              {selctedThreadId === feed.id ? (
                <Fragment>
                  <LatestReplyFeedList
                    className="tw-mt-6 tw-ml-8"
                    feeds={feed?.posts?.slice(0, 3) as Post[]}
                  />
                  <div className="tw-flex tw-gap-3 tw-ml-8 tw-mb-6">
                    <p
                      className="link-text tw-text-xs"
                      onClick={() => onThreadSelect(selctedThreadId)}>
                      Show more
                    </p>
                    <p
                      className="link-text tw-text-xs"
                      onClick={onThreadIdDeselect}>
                      Show less
                    </p>
                  </div>
                </Fragment>
              ) : null}
            </Fragment>
          );
        })}
    </Fragment>
  );
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
  const [selctedThreadId, setSelctedThreadId] = useState<string>('');

  const onThreadIdSelect = (id: string) => {
    setSelctedThreadId(id);
  };

  const onThreadIdDeselect = () => {
    setSelctedThreadId('');
  };

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
          <Fragment key={i}>
            <FeedListSeparator
              className="tw-relative tw-mt-1 tw-mb-3.5"
              relativeDay={d}
            />
            <FeedListBody
              isEntityFeed={isEntityFeed}
              relativeDay={d}
              selctedThreadId={selctedThreadId}
              updatedFeedList={updatedFeedList}
              onThreadIdDeselect={onThreadIdDeselect}
              onThreadIdSelect={onThreadIdSelect}
              onThreadSelect={onThreadSelect}
            />
          </Fragment>
        );
      })}
      {withSidePanel && selectedThread ? (
        <Fragment>
          <ActivityFeedPanel
            open={!isUndefined(selectedThread)}
            selectedThread={selectedThread}
            onCancel={onCancel}
          />
        </Fragment>
      ) : null}
    </div>
  );
};

export default withLoader<ActivityFeedListProp>(ActivityFeedList);
