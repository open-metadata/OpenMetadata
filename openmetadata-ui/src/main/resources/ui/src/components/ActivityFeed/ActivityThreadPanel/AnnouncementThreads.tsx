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

import { Alert, Divider, Typography } from 'antd';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AnnouncementIcon } from '../../../assets/svg/announcements-v1.svg';
import { Post, Thread } from '../../../generated/entity/feed/thread';
import { isActiveAnnouncement } from '../../../utils/AnnouncementsUtils';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import ActivityFeedCardV1 from '../ActivityFeedCard/ActivityFeedCardV1';
import { ActivityThreadListProp } from './ActivityThreadPanel.interface';
import './announcement.less';

const AnnouncementThreads: FC<
  Pick<ActivityThreadListProp, 'threads' | 'className'>
> = ({ threads, className }) => {
  const { t } = useTranslation();
  const { updatedFeedList: updatedThreads } =
    getFeedListWithRelativeDays(threads);

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

      return (
        <Alert
          description={
            <ActivityFeedCardV1
              className="p-y-xss"
              data-testid="announcement-card"
              feed={thread}
              hidePopover={false}
              isPost={false}
              post={mainFeed}
              showThread={false}
            />
          }
          key={`${index} - card`}
          message={
            <div className="d-flex announcement-alert-heading">
              <AnnouncementIcon width={20} />
              <span className="text-sm p-l-xss">{t('label.announcement')}</span>
            </div>
          }
          type="info"
        />
      );
    });
  };

  return (
    <div className={className}>
      {getAnnouncements(activeAnnouncements)}
      {Boolean(inActiveAnnouncements.length) && (
        <>
          <Divider />
          <Typography.Text
            className="font-medium"
            data-testid="inActive-announcements">
            {t('label.inactive-announcement-plural')}
          </Typography.Text>
        </>
      )}

      {getAnnouncements(inActiveAnnouncements)}
    </div>
  );
};

export default AnnouncementThreads;
