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

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { observer } from 'mobx-react';
import React, { useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import {
  createTeam,
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
import FormModal from '../../components/Modals/FormModal';
import {
  ERROR404,
  getTeamDetailsPath,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { Team } from '../../generated/entity/teams/team';
import { User } from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import { UserTeam } from '../../interface/team.interface';
import { getCountBadge } from '../../utils/CommonUtils';
import AddUsersModal from './AddUsersModal';
import Form from './Form';
import UserCard from './UserCard';

const TeamsPage = () => {
  const { team } = useParams() as Record<string, string>;
  const history = useHistory();
  const { isAuthDisabled, isAdminUser } = useAuth();
  const [teams, setTeams] = useState<Array<Team>>([]);
  const [currentTeam, setCurrentTeam] = useState<Team>();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);
  const [isAddingUsers, setIsAddingUsers] = useState<boolean>(false);
  const [userList, setUserList] = useState<Array<User>>([]);

  const fetchTeams = () => {
    setIsLoading(true);
    getTeams(['users', 'owns'])
      .then((res: AxiosResponse) => {
        if (!team) {
          setCurrentTeam(res.data.data[0]);
        }
        setTeams(res.data.data);
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

  const fetchCurrentTeam = (name: string, update = false) => {
    if (currentTeam?.name !== name || update) {
      setIsLoading(true);
      getTeamByName(name, ['users', 'owns'])
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

  const createNewTeam = (data: Team) => {
    createTeam(data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          fetchTeams();
        }
      })
      .finally(() => {
        setIsAddingTeam(false);
      });
  };

  const createUsers = (data: Array<UserTeam>) => {
    const updatedTeam = {
      ...currentTeam,
      users: [...(currentTeam?.users as Array<UserTeam>), ...data],
    };
    const jsonPatch = compare(currentTeam as Team, updatedTeam);
    patchTeamDetail(currentTeam?.id, jsonPatch).then((res: AxiosResponse) => {
      if (res.data) {
        fetchCurrentTeam(res.data.name, true);
      }
    });
    setIsAddingUsers(false);
  };

  const deleteUser = (id: string) => {
    const users = [...(currentTeam?.users as Array<UserTeam>)];
    const newUsers = users.filter((user) => {
      return user.id !== id;
    });
    const updatedTeam = {
      ...currentTeam,
      users: newUsers,
    };
    const jsonPatch = compare(currentTeam as Team, updatedTeam);
    patchTeamDetail(currentTeam?.id, jsonPatch).then((res: AxiosResponse) => {
      if (res.data) {
        fetchCurrentTeam(res.data.name, true);
      }
    });
  };

  const getCurrentTeamClass = (name: string) => {
    if (currentTeam?.name === name) {
      return 'activeCategory';
    } else {
      return '';
    }
  };
  const getActiveTabClass = (tab: number) => {
    return tab === currentTab ? 'active' : '';
  };
  const changeCurrentTeam = (name: string) => {
    history.push(getTeamDetailsPath(name));
  };

  const getTabs = () => {
    return (
      <div className="tw-mb-3 ">
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
        </nav>
      </div>
    );
  };

  const getUserCards = () => {
    if ((currentTeam?.users?.length as number) <= 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>There are no users added yet.</p>
          {isAdminUser || isAuthDisabled ? (
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

    return (
      <>
        <div
          className="tw-grid xxl:tw-grid-cols-4 lg:tw-grid-cols-3 md:tw-grid-cols-2 tw-gap-4"
          data-testid="user-card-container">
          {currentTeam?.users?.map((user, index) => {
            const User = {
              description: user.displayName || user.name || '',
              name: user.name || '',
              id: user.id,
            };

            return (
              <UserCard
                isIconVisible
                item={User}
                key={index}
                onRemove={deleteUser}
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
  const fetchLeftPanel = () => {
    return (
      <>
        <div className="tw-flex tw-justify-between tw-items-baseline tw-mb-3 tw-border-b">
          <h6 className="tw-heading">Teams</h6>
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-7 tw-px-2', {
                'tw-opacity-40': !isAdminUser && !isAuthDisabled,
              })}
              data-testid="add-teams"
              size="small"
              theme="primary"
              variant="contained"
              onClick={() => setIsAddingTeam(true)}>
              <i aria-hidden="true" className="fa fa-plus" />
            </Button>
          </NonAdminAction>
        </div>
        {teams &&
          teams.map((team: Team) => (
            <div
              className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-mb-3 tw-flex tw-justify-between ${getCurrentTeamClass(
                team.name
              )}`}
              key={team.name}
              onClick={() => {
                changeCurrentTeam(team.name);
              }}>
              <p className="tw-text-center tag-category tw-self-center">
                {team.displayName}
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
        <PageContainerV1 className="tw-py-4">
          <PageLayout leftPanel={fetchLeftPanel()}>
            {isLoading ? (
              <Loader />
            ) : (
              <div className="tw-pb-3" data-testid="team-container">
                {teams.length > 0 ? (
                  <>
                    <div
                      className="tw-flex tw-justify-between tw-pl-1"
                      data-testid="header">
                      <div className="tw-heading tw-text-link tw-text-base">
                        {currentTeam?.displayName}
                      </div>
                      <NonAdminAction
                        position="bottom"
                        title={TITLE_FOR_NON_ADMIN_ACTION}>
                        <Button
                          className={classNames('tw-h-8 tw-rounded tw-mb-2', {
                            'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                          })}
                          data-testid="add-new-user-button"
                          size="small"
                          theme="primary"
                          variant="contained"
                          onClick={() => setIsAddingUsers(true)}>
                          Add new user
                        </Button>
                      </NonAdminAction>
                    </div>
                    <div
                      className="tw-mb-3"
                      data-testid="description-container">
                      <Description
                        description={currentTeam?.description || ''}
                        entityName={currentTeam?.displayName}
                        isEdit={isEditable}
                        onCancel={onCancel}
                        onDescriptionEdit={onDescriptionEdit}
                        onDescriptionUpdate={onDescriptionUpdate}
                      />
                    </div>

                    {getTabs()}

                    {currentTab === 1 && getUserCards()}

                    {currentTab === 2 && getDatasetCards()}
                    {isAddingUsers && (
                      <AddUsersModal
                        header={`Adding new users to ${currentTeam?.name}`}
                        list={getUniqueUserList()}
                        onCancel={() => setIsAddingUsers(false)}
                        onSave={(data) => createUsers(data)}
                      />
                    )}
                  </>
                ) : (
                  <ErrorPlaceHolder>
                    <p className="w-text-lg tw-text-center">No Teams Added.</p>
                    <p className="w-text-lg tw-text-center">
                      <button
                        className="link-text tw-underline"
                        onClick={() => setIsAddingTeam(true)}>
                        Click here
                      </button>
                      {' to add new Team'}
                    </p>
                  </ErrorPlaceHolder>
                )}

                {isAddingTeam && (
                  <FormModal
                    form={Form}
                    header="Adding new team"
                    initialData={{
                      name: '',
                      description: '',
                      displayName: '',
                    }}
                    onCancel={() => setIsAddingTeam(false)}
                    onSave={(data) => createNewTeam(data as Team)}
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
