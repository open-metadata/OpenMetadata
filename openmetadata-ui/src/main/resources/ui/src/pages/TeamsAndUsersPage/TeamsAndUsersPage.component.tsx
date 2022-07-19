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
import { FormattedUsersData, FormErrorData, SearchResponse } from 'Models';
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
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import TeamsAndUsers from '../../components/TeamsAndUsers/TeamsAndUsers.component';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import {
  getTeamAndUserDetailsPath,
  INITIAL_PAGIN_VALUE,
  PAGE_SIZE_BASE,
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

const TeamsAndUsersPage = () => {
  const { teamAndUser } = useParams<Record<string, string>>();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [isRightPanelLoading, setIsRightPanelLoading] = useState<boolean>(true);
  const [isTeamMemberLoading, setIsTeamMemberLoading] = useState<boolean>(true);
  const [isTeamVisible, setIsTeamVisible] = useState<boolean>(true);
  const [isUsersLoading, setIsUsersLoading] = useState<boolean>(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team>();
  const [currentTeamUsers, setCurrentTeamUsers] = useState<User[]>([]);
  const [teamUserPagin, setTeamUserPagin] = useState<Paging>({} as Paging);
  const [userPaging, setUserPaging] = useState<Paging>({} as Paging);
  const [currentTeamUserPage, setCurrentTeamUserPage] =
    useState(INITIAL_PAGIN_VALUE);
  const [currentUserPage, setCurrentUserPage] = useState(INITIAL_PAGIN_VALUE);
  const [teamUsersSearchText, setTeamUsersSearchText] = useState<string>('');
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);
  const [isAddingUsers, setIsAddingUsers] = useState<boolean>(false);
  const [errorNewTeamData, setErrorNewTeamData] = useState<FormErrorData>();
  const [activeUserTab, setactiveUserTab] = useState<UserType>();
  const [userList, setUserList] = useState<Array<User>>([]);
  const [usersCount, setUsersCount] = useState<number>(0);
  const [adminsCount, setAdminsCount] = useState<number>(0);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
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

  const fetchUserCount = (isAdmin: boolean | undefined) => {
    return new Promise<number>((resolve) => {
      getUsers('', 0, undefined, isAdmin, false)
        .then((res: AxiosResponse) => {
          if (res.data) {
            resolve(res.data.paging.total);
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          const errMsg = getErrorText(
            err,
            jsonData['api-error-messages']['fetch-user-count-error']
          );
          showErrorToast(errMsg);
          resolve(0);
        });
    });
  };

  /**
   * Make API call to fetch all the users
   */
  const fetchUsers = (
    limit = PAGE_SIZE_BASE,
    paging = {} as Record<string, string>,
    isAdmin = undefined as boolean | undefined
  ) => {
    return new Promise<Array<User>>((resolve) => {
      getUsers('profile,teams,roles', limit, paging, isAdmin, false)
        .then((res: AxiosResponse) => {
          if (res.data) {
            const resUsers = res.data.data;
            if (res.data.paging.total > limit) {
              setUserPaging(res.data.paging);
            }
            resolve(resUsers);
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
          resolve([]);
        });
    });
  };

  const userQuerySearch = (
    text = WILD_CARD_CHAR,
    currentPage = 1,
    isAdmin = false
  ) => {
    let filters = '';
    if (isAdmin) {
      filters = '(isAdmin:true)';
    }

    return new Promise<Array<FormattedUsersData>>((resolve) => {
      searchData(
        text,
        currentPage,
        PAGE_SIZE_BASE,
        filters,
        '',
        '',
        SearchIndex.USER
      )
        .then((res: SearchResponse) => {
          const data = formatUsersResponse(res.data.hits.hits);
          setUserPaging({
            total: res.data.hits.total.value,
          });
          resolve(data);
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-users-error']
          );
          resolve([]);
        });
    });
  };

  const setAllTabList = (type: string, cursorValue?: string | number) => {
    setIsUsersLoading(true);

    if (type) {
      const isAdmin = type === UserType.ADMINS || undefined;
      const paging = cursorValue
        ? { [cursorValue]: userPaging[cursorValue as keyof Paging] as string }
        : {};
      fetchUsers(PAGE_SIZE_BASE, paging, isAdmin).then((res) => {
        setSelectedUserList(res);
        setIsUsersLoading(false);
      });
    }
    setIsRightPanelLoading(false);
  };

  const getSearchedUsers = (value: string, pageNumber: number) => {
    setIsUsersLoading(true);
    const isAdmin = activeUserTab === UserType.ADMINS;
    userQuerySearch(value, pageNumber, isAdmin).then((resUsers) => {
      setSelectedUserList(resUsers as unknown as User[]);
      setIsUsersLoading(false);
    });
  };

  const handleUserSearchTerm = (value: string) => {
    setUserSearchTerm(value);
    setCurrentUserPage(INITIAL_PAGIN_VALUE);
    if (value) {
      getSearchedUsers(value, INITIAL_PAGIN_VALUE);
    } else {
      setAllTabList(activeUserTab || '');
    }
  };

  const userPagingHandler = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    if (userSearchTerm) {
      setCurrentUserPage(cursorValue as number);
      getSearchedUsers(userSearchTerm, cursorValue as number);
    } else {
      setCurrentUserPage(activePage as number);
      setAllTabList(activeUserTab || '', cursorValue);
    }
  };

  const handleAddNewUser = () => {
    history.push(ROUTES.CREATE_USER);
  };

  const handleDeleteUser = () => {
    setAllTabList(activeUserTab || '');
    if (activeUserTab === UserType.USERS) {
      setUsersCount((pre) => pre - 1);
    }
    if (activeUserTab === UserType.ADMINS) {
      setAdminsCount((pre) => pre - 1);
    }
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
            setIsRightPanelLoading(false);
          } else {
            const team = res.data.data.find(
              (t: Team) =>
                t.name === teamAndUser || t.displayName === teamAndUser
            );
            if (!isUndefined(team)) {
              getCurrentTeamUsers(team.name);
              setCurrentTeam(team);
            } else {
              setCurrentTeam({} as Team);
            }
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
        if (!teamAndUser) {
          setCurrentTeam({} as Team);
        }
      })
      .finally(() => {
        setIsLoading(false);
        setIsRightPanelLoading(false);
        setIsDataLoading(false);
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
          setCurrentTeam({} as Team);
        })
        .finally(() => {
          setIsRightPanelLoading(false);
        });
    } else {
      setIsRightPanelLoading(false);
    }
  };

  const searchUsers = (text: string, currentPage: number) => {
    setIsTeamMemberLoading(true);
    searchData(
      text,
      currentPage,
      PAGE_SIZE_MEDIUM,
      `(teams.id:${currentTeam?.id})`,
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
    if (!isUndefined(currentTeam) && !isUndefined(currentTeam.users)) {
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
    setIsRightPanelLoading(true);
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
        setIsRightPanelLoading(false);
      });
  };

  const handleLeaveTeamClick = (id: string, data: Operation[]) => {
    setIsRightPanelLoading(true);

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
          setIsRightPanelLoading(false);
        });
    });
  };

  /**
   * Handle current team route
   * @param name - team name
   */
  const changeCurrentTeam = (name: string, isUsersCategory: boolean) => {
    if (name !== teamAndUser) {
      setIsRightPanelLoading(true);
      history.push(getTeamAndUserDetailsPath(name));
      if (isUsersCategory) {
        setIsTeamVisible(false);
        setCurrentTeam({} as Team);
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
    if (!isDataLoading) {
      if (teamAndUser) {
        if (
          Object.values(UserType).includes(teamAndUser as UserType) &&
          (isAdminUser || isAuthDisabled)
        ) {
          setIsTeamVisible(false);
          setactiveUserTab(teamAndUser as UserType);
          setCurrentTeam({} as Team);
          setCurrentUserPage(INITIAL_PAGIN_VALUE);
          setAllTabList(teamAndUser as UserType);
          setUserPaging({} as Paging);
        } else {
          fetchCurrentTeam(teamAndUser);
        }
      } else {
        setactiveUserTab('' as UserType);
        setIsTeamVisible(true);
      }
      setUserSearchTerm('');
      setTeamUsersSearchText('');
    }
  }, [teamAndUser, isDataLoading]);

  useEffect(() => {
    fetchUserCount(undefined).then((count) => {
      setUsersCount(count);
    });
    fetchUserCount(true).then((count) => {
      setAdminsCount(count);
    });
    fetchUsers()
      .then((resUsers) => {
        setUserList(resUsers);
        if (teams.length <= 0) {
          fetchTeams();
        }
      })
      .catch(() => {
        // ignore exception handling, as its handled in previous promises.
      });
  }, []);

  const isLoaded = () => {
    return (
      !isLoading && !isDataLoading && Boolean(activeUserTab || currentTeam)
    );
  };

  const render = () => {
    return (
      <TeamsAndUsers
        activeUserTab={activeUserTab}
        activeUserTabHandler={activeUserTabHandler}
        addUsersToTeam={addUsersToTeam}
        adminsCount={adminsCount}
        afterDeleteAction={afterDeleteAction}
        changeCurrentTeam={changeCurrentTeam}
        createNewTeam={createNewTeam}
        currentTeam={currentTeam || ({} as Team)}
        currentTeamUserPage={currentTeamUserPage}
        currentTeamUsers={currentTeamUsers}
        currentUserPage={currentUserPage}
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
        isRightPannelLoading={isRightPanelLoading}
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
        userPaging={userPaging}
        userPagingHandler={userPagingHandler}
        userSearchTerm={userSearchTerm}
        usersCount={usersCount}
        onDescriptionUpdate={onDescriptionUpdate}
        onNewTeamDataChange={onNewTeamDataChange}
      />
    );
  };

  return (
    <PageContainerV1>{isLoaded() ? render() : <Loader />}</PageContainerV1>
  );
};

export default observer(TeamsAndUsersPage);
