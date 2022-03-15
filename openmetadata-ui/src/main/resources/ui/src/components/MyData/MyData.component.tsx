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
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../AppState';
import { getExplorePathWithSearch } from '../../constants/constants';
import { filterList } from '../../constants/Mydata.constants';
import { FeedFilter, Ownership } from '../../enums/mydata.enum';
import { getOwnerIds } from '../../utils/CommonUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolderES from '../common/error-with-placeholder/ErrorPlaceHolderES';
import PageLayout from '../containers/PageLayout';
import DropDownList from '../dropdown/DropDownList';
import EntityList from '../EntityList/EntityList';
import MyAssetStats from '../MyAssetStats/MyAssetStats.component';
import Onboarding from '../onboarding/Onboarding';
import RecentlyViewed from '../recently-viewed/RecentlyViewed';
import RecentSearchedTerms from '../RecentSearchedTerms/RecentSearchedTerms';
import { MyDataProps } from './MyData.interface';

const MyData: React.FC<MyDataProps> = ({
  error,
  countServices,
  ingestionCount,
  ownedData,
  followedData,
  entityCounts,
  feedData,
  feedFilter,
  feedFilterHandler,
  isFeedLoading,
  postFeedHandler,
  deletePostHandler,
}: MyDataProps): React.ReactElement => {
  const [fieldListVisible, setFieldListVisible] = useState<boolean>(false);
  const isMounted = useRef(false);

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
        <div className="tw-relative tw-mt-5">
          <Button
            className="hover:tw-no-underline focus:tw-no-underline"
            data-testid="feeds"
            size="custom"
            tag="button"
            theme="primary"
            variant="link"
            onClick={() => setFieldListVisible((visible) => !visible)}>
            <span className="tw-font-medium">
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

  const getLinkByFilter = (filter: Ownership) => {
    return `${getExplorePathWithSearch()}?${filter}=${getOwnerIds(
      filter,
      AppState.userDetails
    ).join()}`;
  };

  const getLeftPanel = () => {
    return (
      <div className="tw-mt-12">
        <MyAssetStats
          countServices={countServices}
          entityCounts={entityCounts}
          ingestionCount={ingestionCount}
        />
        <div className="tw-filter-seperator" />
        <RecentlyViewed />
        <div className="tw-filter-seperator tw-mt-3" />
        <RecentSearchedTerms />
        <div className="tw-filter-seperator tw-mt-3" />
      </div>
    );
  };

  const getRightPanel = useCallback(() => {
    return (
      <div className="tw-mt-12">
        <EntityList
          entityList={ownedData}
          headerText={
            <div className="tw-flex tw-justify-between">
              My Data
              {ownedData.length ? (
                <Link
                  data-testid="my-data"
                  to={getLinkByFilter(Ownership.OWNER)}>
                  <span className="link-text tw-font-normal tw-text-xs">
                    View All
                  </span>
                </Link>
              ) : null}
            </div>
          }
          noDataPlaceholder={<>You have not owned anything yet.</>}
          testIDText="My data"
        />
        <div className="tw-filter-seperator tw-mt-3" />
        <EntityList
          entityList={followedData}
          headerText={
            <div className="tw-flex tw-justify-between">
              Following
              {followedData.length ? (
                <Link
                  data-testid="following-data"
                  to={getLinkByFilter(Ownership.FOLLOWERS)}>
                  <span className="link-text tw-font-normal tw-text-xs">
                    View All
                  </span>
                </Link>
              ) : null}
            </div>
          }
          noDataPlaceholder={<>You have not followed anything yet.</>}
          testIDText="Following data"
        />
        <div className="tw-filter-seperator tw-mt-3" />
      </div>
    );
  }, [ownedData, followedData]);

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
                isLoading={isFeedLoading}
                postFeedHandler={postFeedHandler}
              />
            </Fragment>
          ) : (
            <Onboarding />
          )}
        </Fragment>
      )}
    </PageLayout>
  );
};

export default observer(MyData);
