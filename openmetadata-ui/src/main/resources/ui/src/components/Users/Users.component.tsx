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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AxiosError, AxiosResponse } from 'axios';
import { isNil } from 'lodash';
import { observer } from 'mobx-react';
import React, { Fragment, RefObject, useEffect, useState } from 'react';
import Select, { MultiValue } from 'react-select';
import AppState from '../../AppState';
import { getTeams } from '../../axiosAPIs/teamsAPI';
import { filterList, observerOptions } from '../../constants/Mydata.constants';
import { AssetsType } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { Role } from '../../generated/entity/teams/role';
import { Team } from '../../generated/entity/teams/team';
import { EntityReference } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import jsonData from '../../jsons/en';
import UserCard from '../../pages/teams/UserCard';
import { getEntityName, getNonDeletedTeams } from '../../utils/CommonUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import { Button } from '../buttons/Button/Button';
import Avatar from '../common/avatar/Avatar';
import Description from '../common/description/Description';
import { reactSingleSelectCustomStyle } from '../common/react-select-component/reactSelectCustomStyle';
import TabsPane from '../common/TabsPane/TabsPane';
import PageLayout from '../containers/PageLayout';
import DropDownList from '../dropdown/DropDownList';
import Loader from '../Loader/Loader';
import { Option, Props } from './Users.interface';

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
  updateUserDetails,
  isAdminUser,
}: Props) => {
  const [activeTab, setActiveTab] = useState(1);
  const [fieldListVisible, setFieldListVisible] = useState<boolean>(false);
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
  const [displayName, setDisplayName] = useState(userData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);
  const [isRolesEdit, setIsRolesEdit] = useState(false);
  const [isTeamsEdit, setIsTeamsEdit] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Array<Option>>([]);
  const [selectedTeams, setSelectedTeams] = useState<Array<Option>>([]);
  const [teams, setTeams] = useState<Array<Team>>([]);
  const [roles, setRoles] = useState<Array<Role>>([]);

  const fetchTeams = () => {
    getTeams(['users'])
      .then((res: AxiosResponse) => {
        if (res.data) {
          setTeams(res.data.data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-teams-error']
        );
      });
  };

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const activeTabHandler = (tab: number) => {
    setActiveTab(tab);
  };

  const handleDropDown = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    feedFilterHandler((value as FeedFilter) || FeedFilter.MENTIONS);
    setFieldListVisible(false);
  };

  const handleDisplayNameChange = () => {
    if (displayName !== userData.displayName) {
      updateUserDetails({ displayName: displayName || '' });
    }
    setIsDisplayNameEdit(false);
  };

  const handleDescriptionChange = (description: string) => {
    if (description !== userData.description) {
      updateUserDetails({ description });
    }
    setIsDescriptionEdit(false);
  };

  const handleRolesChange = () => {
    updateUserDetails({ roles: selectedRoles.map((role) => role.value) });

    setIsRolesEdit(false);
  };
  const handleTeamsChange = () => {
    updateUserDetails({ teams: selectedTeams.map((team) => team.value) });

    setIsTeamsEdit(false);
  };

  const handleOnRolesChange = (
    value: MultiValue<unknown>,
    { action }: { action: string }
  ) => {
    if (isNil(value) || action === 'clear') {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(value as Option[]);
    }
  };
  const handleOnTeamsChange = (
    value: MultiValue<unknown>,
    { action }: { action: string }
  ) => {
    if (isNil(value) || action === 'clear') {
      setSelectedTeams([]);
    } else {
      setSelectedTeams(value as Option[]);
    }
  };

  const getAssets = (data: EntityReference[]) => {
    const includedEntity = Object.values(AssetsType);

    return data.filter((d) => includedEntity.includes(d.type as AssetsType));
  };

  const getDisplayNameComponent = () => {
    if (isAdminUser) {
      return (
        <div className="tw-mt-4 tw-w-full tw-text-center">
          {isDisplayNameEdit ? (
            <div className="tw-flex tw-items-center tw-gap-1">
              <input
                className="tw-form-inputs tw-px-3 tw-py-0.5 tw-w-64"
                data-testid="displayName"
                id="displayName"
                name="displayName"
                placeholder="displayName"
                type="text"
                value={displayName}
                onChange={onDisplayNameChange}
              />
              <div className="tw-flex tw-justify-end" data-testid="buttons">
                <Button
                  className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
                  data-testid="cancel-displayName"
                  size="custom"
                  theme="primary"
                  variant="contained"
                  onMouseDown={() => setIsDisplayNameEdit(false)}>
                  <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="times" />
                </Button>
                <Button
                  className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
                  data-testid="save-displayName"
                  size="custom"
                  theme="primary"
                  variant="contained"
                  onClick={handleDisplayNameChange}>
                  <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="check" />
                </Button>
              </div>
            </div>
          ) : (
            <Fragment>
              <span className="tw-text-base tw-font-medium tw-mr-2">
                {userData.displayName || 'Add display name'}
              </span>
              <button
                className="tw-ml-2 focus:tw-outline-none"
                data-testid="edit-displayName"
                onClick={() => setIsDisplayNameEdit(true)}>
                <SVGIcons
                  alt="edit"
                  icon="icon-edit"
                  title="Edit"
                  width="12px"
                />
              </button>
            </Fragment>
          )}
        </div>
      );
    } else {
      return (
        <p className="tw-mt-2">
          {getEntityName(userData as unknown as EntityReference)}
        </p>
      );
    }
  };

  const getDescriptionComponent = () => {
    if (isAdminUser) {
      return (
        <Description
          description={userData.description || ''}
          entityName={getEntityName(userData as unknown as EntityReference)}
          hasEditAccess={isAdminUser}
          isEdit={isDescriptionEdit}
          onCancel={() => setIsDescriptionEdit(false)}
          onDescriptionEdit={() => setIsDescriptionEdit(true)}
          onDescriptionUpdate={handleDescriptionChange}
        />
      );
    } else {
      return (
        <p className="tw-mt-2">
          {userData.description || (
            <span className="tw-no-description tw-p-2">No description </span>
          )}
        </p>
      );
    }
  };

  const getTeamsComponent = () => {
    const teamsElement = (
      <Fragment>
        {getNonDeletedTeams(userData.teams ?? []).map((team, i) => (
          <div
            className="tw-mb-2 tw-flex tw-items-center tw-gap-2"
            data-testid={team.name}
            key={i}>
            <SVGIcons alt="icon" className="tw-w-4" icon={Icons.TEAMS_GREY} />
            <span>{getEntityName(team)}</span>
          </div>
        ))}
      </Fragment>
    );

    if (!isAdminUser) {
      return (
        <Fragment>
          <div className="tw-flex">
            <h6 className="tw-heading tw-mb-3">Teams</h6>
          </div>
          <div className="tw-pb-4 tw-mb-4 tw-border-b">{teamsElement}</div>;
        </Fragment>
      );
    } else {
      return (
        <Fragment>
          <div className="tw-flex">
            <h6 className="tw-heading tw-mb-3">Teams</h6>
            {!isTeamsEdit && (
              <button
                className="tw-ml-2 focus:tw-outline-none tw-self-baseline"
                data-testid="edit-teams"
                onClick={() => setIsTeamsEdit(true)}>
                <SVGIcons
                  alt="edit"
                  icon="icon-edit"
                  title="Edit"
                  width="12px"
                />
              </button>
            )}
          </div>
          <div className="tw-pb-4 tw-mb-4 tw-border-b">
            {isTeamsEdit ? (
              <Fragment>
                <Select
                  isClearable
                  isMulti
                  aria-label="Select teams"
                  className="tw-ml-1"
                  isSearchable={false}
                  options={teams?.map((team) => ({
                    label: getEntityName(team as unknown as EntityReference),
                    value: team.id,
                  }))}
                  placeholder="Teams..."
                  styles={reactSingleSelectCustomStyle}
                  value={selectedTeams}
                  onChange={handleOnTeamsChange}
                />
                <div
                  className="tw-flex tw-justify-end tw-mt-2"
                  data-testid="buttons">
                  <Button
                    className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
                    data-testid="cancel-teams"
                    size="custom"
                    theme="primary"
                    variant="contained"
                    onMouseDown={() => setIsTeamsEdit(false)}>
                    <FontAwesomeIcon
                      className="tw-w-3.5 tw-h-3.5"
                      icon="times"
                    />
                  </Button>
                  <Button
                    className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
                    data-testid="save-teams"
                    size="custom"
                    theme="primary"
                    variant="contained"
                    onClick={handleTeamsChange}>
                    <FontAwesomeIcon
                      className="tw-w-3.5 tw-h-3.5"
                      icon="check"
                    />
                  </Button>
                </div>
              </Fragment>
            ) : (
              teamsElement
            )}
          </div>
        </Fragment>
      );
    }
  };

  const getRolesComponent = () => {
    const rolesElement = (
      <Fragment>
        {userData.roles?.map((role, i) => (
          <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2" key={i}>
            <SVGIcons alt="icon" className="tw-w-4" icon={Icons.USERS} />
            <span>{getEntityName(role)}</span>
          </div>
        ))}
      </Fragment>
    );

    if (!isAdminUser) {
      return (
        <Fragment>
          <div className="tw-flex">
            <h6 className="tw-heading tw-mb-3">Roles</h6>
          </div>
          <div className="tw-pb-4 tw-mb-4 tw-border-b">{rolesElement}</div>;
        </Fragment>
      );
    } else {
      return (
        <Fragment>
          <div className="tw-flex">
            <h6 className="tw-heading tw-mb-3">Roles</h6>
            {!isRolesEdit && (
              <button
                className="tw-ml-2 focus:tw-outline-none tw-self-baseline"
                data-testid="edit-roles"
                onClick={() => setIsRolesEdit(true)}>
                <SVGIcons
                  alt="edit"
                  icon="icon-edit"
                  title="Edit"
                  width="12px"
                />
              </button>
            )}
          </div>
          <div className="tw-pb-4 tw-mb-4 tw-border-b">
            {isRolesEdit ? (
              <Fragment>
                <Select
                  isClearable
                  isMulti
                  aria-label="Select roles"
                  className="tw-ml-1"
                  isSearchable={false}
                  options={roles?.map((role) => ({
                    label: getEntityName(role as unknown as EntityReference),
                    value: role.id,
                  }))}
                  placeholder="Roles..."
                  styles={reactSingleSelectCustomStyle}
                  value={selectedRoles}
                  onChange={handleOnRolesChange}
                />
                <div
                  className="tw-flex tw-justify-end tw-mt-2"
                  data-testid="buttons">
                  <Button
                    className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
                    data-testid="cancel-roles"
                    size="custom"
                    theme="primary"
                    variant="contained"
                    onMouseDown={() => setIsRolesEdit(false)}>
                    <FontAwesomeIcon
                      className="tw-w-3.5 tw-h-3.5"
                      icon="times"
                    />
                  </Button>
                  <Button
                    className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
                    data-testid="save-roles"
                    size="custom"
                    theme="primary"
                    variant="contained"
                    onClick={handleRolesChange}>
                    <FontAwesomeIcon
                      className="tw-w-3.5 tw-h-3.5"
                      icon="check"
                    />
                  </Button>
                </div>
              </Fragment>
            ) : (
              rolesElement
            )}
          </div>
        </Fragment>
      );
    }
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
          {getDisplayNameComponent()}
          <p className="tw-mt-2">{userData.email}</p>
          {getDescriptionComponent()}
        </div>
        {getTeamsComponent()}
        {getRolesComponent()}
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
    const modifiedFilterList = filterList.filter(
      (filter) => filter.value !== FeedFilter.ALL
    );

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
              {modifiedFilterList.find((f) => f.value === feedFilter)?.name}
            </span>
            <DropDownIcon />
          </Button>
          {fieldListVisible && (
            <DropDownList
              dropDownList={modifiedFilterList}
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

  useEffect(() => {
    setRoles(AppState.userRoles);
  }, [AppState.userRoles]);

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    setSelectedRoles(
      userData.roles?.map((role) => ({
        label: getEntityName(role as EntityReference),
        value: role.id,
      })) || []
    );
    setSelectedTeams(
      getNonDeletedTeams(userData.teams || []).map((team) => ({
        label: getEntityName(team as EntityReference),
        value: team.id,
      }))
    );
  }, [userData]);

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

export default observer(Users);
