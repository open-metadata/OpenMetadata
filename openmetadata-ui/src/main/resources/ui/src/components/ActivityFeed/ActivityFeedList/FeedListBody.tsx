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

import React, { FC, Fragment } from 'react';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import FeedCardFooter from '../FeedCardFooter/FeedCardFooter';
import { FeedListBodyProp } from './ActivityFeedList.interface';

const FeedListBody: FC<FeedListBodyProp> = ({
  updatedFeedList,
  relativeDay,
  isEntityFeed,
  onThreadSelect,
  onThreadIdSelect,
  postFeed,
  onViewMore,
  selctedThreadId,
  onConfirmation,
}) => {
  return (
    <Fragment>
      {updatedFeedList
        .filter((f) => f.relativeDay === relativeDay)
        .map((feed, index) => {
          const mainFeed = {
            message: feed.message,
            postTs: feed.threadTs,
            from: feed.createdBy,
            id: feed.id,
          };
          const postLength = feed.posts.length;
          const replies = feed.postsCount - 1;
          const repliedUsers = feed.posts
            .map((f) => f.from)
            .slice(0, postLength >= 3 ? 2 : 1);
          const lastPost = feed.posts[postLength - 1];

          return (
            <div data-testid="message-container" key={index}>
              <ActivityFeedCard
                className="tw-mb-6"
                data-testid="main-message"
                entityLink={feed.about}
                feed={mainFeed}
                isEntityFeed={isEntityFeed}
              />
              {postLength > 0 ? (
                <Fragment>
                  {postLength > 1 ? (
                    <div className="tw-mb-6">
                      <div className="tw-ml-9 tw-flex tw-mb-6">
                        <FeedCardFooter
                          isFooterVisible
                          className="tw--mt-4"
                          lastReplyTimeStamp={lastPost?.postTs}
                          repliedUsers={repliedUsers}
                          replies={replies}
                          threadId={feed.id}
                          onThreadSelect={(id: string) => {
                            onThreadIdSelect('');
                            onThreadSelect(id);
                            onViewMore();
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <ActivityFeedCard
                    className="tw-mb-6 tw-ml-9"
                    data-testid="latest-message"
                    feed={lastPost}
                    isEntityFeed={isEntityFeed}
                    threadId={feed.id}
                    onConfirmation={onConfirmation}
                  />
                  <p
                    className="link-text tw-text-xs tw-underline tw-ml-9 tw-pl-9 tw--mt-4 tw-mb-6"
                    data-testid="quick-reply"
                    onClick={() => {
                      onThreadIdSelect(feed.id);
                    }}>
                    Reply
                  </p>
                  {selctedThreadId === feed.id ? (
                    <ActivityFeedEditor
                      buttonClass="tw-mr-4"
                      className="tw-ml-5 tw-mr-2"
                      data-testid="quick-reply-editor"
                      onSave={postFeed}
                    />
                  ) : null}
                </Fragment>
              ) : (
                <p
                  className="link-text tw-text-xs tw-underline tw-ml-9 tw--mt-4 tw-mb-6"
                  data-testid="replyInSidePanel"
                  onClick={() => {
                    onThreadSelect(feed.id);
                    onViewMore();
                  }}>
                  Reply
                </p>
              )}
            </div>
          );
        })}
    </Fragment>
  );
};

export default FeedListBody;
