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
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { leftPanelAntCardStyle } from '../../containers/PageLayout';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import FeedCardFooter from '../ActivityFeedCard/FeedCardFooter/FeedCardFooter';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import FeedListSeparator from '../ActivityFeedList/FeedListSeparator';
import { ActivityThreadListProp } from './ActivityThreadPanel.interface';

const ActivityThreadList: FC<ActivityThreadListProp> = ({
  className,
  threads,
  selectedThreadId,
  postFeed,
  onThreadIdSelect,
  onThreadSelect,
  onConfirmation,
  updateThreadHandler,
}) => {
  const { updatedFeedList: updatedThreads, relativeDays } =
    getFeedListWithRelativeDays(threads);

  const toggleReplyEditor = (id: string) => {
    onThreadIdSelect(selectedThreadId === id ? '' : id);
  };

  return (
    <div className={className}>
      {relativeDays.map((d, i) => {
        return (
          <div data-testid={`thread${i}`} key={i}>
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
                  id: thread.id,
                  reactions: thread.reactions,
                } as Post;
                const postLength = thread?.posts?.length || 0;
                const replies = thread.postsCount ? thread.postsCount - 1 : 0;
                const repliedUsers = (thread.posts || [])
                  .map((f) => f.from)
                  .slice(0, postLength >= 3 ? 2 : 1);
                const lastPost = thread?.posts?.[postLength - 1];

                return (
                  <Fragment key={index}>
                    <Card
                      className="ant-card-feed"
                      key={`${index} - card`}
                      style={leftPanelAntCardStyle}>
                      <div data-testid="main-message">
                        <ActivityFeedCard
                          isEntityFeed
                          isThread
                          entityLink={thread.about}
                          feed={mainFeed}
                          updateThreadHandler={updateThreadHandler}
                          onReply={() => onThreadSelect(thread.id)}
                        />
                      </div>
                      {postLength > 0 ? (
                        <div data-testid="replies-container">
                          {postLength > 1 ? (
                            <div className="tw-ml-9 tw-my-2">
                              {Boolean(lastPost) && (
                                <div className="tw-filter-seperator" />
                              )}
                              <div className="tw-flex tw-my-4">
                                <FeedCardFooter
                                  isFooterVisible
                                  lastReplyTimeStamp={lastPost?.postTs}
                                  repliedUsers={repliedUsers}
                                  replies={replies}
                                  threadId={thread.id}
                                  onThreadSelect={() =>
                                    onThreadSelect(thread.id)
                                  }
                                />
                              </div>
                            </div>
                          ) : null}
                          <div data-testid="latest-reply">
                            <ActivityFeedCard
                              isEntityFeed
                              className="tw-ml-9"
                              feed={lastPost as Post}
                              threadId={thread.id}
                              updateThreadHandler={updateThreadHandler}
                              onConfirmation={onConfirmation}
                              onReply={() => toggleReplyEditor(thread.id)}
                            />
                          </div>
                        </div>
                      ) : null}
                      {selectedThreadId === thread.id ? (
                        <div data-testid="quick-reply-editor">
                          <ActivityFeedEditor
                            buttonClass="tw-mr-4"
                            className="tw-ml-5 tw-mr-2 tw-mb-6"
                            onSave={postFeed}
                          />
                        </div>
                      ) : null}
                    </Card>
                  </Fragment>
                );
              })}
          </div>
        );
      })}
    </div>
  );
};

export default ActivityThreadList;
