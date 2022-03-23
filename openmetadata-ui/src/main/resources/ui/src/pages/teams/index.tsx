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
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isUndefined, orderBy, toLower } from 'lodash';
import { observer } from 'mobx-react';
import { ExtraInfo, FormErrorData } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import {
  createTeam,
  deleteTeam,
  getTeamByName,
  getTeams,
  patchTeamDetail,
} from '../../axiosAPIs/teamsAPI';
import { Button } from '../../components/buttons/Button/Button';
import Description from '../../components/common/description/Description';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import ManageTabComponent from '../../components/ManageTab/ManageTab.component';
import ConfirmationModal from '../../components/Modals/ConfirmationModal/ConfirmationModal';
import FormModal from '../../components/Modals/FormModal';
import {
  ERROR404,
  getTeamDetailsPath,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { Team } from '../../generated/entity/teams/team';
import {
  EntityReference,
  EntityReference as UserTeams,
  User,
} from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import jsonData from '../../jsons/en';
import {
  getActiveCatClass,
  getCountBadge,
  hasEditAccess,
  isUrlFriendlyName,
} from '../../utils/CommonUtils';
import { getInfoElements } from '../../utils/EntityUtils';
import AddUsersModal from './AddUsersModal';
import Form from './Form';
import UserCard from './UserCard';

const TeamsPage = () => {
  const { team } = useParams() as Record<string, string>;
  const history = useHistory();
  const { isAdminUser, userPermissions } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [teams, setTeams] = useState<Array<Team>>([]);
  const [currentTeam, setCurrentTeam] = useState<Team>();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);
  const [isAddingUsers, setIsAddingUsers] = useState<boolean>(false);
  const [userList, setUserList] = useState<Array<User>>([]);
  const [errorData, setErrorData] = useState<FormErrorData>();
  const [deletingUser, setDeletingUser] = useState<{
    user: EntityReference | undefined;
    state: boolean;
  }>({ user: undefined, state: false });
  const [deletingTeam, setDeletingTeam] = useState<{
    team: Team | undefined;
    state: boolean;
  }>({ team: undefined, state: false });

  const showToast = useToastContext();

  const handleShowErrorToast = (errMessage: string) => {
    showToast({
      variant: 'error',
      body: errMessage,
    });
  };

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value:
        currentTeam?.owner?.type === 'team'
          ? getTeamDetailsPath(
              currentTeam?.owner?.displayName || currentTeam?.owner?.name || ''
            )
          : currentTeam?.owner?.displayName || currentTeam?.owner?.name || '',
      placeholderText:
        currentTeam?.owner?.displayName || currentTeam?.owner?.name || '',
      isLink: currentTeam?.owner?.type === 'team',
      openInNewTab: false,
    },
  ];

  const isOwner = () => {
    return hasEditAccess(
      currentTeam?.owner?.type || '',
      currentTeam?.owner?.id || ''
    );
  };

  const fetchTeams = () => {
    setIsLoading(true);
    getTeams(['users', 'owns', 'defaultRoles', 'owner'])
      .then((res: AxiosResponse) => {
        if (!team) {
          setCurrentTeam(res.data.data[0]);
        }
        setTeams(res.data.data);
        AppState.updateUserTeam(res.data.data);
      })
      .catch((err: AxiosError) => {
        if (err?.response?.data.code) {
          setError(ERROR404);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const goToTeams = () => {
    if (team) {
      history.push(getTeamDetailsPath());
    } else {
      fetchTeams();
      setCurrentTab(1);
    }
  };

  const fetchCurrentTeam = (name: string, update = false) => {
    if (currentTeam?.name !== name || update) {
      setIsLoading(true);
      getTeamByName(name, ['users', 'owns', 'defaultRoles', 'owner'])
        .then((res: AxiosResponse) => {
          setCurrentTeam(res.data);
          if (teams.length <= 0) {
            fetchTeams();
          }
        })
        .catch((err: AxiosError) => {
          if (err?.response?.data.code) {
            setError(ERROR404);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };

  const onNewDataChange = (data: Team, forceSet = false) => {
    if (errorData || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.name.trim()) {
        errData['name'] = 'Name is required';
      } else if (
        !isUndefined(
          teams.find((item) => toLower(item.name) === toLower(data.name))
        )
      ) {
        errData['name'] = 'Name already exists';
      } else if (data.name.length < 1 || data.name.length > 128) {
        errData['name'] = 'Name size must be between 1 and 128';
      } else if (!isUrlFriendlyName(data.name.trim())) {
        errData['name'] = 'Special characters are not allowed';
      }
      if (!data.displayName?.trim()) {
        errData['displayName'] = 'Display name is required';
      } else if (data.displayName.length < 1 || data.displayName.length > 128) {
        errData['displayName'] = 'Display name size must be between 1 and 128';
      }
      setErrorData(errData);

      return errData;
    }

    return {};
  };

  const createNewTeam = (data: Team) => {
    const errData = onNewDataChange(data, true);
    if (!Object.values(errData).length) {
      const teamData = {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
      };
      createTeam(teamData)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchTeams();
          }
        })
        .catch((error: AxiosError) => {
          showToast({
            variant: 'error',
            body: error.message ?? 'Something went wrong!',
          });
        })
        .finally(() => {
          setIsAddingTeam(false);
        });
    }
  };

  const createUsers = (data: Array<UserTeams>) => {
    const updatedTeam = {
      ...currentTeam,
      users: [...(currentTeam?.users as Array<UserTeams>), ...data],
    };
    const jsonPatch = compare(currentTeam as Team, updatedTeam);
    patchTeamDetail(currentTeam?.id, jsonPatch).then((res: AxiosResponse) => {
      if (res.data) {
        fetchCurrentTeam(res.data.name, true);
      }
    });
    setIsAddingUsers(false);
  };

  const deleteUserHandler = (id: string) => {
    const user = [...(currentTeam?.users as Array<UserTeams>)].find(
      (u) => u.id === id
    );
    setDeletingUser({ user, state: true });
  };

  const deleteUser = (id: string) => {
    const users = [...(currentTeam?.users as Array<UserTeams>)];
    const newUsers = users.filter((user) => {
      return user.id !== id;
    });
    const updatedTeam = {
      ...currentTeam,
      users: newUsers,
    };
    const jsonPatch = compare(currentTeam as Team, updatedTeam);
    patchTeamDetail(currentTeam?.id, jsonPatch)
      .then((res: AxiosResponse) => {
        if (res.data) {
          fetchCurrentTeam(res.data.name, true);
        }
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.response?.data?.message ?? 'Error while removing user',
        });
      })
      .finally(() => {
        setDeletingUser({ user: undefined, state: false });
      });
  };

  const deleteTeamHandler = () => {
    const team = currentTeam;
    setDeletingTeam({ team: team, state: true });
  };

  const deleteTeamById = (id: string) => {
    deleteTeam(id)
      .then((res: AxiosResponse) => {
        if (res.data) {
          goToTeams();
        } else {
          handleShowErrorToast(
            jsonData['api-error-messages']['delete-team-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        handleShowErrorToast(
          err.response?.data?.message ||
            jsonData['api-error-messages']['delete-team-error']
        );
      })
      .finally(() => {
        setDeletingTeam({ team: undefined, state: false });
      });
  };

  const getActiveTabClass = (tab: number) => {
    return tab === currentTab ? 'active' : '';
  };
  const changeCurrentTeam = (name: string) => {
    history.push(getTeamDetailsPath(name));
  };

  const getTabs = () => {
    return (
      <div className="tw-mb-3 tw-flex-initial">
        <nav
          className="tw-flex tw-flex-row tw-gh-tabs-container"
          data-testid="tabs">
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(1)}`}
            data-testid="users"
            onClick={() => {
              setCurrentTab(1);
            }}>
            Users
            {getCountBadge(currentTeam?.users?.length, '', currentTab === 1)}
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(2)}`}
            data-testid="assets"
            onClick={() => {
              setCurrentTab(2);
            }}>
            Assets
            {getCountBadge(currentTeam?.owns?.length, '', currentTab === 2)}
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(3)}`}
            data-testid="roles"
            onClick={() => {
              setCurrentTab(3);
            }}>
            Roles
            {getCountBadge(
              currentTeam?.defaultRoles?.length,
              '',
              currentTab === 3
            )}
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(4)}`}
            data-testid="manage"
            onClick={() => {
              setCurrentTab(4);
            }}>
            Manage
          </button>
        </nav>
      </div>
    );
  };

  const getUserCards = () => {
    if ((currentTeam?.users?.length as number) <= 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>There are no users added yet.</p>
          {isAdminUser ||
          isAuthDisabled ||
          userPermissions[Operation.UpdateTeam] ? (
            <>
              <p>Would like to start adding some?</p>
              <Button
                className="tw-h-8 tw-rounded tw-my-2"
                size="small"
                theme="primary"
                variant="contained"
                onClick={() => setIsAddingUsers(true)}>
                Add new user
              </Button>
            </>
          ) : null}
        </div>
      );
    }

    const sortedUser = orderBy(currentTeam?.users || [], ['name'], 'asc');

    return (
      <>
        <div
          className="tw-grid xxl:tw-grid-cols-4 lg:tw-grid-cols-3 md:tw-grid-cols-2 tw-gap-4"
          data-testid="user-card-container">
          {sortedUser.map((user, index) => {
            const User = {
              description: user.displayName || user.name || '',
              name: user.name || '',
              id: user.id,
            };

            return (
              <UserCard
                isActionVisible
                isIconVisible
                item={User}
                key={index}
                onRemove={deleteUserHandler}
              />
            );
          })}
        </div>
      </>
    );
  };

  const getDatasetCards = () => {
    if ((currentTeam?.owns?.length as number) <= 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>Your team does not have any dataset</p>
          <p>Would like to start adding some?</p>
          <Link to="/explore">
            <Button
              className="tw-h-8 tw-rounded tw-mb-2 tw-text-white"
              size="small"
              theme="primary"
              variant="contained">
              Explore
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <>
        <div
          className="tw-grid xxl:tw-grid-cols-4 md:tw-grid-cols-3 tw-gap-4"
          data-testid="dataset-card">
          {' '}
          {currentTeam?.owns?.map((dataset, index) => {
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

  const getDefaultRoles = () => {
    if ((currentTeam?.defaultRoles?.length as number) === 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>There are no roles assigned yet.</p>
        </div>
      );
    }

    return (
      <div
        className="tw-grid xxl:tw-grid-cols-4 md:tw-grid-cols-3 tw-gap-4"
        data-testid="teams-card">
        {currentTeam?.defaultRoles?.map((role, i) => {
          const roleData = {
            description: role.displayName || role.name || '',
            name: role.name as string,
            id: role.id,
          };

          return <UserCard isIconVisible item={roleData} key={i} />;
        })}
      </div>
    );
  };

  const fetchLeftPanel = () => {
    return (
      <>
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-3 tw-border-b">
          <h6 className="tw-heading tw-text-base">Teams</h6>
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-7 tw-px-2 tw-mb-4', {
                'tw-opacity-40': !isAdminUser && !isAuthDisabled,
              })}
              data-testid="add-teams"
              size="small"
              theme="primary"
              variant="contained"
              onClick={() => {
                setErrorData(undefined);
                setIsAddingTeam(true);
              }}>
              <FontAwesomeIcon icon="plus" />
            </Button>
          </NonAdminAction>
        </div>
        {teams &&
          teams.map((team: Team) => (
            <div
              className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-mb-3 tw-flex tw-justify-between ${getActiveCatClass(
                team.name,
                currentTeam?.name
              )}`}
              key={team.name}
              onClick={() => {
                changeCurrentTeam(team.name);
              }}>
              <p
                className="tag-category label-category tw-self-center tw-truncate tw-w-52"
                title={team.displayName ?? team.name}>
                {team.displayName ?? team.name}
              </p>
            </div>
          ))}
      </>
    );
  };
  const onDescriptionUpdate = (updatedHTML: string) => {
    if (currentTeam?.description !== updatedHTML) {
      const updatedTeam = { ...currentTeam, description: updatedHTML };
      const jsonPatch = compare(currentTeam as Team, updatedTeam);
      patchTeamDetail(currentTeam?.id, jsonPatch).then((res: AxiosResponse) => {
        if (res.data) {
          fetchCurrentTeam(res.data.name, true);
        }
      });

      setIsEditable(false);
    } else {
      setIsEditable(false);
    }
  };
  const onDescriptionEdit = (): void => {
    setIsEditable(true);
  };

  const onCancel = (): void => {
    setIsEditable(false);
  };

  const getUniqueUserList = () => {
    const uniqueList = userList
      .filter((user) => {
        const teamUser = currentTeam?.users?.some(
          (teamUser) => user.id === teamUser.id
        );

        return !teamUser && user;
      })
      .map((user) => {
        return {
          description: user.displayName || '',
          id: user.id,
          href: user.href,
          name: user.name || '',
          type: 'user',
        };
      });

    return uniqueList;
  };

  const handleUpdateOwner = (owner: Team['owner']) => {
    const updatedTeam = {
      ...currentTeam,
      owner,
    };
    const jsonPatch = compare(currentTeam as Team, updatedTeam);

    return new Promise<void>((_, reject) => {
      patchTeamDetail(currentTeam?.id, jsonPatch)
        .then((res: AxiosResponse) => {
          fetchCurrentTeam(res.data.name, true);
        })
        .catch((err: AxiosError) => {
          reject();
          const message = err.response?.data?.message;
          showToast({
            variant: 'error',
            body:
              message ??
              `${jsonData['api-error-messages']['update-owner-error']} for ${
                currentTeam?.displayName ?? currentTeam?.name
              }`,
          });
        });
    });
  };

  useEffect(() => {
    setUserList(AppState.users);
  }, [AppState.users]);

  useEffect(() => {
    if (team) {
      fetchCurrentTeam(team);
    } else {
      fetchTeams();
    }
    setCurrentTab(1);
  }, [team]);

  return (
    <>
      {error ? (
        <ErrorPlaceHolder />
      ) : (
        <PageContainerV1 className="tw-pt-4 tw-mb-4">
          <PageLayout classes="tw-h-full" leftPanel={fetchLeftPanel()}>
            {isLoading ? (
              <Loader />
            ) : (
              <div
                className="tw-pb-3 tw-w-full tw-h-full tw-flex tw-flex-col"
                data-testid="team-container">
                {teams.length > 0 ? (
                  <div className="tw-w-full tw-h-full tw-flex tw-flex-col">
                    <Fragment>
                      <div
                        className="tw-flex tw-justify-between tw-items-center"
                        data-testid="header">
                        <div
                          className="tw-heading tw-text-link tw-text-base tw-truncate tw-w-52"
                          title={currentTeam?.displayName ?? currentTeam?.name}>
                          {currentTeam?.displayName ?? currentTeam?.name}
                        </div>
                        <div>
                          <NonAdminAction
                            html={
                              <Fragment>
                                You do not have permission to update the team.
                              </Fragment>
                            }
                            isOwner={isOwner()}
                            permission={Operation.UpdateTeam}
                            position="bottom">
                            <Button
                              className={classNames(
                                'tw-h-8 tw-rounded tw-mb-3',
                                {
                                  'tw-opacity-40':
                                    !isAdminUser &&
                                    !isAuthDisabled &&
                                    !userPermissions[Operation.UpdateTeam] &&
                                    !isOwner(),
                                }
                              )}
                              data-testid="add-new-user-button"
                              size="small"
                              theme="primary"
                              variant="contained"
                              onClick={() => setIsAddingUsers(true)}>
                              Add new user
                            </Button>
                          </NonAdminAction>
                          <NonAdminAction
                            html={
                              <Fragment>
                                You do not have permission to delete the team.
                              </Fragment>
                            }
                            isOwner={isOwner()}
                            position="bottom">
                            <Button
                              className={classNames(
                                'tw-h-8 tw-rounded tw-mb-3 tw-ml-2',
                                {
                                  'tw-opacity-40':
                                    !isAdminUser &&
                                    !isAuthDisabled &&
                                    !isOwner(),
                                }
                              )}
                              data-testid="delete-team-button"
                              size="small"
                              theme="primary"
                              variant="contained"
                              onClick={() => deleteTeamHandler()}>
                              Delete Team
                            </Button>
                          </NonAdminAction>
                        </div>
                      </div>
                      <div className="tw-flex tw-gap-1 tw-mb-2 tw-flex-wrap">
                        {extraInfo.map((info, index) => (
                          <span className="tw-flex" key={index}>
                            {getInfoElements(info)}
                            {extraInfo.length !== 1 &&
                            index < extraInfo.length - 1 ? (
                              <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                                |
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                      <div
                        className="tw-mb-3 tw--ml-5"
                        data-testid="description-container">
                        <Description
                          blurWithBodyBG
                          description={currentTeam?.description || ''}
                          entityName={
                            currentTeam?.displayName ?? currentTeam?.name
                          }
                          isEdit={isEditable}
                          onCancel={onCancel}
                          onDescriptionEdit={onDescriptionEdit}
                          onDescriptionUpdate={onDescriptionUpdate}
                        />
                      </div>
                    </Fragment>
                    <div className="tw-flex tw-flex-col tw-flex-grow">
                      {getTabs()}

                      <div className="tw-flex-grow">
                        {currentTab === 1 && getUserCards()}

                        {currentTab === 2 && getDatasetCards()}

                        {currentTab === 3 && getDefaultRoles()}

                        {currentTab === 4 && (
                          <ManageTabComponent
                            hideTier
                            allowTeamOwner={false}
                            currentUser={currentTeam?.owner?.id}
                            hasEditAccess={isOwner()}
                            onSave={handleUpdateOwner}
                          />
                        )}
                      </div>
                    </div>

                    {isAddingUsers && (
                      <AddUsersModal
                        header={`Adding new users to ${
                          currentTeam?.displayName ?? currentTeam?.name
                        }`}
                        list={getUniqueUserList()}
                        onCancel={() => setIsAddingUsers(false)}
                        onSave={(data) => createUsers(data)}
                      />
                    )}
                  </div>
                ) : (
                  <ErrorPlaceHolder>
                    <p className="tw-text-lg tw-text-center">No Teams Added.</p>
                    <div className="tw-text-lg tw-text-center">
                      <NonAdminAction
                        position="bottom"
                        title={TITLE_FOR_NON_ADMIN_ACTION}>
                        <Button
                          className={classNames({
                            'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                          })}
                          size="small"
                          theme="primary"
                          variant="outlined"
                          onClick={() => setIsAddingTeam(true)}>
                          Click here
                        </Button>
                      </NonAdminAction>
                      {' to add new Team'}
                    </div>
                  </ErrorPlaceHolder>
                )}

                {isAddingTeam && (
                  <FormModal
                    errorData={errorData}
                    form={Form}
                    header="Adding new team"
                    initialData={{
                      name: '',
                      description: '',
                      displayName: '',
                    }}
                    onCancel={() => setIsAddingTeam(false)}
                    onChange={(data) => onNewDataChange(data as Team)}
                    onSave={(data) => createNewTeam(data as Team)}
                  />
                )}
                {deletingUser.state && (
                  <ConfirmationModal
                    bodyText={`Are you sure want to remove ${
                      deletingUser.user?.displayName ?? deletingUser.user?.name
                    }?`}
                    cancelText="Cancel"
                    confirmText="Confirm"
                    header="Removing user"
                    onCancel={() =>
                      setDeletingUser({ user: undefined, state: false })
                    }
                    onConfirm={() => {
                      deleteUser(deletingUser.user?.id as string);
                    }}
                  />
                )}
                {deletingTeam.state && (
                  <ConfirmationModal
                    bodyText={`Are you sure you want to delete the team "${
                      deletingTeam.team?.displayName || deletingTeam.team?.name
                    }"?`}
                    cancelText="Cancel"
                    confirmText="Confirm"
                    header="Delete Team"
                    onCancel={() =>
                      setDeletingTeam({ team: undefined, state: false })
                    }
                    onConfirm={() => {
                      deleteTeamById(deletingTeam.team?.id as string);
                    }}
                  />
                )}
              </div>
            )}
          </PageLayout>
        </PageContainerV1>
      )}
    </>
  );
};

export default observer(TeamsPage);
