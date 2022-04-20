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

import { EntityThread } from 'Models';
import React, { Fragment, RefObject, useEffect, useState } from 'react';
import { filterList, observerOptions } from '../../constants/Mydata.constants';
import { AssetsType } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { EntityReference, User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import UserCard from '../../pages/teams/UserCard';
import { getNonDeletedTeams } from '../../utils/CommonUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import { Button } from '../buttons/Button/Button';
import Avatar from '../common/avatar/Avatar';
import TabsPane from '../common/TabsPane/TabsPane';
import PageLayout from '../containers/PageLayout';
import DropDownList from '../dropdown/DropDownList';
import Loader from '../Loader/Loader';
import Onboarding from '../onboarding/Onboarding';

interface Props {
  userData: User;
  feedData: EntityThread[];
  feedFilter: FeedFilter;
  paging: Paging;
  isFeedLoading: boolean;
  feedFilterHandler: (v: FeedFilter) => void;
  fetchFeedHandler: (filterType: FeedFilter, after?: string) => void;
  postFeedHandler: (value: string, id: string) => void;
  deletePostHandler?: (threadId: string, postId: string) => void;
}

const Users = ({
  userData,
  feedData,
  feedFilter,
  feedFilterHandler,
  isFeedLoading,
  postFeedHandler,
  deletePostHandler,
  fetchFeedHandler,
  paging,
}: Props) => {
  const [activeTab, setActiveTab] = useState(1);
  const [fieldListVisible, setFieldListVisible] = useState<boolean>(false);
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
  const activeTabHandler = (tab: number) => {
    setActiveTab(tab);
  };

  const handleDropDown = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    feedFilterHandler((value as FeedFilter) || FeedFilter.ALL);
    setFieldListVisible(false);
  };

  const tabs = [
    {
      name: 'Activity Feed',
      icon: {
        alt: 'activity_feed',
        name: 'activity_feed',
        title: 'Activity Feed',
        selectedName: 'activity-feed-color',
      },
      isProtected: false,
      position: 1,
    },
    {
      name: 'Owned Data',
      icon: {
        alt: 'owned-data',
        name: 'owned-data',
        title: 'Owned Data',
        selectedName: 'owned-data',
      },
      isProtected: false,
      position: 2,
    },
    {
      name: 'Following',
      icon: {
        alt: 'following',
        name: 'following',
        title: 'following',
        selectedName: 'following',
      },
      isProtected: false,
      position: 3,
    },
  ];

  const getAssets = (data: EntityReference[]) => {
    const includedEntity = Object.values(AssetsType);

    return data.filter((d) => includedEntity.includes(d.type as AssetsType));
  };

  const fetchLeftPanel = () => {
    return (
      <div className="tw-pt-4" data-testid="left-panel">
        <div className="tw-pb-4 tw-mb-4 tw-border-b tw-flex tw-flex-col tw-items-center">
          {userData.profile?.images?.image ? (
            <div className="tw-h-28 tw-w-28">
              <img
                alt="profile"
                className="tw-rounded-full tw-w-full"
                src={userData.profile?.images?.image}
              />
            </div>
          ) : (
            <Avatar
              name={userData?.displayName || userData.name}
              textClass="tw-text-5xl"
              width="112"
            />
          )}
          <p className="tw-mt-4">
            <span className="tw-text-base tw-font-medium tw-mr-2">
              {userData.displayName || userData.name}
            </span>
          </p>
          <p className="tw-mt-2">{userData.email}</p>
          <p className="tw-mt-2">{userData.description}</p>
        </div>
        <div className="tw-pb-4 tw-mb-4 tw-border-b">
          <h6 className="tw-heading tw-mb-3">Teams</h6>
          {getNonDeletedTeams(userData.teams ?? []).map((team, i) => (
            <div
              className="tw-mb-2 tw-flex tw-items-center tw-gap-2"
              data-testid={team.name}
              key={i}>
              <SVGIcons alt="icon" className="tw-w-4" icon={Icons.TEAMS_GREY} />
              <span>{team?.displayName || team?.name}</span>
            </div>
          ))}
        </div>
        <div className="tw-pb-4 tw-mb-4 tw-border-b">
          <h6 className="tw-heading tw-mb-3">Roles</h6>

          {userData.roles?.map((role, i) => (
            <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2" key={i}>
              <SVGIcons alt="icon" className="tw-w-4" icon={Icons.USERS} />
              <span>{role?.displayName || role?.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getEntityData = (data: EntityReference[], placeholder: string) => {
    if ((data?.length as number) <= 0) {
      return (
        <div
          className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1"
          data-testid="no-assets">
          <p className="tw-text-base">{placeholder}</p>
        </div>
      );
    }

    return (
      <>
        <div
          className="tw-grid xxl:tw-grid-cols-4 md:tw-grid-cols-3 tw-gap-4"
          data-testid="dataset-card">
          {' '}
          {data?.map((dataset, index) => {
            const Dataset = {
              displayName: dataset.displayName || dataset.name || '',
              type: dataset.type,
              fqn: dataset.fullyQualifiedName || '',
              id: dataset.id,
              name: dataset.name,
            };

            return (
              <UserCard isDataset isIconVisible item={Dataset} key={index} />
            );
          })}
        </div>
      </>
    );
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

  const getLoader = () => {
    return isFeedLoading ? <Loader /> : null;
  };

  const getFeedTabData = () => {
    return (
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
    );
  };

  const fetchMoreFeed = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (isElementInView && pagingObj?.after && !isLoading) {
      fetchFeedHandler(feedFilter, pagingObj.after);
    }
  };

  useEffect(() => {
    fetchMoreFeed(isInView as boolean, paging, isFeedLoading);
  }, [isInView, paging, isFeedLoading]);

  return (
    <PageLayout classes="tw-h-full tw-px-6" leftPanel={fetchLeftPanel()}>
      <div className="tw-mb-3">
        <TabsPane
          activeTab={activeTab}
          className="tw-flex-initial"
          setActiveTab={activeTabHandler}
          tabs={tabs}
        />
      </div>
      <div>
        {activeTab === 1 && getFeedTabData()}
        {activeTab === 2 &&
          getEntityData(
            getAssets(userData?.owns || []),
            `${
              userData?.displayName || userData?.name || 'User'
            } does not own anything yet`
          )}
        {activeTab === 3 &&
          getEntityData(
            getAssets(userData?.follows || []),
            `${
              userData?.displayName || userData?.name || 'User'
            } does not follow anything yet`
          )}
      </div>
    </PageLayout>
  );
};

export default Users;
