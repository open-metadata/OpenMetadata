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

import { Divider } from 'antd';
import { AxiosError } from 'axios';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Post,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { getFeedById } from '../../../rest/feedsAPI';
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
    <>
      <div className={className}>
        {threadData ? (
          <div data-testid="main-message">
            <ActivityFeedCard
              isEntityFeed
              isThread
              announcementDetails={threadData.announcement}
              feed={mainThread as Post}
              feedType={threadData.type || ThreadType.Conversation}
              task={threadData}
              threadId={threadData.id}
              updateThreadHandler={updateThreadHandler}
              onConfirmation={onConfirmation}
            />
          </div>
        ) : null}
        {repliesLength > 0 ? (
          <div className="m-l-sm" data-testid="replies">
            <Divider
              plain
              className="m-y-sm"
              data-testid="replies-count"
              orientation="left">
              {getReplyText(
                repliesLength,
                t('label.reply-lowercase'),
                t('label.reply-lowercase-plural')
              )}
            </Divider>

            {threadData?.posts?.map((reply, key) => (
              <ActivityFeedCard
                isEntityFeed
                className="m-b-sm"
                feed={reply}
                feedType={threadData.type || ThreadType.Conversation}
                key={key}
                task={threadData}
                threadId={threadData.id}
                updateThreadHandler={updateThreadHandler}
                onConfirmation={onConfirmation}
              />
            ))}
          </div>
        ) : null}
      </div>
      <ActivityFeedEditor onSave={postFeed} />
    </>
  );
};

export default ActivityThread;
