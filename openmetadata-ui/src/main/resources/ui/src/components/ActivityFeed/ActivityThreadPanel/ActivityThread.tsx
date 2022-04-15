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

import { AxiosError, AxiosResponse } from 'axios';
import { EntityThread, Post } from 'Models';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { getFeedById } from '../../../axiosAPIs/feedsAPI';
import jsonData from '../../../jsons/en';
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
}) => {
  const [threadData, setThreadData] = useState<EntityThread>(selectedThread);
  const repliesLength = threadData?.posts?.length ?? 0;
  const mainThread = {
    message: threadData.message,
    from: threadData.createdBy,
    postTs: threadData.threadTs,
    id: threadData.id,
  };

  useEffect(() => {
    getFeedById(selectedThread.id)
      .then((res: AxiosResponse) => {
        setThreadData(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['fetch-feed-error']);
      });
  }, [selectedThread]);

  return (
    <Fragment>
      <div className={className}>
        {threadData ? (
          <div data-testid="main-message">
            <ActivityFeedCard
              isEntityFeed
              className="tw-mb-3"
              feed={mainThread as Post}
            />
          </div>
        ) : null}
        {repliesLength > 0 ? (
          <div data-testid="replies">
            <div className="tw-mb-3 tw-flex">
              <span data-testid="replies-count">
                {getReplyText(repliesLength, 'reply', 'replies')}
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
                key={key}
                threadId={threadData.id}
                onConfirmation={onConfirmation}
              />
            ))}
          </div>
        ) : null}
        <ActivityFeedEditor
          buttonClass="tw-mr-4"
          className="tw-ml-5 tw-mr-2 tw-my-6"
          onSave={postFeed}
        />
      </div>
    </Fragment>
  );
};

export default ActivityThread;
