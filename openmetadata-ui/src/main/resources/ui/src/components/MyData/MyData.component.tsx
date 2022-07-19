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
import PageLayout, { leftPanelAntCardStyle } from '../containers/PageLayout';
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
  countDashboards,
  countPipelines,
  countServices,
  countTables,
  countTopics,
  countTeams,
  countUsers,
  ownedData,
  pendingTaskCount,
  countMlModal,
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
}: MyDataProps): React.ReactElement => {
  const isMounted = useRef(false);
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
  const [feedFilter, setFeedFilter] = useState(FeedFilter.ALL);
  const [threadType, setThreadType] = useState<ThreadType>();

  const getLeftPanel = () => {
    return (
      <div className="tw-mt-4">
        <MyAssetStats
          countDashboards={countDashboards}
          countMlModal={countMlModal}
          countPipelines={countPipelines}
          countServices={countServices}
          countTables={countTables}
          countTeams={countTeams}
          countTopics={countTopics}
          countUsers={countUsers}
        />
        <div className="tw-mb-5" />
        <RecentlyViewed />
        <div className="tw-mb-5" />
        <RecentSearchedTermsAntd />
      </div>
    );
  };

  const getRightPanel = useCallback(() => {
    const currentUserDetails = AppState.getCurrentUserDetails();

    return (
      <div className="tw-mt-4">
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
                  {pendingTaskCount} Pending tasks
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
            noDataPlaceholder={<>You have not followed anything yet.</>}
            testIDText="Following data"
          />
        </div>
        <div className="tw-mt-5" />
      </div>
    );
  }, [ownedData, followedData, pendingTaskCount]);

  const getLoader = () => {
    return isFeedLoading ? <Loader /> : null;
  };

  const fetchMoreFeed = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (
      isElementInView &&
      pagingObj?.after &&
      !isLoading &&
      isMounted.current
    ) {
      fetchFeedHandler(feedFilter, pagingObj.after, threadType);
    }
  };

  useEffect(() => {
    fetchMoreFeed(isInView as boolean, paging, isFeedLoading);
  }, [isInView, paging, isFeedLoading]);

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
    () => feedFilter === FeedFilter.ALL && !threadType,
    [feedFilter, threadType]
  );

  return (
    <PageLayout leftPanel={getLeftPanel()} rightPanel={getRightPanel()}>
      {error ? (
        <ErrorPlaceHolderES errorMessage={error} type="error" />
      ) : (
        <Fragment>
          {feedData?.length > 0 || !filtersApplied || newFeedsLength ? (
            <>
              <ActivityFeedList
                withSidePanel
                className="tw-mt-3"
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
          <div
            data-testid="observer-element"
            id="observer-element"
            ref={elementRef as RefObject<HTMLDivElement>}>
            {getLoader()}
          </div>
          {/* Add spacer to work infinite scroll smoothly */}
          <div className="tw-p-4" />
        </Fragment>
      )}
    </PageLayout>
  );
};

export default observer(MyData);
