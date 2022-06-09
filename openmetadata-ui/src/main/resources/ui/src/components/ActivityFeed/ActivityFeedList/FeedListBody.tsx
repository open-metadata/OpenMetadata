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

import { Card } from 'antd';
import { Post } from 'Models';
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
  selectedThreadId,
  onConfirmation,
}) => {
  const toggleReplyEditor = (id: string) => {
    onThreadIdSelect(selectedThreadId === id ? '' : id);
  };

  const getFeedEditor = (id: string) => {
    return selectedThreadId === id ? (
      <ActivityFeedEditor
        buttonClass="tw-mr-4"
        className="tw-ml-5 tw-mr-2"
        data-testid="quick-reply-editor"
        onSave={postFeed}
      />
    ) : null;
  };

  const getThreadFooter = (
    postLength: number,
    lastPost: Post,
    repliedUsers: Array<string>,
    replies: number,
    threadId: string
  ) => {
    return postLength > 1 ? (
      <div className="tw-mb-2">
        <div className="tw-ml-9 tw-flex">
          <FeedCardFooter
            isFooterVisible
            lastReplyTimeStamp={lastPost?.postTs}
            repliedUsers={repliedUsers}
            replies={replies}
            threadId={threadId}
            onThreadSelect={(id: string) => {
              onThreadIdSelect('');
              onThreadSelect(id);
              onViewMore();
            }}
          />
        </div>
      </div>
    ) : null;
  };

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
            <Card
              key={`${index} - card`}
              style={{
                border: '1px rgb(221, 227, 234) solid',
                borderRadius: '8px',
                marginBottom: '20px',
                boxShadow: '1px 1px 6px rgb(0 0 0 / 12%)',
                marginRight: '4px',
                marginLeft: '4px',
              }}>
              <div data-testid="message-container" key={index}>
                <ActivityFeedCard
                  data-testid="main-message"
                  entityLink={feed.about}
                  feed={mainFeed}
                  isEntityFeed={isEntityFeed}
                />
                {postLength > 0 ? (
                  <Fragment>
                    {getThreadFooter(
                      postLength,
                      lastPost,
                      repliedUsers,
                      replies,
                      feed.id
                    )}
                    <ActivityFeedCard
                      className="tw-mb-6 tw-ml-9"
                      data-testid="latest-message"
                      feed={lastPost}
                      isEntityFeed={isEntityFeed}
                      threadId={feed.id}
                      onConfirmation={onConfirmation}
                    />
                    <p
                      className="link-text tw-text-xs tw-underline tw-ml-9 tw-mt-4 tw-mb-2"
                      data-testid="quick-reply"
                      onClick={() => {
                        toggleReplyEditor(feed.id);
                      }}>
                      Reply
                    </p>
                    {getFeedEditor(feed.id)}
                  </Fragment>
                ) : (
                  <p
                    className="link-text tw-text-xs tw-underline tw-ml-9 tw-mt-1 tw-mb-1"
                    data-testid="replyInSidePanel"
                    onClick={() => {
                      onThreadSelect(feed.id);
                      onViewMore();
                    }}>
                    Reply
                  </p>
                )}
              </div>
            </Card>
          );
        })}
    </Fragment>
  );
};

export default FeedListBody;
