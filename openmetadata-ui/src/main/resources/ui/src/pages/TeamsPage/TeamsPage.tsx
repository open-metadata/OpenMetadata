/*
 *  Copyright 2022 Collate.
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
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { useAuthContext } from '../../components/Auth/AuthProviders/AuthProvider';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Loader from '../../components/Loader/Loader';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import { TeamsPageTab } from '../../components/Team/TeamDetails/team.interface';
import TeamDetailsV1 from '../../components/Team/TeamDetails/TeamDetailsV1';
import { ASSETS_INDEXES } from '../../constants/Assets.constants';
import { HTTP_STATUS_CODE } from '../../constants/auth.constants';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  pagingObject,
} from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import { CreateTeam, TeamType } from '../../generated/api/teams/createTeam';
import { EntityReference } from '../../generated/entity/data/table';
import { Team } from '../../generated/entity/teams/team';
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { SearchResponse } from '../../interface/search.interface';
import { searchData } from '../../rest/miscAPI';
import {
  createTeam,
  getTeamByName,
  getTeams,
  patchTeamDetail,
} from '../../rest/teamsAPI';
import { getUsers, updateUserDetail } from '../../rest/userAPI';
import { formatUsersResponse } from '../../utils/APIUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getSettingPath, getTeamsWithFqnPath } from '../../utils/RouterUtils';
import { getDecodedFqn, getEncodedFqn } from '../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import AddTeamForm from './AddTeamForm';

const TeamsPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { fqn } = useParams<{ fqn: string }>();
  const [currentFqn, setCurrentFqn] = useState<string>('');
  const [allTeam, setAllTeam] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team>({} as Team);
  const [users, setUsers] = useState<User[]>([]);
  const [userPaging, setUserPaging] = useState<Paging>(pagingObject);
  const [isDataLoading, setIsDataLoading] = useState(0);
  const [currentUserPage, setCurrentUserPage] = useState(INITIAL_PAGING_VALUE);
  const [showDeletedTeam, setShowDeletedTeam] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [userSearchValue, setUserSearchValue] = useState<string>('');
  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [assets, setAssets] = useState<number>(0);
  const [parentTeams, setParentTeams] = useState<Team[]>([]);
  const { updateCurrentUser } = useAuthContext();

  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isFetchingAdvancedDetails, setFetchingAdvancedDetails] =
    useState<boolean>(false);
  const [isFetchAllTeamAdvancedDetails, setFetchAllTeamAdvancedDetails] =
    useState<boolean>(false);

  const isGroupType = useMemo(
    () => selectedTeam.teamType === TeamType.Group,
    [selectedTeam]
  );

  const activeTab = useMemo(() => {
    const param = new URLSearchParams(location.search);

    return param.get('activeTab');
  }, [location.search]);

  const currentTab = useMemo(() => {
    if (activeTab) {
      return activeTab;
    }

    return isGroupType ? TeamsPageTab.USERS : TeamsPageTab.TEAMS;
  }, [activeTab, isGroupType]);

  const hasViewPermission = useMemo(
    () => entityPermissions.ViewAll || entityPermissions.ViewBasic,
    [entityPermissions]
  );

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

  const fetchAllTeamsBasicDetails = async (parentTeam?: string) => {
    try {
      const { data } = await getTeams(undefined, {
        parentTeam: decodeURIComponent(parentTeam ?? '') ?? 'organization',
        include: 'all',
      });

      const modifiedTeams: Team[] = data.map((team) => ({
        ...team,
        key: team.fullyQualifiedName,
        children: team.childrenCount && team.childrenCount > 0 ? [] : undefined,
      }));

      setAllTeam(modifiedTeams);
      setFetchAllTeamAdvancedDetails(true);
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    }
  };

  const fetchAllTeamsAdvancedDetails = async (
    loading = true,
    parentTeam?: string,
    updateChildNode = false
  ) => {
    loading && setIsDataLoading((isDataLoading) => ++isDataLoading);

    try {
      const { data } = await getTeams(
        ['userCount', 'childrenCount', 'owns', 'parents'],
        {
          parentTeam: decodeURIComponent(parentTeam ?? '') ?? 'organization',
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
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    } finally {
      setFetchAllTeamAdvancedDetails(false);
    }
    loading && setIsDataLoading((isDataLoading) => --isDataLoading);
  };

  /**
   * Make API call to fetch current team user data
   */
  const getCurrentTeamUsers = (
    team: string,
    paging = {} as { [key: string]: string },
    loadPage = true
  ) => {
    loadPage && setIsDataLoading((isDataLoading) => ++isDataLoading);
    getUsers({
      fields: 'teams,roles',
      limit: PAGE_SIZE_BASE,
      team: getDecodedFqn(team),
      ...paging,
    })
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
      .finally(() => {
        loadPage && setIsDataLoading((isDataLoading) => --isDataLoading);
      });
  };

  const getParentTeam = async (
    name: string,
    newTeam = false,
    loadPage = true
  ) => {
    setIsPageLoading(loadPage);
    try {
      const data = await getTeamByName(name, ['parents'], 'all');
      if (data) {
        setParentTeams((prev) => (newTeam ? [data] : [data, ...prev]));
        if (!isEmpty(data.parents) && data.parents?.[0].name) {
          await getParentTeam(data.parents[0].name, false, loadPage);
        }
      } else {
        throw t('server.unexpected-response');
      }
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    }
  };

  const fetchAssets = async () => {
    if (selectedTeam.id && isGroupType) {
      try {
        const res = await searchData(
          ``,
          0,
          0,
          `owner.id:${selectedTeam.id}`,
          '',
          '',
          ASSETS_INDEXES
        );
        const total = res?.data?.hits?.total.value ?? 0;
        setAssets(total);
      } catch (error) {
        // Error
      }
    }
  };

  const fetchTeamBasicDetails = async (name: string, loadPage = false) => {
    setIsPageLoading(loadPage);
    try {
      const data = await getTeamByName(
        name,
        ['owner', 'parents', 'profile'],
        'all'
      );

      setSelectedTeam(data);
      if (!isEmpty(data.parents) && data.parents?.[0].name) {
        await getParentTeam(data.parents[0].name, true, loadPage);
      }
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    } finally {
      setIsPageLoading(false);
    }
  };

  const fetchTeamAdvancedDetails = async (name: string) => {
    setFetchingAdvancedDetails(true);
    try {
      const data = await getTeamByName(
        name,
        ['users', 'defaultRoles', 'policies', 'childrenCount', 'domain'],
        'all'
      );

      setSelectedTeam((prev) => ({ ...prev, ...data }));
      fetchAssets();
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    } finally {
      setFetchingAdvancedDetails(false);
    }
  };

  /**
   * Take Team data as input and create the team
   * @param data - Team Data
   */
  const createNewTeam = async (data: Team) => {
    try {
      setIsLoading(true);
      const teamData: CreateTeam = {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        teamType: data.teamType as TeamType,
        parents: fqn ? [selectedTeam.id] : undefined,
        email: data.email || undefined,
      };
      const res = await createTeam(teamData);
      if (res) {
        fetchTeamBasicDetails(selectedTeam.name, true);
        handleAddTeam(false);
      }
    } catch (error) {
      if (
        (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
      ) {
        showErrorToast(
          t('server.entity-already-exist', {
            entity: t('label.team'),
            entityPlural: t('label.team-plural-lowercase'),
            name: data.name,
          })
        );
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.create-entity-error', {
            entity: t('label.team-lowercase'),
          })
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = (text: string, currentPage: number) => {
    setIsDataLoading((isDataLoading) => ++isDataLoading);
    searchData(
      text,
      currentPage,
      PAGE_SIZE_BASE,
      `(teams.id:${selectedTeam?.id})`,
      '',
      '',
      SearchIndex.USER
    )
      .then((res) => {
        const data = formatUsersResponse(
          (res.data as SearchResponse<SearchIndex.USER>).hits.hits
        );
        setUsers(data);
        setUserPaging({
          total: res.data.hits.total.value,
        });
      })
      .catch(() => {
        setUsers([]);
      })
      .finally(() => setIsDataLoading((isDataLoading) => --isDataLoading));
  };

  const updateTeamHandler = async (updatedData: Team) => {
    const jsonPatch = compare(selectedTeam, updatedData);

    try {
      const res = await patchTeamDetail(selectedTeam.id, jsonPatch);
      setSelectedTeam(res);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.team'),
        })
      );
    }
  };

  const userPagingHandler = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (userSearchValue) {
      setCurrentUserPage(currentPage);
      searchUsers(userSearchValue, currentPage);
    } else if (cursorType) {
      setCurrentUserPage(currentPage);
      getCurrentTeamUsers(selectedTeam.name, {
        [cursorType]: userPaging[cursorType] as string,
      });
    }
  };

  const handleJoinTeamClick = (id: string, data: Operation[]) => {
    updateUserDetail(id, data)
      .then((res) => {
        if (res) {
          updateCurrentUser(res);
          AppState.updateUserDetails(res);
          setSelectedTeam((prev) => ({ ...prev, ...res }));
          showSuccessToast(t('server.join-team-success'), 2000);
        } else {
          throw t('server.join-team-error');
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, t('server.join-team-error'));
      });
  };

  const handleLeaveTeamClick = (id: string, data: Operation[]) => {
    return new Promise<void>((resolve) => {
      updateUserDetail(id, data)
        .then((res) => {
          if (res) {
            updateCurrentUser(res);
            AppState.updateUserDetails(res);
            setSelectedTeam((prev) => ({ ...prev, ...res }));
            showSuccessToast(t('server.leave-team-success'), 2000);
            resolve();
          } else {
            throw t('server.leave-team-error');
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(err, t('server.leave-team-error'));
        });
    });
  };

  /**
   * Take users data as input and add users to team
   * @param data
   */
  const addUsersToTeam = async (data: Array<EntityReference>) => {
    if (!isUndefined(selectedTeam) && !isUndefined(selectedTeam.users)) {
      const updatedTeam = {
        ...selectedTeam,
        users: data,
      };
      const jsonPatch = compare(selectedTeam, updatedTeam);
      try {
        const res = await patchTeamDetail(selectedTeam.id, jsonPatch);
        setSelectedTeam((prev) => ({ ...prev, ...res }));
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.team'),
          })
        );
      }
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
            setSelectedTeam((prev) => ({ ...prev, ...res }));
          } else {
            throw t('server.unexpected-response');
          }
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            t('server.entity-updating-error', {
              entity: t('label.team'),
            })
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
          setSelectedTeam((prev) => ({ ...prev, ...response }));
        } else {
          throw t('server.unexpected-response');
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

  const toggleShowDeletedTeam = () => {
    setShowDeletedTeam((pre) => !pre);
  };

  useEffect(() => {
    if (hasViewPermission && currentFqn !== fqn) {
      if (fqn) {
        fetchTeamBasicDetails(fqn, true);
      }
      setCurrentFqn(fqn);
    }
  }, [entityPermissions, fqn]);

  useEffect(() => {
    fetchPermissions(fqn);
  }, [fqn]);

  useEffect(() => {
    if (currentTab === TeamsPageTab.USERS) {
      getCurrentTeamUsers(getEncodedFqn(selectedTeam.name), {}, false);
    } else {
      setUserPaging(pagingObject);
    }
  }, [selectedTeam, currentTab]);

  useEffect(() => {
    if (!isPageLoading && hasViewPermission && fqn) {
      fetchTeamAdvancedDetails(fqn);
      fetchAllTeamsBasicDetails(fqn);
    }
  }, [isPageLoading, entityPermissions, fqn]);

  useEffect(() => {
    if (isFetchAllTeamAdvancedDetails && fqn) {
      fetchAllTeamsAdvancedDetails(false, fqn);
    }
  }, [isFetchAllTeamAdvancedDetails, fqn]);

  if (isPageLoading) {
    return <Loader />;
  }

  if (!hasViewPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (isEmpty(selectedTeam)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <>
      <TeamDetailsV1
        afterDeleteAction={afterDeleteAction}
        assetsCount={assets}
        childTeams={allTeam}
        currentTeam={selectedTeam}
        currentTeamUserPage={currentUserPage}
        currentTeamUsers={users}
        descriptionHandler={descriptionHandler}
        entityPermissions={entityPermissions}
        handleAddTeam={handleAddTeam}
        handleAddUser={addUsersToTeam}
        handleCurrentUserPage={handleCurrentUserPage}
        handleJoinTeamClick={handleJoinTeamClick}
        handleLeaveTeamClick={handleLeaveTeamClick}
        handleTeamUsersSearchAction={handleUsersSearchAction}
        isDescriptionEditable={isDescriptionEditable}
        isFetchingAdvancedDetails={isFetchingAdvancedDetails}
        isFetchingAllTeamAdvancedDetails={isFetchAllTeamAdvancedDetails}
        isTeamMemberLoading={isDataLoading}
        parentTeams={parentTeams}
        removeUserFromTeam={removeUserFromTeam}
        showDeletedTeam={showDeletedTeam}
        teamUserPaging={userPaging}
        teamUserPagingHandler={userPagingHandler}
        teamUsersSearchText={userSearchValue}
        updateTeamHandler={updateTeamHandler}
        onDescriptionUpdate={onDescriptionUpdate}
        onShowDeletedTeamChange={toggleShowDeletedTeam}
        onTeamExpand={fetchAllTeamsAdvancedDetails}
      />
      {selectedTeam.teamType && (
        <AddTeamForm
          isLoading={isLoading}
          parentTeamType={selectedTeam.teamType}
          visible={isAddingTeam}
          onCancel={() => setIsAddingTeam(false)}
          onSave={(data) => createNewTeam(data)}
        />
      )}
    </>
  );
};

export default TeamsPage;
