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

import { Card, Divider, Typography } from 'antd';
import React, { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ANNOUNCEMENT_BG,
  ANNOUNCEMENT_BORDER,
} from '../../../constants/Feeds.constants';
import {
  Post,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { isActiveAnnouncement } from '../../../utils/AnnouncementsUtils';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import FeedCardFooter from '../ActivityFeedCard/FeedCardFooter/FeedCardFooter';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import AnnouncementBadge from '../Shared/AnnouncementBadge';
import { ActivityThreadListProp } from './ActivityThreadPanel.interface';

const AnnouncementThreads: FC<ActivityThreadListProp> = ({
  threads,
  className,
  selectedThreadId,
  onThreadIdSelect,
  onThreadSelect,
  onConfirmation,
  postFeed,
  updateThreadHandler,
}) => {
  const { t } = useTranslation();
  const { updatedFeedList: updatedThreads } =
    getFeedListWithRelativeDays(threads);

  const toggleReplyEditor = (id: string) => {
    onThreadIdSelect(selectedThreadId === id ? '' : id);
  };

  const activeAnnouncements = updatedThreads.filter(
    (thread) =>
      thread.announcement &&
      isActiveAnnouncement(
        thread.announcement?.startTime,
        thread.announcement?.endTime
      )
  );

  const inActiveAnnouncements = updatedThreads.filter(
    (thread) =>
      !(
        thread.announcement &&
        isActiveAnnouncement(
          thread.announcement?.startTime,
          thread.announcement?.endTime
        )
      )
  );

  const getAnnouncements = (announcements: Thread[]) => {
    return announcements.map((thread, index) => {
      const mainFeed = {
        message: thread.message,
        postTs: thread.threadTs,
        from: thread.createdBy,
        id: thread.id,
        reactions: thread.reactions,
      } as Post;

      const postLength = thread?.posts?.length || 0;
      const replies = thread.postsCount ? thread.postsCount - 1 : 0;
      const repliedUsers = [
        ...new Set((thread?.posts || []).map((f) => f.from)),
      ];
      const repliedUniqueUsersList = repliedUsers.slice(
        0,
        postLength >= 3 ? 2 : 1
      );
      const lastPost = thread?.posts?.[postLength - 1];

      return (
        <Fragment key={index}>
          <Card
            className="ant-card-feed"
            data-testid="announcement-card"
            key={`${index} - card`}
            style={{
              marginTop: '20px',
              paddingTop: '8px',
              borderRadius: '8px',
              border: `1px solid ${ANNOUNCEMENT_BORDER}`,
              background: `${ANNOUNCEMENT_BG}`,
            }}>
            <AnnouncementBadge />
            <div data-testid="main-message">
              <ActivityFeedCard
                isEntityFeed
                isThread
                announcementDetails={thread.announcement}
                entityLink={thread.about}
                feed={mainFeed}
                feedType={thread.type || ThreadType.Conversation}
                taskDetails={thread.task}
                threadId={thread.id}
                updateThreadHandler={updateThreadHandler}
                onConfirmation={onConfirmation}
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
                        repliedUsers={repliedUniqueUsersList}
                        replies={replies}
                        threadId={thread.id}
                        onThreadSelect={() => onThreadSelect(thread.id)}
                      />
                    </div>
                  </div>
                ) : null}
                <div data-testid="latest-reply">
                  <ActivityFeedCard
                    isEntityFeed
                    className="tw-ml-9"
                    feed={lastPost as Post}
                    feedType={thread.type || ThreadType.Conversation}
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
    });
  };

  return (
    <div className={className}>
      {getAnnouncements(activeAnnouncements)}
      {Boolean(inActiveAnnouncements.length) && (
        <>
          <Typography.Text
            className="tw-block tw-mt-4 tw-font-medium"
            data-testid="inActive-announcements">
            {t('label.inactive-announcement-plural')}
          </Typography.Text>
          <Divider className="tw-mb-4 tw-mt-2" />
        </>
      )}

      {getAnnouncements(inActiveAnnouncements)}
    </div>
  );
};

export default AnnouncementThreads;
