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

import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { cloneDeep, isUndefined } from 'lodash';
import { SearchResponse } from 'Models';
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
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../../components/Loader/Loader';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import TeamDetailsV1 from '../../components/TeamDetails/TeamDetailsV1';
import Teams from '../../components/TeamDetails/Teams';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
  pagingObject,
} from '../../constants/constants';
import { NO_PERMISSION_TO_VIEW } from '../../constants/HelperTextUtil';
import { SearchIndex } from '../../enums/search.enum';
import { CreateTeam, TeamType } from '../../generated/api/teams/createTeam';
import { EntityReference } from '../../generated/entity/data/table';
import { Team } from '../../generated/entity/teams/team';
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { formatUsersResponse } from '../../utils/APIUtils';
import { getEntityName } from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getSettingPath, getTeamsWithFqnPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import AddTeamForm from './AddTeamForm';
import AddUsersModalV1 from './AddUsersModalV1';

const TeamsPage = () => {
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const { fqn } = useParams<{ [key: string]: string }>();
  const [allTeam, setAllTeam] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team>({} as Team);
  const [users, setUsers] = useState<User[]>([]);
  const [userPaging, setUserPaging] = useState<Paging>(pagingObject);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [currentUserPage, setCurrentUserPage] = useState(INITIAL_PAGING_VALUE);
  const [showDeletedTeam, setShowDeletedTeam] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [userSearchValue, setUserSearchValue] = useState<string>('');
  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);
  const [isAddingUsers, setIsAddingUsers] = useState<boolean>(false);

  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const fetchPermissions = async (entityFqn: string) => {
    setIsPageLoading(true);
    try {
      const perms = await getEntityPermissionByFqn(
        ResourceEntity.TEAM,
        entityFqn
      );
      setEntityPermissions(perms);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPageLoading(false);
    }
  };

  const descriptionHandler = (value: boolean) => {
    setIsDescriptionEditable(value);
  };

  const handleAddTeam = (value: boolean) => {
    setIsAddingTeam(value);
  };

  const handleAddUsers = (value: boolean) => {
    setIsAddingUsers(value);
  };

  const updateTeamsHierarchy = (
    teams: Team[],
    parentTeam: string,
    data: Team[]
  ) => {
    for (const team of teams) {
      if (team.fullyQualifiedName === parentTeam) {
        team.children = data as EntityReference[];

        break;
      } else if (team.children && team.children.length > 0) {
        updateTeamsHierarchy(team.children as Team[], parentTeam, data);
      }
    }
  };

  const fetchAllTeams = async (
    isPageLoading = true,
    parentTeam?: string,
    updateChildNode = false
  ) => {
    isPageLoading && setIsPageLoading(true);
    try {
      const { data } = await getTeams(
        ['defaultRoles', 'userCount', 'childrenCount'],
        {
          parentTeam: parentTeam ?? 'organization',
          include: 'all',
        }
      );

      const modifiedTeams: Team[] = data.map((team) => ({
        ...team,
        key: team.fullyQualifiedName,
        children: team.childrenCount && team.childrenCount > 0 ? [] : undefined,
      }));

      if (updateChildNode) {
        const allTeamsData = cloneDeep(allTeam);
        updateTeamsHierarchy(allTeamsData, parentTeam || '', modifiedTeams);
        setAllTeam(allTeamsData);
      } else {
        setAllTeam(modifiedTeams);
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
   * Take Team data as input and create the team
   * @param data - Team Data
   */
  const createNewTeam = async (data: Team) => {
    try {
      const teamData: CreateTeam = {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        teamType: data.teamType as TeamType,
        parents: fqn ? [selectedTeam.id] : undefined,
      };
      const res = await createTeam(teamData);
      if (res) {
        const parent = fqn ? selectedTeam.fullyQualifiedName : undefined;
        handleAddTeam(false);
        fetchAllTeams(true, parent);
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['create-team-error']
      );
    }
  };

  /**
   * Make API call to fetch current team user data
   */
  const getCurrentTeamUsers = (
    team: string,
    paging = {} as { [key: string]: string }
  ) => {
    setIsDataLoading(true);
    getUsers('teams,roles', PAGE_SIZE_MEDIUM, { team, ...paging })
      .then((res) => {
        if (res.data) {
          setUsers(res.data);
          setUserPaging(res.paging);
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
      const data = await getTeamByName(
        name,
        [
          'users',
          'owns',
          'defaultRoles',
          'policies',
          'owner',
          'parents',
          'childrenCount',
        ],
        'all'
      );

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
      PAGE_SIZE_MEDIUM,
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

  const updateTeamHandler = (updatedData: Team, fetchTeam = true) => {
    const jsonPatch = compare(selectedTeam, updatedData);

    return new Promise<void>((resolve, reject) => {
      patchTeamDetail(selectedTeam.id, jsonPatch)
        .then((res) => {
          if (res) {
            if (fetchTeam) {
              fetchTeamByFqn(selectedTeam.name);
            } else {
              setSelectedTeam((previous) => ({ ...previous, ...res }));
            }
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
      .then((res) => {
        if (res) {
          AppState.updateUserDetails(res);
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
        .then((res) => {
          if (res) {
            AppState.updateUserDetails(res);
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
        .then((res) => {
          if (res) {
            fetchTeamByFqn(res.name);
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
        .then((res) => {
          if (res) {
            fetchTeamByFqn(res.name);
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

  const handleCurrentUserPage = (value?: number) => {
    setCurrentUserPage(value ?? INITIAL_PAGING_VALUE);
  };

  const handleUsersSearchAction = (text: string) => {
    setUserSearchValue(text);
    setCurrentUserPage(INITIAL_PAGING_VALUE);
    if (text) {
      searchUsers(text, INITIAL_PAGING_VALUE);
    } else {
      getCurrentTeamUsers(selectedTeam.name);
    }
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (selectedTeam.description !== updatedHTML) {
      const updatedTeam = { ...selectedTeam, description: updatedHTML };
      const jsonPatch = compare(selectedTeam, updatedTeam);
      try {
        const response = await patchTeamDetail(selectedTeam.id, jsonPatch);
        if (response) {
          fetchTeamByFqn(response.name);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        descriptionHandler(false);
      }
    } else {
      descriptionHandler(false);
    }
  };

  const afterDeleteAction = () => {
    history.push(getSettingPath(getTeamsWithFqnPath(TeamType.Organization)));
  };

  const handleShowDeletedTeam = (checked: boolean) => {
    setShowDeletedTeam(checked);
  };

  useEffect(() => {
    if (entityPermissions.ViewAll) {
      if (fqn) {
        fetchTeamByFqn(fqn);
      }
      fetchAllTeams(false, fqn);
    }
  }, [entityPermissions, fqn]);

  useEffect(() => {
    fetchPermissions(fqn);
  }, [fqn]);

  if (isPageLoading) {
    return <Loader />;
  }

  return (
    <>
      {entityPermissions.ViewAll ? (
        <>
          {isUndefined(fqn) ? (
            <Teams
              data={allTeam}
              showDeletedTeam={showDeletedTeam}
              onAddTeamClick={handleAddTeam}
              onShowDeletedTeamChange={handleShowDeletedTeam}
              onTeamExpand={fetchAllTeams}
            />
          ) : (
            <TeamDetailsV1
              afterDeleteAction={afterDeleteAction}
              childTeams={allTeam}
              currentTeam={selectedTeam}
              currentTeamUserPage={currentUserPage}
              currentTeamUsers={users}
              descriptionHandler={descriptionHandler}
              handleAddTeam={handleAddTeam}
              handleAddUser={handleAddUsers}
              handleCurrentUserPage={handleCurrentUserPage}
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
              onTeamExpand={fetchAllTeams}
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

          <AddTeamForm
            visible={isAddingTeam}
            onCancel={() => setIsAddingTeam(false)}
            onSave={(data) => createNewTeam(data as Team)}
          />
        </>
      ) : (
        <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>
      )}
    </>
  );
};

export default TeamsPage;
