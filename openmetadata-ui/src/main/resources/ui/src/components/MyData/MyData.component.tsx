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

import { Card } from 'antd';
import { observer } from 'mobx-react';
import React, {
  Fragment,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../AppState';
import { getUserPath } from '../../constants/constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { FeedFilter } from '../../enums/mydata.enum';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ErrorPlaceHolderES from '../common/error-with-placeholder/ErrorPlaceHolderES';
import { leftPanelAntCardStyle } from '../containers/PageLayout';
import PageLayoutV1 from '../containers/PageLayoutV1';
import { EntityListWithAntd } from '../EntityList/EntityList';
import Loader from '../Loader/Loader';
import MyAssetStats from '../MyAssetStats/MyAssetStats.component';
import Onboarding from '../onboarding/Onboarding';
import RecentlyViewed from '../recently-viewed/RecentlyViewed';
import RecentSearchedTermsAntd from '../RecentSearchedTerms/RecentSearchedTermsAntd';
import { MyDataProps } from './MyData.interface';

const MyData: React.FC<MyDataProps> = ({
  activityFeeds,
  onRefreshFeeds,
  error,
  data,
  ownedData,
  pendingTaskCount,
  followedData,
  feedData,
  ownedDataCount,
  followedDataCount,
  isFeedLoading,
  postFeedHandler,
  deletePostHandler,
  fetchFeedHandler,
  paging,
  updateThreadHandler,
  isLoadingOwnedData,
}: MyDataProps): React.ReactElement => {
  const isMounted = useRef(false);
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
  const [feedFilter, setFeedFilter] = useState(FeedFilter.OWNER);
  const [threadType, setThreadType] = useState<ThreadType>();

  const getLeftPanel = () => {
    return (
      <>
        <MyAssetStats entityState={data} />
        <div className="tw-mb-5" />
        <RecentlyViewed />
        <div className="tw-mb-5" />
        <RecentSearchedTermsAntd />
      </>
    );
  };

  const getRightPanel = useCallback(() => {
    const currentUserDetails = AppState.getCurrentUserDetails();

    return (
      <>
        {/* Pending task count card */}
        {pendingTaskCount ? (
          <div className="tw-mb-5" data-testid="my-tasks-container ">
            <Card
              bodyStyle={{ padding: 0 }}
              extra={
                <>
                  <Link
                    data-testid="my-data"
                    to={getUserPath(
                      currentUserDetails?.name || '',
                      'tasks?feedFilter=ASSIGNED_TO'
                    )}>
                    <span className="tw-text-info tw-font-normal tw-text-xs">
                      View All
                    </span>
                  </Link>
                </>
              }
              style={leftPanelAntCardStyle}
              title={
                <div className="tw-flex tw-item-center ">
                  <SVGIcons
                    alt="Pending tasks"
                    className="tw-mr-2.5"
                    icon={Icons.TASK}
                    title="Tasks"
                    width="16px"
                  />
                  {pendingTaskCount} Pending task{pendingTaskCount > 1 && 's'}
                </div>
              }
            />
          </div>
        ) : null}
        <div data-testid="my-data-container">
          <EntityListWithAntd
            entityList={ownedData}
            headerText={
              <>
                {ownedData.length ? (
                  <Link
                    data-testid="my-data"
                    to={getUserPath(currentUserDetails?.name || '', 'mydata')}>
                    <span className="tw-text-info tw-font-normal tw-text-xs">
                      View All{' '}
                      <span data-testid="my-data-total-count">
                        ({ownedDataCount})
                      </span>
                    </span>
                  </Link>
                ) : null}
              </>
            }
            headerTextLabel="My Data"
            loading={isLoadingOwnedData}
            noDataPlaceholder={<>You have not owned anything yet.</>}
            testIDText="My data"
          />
        </div>
        <div className="tw-mt-5" />
        <div data-testid="following-data-container">
          <EntityListWithAntd
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
                      View All{' '}
                      <span data-testid="following-data-total-count">
                        ({followedDataCount})
                      </span>
                    </span>
                  </Link>
                ) : null}
              </>
            }
            headerTextLabel="Following"
            loading={isLoadingOwnedData}
            noDataPlaceholder={<>You have not followed anything yet.</>}
            testIDText="Following data"
          />
        </div>
        <div className="tw-mt-5" />
      </>
    );
  }, [ownedData, followedData, pendingTaskCount, isLoadingOwnedData]);

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
    fetchMoreFeed(Boolean(isInView), paging);
  }, [isInView, paging]);

  useEffect(() => {
    isMounted.current = true;
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

  // Check if feedFilter or ThreadType filter is applied or not
  const filtersApplied = useMemo(
    () => feedFilter === FeedFilter.OWNER && !threadType,
    [feedFilter, threadType]
  );

  return (
    <PageLayoutV1 leftPanel={getLeftPanel()} rightPanel={getRightPanel()}>
      {error ? (
        <ErrorPlaceHolderES errorMessage={error} type="error" />
      ) : (
        <Fragment>
          {feedData?.length > 0 || !filtersApplied || newFeedsLength ? (
            <>
              <ActivityFeedList
                stickyFilter
                withSidePanel
                deletePostHandler={deletePostHandler}
                feedList={feedData}
                postFeedHandler={postFeedHandler}
                refreshFeedCount={newFeedsLength}
                updateThreadHandler={updateThreadHandler}
                onFeedFiltersUpdate={handleFeedFilterChange}
                onRefreshFeeds={onRefreshFeeds}
              />
              {filtersApplied && feedData?.length <= 0 ? <Onboarding /> : null}
            </>
          ) : (
            !isFeedLoading && <Onboarding />
          )}
          {isFeedLoading ? <Loader /> : null}
          <div
            data-testid="observer-element"
            id="observer-element"
            ref={elementRef as RefObject<HTMLDivElement>}
          />
          {/* Add spacer to work infinite scroll smoothly */}
          <div className="tw-p-4" />
        </Fragment>
      )}
    </PageLayoutV1>
  );
};

export default observer(MyData);
