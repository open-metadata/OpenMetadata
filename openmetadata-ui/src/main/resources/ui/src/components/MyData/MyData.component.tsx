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
import { filterList, observerOptions } from '../../constants/Mydata.constants';
import { FeedFilter, Ownership } from '../../enums/mydata.enum';
import { Paging } from '../../generated/type/paging';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { getExploreLinkByFilter } from '../../utils/CommonUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolderES from '../common/error-with-placeholder/ErrorPlaceHolderES';
import PageLayout from '../containers/PageLayout';
import DropDownList from '../dropdown/DropDownList';
import { EntityListWithAntd } from '../EntityList/EntityList';
import Loader from '../Loader/Loader';
import MyAssetStats from '../MyAssetStats/MyAssetStats.component';
import Onboarding from '../onboarding/Onboarding';
import RecentlyViewed from '../recently-viewed/RecentlyViewed';
import RecentSearchedTermsAntd from '../RecentSearchedTerms/RecentSearchedTermsAntd';
import { MyDataProps } from './MyData.interface';

const MyData: React.FC<MyDataProps> = ({
  error,
  countDashboards,
  countPipelines,
  countServices,
  countTables,
  countTopics,
  countTeams,
  countUsers,
  ownedData,
  followedData,
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
}: MyDataProps): React.ReactElement => {
  const [fieldListVisible, setFieldListVisible] = useState<boolean>(false);
  const isMounted = useRef(false);
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);

  const handleDropDown = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    feedFilterHandler((value as FeedFilter) || FeedFilter.ALL);
    setFieldListVisible(false);
  };
  const getFilterDropDown = () => {
    return (
      <Fragment>
        <div className="tw-relative tw-my-5">
          <Button
            className="hover:tw-no-underline focus:tw-no-underline"
            data-testid="feeds"
            size="custom"
            tag="button"
            theme="primary"
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
      </Fragment>
    );
  };

  const getLeftPanel = () => {
    return (
      <div className="tw-mt-4">
        <MyAssetStats
          countDashboards={countDashboards}
          countPipelines={countPipelines}
          countServices={countServices}
          countTables={countTables}
          countTeams={countTeams}
          countTopics={countTopics}
          countUsers={countUsers}
        />
        <div className="tw-mb-3" />
        <RecentlyViewed />
        <div className="tw-mb-3" />
        <RecentSearchedTermsAntd />
      </div>
    );
  };

  const getRightPanel = useCallback(() => {
    return (
      <div className="tw-mt-4">
        <div data-testid="my-data-container">
          <EntityListWithAntd
            entityList={ownedData}
            headerText={
              <>
                {ownedData.length ? (
                  <Link
                    data-testid="my-data"
                    to={getExploreLinkByFilter(
                      Ownership.OWNER,
                      AppState.userDetails,
                      AppState.nonSecureUserDetails
                    )}>
                    <span className="link-text tw-font-normal tw-text-xs">
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
        <div className="tw-mt-3" />
        <div data-testid="following-data-container">
          <EntityListWithAntd
            entityList={followedData}
            headerText={
              <>
                {followedData.length ? (
                  <Link
                    data-testid="following-data"
                    to={getExploreLinkByFilter(
                      Ownership.FOLLOWERS,
                      AppState.userDetails,
                      AppState.nonSecureUserDetails
                    )}>
                    <span className="link-text tw-font-normal tw-text-xs">
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
        <div className="tw-mt-3" />
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

  return (
    <PageLayout leftPanel={getLeftPanel()} rightPanel={getRightPanel()}>
      {error ? (
        <ErrorPlaceHolderES errorMessage={error} type="error" />
      ) : (
        <Fragment>
          {feedData?.length > 0 || feedFilter !== FeedFilter.ALL ? (
            <Fragment>
              {getFilterDropDown()}
              <ActivityFeedList
                withSidePanel
                className=""
                deletePostHandler={deletePostHandler}
                feedList={feedData}
                postFeedHandler={postFeedHandler}
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
