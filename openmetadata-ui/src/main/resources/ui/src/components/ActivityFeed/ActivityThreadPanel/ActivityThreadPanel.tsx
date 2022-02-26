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

import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import { EntityThread } from 'Models';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  useEffect,
  useState,
} from 'react';
import { getAllFeeds } from '../../../axiosAPIs/feedsAPI';
import {
  getEntityField,
  getFeedListWithRelativeDays,
} from '../../../utils/FeedUtils';
import ActivityFeedCard, {
  FeedFooter,
} from '../ActivityFeedCard/ActivityFeedCard';
import { FeedListSeparator } from '../ActivityFeedList/ActivityFeedList';
import {
  FeedPanelHeader,
  FeedPanelOverlay,
} from '../ActivityFeedPanel/ActivityFeedPanel';

interface ActivityThreadPanelProp extends HTMLAttributes<HTMLDivElement> {
  threadLink: string;
  open?: boolean;
  onCancel: () => void;
}

interface ActivityThreadListProp extends HTMLAttributes<HTMLDivElement> {
  threads: EntityThread[];
}

const ActivityThreadList: FC<ActivityThreadListProp> = ({
  className,
  threads,
}) => {
  const { updatedFeedList: updatedThreads, relativeDays } =
    getFeedListWithRelativeDays(threads);

  return (
    <div className={className}>
      {relativeDays.map((d, i) => {
        return (
          <Fragment key={i}>
            <FeedListSeparator
              className="tw-relative tw-mt-1 tw-mb-3.5"
              relativeDay={d}
            />
            {updatedThreads
              .filter((f) => f.relativeDay === d)
              .map((thread, index) => {
                const mainFeed = {
                  message: thread.message,
                  postTs: thread.threadTs,
                  from: thread.createdBy,
                };
                const postLength = thread.posts.length;
                const replies = thread.postsCount;
                const repliedUsers = thread.posts.map((f) => f.from);
                const lastPost = thread.posts[postLength - 1];

                return (
                  <Fragment key={index}>
                    <ActivityFeedCard
                      isEntityFeed
                      className="tw-mb-6"
                      entityLink={thread.about}
                      feed={mainFeed}
                    />
                    {postLength > 0 ? (
                      <Fragment>
                        <ActivityFeedCard
                          isEntityFeed
                          className="tw-mb-6 tw-ml-9"
                          feed={lastPost}
                        />
                        <div className="tw-mb-6">
                          <div className="tw-ml-9 tw-flex tw-mb-6">
                            <FeedFooter
                              isFooterVisible
                              lastReplyTimeStamp={lastPost?.postTs}
                              repliedUsers={repliedUsers}
                              replies={replies}
                              threadId={thread.id}
                            />
                            <span className="tw-mx-1.5 tw-mt-1 tw-inline-block tw-text-gray-400">
                              |
                            </span>
                            <p className="link-text tw-text-xs tw-mt-1.5 tw-underline">
                              Reply
                            </p>
                          </div>
                          {/* {selctedThreadId === feed.id ? (
                            <ActivityFeedEditor
                              buttonClass="tw-mr-4"
                              className="tw-ml-5 tw-mr-2"
                              onSave={postFeed}
                            />
                          ) : null} */}
                        </div>
                      </Fragment>
                    ) : (
                      <p className="link-text tw-text-xs tw-underline tw-ml-9 tw--mt-4 tw-mb-6">
                        Reply
                      </p>
                    )}
                  </Fragment>
                );
              })}
          </Fragment>
        );
      })}
    </div>
  );
};

const ActivityThreadPanel: FC<ActivityThreadPanelProp> = ({
  threadLink,
  className,
  onCancel,
  open,
}) => {
  const [threads, setThreads] = useState<EntityThread[]>([]);

  const entityField = getEntityField(threadLink);

  useEffect(() => {
    getAllFeeds(threadLink).then((res: AxiosResponse) => {
      const { data } = res.data;
      setThreads(data);
    });
  }, [threadLink]);

  return (
    <div className={classNames('tw-h-full', className)}>
      <FeedPanelOverlay
        className="tw-z-10 tw-fixed tw-inset-0 tw-top-16 tw-h-full tw-w-3/5 tw-bg-black tw-opacity-40"
        onCancel={onCancel}
      />
      <div
        className={classNames(
          'tw-top-16 tw-right-0 tw-bottom-0 tw-w-2/5 tw-bg-white tw-fixed tw-shadow-md tw-transform tw-ease-in-out tw-duration-1000 tw-overflow-y-auto',
          {
            'tw-translate-x-0': open,
            'tw-translate-x-full': !open,
          }
        )}>
        <FeedPanelHeader
          className="tw-px-4 tw-shadow-sm"
          entityField={entityField as string}
          onCancel={onCancel}
        />
        <ActivityThreadList className="tw-py-6 tw-pl-5" threads={threads} />
      </div>
    </div>
  );
};

export default ActivityThreadPanel;
