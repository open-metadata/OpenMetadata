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

import React, { useState } from 'react';
import { AssetsType } from '../../enums/entity.enum';
import { EntityReference, User } from '../../generated/entity/teams/user';
import UserCard from '../../pages/teams/UserCard';
import { getNonDeletedTeams } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import Avatar from '../common/avatar/Avatar';
import TabsPane from '../common/TabsPane/TabsPane';
import PageLayout from '../containers/PageLayout';

type Props = {
  userData: User;
};

const Users = ({ userData }: Props) => {
  const [activeTab, setActiveTab] = useState(1);

  const activeTabHandler = (tab: number) => {
    setActiveTab(tab);
  };

  const tabs = [
    {
      name: 'Owned Data',
      icon: {
        alt: 'owned-data',
        name: 'owned-data',
        title: 'Owned Data',
        selectedName: 'owned-data',
      },
      isProtected: false,
      position: 1,
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
      position: 2,
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
              description: dataset.name || '',
              name: dataset.type,
            };

            return (
              <UserCard isDataset isIconVisible item={Dataset} key={index} />
            );
          })}
        </div>
      </>
    );
  };

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
        {activeTab === 1 &&
          getEntityData(
            getAssets(userData?.owns || []),
            `${
              userData?.displayName || userData?.name || 'User'
            } does not own anything yet`
          )}
        {activeTab === 2 &&
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
