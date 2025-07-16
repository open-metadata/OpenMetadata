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
import { cloneDeep, filter, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import TeamDetailsV1 from '../../components/Settings/Team/TeamDetails/TeamDetailsV1';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { CreateTeam, TeamType } from '../../generated/api/teams/createTeam';
import { EntityReference } from '../../generated/entity/data/table';
import { Operation as PermissionOperation } from '../../generated/entity/policies/policy';
import { Team } from '../../generated/entity/teams/team';
import { Include } from '../../generated/type/include';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { searchData } from '../../rest/miscAPI';
import {
  createTeam,
  deleteUserFromTeam,
  getTeamByName,
  getTeams,
  patchTeamDetail,
  updateUsersFromTeam,
} from '../../rest/teamsAPI';
import { updateUserDetail } from '../../rest/userAPI';
import { getEntityReferenceFromEntity } from '../../utils/EntityUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getTeamsWithFqnPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import AddTeamForm from './AddTeamForm';

const TeamsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { fqn } = useFqn();
  const [childTeams, setChildTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team>({} as Team);

  const [isDataLoading, setIsDataLoading] = useState(0);

  const [showDeletedTeam, setShowDeletedTeam] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);

  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [assets, setAssets] = useState<number>(0);
  const [parentTeams, setParentTeams] = useState<Team[]>([]);
  const { updateCurrentUser } = useApplicationStore();

  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isFetchingAdvancedDetails, setFetchingAdvancedDetails] =
    useState<boolean>(true);
  const [isFetchAllTeamAdvancedDetails, setFetchAllTeamAdvancedDetails] =
    useState<boolean>(false);

  const hasViewPermission = useMemo(
    () =>
      getPrioritizedViewPermission(
        entityPermissions,
        PermissionOperation.ViewBasic
      ),
    [entityPermissions]
  );

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
      const { data } = await getTeams({
        parentTeam: parentTeam ?? 'organization',
        include: Include.All,
      });

      const modifiedTeams: Team[] = data.map((team) => ({
        ...team,
        key: team.fullyQualifiedName,
        children: team.childrenCount && team.childrenCount > 0 ? [] : undefined,
      }));

      setChildTeams(modifiedTeams);
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
      const { data } = await getTeams({
        parentTeam: parentTeam ?? 'organization',
        include: Include.All,
        fields: [
          TabSpecificField.USER_COUNT,
          TabSpecificField.CHILDREN_COUNT,
          TabSpecificField.OWNS,
          TabSpecificField.PARENTS,
        ],
      });

      const modifiedTeams: Team[] = data.map((team) => ({
        ...team,
        key: team.fullyQualifiedName,
        children: team.childrenCount && team.childrenCount > 0 ? [] : undefined,
      }));

      if (updateChildNode) {
        const allTeamsData = cloneDeep(childTeams);
        updateTeamsHierarchy(allTeamsData, parentTeam || '', modifiedTeams);
        setChildTeams(allTeamsData);
      } else {
        setChildTeams(modifiedTeams);
      }
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    } finally {
      setFetchAllTeamAdvancedDetails(false);
    }
    loading && setIsDataLoading((isDataLoading) => --isDataLoading);
  };

  const getParentTeam = async (
    name: string,
    newTeam = false,
    loadPage = true
  ) => {
    setIsPageLoading(loadPage);
    try {
      const data = await getTeamByName(name, {
        fields: TabSpecificField.PARENTS,
        include: Include.All,
      });
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

  const fetchAssets = async (selectedTeam: Team) => {
    if (selectedTeam.id && selectedTeam.teamType === TeamType.Group) {
      try {
        const res = await searchData(
          ``,
          0,
          0,
          `owners.id:${selectedTeam.id}`,
          '',
          '',
          SearchIndex.ALL
        );
        const total = res?.data?.hits?.total.value ?? 0;
        setAssets(total);
      } catch {
        // Error
      }
    }
  };

  const fetchTeamBasicDetails = async (name: string, loadPage = false) => {
    setIsPageLoading(loadPage);
    try {
      const data = await getTeamByName(name, {
        fields: [
          TabSpecificField.USER_COUNT,
          TabSpecificField.PARENTS,
          TabSpecificField.PROFILE,
          TabSpecificField.OWNERS,
        ],
        include: Include.All,
      });

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
      const data = await getTeamByName(name, {
        fields: [
          TabSpecificField.USERS,
          TabSpecificField.DEFAULT_ROLES,
          TabSpecificField.POLICIES,
          TabSpecificField.CHILDREN_COUNT,
          TabSpecificField.DOMAINS,
        ],
        include: Include.All,
      });

      setSelectedTeam((prev) => ({ ...prev, ...data }));
      fetchAssets(data);
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    } finally {
      setFetchingAdvancedDetails(false);
    }
  };

  const loadAdvancedDetails = useCallback(() => {
    fetchTeamAdvancedDetails(fqn);
    fetchAllTeamsBasicDetails(fqn);
  }, [fqn]);

  /**
   * Take Team data as input and create the team
   * @param data - Team Data
   */
  const createNewTeam = async (data: Team) => {
    try {
      setIsLoading(true);
      const domains =
        data?.domains?.map((domain) => domain.fullyQualifiedName ?? '') ?? [];
      const teamData: CreateTeam = {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        teamType: data.teamType as TeamType,
        parents: fqn ? [selectedTeam.id] : undefined,
        email: data.email || undefined,
        domains,
        isJoinable: data.isJoinable,
      };

      const res = await createTeam(teamData);
      if (res) {
        handleAddTeam(false);
        await fetchTeamBasicDetails(selectedTeam.name, true);
        loadAdvancedDetails();
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

  const handleJoinTeamClick = async (id: string, data: Operation[]) => {
    try {
      const response = await updateUserDetail(id, data);
      const currentUser = getEntityReferenceFromEntity(
        response,
        EntityType.USER
      );
      setSelectedTeam((prev) => ({
        ...prev,
        users: prev.users ? [currentUser, ...prev.users] : [currentUser],
      }));
      updateCurrentUser(response);
      showSuccessToast(t('server.join-team-success'), 2000);
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.join-team-error'));
    }
  };

  const handleLeaveTeamClick = async (id: string, data: Operation[]) => {
    try {
      const response = await updateUserDetail(id, data);
      updateCurrentUser(response);
      setSelectedTeam((prev) => ({
        ...prev,
        users: filter(prev.users, (user) => user.id !== response.id),
      }));
      showSuccessToast(t('server.leave-team-success'), 2000);
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.leave-team-error'));
    }
  };

  /**
   * Take users data as input and add users to team
   * @param data
   */
  const addUsersToTeam = async (data: Array<EntityReference>) => {
    if (!isUndefined(selectedTeam)) {
      try {
        const res = await updateUsersFromTeam(selectedTeam.id, data);
        if (res) {
          setSelectedTeam((prev) => ({
            ...prev,
            users: data,
            userCount: data.length,
          }));
        } else {
          throw new Error(t('server.unexpected-response'));
        }
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
  const removeUserFromTeam = async (id: string) => {
    const updatedUsers = selectedTeam?.users?.filter((user) => user.id !== id);
    try {
      const res = await deleteUserFromTeam(selectedTeam.id, id);
      if (res) {
        setSelectedTeam((prev) => ({
          ...prev,
          users: updatedUsers,
          userCount: updatedUsers?.length,
        }));
      } else {
        throw new Error(t('server.unexpected-response'));
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.team'),
        })
      );
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
      }
    }
  };

  const handleToggleDelete = () => {
    setSelectedTeam((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
      };
    });
    setChildTeams((prev) =>
      prev.map((currTeam) => ({
        ...currTeam,
        deleted: !currTeam?.deleted,
      }))
    );
  };

  const afterDeleteAction = (isSoftDelete?: boolean) => {
    isSoftDelete
      ? handleToggleDelete()
      : navigate(getTeamsWithFqnPath(TeamType.Organization));
  };

  const toggleShowDeletedTeam = () => {
    setShowDeletedTeam((pre) => !pre);
  };

  const init = useCallback(async () => {
    setIsPageLoading(true);
    try {
      const teamPermissions = await getEntityPermissionByFqn(
        ResourceEntity.TEAM,
        fqn
      );
      setEntityPermissions(teamPermissions);
      if (
        getPrioritizedViewPermission(
          teamPermissions,
          PermissionOperation.ViewBasic
        )
      ) {
        await fetchTeamBasicDetails(fqn, true);
        loadAdvancedDetails();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPageLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    init();
  }, [fqn]);

  useEffect(() => {
    if (isFetchAllTeamAdvancedDetails && fqn) {
      fetchAllTeamsAdvancedDetails(false, fqn);
    }
  }, [isFetchAllTeamAdvancedDetails, fqn]);

  if (isPageLoading) {
    return <Loader />;
  }

  if (!hasViewPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.team-plural'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (isEmpty(selectedTeam)) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
      />
    );
  }

  return (
    <PageLayoutV1 pageTitle={t('label.team-plural')}>
      <TeamDetailsV1
        afterDeleteAction={afterDeleteAction}
        assetsCount={assets}
        childTeams={childTeams}
        currentTeam={selectedTeam}
        entityPermissions={entityPermissions}
        handleAddTeam={handleAddTeam}
        handleAddUser={addUsersToTeam}
        handleJoinTeamClick={handleJoinTeamClick}
        handleLeaveTeamClick={handleLeaveTeamClick}
        isFetchingAdvancedDetails={isFetchingAdvancedDetails}
        isFetchingAllTeamAdvancedDetails={isFetchAllTeamAdvancedDetails}
        isTeamMemberLoading={isDataLoading}
        parentTeams={parentTeams}
        removeUserFromTeam={removeUserFromTeam}
        showDeletedTeam={showDeletedTeam}
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
    </PageLayoutV1>
  );
};

export default TeamsPage;
