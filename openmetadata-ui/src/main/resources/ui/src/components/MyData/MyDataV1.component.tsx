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

import { Alert, Card, Divider, Space } from 'antd';
import { ReactComponent as AnnouncementIcon } from 'assets/svg/announcements-v1.svg';
import ActivityFeedCard from 'components/ActivityFeed/ActivityFeedCard/ActivityFeedCard';
import RecentlyViewed from 'components/recently-viewed/RecentlyViewed';
import WelcomeScreen from 'components/WelcomeScreen/WelcomeScreen.component';
import { ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { observer } from 'mobx-react';
import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getActiveAnnouncement } from 'rest/feedsAPI';
import { showErrorToast } from 'utils/ToastUtils';
import AppState from '../../AppState';
import {
  getUserPath,
  LOGGED_IN_USER_STORAGE_KEY,
} from '../../constants/constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { FeedFilter } from '../../enums/mydata.enum';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { useElementInView } from '../../hooks/useElementInView';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ErrorPlaceHolderES from '../common/error-with-placeholder/ErrorPlaceHolderES';
import PageLayoutV1 from '../containers/PageLayoutV1';
import { EntityListWithAntdV1 } from '../EntityList/EntityList';
import Loader from '../Loader/Loader';
import LeftSidebar from './LeftSidebar/LeftSidebar.component';
import { MyDataProps } from './MyData.interface';
import './myData.less';

const MyDataV1: React.FC<MyDataProps> = ({
  activityFeeds,
  onRefreshFeeds,
  error,
  ownedData,
  pendingTaskCount,
  followedData,
  feedData,
  followedDataCount,
  isFeedLoading,
  postFeedHandler,
  deletePostHandler,
  fetchFeedHandler,
  paging,
  updateThreadHandler,
  isLoadingOwnedData,
}: MyDataProps): React.ReactElement => {
  const { t } = useTranslation();
  const isMounted = useRef(false);
  const [elementRef, isInView] = useElementInView(observerOptions);
  const [feedFilter, setFeedFilter] = useState(FeedFilter.OWNER);
  const [threadType, setThreadType] = useState<ThreadType>();
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [announcements, setAnnouncements] = useState<Thread[]>([]);
  const storageData = localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY);

  const loggedInUserName = useMemo(() => {
    return AppState.getCurrentUserDetails()?.name || '';
  }, [AppState]);

  const usernameExistsInCookie = useMemo(() => {
    return storageData
      ? storageData.split(',').includes(loggedInUserName)
      : false;
  }, [storageData, loggedInUserName]);

  const updateWelcomeScreen = (show: boolean) => {
    if (loggedInUserName) {
      const arr = storageData ? storageData.split(',') : [];
      if (!arr.includes(loggedInUserName)) {
        arr.push(loggedInUserName);
        localStorage.setItem(LOGGED_IN_USER_STORAGE_KEY, arr.join(','));
      }
    }
    setShowWelcomeScreen(show);
  };

  const getRightPanel = useCallback(() => {
    const currentUserDetails = AppState.getCurrentUserDetails();

    return (
      <>
        <Space>
          {pendingTaskCount ? (
            <div className="tw-mb-5" data-testid="my-tasks-container ">
              <Card
                bodyStyle={{ padding: 0 }}
                className="panel-shadow-color"
                extra={
                  <>
                    <Link
                      data-testid="my-data"
                      to={getUserPath(
                        currentUserDetails?.name || '',
                        'tasks?feedFilter=ASSIGNED_TO'
                      )}>
                      <span className="tw-text-info tw-font-normal tw-text-xs">
                        {t('label.view-all')}
                      </span>
                    </Link>
                  </>
                }
                title={
                  <div className="tw-flex tw-item-center ">
                    <SVGIcons
                      alt="Pending tasks"
                      className="tw-mr-2.5"
                      icon={Icons.TASK}
                      title={t('label.task-plural')}
                      width="16px"
                    />
                    {pendingTaskCount}{' '}
                    {pendingTaskCount > 1
                      ? t('label.pending-task-plural')
                      : t('label.pending-task')}
                  </div>
                }
              />
            </div>
          ) : null}
        </Space>
        <div className="p-md" data-testid="following-data-container">
          <EntityListWithAntdV1
            entityList={followedData}
            headerText={
              <>
                {followedData.length ? (
                  <Link
                    data-testid="following-data"
                    to={getUserPath(
                      currentUserDetails?.name || '',
                      'following'
                    )}>
                    <span className="tw-text-info tw-font-normal tw-text-xs">
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
              <>
                <Alert
                  closable
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
                      updateThreadHandler={updateThreadHandler}
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
              </>
            );
          })}
        </div>
      </>
    );
  }, [
    ownedData,
    announcements,
    followedData,
    pendingTaskCount,
    isLoadingOwnedData,
  ]);

  const fetchMoreFeed = useCallback(
    (isElementInView: boolean, pagingObj: Paging) => {
      if (
        isElementInView &&
        pagingObj?.after &&
        !isFeedLoading &&
        isMounted.current
      ) {
        fetchFeedHandler(feedFilter, pagingObj.after, threadType);
      }
    },
    [isFeedLoading, threadType, fetchFeedHandler, isMounted.current]
  );

  useEffect(() => {
    fetchMoreFeed(isInView, paging);
  }, [isInView, paging]);

  useEffect(() => {
    isMounted.current = true;
    updateWelcomeScreen(!usernameExistsInCookie);
    getActiveAnnouncement()
      .then((res) => {
        setAnnouncements(res.data);
      })
      .catch((err) => {
        showErrorToast(err);
      });

    return () => updateWelcomeScreen(false);
  }, []);

  const handleFeedFilterChange = useCallback(
    (feedType: FeedFilter, threadType?: ThreadType) => {
      setFeedFilter(feedType);
      setThreadType(threadType);
      fetchFeedHandler(feedType, undefined, threadType);
    },
    [fetchFeedHandler]
  );

  const newFeedsLength = activityFeeds && activityFeeds.length;

  const showActivityFeedList = useMemo(
    () => !(!isFeedLoading && showWelcomeScreen),
    [isFeedLoading, showWelcomeScreen]
  );

  return (
    <PageLayoutV1
      className="my-data-page p-0"
      leftPanel={<LeftSidebar />}
      leftPanelWidth={90}
      pageTitle={t('label.my-data')}
      rightPanel={getRightPanel()}
      rightPanelWidth={380}>
      <>
        {error ? (
          <ErrorPlaceHolderES
            errorMessage={error}
            type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.ERROR}
          />
        ) : (
          <>
            {showActivityFeedList ? (
              <ActivityFeedList
                stickyFilter
                withSidePanel
                appliedFeedFilter={feedFilter}
                deletePostHandler={deletePostHandler}
                feedList={feedData}
                isFeedLoading={isFeedLoading}
                postFeedHandler={postFeedHandler}
                refreshFeedCount={newFeedsLength}
                updateThreadHandler={updateThreadHandler}
                onFeedFiltersUpdate={handleFeedFilterChange}
                onRefreshFeeds={onRefreshFeeds}
              />
            ) : (
              !isFeedLoading && (
                <WelcomeScreen onClose={() => updateWelcomeScreen(false)} />
              )
            )}
            {isFeedLoading ? <Loader /> : null}
            <div
              data-testid="observer-element"
              id="observer-element"
              ref={elementRef as RefObject<HTMLDivElement>}
            />
            {/* Add spacer to work infinite scroll smoothly */}
            <div className="tw-p-4" />
          </>
        )}
      </>
    </PageLayoutV1>
  );
};

export default observer(MyDataV1);
