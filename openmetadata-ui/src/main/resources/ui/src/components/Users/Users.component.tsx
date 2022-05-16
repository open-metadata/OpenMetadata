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
import { isNil, toLower } from 'lodash';
import { observer } from 'mobx-react';
import { FormatedTableData } from 'Models';
import React, {
  Fragment,
  RefObject,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import Select from 'react-select';
import AppState from '../../AppState';
import { getTeams } from '../../axiosAPIs/teamsAPI';
import { TERM_ADMIN } from '../../constants/constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { Ownership } from '../../enums/mydata.enum';
import { Role } from '../../generated/entity/teams/role';
import { Team } from '../../generated/entity/teams/team';
import { EntityReference } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import jsonData from '../../jsons/en';
import {
  getEntityName,
  getExploreLinkByFilter,
  getNonDeletedTeams,
} from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import { Button } from '../buttons/Button/Button';
import Avatar from '../common/avatar/Avatar';
import Description from '../common/description/Description';
import { reactSingleSelectCustomStyle } from '../common/react-select-component/reactSelectCustomStyle';
import TabsPane from '../common/TabsPane/TabsPane';
import PageLayout from '../containers/PageLayout';
import EntityList from '../EntityList/EntityList';
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
];

const Users = ({
  userData,
  feedData,
  isFeedLoading,
  postFeedHandler,
  deletePostHandler,
  fetchFeedHandler,
  paging,
  updateUserDetails,
  isAdminUser,
  isLoggedinUser,
  isAuthDisabled,
}: Props) => {
  const [activeTab, setActiveTab] = useState(1);
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
    // filter out the roles , and exclude the admin one
    const updatedRoles = selectedRoles.filter(
      (role) => role.value !== toLower(TERM_ADMIN)
    );

    // get the admin role and send it as boolean value `isAdmin=Boolean(isAdmin)
    const isAdmin = selectedRoles.find(
      (role) => role.value === toLower(TERM_ADMIN)
    );
    updateUserDetails({
      roles: updatedRoles.map((item) => {
        const roleId = item.value;
        const role = roles.find((r) => r.id === roleId);

        return { id: roleId, type: 'role', name: role?.name || '' };
      }),
      isAdmin: Boolean(isAdmin),
    });

    setIsRolesEdit(false);
  };
  const handleTeamsChange = () => {
    updateUserDetails({
      teams: selectedTeams.map((item) => {
        const teamId = item.value;
        const team = teams.find((t) => t.id === teamId);

        return { id: teamId, type: 'team', name: team?.name || '' };
      }),
    });

    setIsTeamsEdit(false);
  };

  const handleOnRolesChange = (
    value: unknown,
    { action }: { action: string }
  ) => {
    if (isNil(value) || action === 'clear') {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(value as Option[]);
    }
  };
  const handleOnTeamsChange = (
    value: unknown,
    { action }: { action: string }
  ) => {
    if (isNil(value) || action === 'clear') {
      setSelectedTeams([]);
    } else {
      setSelectedTeams(value as Option[]);
    }
  };

  const getDisplayNameComponent = () => {
    if (isAdminUser || isLoggedinUser || isAuthDisabled) {
      return (
        <div className="tw-mt-4 tw-w-full">
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
    if (isAdminUser || isLoggedinUser || isAuthDisabled) {
      return (
        <div className="tw--ml-5">
          <Description
            description={userData.description || ''}
            entityName={getEntityName(userData as unknown as EntityReference)}
            hasEditAccess={isAdminUser}
            isEdit={isDescriptionEdit}
            onCancel={() => setIsDescriptionEdit(false)}
            onDescriptionEdit={() => setIsDescriptionEdit(true)}
            onDescriptionUpdate={handleDescriptionChange}
          />
        </div>
      );
    } else {
      return (
        <div className="tw--ml-2">
          <p className="tw-mt-2">
            {userData.description || (
              <span className="tw-no-description tw-p-2">No description </span>
            )}
          </p>
        </div>
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

    if (!isAdminUser && !isAuthDisabled) {
      return (
        <Fragment>
          <div className="tw-flex">
            <h6 className="tw-heading tw-mb-3">Teams</h6>
          </div>
          <div className="tw-pb-4 tw-mb-4 tw-border-b">{teamsElement}</div>
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
    const userRolesOption = roles?.map((role) => ({
      label: getEntityName(role as unknown as EntityReference),
      value: role.id,
    }));
    if (!userData.isAdmin) {
      userRolesOption.push({
        label: TERM_ADMIN,
        value: toLower(TERM_ADMIN),
      });
    }

    const rolesElement = (
      <Fragment>
        {userData.isAdmin && (
          <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2">
            <SVGIcons alt="icon" className="tw-w-4" icon={Icons.USERS} />
            <span>{TERM_ADMIN}</span>
          </div>
        )}
        {userData.roles?.map((role, i) => (
          <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2" key={i}>
            <SVGIcons alt="icon" className="tw-w-4" icon={Icons.USERS} />
            <span>{getEntityName(role)}</span>
          </div>
        ))}
      </Fragment>
    );

    if (!isAdminUser && !isAuthDisabled) {
      return (
        <Fragment>
          <div className="tw-flex">
            <h6 className="tw-heading tw-mb-3">Roles</h6>
          </div>
          <div className="tw-pb-4 tw-mb-4 tw-border-b">{rolesElement}</div>
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
                  id="select-role"
                  isSearchable={false}
                  options={userRolesOption}
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

  const getInheritedRolesComponent = () => {
    if (userData.inheritedRoles?.length) {
      return (
        <Fragment>
          <div className="tw-flex">
            <h6 className="tw-heading tw-mb-3" data-testid="inherited-roles">
              Inherited Roles
            </h6>
          </div>
          <div className="tw-pb-4 tw-mb-4 tw-border-b">
            {userData.inheritedRoles?.map((inheritedRole, i) => (
              <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2" key={i}>
                <SVGIcons alt="icon" className="tw-w-4" icon={Icons.USERS} />
                <span>{getEntityName(inheritedRole)}</span>
              </div>
            ))}
          </div>
        </Fragment>
      );
    } else {
      return null;
    }
  };

  const fetchLeftPanel = () => {
    return (
      <div className="tw-pt-4" data-testid="left-panel">
        <div className="tw-pb-4 tw-mb-4 tw-border-b tw-flex tw-flex-col">
          {userData.profile?.images?.image ? (
            <div className="tw-h-28 tw-w-28">
              <img
                alt="profile"
                className="tw-w-full"
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
        {getInheritedRolesComponent()}
      </div>
    );
  };

  const getLoader = () => {
    return isFeedLoading ? <Loader /> : null;
  };

  const getFeedTabData = () => {
    return (
      <Fragment>
        <div className="tw-mt-3.5">
          <ActivityFeedList
            withSidePanel
            className=""
            deletePostHandler={deletePostHandler}
            feedList={feedData}
            postFeedHandler={postFeedHandler}
          />
        </div>
        <div
          data-testid="observer-element"
          id="observer-element"
          ref={elementRef as RefObject<HTMLDivElement>}>
          {getLoader()}
        </div>
      </Fragment>
    );
  };

  const prepareSelectedRoles = () => {
    const defaultRoles = [
      ...(userData.roles?.map((role) => ({
        label: getEntityName(role),
        value: role.id,
      })) || []),
    ];
    if (userData.isAdmin) {
      defaultRoles.push({
        label: TERM_ADMIN,
        value: toLower(TERM_ADMIN),
      });
    }
    setSelectedRoles(defaultRoles);
  };

  const prepareSelectedTeams = () => {
    setSelectedTeams(
      getNonDeletedTeams(userData.teams || []).map((team) => ({
        label: getEntityName(team),
        value: team.id,
      }))
    );
  };

  const fetchMoreFeed = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (isElementInView && pagingObj?.after && !isLoading) {
      fetchFeedHandler(pagingObj.after);
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
    prepareSelectedRoles();
    prepareSelectedTeams();
  }, [userData]);

  const getRightPanel = useCallback(() => {
    return (
      <div className="tw-mt-4" data-testid="right-pannel">
        <EntityList
          entityList={userData?.owns as unknown as FormatedTableData[]}
          headerText={
            <div className="tw-flex tw-justify-between tw-items-center">
              My Data
              {userData?.owns?.length ? (
                <Link
                  className="tw-ml-1"
                  data-testid="my-data"
                  to={getExploreLinkByFilter(
                    Ownership.OWNER,
                    AppState.userDetails,
                    AppState.nonSecureUserDetails
                  )}>
                  <span className="link-text tw-font-normal tw-text-xs">
                    View All <span>({userData?.owns?.length})</span>
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
          entityList={userData?.follows as unknown as FormatedTableData[]}
          headerText={
            <div className="tw-flex tw-justify-between">
              Following
              {userData?.follows?.length ? (
                <Link
                  className="tw-ml-1"
                  data-testid="following-data"
                  to={getExploreLinkByFilter(
                    Ownership.FOLLOWERS,
                    AppState.userDetails,
                    AppState.nonSecureUserDetails
                  )}>
                  <span className="link-text tw-font-normal tw-text-xs">
                    View All <span>({userData?.follows?.length})</span>
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
  }, [userData?.owns, userData?.follows]);

  return (
    <PageLayout
      classes="tw-h-full tw-px-6"
      leftPanel={fetchLeftPanel()}
      rightPanel={getRightPanel()}>
      {userData?.isBot && isAdminUser && (
        <div className="tw-mb-10">
          <TabsPane
            activeTab={activeTab}
            className="tw-flex-initial"
            setActiveTab={activeTabHandler}
            tabs={tabs}
          />
        </div>
      )}
      <div>{activeTab === 1 && getFeedTabData()}</div>
    </PageLayout>
  );
};

export default observer(Users);
