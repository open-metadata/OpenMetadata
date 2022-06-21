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
import React, { FC, Fragment } from 'react';
import { Post } from '../../../generated/entity/feed/thread';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import FeedCardFooter from '../ActivityFeedCard/FeedCardFooter/FeedCardFooter';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
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
  updateThreadHandler,
}) => {
  const toggleReplyEditor = (id: string) => {
    onThreadIdSelect(selectedThreadId === id ? '' : id);
  };

  const onReplyThread = (id: string) => {
    onThreadSelect(id);
    onViewMore();
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
    repliedUsers: Array<string>,
    replies: number,
    threadId: string,
    lastPost?: Post
  ) => {
    return (
      <div className="tw-ml-9 tw-my-2">
        {Boolean(lastPost) && <div className="tw-filter-seperator" />}
        {postLength > 1 ? (
          <div className="tw-flex tw-my-4">
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
        ) : null}
      </div>
    );
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
            reactions: feed.reactions,
          } as Post;
          const postLength = feed?.posts?.length || 0;
          const replies = feed.postsCount ? feed.postsCount - 1 : 0;
          const repliedUsers = (feed?.posts || [])
            .map((f) => f.from)
            .slice(0, postLength >= 3 ? 2 : 1);
          const lastPost = feed?.posts?.[postLength - 1];

          return (
            <Card
              className="ant-card-feed"
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
                  isThread
                  data-testid="main-message"
                  entityLink={feed.about}
                  feed={mainFeed}
                  isEntityFeed={isEntityFeed}
                  updateThreadHandler={updateThreadHandler}
                  onReply={() => onReplyThread(feed.id)}
                />
                {postLength > 0 ? (
                  <Fragment>
                    {getThreadFooter(
                      postLength,
                      repliedUsers,
                      replies,
                      feed.id,
                      lastPost
                    )}
                    <ActivityFeedCard
                      className="tw-ml-9"
                      data-testid="latest-message"
                      feed={lastPost as Post}
                      isEntityFeed={isEntityFeed}
                      threadId={feed.id}
                      updateThreadHandler={updateThreadHandler}
                      onConfirmation={onConfirmation}
                      onReply={() => toggleReplyEditor(feed.id)}
                    />
                    {getFeedEditor(feed.id)}
                  </Fragment>
                ) : null}
              </div>
            </Card>
          );
        })}
    </Fragment>
  );
};

export default FeedListBody;
