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
import { useAuthContext } from '../../components/Auth/AuthProviders/AuthProvider';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/Loader/Loader';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import TeamDetailsV1 from '../../components/Team/TeamDetails/TeamDetailsV1';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import { CreateTeam, TeamType } from '../../generated/api/teams/createTeam';
import { EntityReference } from '../../generated/entity/data/table';
import { Team } from '../../generated/entity/teams/team';
import { Include } from '../../generated/type/include';
import { searchData } from '../../rest/miscAPI';
import {
  createTeam,
  getTeamByName,
  getTeams,
  patchTeamDetail,
} from '../../rest/teamsAPI';
import { updateUserDetail } from '../../rest/userAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getSettingPath, getTeamsWithFqnPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import AddTeamForm from './AddTeamForm';

const TeamsPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { fqn } = useParams<{ fqn: string }>();
  const [currentFqn, setCurrentFqn] = useState<string>('');
  const [childTeams, setChildTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team>({} as Team);

  const [isDataLoading, setIsDataLoading] = useState(0);

  const [showDeletedTeam, setShowDeletedTeam] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);

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
      const { data } = await getTeams({
        parentTeam: decodeURIComponent(parentTeam ?? '') ?? 'organization',
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
        parentTeam: decodeURIComponent(parentTeam ?? '') ?? 'organization',
        include: Include.All,
        fields: 'userCount,childrenCount,owns,parents',
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
        fields: 'parents',
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
          SearchIndex.ALL
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
      const data = await getTeamByName(name, {
        fields: 'users,parents,profile',
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
        fields: 'users,defaultRoles,policies,childrenCount,domain',
        include: Include.All,
      });

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

  const handleJoinTeamClick = (id: string, data: Operation[]) => {
    updateUserDetail(id, data)
      .then((res) => {
        if (res) {
          updateCurrentUser(res);

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
      : history.push(
          getSettingPath(getTeamsWithFqnPath(TeamType.Organization))
        );
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
        childTeams={childTeams}
        currentTeam={selectedTeam}
        descriptionHandler={descriptionHandler}
        entityPermissions={entityPermissions}
        handleAddTeam={handleAddTeam}
        handleAddUser={addUsersToTeam}
        handleJoinTeamClick={handleJoinTeamClick}
        handleLeaveTeamClick={handleLeaveTeamClick}
        isDescriptionEditable={isDescriptionEditable}
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
    </>
  );
};

export default TeamsPage;
