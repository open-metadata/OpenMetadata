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

import { Divider, Typography } from 'antd';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Post, Thread } from '../../generated/entity/feed/thread';
import { isActiveAnnouncement } from '../../utils/AnnouncementsUtils';
import { getFeedListWithRelativeDays } from '../../utils/FeedUtils';
import { AnnouncementThreadListProp } from './Announcement.interface';
import './announcement.less';
import AnnouncementFeedCard from './AnnouncementFeedCard.component';

const AnnouncementThreads: FC<AnnouncementThreadListProp> = ({
  threads,
  editPermission,
  postFeed,
  onConfirmation,
  updateThreadHandler,
}) => {
  const { t } = useTranslation();
  const { updatedFeedList: updatedThreads } =
    getFeedListWithRelativeDays(threads);

  const { activeAnnouncements, inActiveAnnouncements } = useMemo(() => {
    return updatedThreads.reduce(
      (
        acc: {
          activeAnnouncements: Thread[];
          inActiveAnnouncements: Thread[];
        },
        cv: Thread
      ) => {
        if (
          cv.announcement &&
          isActiveAnnouncement(
            cv.announcement?.startTime,
            cv.announcement?.endTime
          )
        ) {
          acc.activeAnnouncements.push(cv);
        } else {
          acc.inActiveAnnouncements.push(cv);
        }

        return acc;
      },
      {
        activeAnnouncements: [],
        inActiveAnnouncements: [],
      }
    );
  }, [updatedThreads]);

  const getAnnouncements = useCallback(
    (announcements: Thread[]) => {
      return announcements.map((thread) => {
        const mainFeed = {
          message: thread.message,
          postTs: thread.threadTs,
          from: thread.createdBy,
          id: thread.id,
          reactions: thread.reactions,
        } as Post;

        return (
          <AnnouncementFeedCard
            editPermission={editPermission}
            feed={mainFeed}
            key={thread.id}
            postFeed={postFeed}
            task={thread}
            updateThreadHandler={updateThreadHandler}
            onConfirmation={onConfirmation}
          />
        );
      });
    },
    [editPermission, postFeed, updateThreadHandler, onConfirmation]
  );

  return (
    <>
      {getAnnouncements(activeAnnouncements)}
      {Boolean(inActiveAnnouncements.length) && (
        <div className="d-flex flex-column items-end m-y-xlg">
          <Typography.Text
            className="text-announcement"
            data-testid="inActive-announcements">
            <strong>{inActiveAnnouncements.length}</strong>{' '}
            {t('label.inactive-announcement-plural')}
          </Typography.Text>
          <Divider className="m-t-xs m-b-0" />
        </div>
      )}

      {getAnnouncements(inActiveAnnouncements)}
    </>
  );
};

export default AnnouncementThreads;
