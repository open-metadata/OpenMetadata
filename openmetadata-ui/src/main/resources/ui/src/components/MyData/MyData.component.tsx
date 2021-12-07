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

import React, {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { getExplorePathWithSearch } from '../../constants/constants';
import { Ownership } from '../../enums/mydata.enum';
import { getCurrentUserId } from '../../utils/CommonUtils';
import { getSummary } from '../../utils/EntityVersionUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolderES from '../common/error-with-placeholder/ErrorPlaceHolderES';
import FeedCards from '../common/FeedCard/FeedCards.component';
import PageLayout from '../containers/PageLayout';
import DropDownList from '../dropdown/DropDownList';
import EntityList from '../EntityList/EntityList';
import MyAssetStats from '../MyAssetStats/MyAssetStats.component';
import RecentlyViewed from '../recently-viewed/RecentlyViewed';
import RecentSearchedTerms from '../RecentSearchedTerms/RecentSearchedTerms';
import { MyDataProps } from './MyData.interface';

const filterList = [
  { name: 'All Activity Feeds', value: 'all' },
  { name: 'My Data Feeds', value: 'mydata' },
  { name: 'Following Data Feeds', value: 'following' },
];

const MyData: React.FC<MyDataProps> = ({
  error,
  countServices,
  ingestionCount,
  ownedData,
  followedData,
  entityCounts,
  feedData,
}: MyDataProps): React.ReactElement => {
  const [filter, setFilter] = useState<string>('all');
  const [fieldListVisible, setFieldListVisible] = useState<boolean>(false);
  const isMounted = useRef(false);

  const handleDropDown = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    setFilter(value || 'all');
    setFieldListVisible(false);
  };
  const getFilterDropDown = () => {
    return (
      <Fragment>
        <div className="tw-relative tw-mt-5">
          <Button
            data-testid="feeds"
            size="custom"
            theme="default"
            variant="text"
            onClick={() => setFieldListVisible((visible) => !visible)}>
            <span className="tw-text-grey-body">
              {filterList.find((f) => f.value === filter)?.name}
            </span>
            <DropDownIcon />
          </Button>
          {fieldListVisible && (
            <DropDownList
              dropDownList={filterList}
              value={filter}
              onSelect={handleDropDown}
            />
          )}
        </div>
      </Fragment>
    );
  };

  const getLinkByFilter = (filter: Ownership) => {
    return `${getExplorePathWithSearch()}?${filter}=${getCurrentUserId()}`;
  };

  const getLeftPanel = () => {
    return (
      <div className="tw-mt-5">
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
      <div className="tw-mt-5">
        <EntityList
          entityList={ownedData}
          headerText={
            <div className="tw-flex tw-justify-between">
              My Data
              {ownedData.length ? (
                <Link to={getLinkByFilter(Ownership.OWNER)}>
                  <span className="link-text tw-font-light tw-text-xs">
                    View All
                  </span>
                </Link>
              ) : null}
            </div>
          }
          noDataPlaceholder={<>You have not owned anything yet!</>}
        />
        <div className="tw-filter-seperator tw-mt-3" />
        <EntityList
          entityList={followedData}
          headerText={
            <div className="tw-flex tw-justify-between">
              Following
              {followedData.length ? (
                <Link to={getLinkByFilter(Ownership.FOLLOWERS)}>
                  <span className="link-text tw-font-light tw-text-xs">
                    View All
                  </span>
                </Link>
              ) : null}
            </div>
          }
          noDataPlaceholder={<>You have not followed anything yet!</>}
        />
        <div className="tw-filter-seperator tw-mt-3" />
      </div>
    );
  }, [ownedData, followedData]);

  const getFeedsData = useCallback(() => {
    const data = feedData
      .map((f) => ({
        name: f.name,
        fqn: f.fullyQualifiedName,
        entityType: f.entityType,
        changeDescriptions: f.changeDescriptions,
      }))
      .map((d) => {
        return (
          d.changeDescriptions
            .filter((c) => c.fieldsAdded || c.fieldsDeleted || c.fieldsUpdated)
            .map((change) => ({
              updatedAt: change.updatedAt,
              updatedBy: change.updatedBy,
              entityName: d.name,
              description: <div>{getSummary(change, true)}</div>,
              entityType: d.entityType,
              fqn: d.fqn,
            })) || []
        );
      })
      .flat(1);

    return data;
  }, [feedData]);

  useEffect(() => {
    isMounted.current = true;
  }, []);

  return (
    <PageLayout leftPanel={getLeftPanel()} rightPanel={getRightPanel()}>
      {getFilterDropDown()}

      {error ? (
        <ErrorPlaceHolderES errorMessage={error} type="error" />
      ) : (
        <FeedCards feeds={getFeedsData()} />
      )}
    </PageLayout>
  );
};

export default MyData;
