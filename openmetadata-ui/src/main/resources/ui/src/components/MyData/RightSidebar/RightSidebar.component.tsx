/*
 *  Copyright 2023 Collate.
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
import { Alert, Divider } from 'antd';
import AppState from 'AppState';
import { ReactComponent as AnnouncementIcon } from 'assets/svg/announcements-v1.svg';
import ActivityFeedCard from 'components/ActivityFeed/ActivityFeedCard/ActivityFeedCard';
import { EntityListWithAntdV1 } from 'components/EntityList/EntityList';
import RecentlyViewed from 'components/recently-viewed/RecentlyViewed';
import { getUserPath } from 'constants/constants';
import { Post, Thread, ThreadType } from 'generated/entity/feed/thread';
import { EntityReference } from 'generated/entity/type';
import { noop } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getActiveAnnouncement } from 'rest/feedsAPI';
import { showErrorToast } from 'utils/ToastUtils';

interface RightSidebarProps {
  followedDataCount: number;
  followedData: Array<EntityReference>;
  isLoadingOwnedData: boolean;
}

const RightSidebar = ({
  followedData,
  followedDataCount,
  isLoadingOwnedData,
}: RightSidebarProps) => {
  const { t } = useTranslation();
  const currentUserDetails = AppState.getCurrentUserDetails();
  const [announcements, setAnnouncements] = useState<Thread[]>([]);

  useEffect(() => {
    getActiveAnnouncement()
      .then((res) => {
        setAnnouncements(res.data);
      })
      .catch((err) => {
        showErrorToast(err);
      });
  }, []);

  return (
    <>
      <div className="p-md" data-testid="following-data-container">
        <EntityListWithAntdV1
          entityList={followedData}
          headerText={
            <>
              {followedData.length ? (
                <Link
                  className="view-all-btn"
                  data-testid="following-data"
                  to={getUserPath(currentUserDetails?.name || '', 'following')}>
                  <span className="font-normal text-xs">
                    {t('label.view-all')}{' '}
                    <span data-testid="following-data-total-count">
                      {`(${followedDataCount})`}
                    </span>
                  </span>
                </Link>
              ) : null}
            </>
          }
          headerTextLabel={t('label.following')}
          loading={isLoadingOwnedData}
          noDataPlaceholder={t('message.not-followed-anything')}
          testIDText="Following data"
        />
      </div>
      <Divider className="m-0" />
      <div className="p-md" data-testid="recently-viewed-container">
        <RecentlyViewed />
      </div>
      <Divider className="m-0" />
      <div className="p-md">
        {announcements.map((item) => {
          const mainFeed = {
            message: item.message,
            postTs: item.threadTs,
            from: item.createdBy,
            id: item.id,
            reactions: item.reactions,
          } as Post;

          return (
            <Alert
              className="m-b-xs p-b-0"
              description={
                <ActivityFeedCard
                  isEntityFeed
                  announcementDetails={item.announcement}
                  className="right-panel-announcement"
                  data-testid="main-message"
                  editAnnouncementPermission={false}
                  entityLink={item.about}
                  feed={mainFeed}
                  feedType={ThreadType.Announcement}
                  isThread={false}
                  showUserAvatar={false}
                  taskDetails={item.task}
                  threadId={item.id}
                  updateThreadHandler={noop}
                />
              }
              key={item.id}
              message={
                <div className="d-flex announcement-alert-heading">
                  <AnnouncementIcon width={20} />
                  <span className="text-sm p-l-xss">
                    {t('label.announcement')}
                  </span>
                </div>
              }
              type="info"
            />
          );
        })}
      </div>
    </>
  );
};

export default RightSidebar;
