import classNames from 'classnames';
import React, { useState } from 'react';
import { EntityReference, User } from '../../generated/entity/teams/user';
import UserCard from '../../pages/teams/UserCard';
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

  const fetchLeftPanel = () => {
    return (
      <div className="tw-pt-4">
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
            <span
              className={classNames(
                'tw-text-xs tw-border tw-px-1 tw-py-0.5 tw-rounded',
                userData.deleted ? 'tw-border-grey-muted' : 'tw-border-success'
              )}>
              {userData.deleted ? (
                <span className="tw-text-grey-muted">Inactive</span>
              ) : (
                <span className="tw-text-success">Active</span>
              )}
            </span>
          </p>
          <p className="tw-mt-2">{userData.email}</p>
        </div>
        <div className="tw-pb-4 tw-mb-4 tw-border-b">
          <h6 className="tw-heading tw-mb-3">Teams</h6>

          {userData.teams?.map((team, i) => (
            <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2" key={i}>
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
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
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
            userData?.owns || [],
            `${
              userData?.displayName || userData?.name || 'User'
            } does not own anything yet`
          )}
        {activeTab === 2 &&
          getEntityData(
            userData?.follows || [],
            `${
              userData?.displayName || userData?.name || 'User'
            } does not follow anything yet`
          )}
      </div>
    </PageLayout>
  );
};

export default Users;
