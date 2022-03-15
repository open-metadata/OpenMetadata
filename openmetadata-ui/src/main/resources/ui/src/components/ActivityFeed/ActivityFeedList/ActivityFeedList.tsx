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
import { EntityThread } from 'Models';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { withLoader } from '../../../hoc/withLoader';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import ActivityFeedPanel from '../ActivityFeedPanel/ActivityFeedPanel';
import FeedCardFooter from '../FeedCardFooter/FeedCardFooter';
import NoFeedPlaceholder from '../NoFeedPlaceholder/NoFeedPlaceholder';
import {
  ActivityFeedListProp,
  FeedListBodyProp,
  FeedListSeparatorProp,
} from './ActivityFeedList.interface';

export const FeedListSeparator: FC<FeedListSeparatorProp> = ({
  className,
  relativeDay,
}) => {
  return (
    <div className={className}>
      <div className="tw-flex tw-justify-center">
        <hr className="tw-absolute tw-top-3 tw-border-b tw-border-main tw-w-full tw-z-0" />
        {relativeDay ? (
          <span className="tw-bg-white tw-px-4 tw-py-px tw-border tw-border-grey-muted tw-rounded tw-z-10 tw-text-grey-muted tw-font-medium">
            {relativeDay}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const FeedListBody: FC<FeedListBodyProp> = ({
  updatedFeedList,
  relativeDay,
  isEntityFeed,
  onThreadSelect,
  onThreadIdSelect,
  postFeed,
  onViewMore,
  selctedThreadId,
  deletePostHandler,
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
          const repliedUsers = feed.posts.map((f) => f.from).slice(1, 3);
          const lastPost = feed.posts[postLength - 1];

          return (
            <Fragment key={index}>
              <ActivityFeedCard
                className="tw-mb-6"
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
                    deletePostHandler={deletePostHandler}
                    feed={lastPost}
                    isEntityFeed={isEntityFeed}
                    threadId={feed.id}
                  />
                  <p
                    className="link-text tw-text-xs tw-underline tw-ml-9 tw-pl-9 tw--mt-4 tw-mb-6"
                    onClick={() => {
                      onThreadIdSelect(feed.id);
                    }}>
                    Reply
                  </p>
                  {selctedThreadId === feed.id ? (
                    <ActivityFeedEditor
                      buttonClass="tw-mr-4"
                      className="tw-ml-5 tw-mr-2"
                      onSave={postFeed}
                    />
                  ) : null}
                </Fragment>
              ) : (
                <p
                  className="link-text tw-text-xs tw-underline tw-ml-9 tw--mt-4 tw-mb-6"
                  onClick={() => {
                    onThreadSelect(feed.id);
                    onViewMore();
                  }}>
                  Reply
                </p>
              )}
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
  postFeedHandler,
  entityName,
  deletePostHandler,
}) => {
  const { updatedFeedList, relativeDays } =
    getFeedListWithRelativeDays(feedList);
  const [selectedThread, setSelectedThread] = useState<EntityThread>();
  const [selctedThreadId, setSelctedThreadId] = useState<string>('');
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  const onThreadIdSelect = (id: string) => {
    setSelctedThreadId(id);
    setSelectedThread(undefined);
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

  const onViewMore = () => {
    setIsPanelOpen(true);
  };

  const onCancel = () => {
    setSelectedThread(undefined);
    setIsPanelOpen(false);
  };

  const postFeed = (value: string) => {
    postFeedHandler?.(value, selectedThread?.id ?? selctedThreadId);
  };

  useEffect(() => {
    onThreadSelect(selectedThread?.id ?? selctedThreadId);
  }, [feedList]);

  useEffect(() => {
    const escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', escapeKeyHandler);

    return () => {
      document.removeEventListener('keydown', escapeKeyHandler);
    };
  }, []);

  return (
    <div className={classNames(className)} id="feedData">
      {feedList.length > 0 ? (
        <Fragment>
          {relativeDays.map((d, i) => {
            return (
              <Fragment key={i}>
                <FeedListSeparator
                  className="tw-relative tw-mt-1 tw-mb-3.5"
                  relativeDay={d}
                />
                <FeedListBody
                  deletePostHandler={deletePostHandler}
                  isEntityFeed={isEntityFeed}
                  postFeed={postFeed}
                  relativeDay={d}
                  selctedThreadId={selctedThreadId}
                  updatedFeedList={updatedFeedList}
                  withSidePanel={withSidePanel}
                  onThreadIdDeselect={onThreadIdDeselect}
                  onThreadIdSelect={onThreadIdSelect}
                  onThreadSelect={onThreadSelect}
                  onViewMore={onViewMore}
                />
              </Fragment>
            );
          })}
          {withSidePanel && selectedThread && isPanelOpen ? (
            <Fragment>
              <ActivityFeedPanel
                deletePostHandler={deletePostHandler}
                open={!isUndefined(selectedThread) && isPanelOpen}
                postFeed={postFeed}
                selectedThread={selectedThread}
                onCancel={onCancel}
              />
            </Fragment>
          ) : null}
        </Fragment>
      ) : (
        <Fragment>
          {entityName ? (
            <NoFeedPlaceholder entityName={entityName} />
          ) : (
            <Fragment>
              <FeedListSeparator
                className="tw-relative tw-mt-1 tw-mb-3.5 tw-pb-5"
                relativeDay=""
              />
              <>No conversations found. Try changing the filter.</>
            </Fragment>
          )}
        </Fragment>
      )}
    </div>
  );
};

export default withLoader<ActivityFeedListProp>(ActivityFeedList);
