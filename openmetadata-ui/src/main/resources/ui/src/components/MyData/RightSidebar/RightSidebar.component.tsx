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
import { Alert, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AppState from '../../../AppState';
import { ReactComponent as AnnouncementIcon } from '../../../assets/svg/announcements-v1.svg';
import FeedCardBodyV1 from '../../../components/ActivityFeed/ActivityFeedCard/FeedCardBody/FeedCardBodyV1';
import FeedCardHeaderV1 from '../../../components/ActivityFeed/ActivityFeedCard/FeedCardHeader/FeedCardHeaderV1';
import { EntityListWithV1 } from '../../../components/Entity/EntityList/EntityList';
import RecentlyViewed from '../../../components/recently-viewed/RecentlyViewed';
import { getUserPath } from '../../../constants/constants';
import { Thread } from '../../../generated/entity/feed/thread';
import { EntityReference } from '../../../generated/entity/type';
import { getActiveAnnouncement } from '../../../rest/feedsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import './right-sidebar.less';

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
      {announcements.length > 0 && (
        <>
          <div className="p-md p-b-xss">
            <Typography.Paragraph className="right-panel-label m-b-sm">
              {t('label.recent-announcement-plural')}
            </Typography.Paragraph>
            <div className="announcement-container-list">
              {announcements.map((item) => {
                return (
                  <Alert
                    className="m-b-xs right-panel-announcement"
                    description={
                      <>
                        <FeedCardHeaderV1
                          about={item.about}
                          className="d-inline"
                          createdBy={item.createdBy}
                          showUserAvatar={false}
                          timeStamp={item.threadTs}
                        />
                        <FeedCardBodyV1
                          isOpenInDrawer
                          announcement={item.announcement}
                          className="p-t-xs"
                          isEditPost={false}
                          message={item.message}
                          showSchedule={false}
                        />
                      </>
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
          </div>
        </>
      )}

      <div className="p-md" data-testid="following-data-container">
        <EntityListWithV1
          entityList={followedData}
          headerText={
            <>
              {followedData.length ? (
                <Link
                  className="view-all-btn text-grey-muted"
                  data-testid="following-data"
                  to={getUserPath(currentUserDetails?.name ?? '', 'following')}>
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
          testIDText="following"
        />
      </div>
      <div className="p-md" data-testid="recently-viewed-container">
        <RecentlyViewed />
      </div>
    </>
  );
};

export default RightSidebar;
