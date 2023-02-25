/*
 *  Copyright 2022 Collate.
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
import { useTranslation } from 'react-i18next';
import { Post, ThreadType } from '../../../generated/entity/feed/thread';
import { getReplyText } from '../../../utils/FeedUtils';
import Loader from '../../Loader/Loader';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import { FeedPanelBodyProp } from './ActivityFeedPanel.interface';

const FeedPanelBody: FC<FeedPanelBodyProp> = ({
  threadData,
  className,
  isLoading,
  onConfirmation,
  updateThreadHandler,
}) => {
  const { t } = useTranslation();
  const repliesLength = threadData?.posts?.length ?? 0;
  const mainThread = {
    message: threadData.message,
    from: threadData.createdBy,
    postTs: threadData.threadTs,
    id: threadData.id,
    reactions: threadData.reactions,
  };

  return (
    <Fragment>
      {isLoading ? (
        <Loader />
      ) : (
        <div className={className} data-testid="panel-body">
          {threadData ? (
            <div data-testid="main-message">
              <ActivityFeedCard
                isEntityFeed
                isThread
                announcementDetails={threadData.announcement}
                className="tw-mb-3"
                feed={mainThread as Post}
                feedType={threadData.type || ThreadType.Conversation}
                threadId={threadData.id}
                updateThreadHandler={updateThreadHandler}
                onConfirmation={onConfirmation}
              />
            </div>
          ) : null}
          {repliesLength > 0 ? (
            <div data-testid="replies">
              <div className="tw-mb-3 tw-flex">
                <span data-testid="replies-count">
                  {getReplyText(
                    repliesLength,
                    t('label.reply-lowercase'),
                    t('label.reply-lowercase-plural')
                  )}
                </span>
                <span className="tw-flex-auto tw-self-center tw-ml-1.5">
                  <hr />
                </span>
              </div>
              {threadData?.posts?.map((reply, key) => (
                <ActivityFeedCard
                  isEntityFeed
                  className="tw-mb-3"
                  feed={reply}
                  feedType={threadData.type || ThreadType.Conversation}
                  key={key}
                  threadId={threadData.id}
                  updateThreadHandler={updateThreadHandler}
                  onConfirmation={onConfirmation}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Fragment>
  );
};

export default FeedPanelBody;
