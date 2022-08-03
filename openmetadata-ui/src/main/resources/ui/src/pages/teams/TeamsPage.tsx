/*
 *  Copyright 2022 Collate
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
import { compare, Operation } from 'fast-json-patch';
import { isUndefined, toLower } from 'lodash';
import { FormErrorData, SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { searchData } from '../../axiosAPIs/miscAPI';
import {
  createTeam,
  getTeamByName,
  getTeams,
  patchTeamDetail,
} from '../../axiosAPIs/teamsAPI';
import { getUsers, updateUserDetail } from '../../axiosAPIs/userAPI';
import Loader from '../../components/Loader/Loader';
import FormModal from '../../components/Modals/FormModal';
import Form from '../../components/TeamDetails/Form';
import TeamDetailsV1 from '../../components/TeamDetails/TeamDetailsV1';
import Teams from '../../components/TeamDetails/Teams';
import {
  INITIAL_PAGIN_VALUE,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/globalSettings.constants';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/entity/data/table';
import { Team } from '../../generated/entity/teams/team';
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { formatUsersResponse } from '../../utils/APIUtils';
import { getEntityName, isUrlFriendlyName } from '../../utils/CommonUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import AddUsersModalV1 from './AddUsersModalV1';

const TeamsPage = () => {
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const { fqn } = useParams<{ [key: string]: string }>();
  const [allTeam, setAllTeam] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team>({} as Team);
  const [users, setUsers] = useState<User[]>([]);
  const [userPaging, setUserPaging] = useState<Paging>(pagingObject);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [currentUserPage, setCurrentUserPage] = useState(INITIAL_PAGIN_VALUE);
  const [showDeletedTeam, setShowDeletedTeam] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [userSearchValue, setUserSearchValue] = useState<string>('');
  const [errorNewTeamData, setErrorNewTeamData] = useState<FormErrorData>();
  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);
  const [isAddingUsers, setIsAddingUsers] = useState<boolean>(false);

  const descriptionHandler = (value: boolean) => {
    setIsDescriptionEditable(value);
  };

  const handleAddTeam = (value: boolean) => {
    setIsAddingTeam(value);
  };

  const handleAddUsers = (value: boolean) => {
    setIsAddingUsers(value);
  };

  const fetchAllTeams = async (isPageLoading = true) => {
    isPageLoading && setIsPageLoading(true);
    try {
      const { data } = await getTeams([
        // 'users',
        'owns',
        'defaultRoles',
        'owner',
        'children',
      ]);

      if (data) {
        setAllTeam(data.data);
      } else {
        throw jsonData['api-error-messages']['unexpected-server-response'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['unexpected-server-response']
      );
    }
    setIsPageLoading(false);
  };

  /**
   * Handle new data change
   * @param data - team data
   * @param forceSet - boolean value
   * @returns - errorData
   */
  const onNewTeamDataChange = (data: Team, forceSet = false) => {
    if (errorNewTeamData || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.name.trim()) {
        errData['name'] = 'Name is required';
      } else if (
        !isUndefined(
          allTeam.find((item) => toLower(item.name) === toLower(data.name))
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
      setErrorNewTeamData(errData);

      return errData;
    }

    return {};
  };

  /**
   * Take Team data as input and create the team
   * @param data - Team Data
   */
  const createNewTeam = (data: Team) => {
    const errData = onNewTeamDataChange(data, true);
    if (!Object.values(errData).length) {
      const teamData = {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
      };
      createTeam(teamData)
        .then((res: AxiosResponse) => {
          if (res.data) {
            handleAddTeam(false);
            fetchAllTeams();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['create-team-error']
          );
        });
    }
  };

  /**
   * Make API call to fetch current team user data
   */
  const getCurrentTeamUsers = (
    team: string,
    pagin = {} as { [key: string]: string }
  ) => {
    setIsDataLoading(true);
    getUsers('teams', PAGE_SIZE, { team, ...pagin })
      .then((res: AxiosResponse) => {
        if (res.data) {
          setUsers(res.data.data);
          setUserPaging(res.data.paging);
        }
      })
      .catch(() => {
        setUsers([]);
        setUserPaging({ total: 0 });
      })
      .finally(() => setIsDataLoading(false));
  };

  const fetchTeamByFqn = async (name: string) => {
    setIsPageLoading(true);
    try {
      const { data } = await getTeamByName(name, [
        'users',
        'owns',
        'defaultRoles',
        'owner',
        'parents',
        'children',
      ]);

      if (data) {
        getCurrentTeamUsers(data.name);
        setSelectedTeam(data);
      } else {
        throw jsonData['api-error-messages']['unexpected-server-response'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['unexpected-server-response']
      );
    }
    setIsPageLoading(false);
  };

  const searchUsers = (text: string, currentPage: number) => {
    setIsDataLoading(true);
    searchData(
      text,
      currentPage,
      PAGE_SIZE,
      `(teams.id:${selectedTeam?.id})`,
      '',
      '',
      SearchIndex.USER
    )
      .then((res: SearchResponse) => {
        const data = formatUsersResponse(res.data.hits.hits);
        setUsers(data);
        setUserPaging({
          total: res.data.hits.total.value,
        });
      })
      .catch(() => {
        setUsers([]);
      })
      .finally(() => setIsDataLoading(false));
  };

  const updateTeamHandler = (updatedData: Team) => {
    const jsonPatch = compare(selectedTeam, updatedData);

    return new Promise<void>((resolve, reject) => {
      patchTeamDetail(selectedTeam.id, jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchTeamByFqn(selectedTeam.name);
            resolve();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['update-team-error']
          );
          reject();
        });
    });
  };

  const userPagingHandler = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    if (userSearchValue) {
      setCurrentUserPage(cursorValue as number);
      searchUsers(userSearchValue, cursorValue as number);
    } else {
      setCurrentUserPage(activePage as number);
      getCurrentTeamUsers(selectedTeam.name, {
        [cursorValue]: userPaging[cursorValue as keyof Paging] as string,
      });
    }
  };

  const handleJoinTeamClick = (id: string, data: Operation[]) => {
    // setIsPageLoading(true);
    updateUserDetail(id, data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          AppState.updateUserDetails(res.data);
          fetchTeamByFqn(selectedTeam.name);
          showSuccessToast(
            jsonData['api-success-messages']['join-team-success'],
            2000
          );
        } else {
          throw jsonData['api-error-messages']['join-team-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['join-team-error']);
        // setIsRightPanelLoading(false);
      });
  };

  const handleLeaveTeamClick = (id: string, data: Operation[]) => {
    // setIsRightPanelLoading(true);

    return new Promise<void>((resolve) => {
      updateUserDetail(id, data)
        .then((res: AxiosResponse) => {
          if (res.data) {
            AppState.updateUserDetails(res.data);
            fetchTeamByFqn(selectedTeam.name);
            showSuccessToast(
              jsonData['api-success-messages']['leave-team-success'],
              2000
            );
            resolve();
          } else {
            throw jsonData['api-error-messages']['leave-team-error'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['leave-team-error']
          );
          // setIsRightPanelLoading(false);
        });
    });
  };

  /**
   * Take users data as input and add users to team
   * @param data
   */
  const addUsersToTeam = (data: Array<EntityReference>) => {
    if (!isUndefined(selectedTeam) && !isUndefined(selectedTeam.users)) {
      const updatedTeam = {
        ...selectedTeam,
        users: [...(selectedTeam.users as Array<EntityReference>), ...data],
      };
      const jsonPatch = compare(selectedTeam, updatedTeam);
      patchTeamDetail(selectedTeam.id, jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchTeamByFqn(res.data.name);
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['update-team-error']
          );
        })
        .finally(() => {
          setIsAddingUsers(false);
        });
    }
  };

  /**
   * Take user id and remove that user from the team
   * @param id - user id
   */
  const removeUserFromTeam = (id: string) => {
    const newUsers = selectedTeam?.users?.filter((user) => {
      return user.id !== id;
    });
    const updatedTeam = {
      ...selectedTeam,
      users: newUsers,
    };

    const jsonPatch = compare(selectedTeam, updatedTeam);

    return new Promise<void>((resolve) => {
      patchTeamDetail(selectedTeam.id, jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchTeamByFqn(res.data.name);
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['update-team-error']
          );
        })
        .finally(() => {
          resolve();
        });
    });
  };

  const handleUsersSearchAction = (text: string) => {
    setUserSearchValue(text);
    setCurrentUserPage(INITIAL_PAGIN_VALUE);
    if (text) {
      searchUsers(text, INITIAL_PAGIN_VALUE);
    } else {
      getCurrentTeamUsers(selectedTeam.name);
    }
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (selectedTeam.description !== updatedHTML) {
      const updatedTeam = { ...selectedTeam, description: updatedHTML };
      const jsonPatch = compare(selectedTeam, updatedTeam);
      patchTeamDetail(selectedTeam.id, jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchTeamByFqn(res.data.name);
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['update-team-error']
          );
        })
        .finally(() => {
          descriptionHandler(false);
        });
    } else {
      descriptionHandler(false);
    }
  };

  const afterDeleteAction = () => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.ACCESS,
        GlobalSettingOptions.TEAMS
      )
    );
  };

  const handleShowDeletedTeam = (checked: boolean) => {
    setShowDeletedTeam(checked);
  };

  useEffect(() => {
    if (isAddingTeam) {
      fetchAllTeams(false);
    }
  }, [isAddingTeam]);

  useEffect(() => {
    if (fqn) {
      fetchTeamByFqn(fqn);
    } else {
      fetchAllTeams();
    }
  }, [fqn]);

  if (isPageLoading) {
    return <Loader />;
  }

  return (
    <>
      {isUndefined(fqn) ? (
        <Teams
          data={allTeam}
          showDeletedTeam={showDeletedTeam}
          onAddTeamClick={handleAddTeam}
          onShowDeletedTeamChange={handleShowDeletedTeam}
        />
      ) : (
        <TeamDetailsV1
          afterDeleteAction={afterDeleteAction}
          currentTeam={selectedTeam}
          currentTeamUserPage={currentUserPage}
          currentTeamUsers={users}
          descriptionHandler={descriptionHandler}
          handleAddTeam={handleAddTeam}
          handleAddUser={handleAddUsers}
          handleJoinTeamClick={handleJoinTeamClick}
          handleLeaveTeamClick={handleLeaveTeamClick}
          handleTeamUsersSearchAction={handleUsersSearchAction}
          hasAccess={isAuthDisabled || isAdminUser}
          isDescriptionEditable={isDescriptionEditable}
          isTeamMemberLoading={isDataLoading}
          removeUserFromTeam={removeUserFromTeam}
          teamUserPagin={userPaging}
          teamUserPaginHandler={userPagingHandler}
          teamUsersSearchText={userSearchValue}
          updateTeamHandler={updateTeamHandler}
          onDescriptionUpdate={onDescriptionUpdate}
        />
      )}

      {isAddingUsers && (
        <AddUsersModalV1
          header={`Adding new users to ${getEntityName(selectedTeam)}`}
          list={selectedTeam.users || []}
          onCancel={() => setIsAddingUsers(false)}
          onSave={(data) => addUsersToTeam(data)}
        />
      )}
      {isAddingTeam && (
        <FormModal
          errorData={errorNewTeamData}
          form={Form}
          header="Adding new team"
          initialData={{
            name: '',
            description: '',
            displayName: '',
          }}
          onCancel={() => setIsAddingTeam(false)}
          onChange={(data) => onNewTeamDataChange(data as Team)}
          onSave={(data) => createNewTeam(data as Team)}
        />
      )}
    </>
  );
};

export default TeamsPage;
