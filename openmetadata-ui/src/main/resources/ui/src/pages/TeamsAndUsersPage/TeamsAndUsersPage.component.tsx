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
import { compare, Operation } from 'fast-json-patch';
import { isUndefined, toLower } from 'lodash';
import { observer } from 'mobx-react';
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
import {
  deleteUser,
  getUsers,
  updateUserDetail,
} from '../../axiosAPIs/userAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import TeamsAndUsers from '../../components/TeamsAndUsers/TeamsAndUsers.component';
import {
  getTeamAndUserDetailsPath,
  INITIAL_PAGIN_VALUE,
  PAGE_SIZE_MEDIUM,
  ROUTES,
} from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { UserType } from '../../enums/user.enum';
import { Team } from '../../generated/entity/teams/team';
import {
  EntityReference as UserTeams,
  User,
} from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { formatUsersResponse } from '../../utils/APIUtils';
import { isUrlFriendlyName } from '../../utils/CommonUtils';
import { getErrorText } from '../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { getAllUsersList } from '../../utils/UserDataUtils';

const TeamsAndUsersPage = () => {
  const { teamAndUser } = useParams<Record<string, string>>();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const [isLoading, setIsLoading] = useState(true);
  const [isRightPannelLoading, setIsRightPannelLoading] = useState(true);
  const [isTeamMemberLoading, setIsTeamMemberLoading] = useState(true);
  const [isTeamVisible, setIsTeamVisible] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team>();
  const [currentTeamUsers, setCurrentTeamUsers] = useState<User[]>([]);
  const [teamUserPagin, setTeamUserPagin] = useState<Paging>({} as Paging);
  const [currentTeamUserPage, setCurrentTeamUserPage] =
    useState(INITIAL_PAGIN_VALUE);
  const [teamUsersSearchText, setTeamUsersSearchText] = useState('');
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);
  const [isAddingUsers, setIsAddingUsers] = useState<boolean>(false);
  const [errorNewTeamData, setErrorNewTeamData] = useState<FormErrorData>();
  const [activeUserTab, setactiveUserTab] = useState<UserType>();
  const [userList, setUserList] = useState<Array<User>>([]);
  const [users, setUsers] = useState<Array<User>>([]);
  const [admins, setAdmins] = useState<Array<User>>([]);
  const [bots, setBots] = useState<Array<User>>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUserList, setSelectedUserList] = useState<Array<User>>([]);

  const descriptionHandler = (value: boolean) => {
    setIsDescriptionEditable(value);
  };

  const handleAddTeam = (value: boolean) => {
    setIsAddingTeam(value);
  };

  const handleAddUser = (data: boolean) => {
    setIsAddingUsers(data);
  };

  const activeUserTabHandler = (data: UserType | undefined) => {
    setactiveUserTab(data);
  };

  const isIncludes = (name: string, term: string) => {
    return toLower(name).includes(toLower(term));
  };

  const setAllTabList = (users: User[], type = '') => {
    setIsUsersLoading(true);
    const dBots = users.filter((user) => user.isBot);
    const dUsers = users.filter((user) => !user.isBot);
    const dAdmins = users.filter((user) => user.isAdmin);
    setUsers(dUsers);
    setAdmins(dAdmins);
    setBots(dBots);

    if (type) {
      switch (type) {
        case UserType.ADMINS:
          setSelectedUserList(dAdmins);

          break;

        case UserType.BOTS:
          setSelectedUserList(dBots);

          break;
        case UserType.USERS:
        default:
          setSelectedUserList(dUsers);

          break;
      }
    }
    setIsRightPannelLoading(false);
    setIsUsersLoading(false);
  };

  const handleUserSearchTerm = (value: string) => {
    setIsUsersLoading(true);
    setUserSearchTerm(value);
    if (value) {
      let updatedList: User[] = [];

      switch (activeUserTab) {
        case UserType.ADMINS:
          updatedList = admins.filter((user) =>
            isIncludes(user.displayName || user.name, value)
          );

          break;

        case UserType.BOTS:
          updatedList = bots.filter((user) =>
            isIncludes(user.displayName || user.name, value)
          );

          break;
        case UserType.USERS:
        default:
          updatedList = users.filter((user) =>
            isIncludes(user.displayName || user.name, value)
          );

          break;
      }

      setSelectedUserList(updatedList);
    } else {
      setAllTabList(userList, activeUserTab);
    }
    setIsUsersLoading(false);
  };

  const handleAddNewUser = () => {
    history.push(ROUTES.CREATE_USER);
  };

  const handleDeleteUser = (id: string) => {
    setIsUsersLoading(true);
    deleteUser(id)
      .then(() => {
        // AppState.updateUsers((userList || []).filter((item) => item.id !== id));
        getAllUsersList();
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['delete-user-error']
        );
      })
      .finally(() => {
        setIsLoading(false);
        setIsUsersLoading(false);
      });
  };

  /**
   * Make API call to fetch current team user data
   */
  const getCurrentTeamUsers = (
    team: string,
    pagin = {} as { [key: string]: string }
  ) => {
    setIsTeamMemberLoading(true);
    getUsers('', PAGE_SIZE_MEDIUM, { team, ...pagin })
      .then((res: AxiosResponse) => {
        if (res.data) {
          setCurrentTeamUsers(res.data.data);
          setTeamUserPagin(res.data.paging);
        }
      })
      .catch(() => {
        setCurrentTeamUsers([]);
        setTeamUserPagin({ total: 0 });
      })
      .finally(() => setIsTeamMemberLoading(false));
  };

  /**
   * Make API call to fetch all the teams
   */
  const fetchTeams = () => {
    getTeams(['users', 'owns', 'defaultRoles', 'owner'])
      .then((res: AxiosResponse) => {
        if (res.data) {
          if (!teamAndUser && res.data.data.length > 0) {
            getCurrentTeamUsers(res.data.data[0].name);
            setCurrentTeam(res.data.data[0]);
            setIsRightPannelLoading(false);
          }
          setTeams(res.data.data);
          AppState.updateUserTeam(res.data.data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['fetch-teams-error']
        );
        showErrorToast(errMsg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  /**
   * Make API call to fetch current team data
   */
  const fetchCurrentTeam = (name: string, update = false) => {
    if (currentTeam?.name !== name || update) {
      getTeamByName(name, ['users', 'owns', 'defaultRoles', 'owner'])
        .then((res: AxiosResponse) => {
          if (res.data) {
            setCurrentTeam(res.data);
            getCurrentTeamUsers(res.data.name);
            if (teams.length <= 0) {
              fetchTeams();
            } else {
              const updatedTeams = teams.map((team) => {
                if (team.id === res.data.id) {
                  return res.data;
                }

                return team;
              });
              setTeams(updatedTeams);
            }
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          const errMsg = getErrorText(
            err,
            jsonData['api-error-messages']['fetch-teams-error']
          );
          showErrorToast(errMsg);
        })
        .finally(() => {
          setIsRightPannelLoading(false);
        });
    }
  };

  const searchUsers = (text: string, currentPage: number) => {
    setIsTeamMemberLoading(true);
    searchData(
      text,
      currentPage,
      PAGE_SIZE_MEDIUM,
      `(teams:${currentTeam?.id})`,
      '',
      '',
      SearchIndex.USER
    )
      .then((res: SearchResponse) => {
        const data = formatUsersResponse(res.data.hits.hits);
        setCurrentTeamUsers(data);
        setTeamUserPagin({
          total: res.data.hits.total.value,
        });
      })
      .catch(() => {
        setCurrentTeamUsers([]);
      })
      .finally(() => setIsTeamMemberLoading(false));
  };

  const teamUserPaginHandler = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    if (teamUsersSearchText) {
      setCurrentTeamUserPage(cursorValue as number);
      searchUsers(teamUsersSearchText, cursorValue as number);
    } else {
      setCurrentTeamUserPage(activePage as number);
      getCurrentTeamUsers(currentTeam?.name || '', {
        [cursorValue]: teamUserPagin[cursorValue as keyof Paging] as string,
      });
    }
  };

  const handleTeamUsersSearchAction = (text: string) => {
    setTeamUsersSearchText(text);
    setCurrentTeamUserPage(INITIAL_PAGIN_VALUE);
    if (text) {
      searchUsers(text, INITIAL_PAGIN_VALUE);
    } else {
      getCurrentTeamUsers(currentTeam?.name as string);
    }
  };

  /**
   * Filter out the already added user and return unique user list
   * @returns - unique user list
   */
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

  /**
   * Take users data as input and add users to team
   * @param data
   */
  const addUsersToTeam = (data: Array<UserTeams>) => {
    if (!isUndefined(currentTeam)) {
      const updatedTeam = {
        ...currentTeam,
        users: [...(currentTeam.users as Array<UserTeams>), ...data],
      };
      const jsonPatch = compare(currentTeam, updatedTeam);
      patchTeamDetail(currentTeam.id, jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchCurrentTeam(res.data.name, true);
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

  const handleJoinTeamClick = (id: string, data: Operation[]) => {
    setIsRightPannelLoading(true);
    updateUserDetail(id, data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          AppState.updateUserDetails(res.data);
          fetchCurrentTeam(currentTeam?.name || '', true);
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
      });
  };

  const handleLeaveTeamClick = (id: string, data: Operation[]) => {
    setIsRightPannelLoading(true);

    return new Promise<void>((resolve) => {
      updateUserDetail(id, data)
        .then((res: AxiosResponse) => {
          if (res.data) {
            AppState.updateUserDetails(res.data);
            fetchCurrentTeam(currentTeam?.name || '', true);
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
        });
    });
  };

  /**
   * Handle current team route
   * @param name - team name
   */
  const changeCurrentTeam = (name: string, isUsersCategory: boolean) => {
    if (name !== teamAndUser) {
      setIsRightPannelLoading(true);
      history.push(getTeamAndUserDetailsPath(name));
      if (isUsersCategory) {
        setIsTeamVisible(false);
        setCurrentTeam(undefined);
      } else {
        setIsTeamVisible(true);
        setactiveUserTab(undefined);
      }
    }
  };

  const updateTeamHandler = (updatedData: Team) => {
    const jsonPatch = compare(currentTeam as Team, updatedData);

    return new Promise<void>((resolve, reject) => {
      patchTeamDetail(currentTeam?.id, jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchCurrentTeam(res.data.name, true);
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
            fetchTeams();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['create-team-error']
          );
        })
        .finally(() => {
          setIsAddingTeam(false);
        });
    }
  };

  /**
   * Take user id and remove that user from the team
   * @param id - user id
   */
  const removeUserFromTeam = (id: string) => {
    const newUsers = currentTeam?.users?.filter((user) => {
      return user.id !== id;
    });
    const updatedTeam = {
      ...currentTeam,
      users: newUsers,
    };
    const jsonPatch = compare(currentTeam as Team, updatedTeam);

    return new Promise<void>((resolve) => {
      patchTeamDetail(currentTeam?.id, jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchCurrentTeam(res.data.name, true);
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

  /**
   * Update team description
   * @param updatedHTML - updated description
   */
  const onDescriptionUpdate = (updatedHTML: string) => {
    if (currentTeam && currentTeam.description !== updatedHTML) {
      const updatedTeam = { ...currentTeam, description: updatedHTML };
      const jsonPatch = compare(currentTeam as Team, updatedTeam);
      patchTeamDetail(currentTeam.id, jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchCurrentTeam(res.data.name, true);
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
    setIsLoading(true);
    history.push(getTeamAndUserDetailsPath());
    fetchTeams();
  };

  useEffect(() => {
    if (teamAndUser) {
      if (Object.values(UserType).includes(teamAndUser as UserType)) {
        setIsTeamVisible(false);
        setactiveUserTab(teamAndUser as UserType);
        setCurrentTeam(undefined);
      } else {
        fetchCurrentTeam(teamAndUser);
      }
    } else {
      setactiveUserTab(undefined);
      setIsTeamVisible(true);
    }
    setUserList(AppState.users);
    setAllTabList(AppState.users, teamAndUser as UserType);
    setUserSearchTerm('');
    setTeamUsersSearchText('');
    fetchTeams();
  }, [teamAndUser, AppState.users]);

  return (
    <PageContainerV1>
      {isLoading ? (
        <Loader />
      ) : (
        <TeamsAndUsers
          activeUserTab={activeUserTab}
          activeUserTabHandler={activeUserTabHandler}
          addUsersToTeam={addUsersToTeam}
          admins={admins}
          afterDeleteAction={afterDeleteAction}
          bots={bots}
          changeCurrentTeam={changeCurrentTeam}
          createNewTeam={createNewTeam}
          currentTeam={currentTeam}
          currentTeamUserPage={currentTeamUserPage}
          currentTeamUsers={currentTeamUsers}
          descriptionHandler={descriptionHandler}
          errorNewTeamData={errorNewTeamData}
          getUniqueUserList={getUniqueUserList}
          handleAddNewUser={handleAddNewUser}
          handleAddTeam={handleAddTeam}
          handleAddUser={handleAddUser}
          handleDeleteUser={handleDeleteUser}
          handleJoinTeamClick={handleJoinTeamClick}
          handleLeaveTeamClick={handleLeaveTeamClick}
          handleTeamUsersSearchAction={handleTeamUsersSearchAction}
          handleUserSearchTerm={handleUserSearchTerm}
          hasAccess={isAuthDisabled || isAdminUser}
          isAddingTeam={isAddingTeam}
          isAddingUsers={isAddingUsers}
          isDescriptionEditable={isDescriptionEditable}
          isRightPannelLoading={isRightPannelLoading}
          isTeamMemberLoading={isTeamMemberLoading}
          isTeamVisible={isTeamVisible}
          isUsersLoading={isUsersLoading}
          removeUserFromTeam={removeUserFromTeam}
          selectedUserList={selectedUserList}
          teamUserPagin={teamUserPagin}
          teamUserPaginHandler={teamUserPaginHandler}
          teamUsersSearchText={teamUsersSearchText}
          teams={teams}
          updateTeamHandler={updateTeamHandler}
          userSearchTerm={userSearchTerm}
          users={users}
          onDescriptionUpdate={onDescriptionUpdate}
          onNewTeamDataChange={onNewTeamDataChange}
        />
      )}
    </PageContainerV1>
  );
};

export default observer(TeamsAndUsersPage);
