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

import { AxiosError } from 'axios';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFeedById } from 'rest/feedsAPI';
import {
  Post,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { getReplyText } from '../../../utils/FeedUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import { ActivityThreadProp } from './ActivityThreadPanel.interface';

const ActivityThread: FC<ActivityThreadProp> = ({
  className,
  selectedThread,
  postFeed,
  onConfirmation,
  updateThreadHandler,
}) => {
  const { t } = useTranslation();
  const [threadData, setThreadData] = useState<Thread>(selectedThread);
  const repliesLength = threadData?.posts?.length ?? 0;
  const mainThread = {
    message: threadData.message,
    from: threadData.createdBy,
    postTs: threadData.threadTs,
    id: threadData.id,
    reactions: threadData.reactions,
  };

  useEffect(() => {
    getFeedById(selectedThread.id)
      .then((res) => {
        setThreadData(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('message.entity-fetch-error', {
            entity: t('label.message-lowercase-plural'),
          })
        );
      });
  }, [selectedThread]);

  return (
    <Fragment>
      <div className={className}>
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
      <ActivityFeedEditor
        buttonClass="tw-mr-4"
        className="tw-ml-5 tw-mr-2 tw-my-6"
        onSave={postFeed}
      />
    </Fragment>
  );
};

export default ActivityThread;
