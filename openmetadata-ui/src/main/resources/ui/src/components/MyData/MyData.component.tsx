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
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../AppState';
import { getUserPath } from '../../constants/constants';
import {
  filterList,
  observerOptions,
  threadFilterList,
} from '../../constants/Mydata.constants';
import { FeedFilter } from '../../enums/mydata.enum';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolderES from '../common/error-with-placeholder/ErrorPlaceHolderES';
import PageLayout, { leftPanelAntCardStyle } from '../containers/PageLayout';
import DropDownList from '../dropdown/DropDownList';
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
  threadTypeFilter,
  onThreadTypeFilterChange,
  feedData,
  feedFilter,
  ownedDataCount,
  followedDataCount,
  feedFilterHandler,
  isFeedLoading,
  postFeedHandler,
  deletePostHandler,
  fetchFeedHandler,
  paging,
  updateThreadHandler,
}: MyDataProps): React.ReactElement => {
  const [fieldListVisible, setFieldListVisible] = useState<boolean>(false);
  const [showThreadTypeList, setShowThreadTypeList] = useState<boolean>(false);
  const isMounted = useRef(false);
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);

  const handleDropDown = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    feedFilterHandler((value as FeedFilter) || FeedFilter.ALL);
    setFieldListVisible(false);
  };

  // Thread filter change handler
  const handleThreadTypeDropDownChange = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    onThreadTypeFilterChange(
      value === 'ALL' ? undefined : (value as ThreadType) ?? undefined
    );
    setShowThreadTypeList(false);
  };

  const getFilterDropDown = () => {
    return (
      <div className="tw-flex">
        {/* Feed filter */}
        <div className="tw-relative tw-mt-5 tw-mr-5">
          <Button
            className="hover:tw-no-underline focus:tw-no-underline"
            data-testid="feeds"
            size="custom"
            tag="button"
            variant="link"
            onClick={() => setFieldListVisible((visible) => !visible)}>
            <span className="tw-font-medium tw-text-grey">
              {filterList.find((f) => f.value === feedFilter)?.name}
            </span>
            <DropDownIcon />
          </Button>
          {fieldListVisible && (
            <DropDownList
              dropDownList={filterList}
              value={feedFilter}
              onSelect={handleDropDown}
            />
          )}
        </div>
        {/* Thread filter */}
        <div className="tw-relative tw-mt-5">
          <Button
            className="hover:tw-no-underline focus:tw-no-underline"
            data-testid="thread-filter"
            size="custom"
            tag="button"
            variant="link"
            onClick={() => setShowThreadTypeList((visible) => !visible)}>
            <span className="tw-font-medium tw-text-grey">
              {
                threadFilterList.find(
                  (f) => f.value === (threadTypeFilter ?? 'ALL')
                )?.name
              }
            </span>
            <DropDownIcon />
          </Button>
          {showThreadTypeList && (
            <DropDownList
              dropDownList={threadFilterList}
              value={threadTypeFilter}
              onSelect={handleThreadTypeDropDownChange}
            />
          )}
        </div>
      </div>
    );
  };

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
  }, [ownedData, followedData]);

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
      fetchFeedHandler(feedFilter, pagingObj.after);
    }
  };

  useEffect(() => {
    fetchMoreFeed(isInView as boolean, paging, isFeedLoading);
  }, [isInView, paging, isFeedLoading]);

  useEffect(() => {
    isMounted.current = true;
  }, []);

  const newFeedsLength = activityFeeds && activityFeeds.length;

  return (
    <PageLayout leftPanel={getLeftPanel()} rightPanel={getRightPanel()}>
      {error ? (
        <ErrorPlaceHolderES errorMessage={error} type="error" />
      ) : (
        <Fragment>
          {feedData?.length > 0 ||
          feedFilter !== FeedFilter.ALL ||
          threadTypeFilter ? (
            <Fragment>
              {getFilterDropDown()}

              {newFeedsLength ? (
                <div className="tw-py-px tw-pt-3 tw-pb-3">
                  <button
                    className="tw-refreshButton "
                    onClick={onRefreshFeeds}>
                    View {newFeedsLength} new{' '}
                    {newFeedsLength > 1 ? 'activities' : 'activity'}
                  </button>
                </div>
              ) : null}

              <ActivityFeedList
                withSidePanel
                className=""
                deletePostHandler={deletePostHandler}
                feedList={feedData}
                postFeedHandler={postFeedHandler}
                updateThreadHandler={updateThreadHandler}
              />
            </Fragment>
          ) : (
            <Onboarding />
          )}
          <div
            data-testid="observer-element"
            id="observer-element"
            ref={elementRef as RefObject<HTMLDivElement>}>
            {getLoader()}
          </div>
        </Fragment>
      )}
    </PageLayout>
  );
};

export default observer(MyData);
