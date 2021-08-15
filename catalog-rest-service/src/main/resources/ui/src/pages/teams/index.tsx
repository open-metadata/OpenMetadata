/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { AxiosError, AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { observer } from 'mobx-react';
import { Team, User, UserTeam } from 'Models';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../AppState';
import {
  createTeam,
  getTeamByName,
  getTeams,
  patchTeamDetail,
} from '../../axiosAPIs/teamsAPI';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import FormModal from '../../components/Modals/FormModal';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { ERROR404 } from '../../constants/constants';
import SVGIcons from '../../utils/SvgUtils';
import AddUsersModal from './AddUsersModal';
import Form from './Form';
import UserCard from './UserCard';

const TeamsPage = () => {
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
        setTeams(res.data.data);
        setCurrentTeam(res.data.data[0]);
        setIsLoading(false);
      })
      .catch((err: AxiosError) => {
        if (err?.response?.data.code) {
          setError(ERROR404);
        }
        setIsLoading(false);
      });
  };

  const fetchCurrentTeam = (name: string, update = false) => {
    if (currentTeam?.name !== name || update) {
      setIsLoading(true);
      getTeamByName(name, ['users', 'owns'])
        .then((res: AxiosResponse) => {
          setCurrentTeam(res.data);
          setIsLoading(false);
        })
        .catch((err: AxiosError) => {
          if (err?.response?.data.code) {
            setError(ERROR404);
          }
          setIsLoading(false);
        });
    }
  };

  const createNewTeam = (data: Team) => {
    createTeam(data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          fetchTeams();
          setIsAddingTeam(false);
        } else {
          setIsAddingTeam(false);
        }
      })
      .catch(() => {
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

  const getTabs = () => {
    return (
      <div className="tw-mb-3 ">
        <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4">
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(1)}`}
            onClick={() => {
              setCurrentTab(1);
            }}>
            Users
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(2)}`}
            onClick={() => {
              setCurrentTab(2);
            }}>
            Assets
          </button>
        </nav>
      </div>
    );
  };

  const getUserCards = () => {
    if ((currentTeam?.users.length as number) <= 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>there are not any users added yet.</p>
          <p>would like to start adding some ?</p>
          <NonAdminAction
            position="bottom"
            title="Only Admin is allowed for the action">
            <Button
              className="tw-h-8 tw-rounded tw-mb-2"
              size="small"
              theme="primary"
              variant="contained"
              onClick={() => setIsAddingUsers(true)}>
              Add new user
            </Button>
          </NonAdminAction>
        </div>
      );
    }

    return (
      <>
        <div className="tw-grid xl:tw-grid-cols-4 md:tw-grid-cols-2 tw-gap-4">
          {currentTeam?.users.map((user, index) => {
            const User = {
              description: user.description,
              name: user.name,
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
    if ((currentTeam?.owns.length as number) <= 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>Your team does not have any dataset</p>
          <p>would like to start adding some ?</p>
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
        <div className="tw-grid xl:tw-grid-cols-4 md:tw-grid-cols-2 tw-gap-4">
          {' '}
          {currentTeam?.owns.map((dataset, index) => {
            const Dataset = { description: dataset.name, name: dataset.type };

            return <UserCard isDataset item={Dataset} key={index} />;
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
          <NonAdminAction
            position="bottom"
            title="Only Admin is allowed for the action">
            <Button
              className="tw-h-7 tw-px-2"
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
                fetchCurrentTeam(team.name);
                setCurrentTab(1);
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
        const teamUser = currentTeam?.users.some(
          (teamUser) => user.id === teamUser.id
        );

        return !teamUser && user;
      })
      .map((user) => {
        return {
          description: user.displayName,
          id: user.id,
          href: user.href,
          name: user.name,
          type: 'user',
        };
      });

    return uniqueList;
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    setUserList(AppState.users);
  }, [AppState.users]);

  return (
    <>
      {error ? (
        <ErrorPlaceHolder />
      ) : (
        <PageContainer leftPanelContent={fetchLeftPanel()}>
          {isLoading ? (
            <Loader />
          ) : (
            <div className="container-fluid tw-pt-1 tw-pb-3">
              <div className="tw-flex tw-justify-between tw-pl-1">
                <div className="tw-heading tw-text-link tw-text-base">
                  {currentTeam?.displayName}
                </div>
                <NonAdminAction
                  position="bottom"
                  title="Only Admin is allowed for the action">
                  <Button
                    className="tw-h-8 tw-rounded tw-mb-2"
                    size="small"
                    theme="primary"
                    variant="contained"
                    onClick={() => setIsAddingUsers(true)}>
                    Add new user
                  </Button>
                </NonAdminAction>
              </div>
              <div className="tw-flex tw-flex-col tw-border tw-rounded-md tw-mb-3 tw-min-h-32 tw-bg-white">
                <div className="tw-flex tw-items-center tw-px-3 tw-py-1 tw-border-b">
                  <span className="tw-flex-1 tw-leading-8 tw-m-0 tw-font-normal">
                    Description
                  </span>
                  <div className="tw-flex-initial">
                    <NonAdminAction
                      position="bottom"
                      title="Only Admin is allowed for the action">
                      <button
                        className="focus:tw-outline-none"
                        onClick={onDescriptionEdit}>
                        <SVGIcons alt="edit" icon="icon-edit" title="Edit" />
                      </button>
                    </NonAdminAction>
                  </div>
                </div>
                <div className="tw-px-3 tw-pl-5 tw-py-2 tw-overflow-y-auto">
                  <div data-testid="description" id="description">
                    {currentTeam?.description ? (
                      <RichTextEditorPreviewer
                        markdown={currentTeam.description}
                      />
                    ) : (
                      <span className="tw-no-description">
                        No description added
                      </span>
                    )}
                  </div>
                  {isEditable && (
                    <ModalWithMarkdownEditor
                      header={`Edit description for ${currentTeam?.displayName}`}
                      placeholder="Enter Description"
                      value={currentTeam?.description || ''}
                      onCancel={onCancel}
                      onSave={onDescriptionUpdate}
                    />
                  )}
                </div>
              </div>
              {getTabs()}

              {currentTab === 1 && getUserCards()}

              {currentTab === 2 && getDatasetCards()}

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
              {isAddingUsers && (
                <AddUsersModal
                  header={`Adding new users to ${currentTeam?.name}`}
                  list={getUniqueUserList()}
                  onCancel={() => setIsAddingUsers(false)}
                  onSave={(data) => createUsers(data)}
                />
              )}
            </div>
          )}
        </PageContainer>
      )}
    </>
  );
};

export default observer(TeamsPage);
