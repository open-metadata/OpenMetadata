/*
 *  Copyright 2023 Collate.
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
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import { EntityTags } from 'Models';
import {
  default as React,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAuthContext } from '../../components/Auth/AuthProviders/AuthProvider';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import DataModelDetails from '../../components/DataModels/DataModelDetails.component';
import Loader from '../../components/Loader/Loader';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import { QueryVote } from '../../components/TableQueries/TableQueries.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Tag } from '../../generated/entity/classification/tag';
import { DashboardDataModel } from '../../generated/entity/data/dashboardDataModel';
import { Include } from '../../generated/type/include';
import {
  addDataModelFollower,
  getDataModelsByName,
  patchDataModelDetails,
  removeDataModelFollower,
  updateDataModelVotes,
} from '../../rest/dataModelsAPI';
import { postThread } from '../../rest/feedsAPI';
import {
  getEntityMissingError,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import { getSortedDataModelColumnTags } from '../../utils/DataModelsUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTierTags } from '../../utils/TableUtils';
import { updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DataModelsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { fqn: dashboardDataModelFQN } = useParams<{ fqn: string }>();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [dataModelPermissions, setDataModelPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [dataModelData, setDataModelData] = useState<DashboardDataModel>(
    {} as DashboardDataModel
  );

  const { hasViewPermission } = useMemo(() => {
    return {
      hasViewPermission:
        dataModelPermissions.ViewAll || dataModelPermissions.ViewBasic,
    };
  }, [dataModelPermissions]);

  const { tier, isUserFollowing } = useMemo(() => {
    return {
      tier: getTierTags(dataModelData?.tags ?? []),
      isUserFollowing: dataModelData?.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ),
    };
  }, [dataModelData, currentUser]);

  const fetchResourcePermission = async (dashboardDataModelFQN: string) => {
    setIsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.DASHBOARD_DATA_MODEL,
        dashboardDataModelFQN
      );
      setDataModelPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };
  const fetchDataModelDetails = async (dashboardDataModelFQN: string) => {
    setIsLoading(true);
    try {
      const response = await getDataModelsByName(
        dashboardDataModelFQN,
        'owner,tags,followers,votes,domain,dataProducts',
        Include.All
      );
      setDataModelData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDataModelData = (updatedData: DashboardDataModel) => {
    const jsonPatch = compare(omitBy(dataModelData, isUndefined), updatedData);

    return patchDataModelDetails(dataModelData?.id ?? '', jsonPatch);
  };

  const handleUpdateDescription = async (updatedDescription: string) => {
    try {
      const { description: newDescription, version } =
        await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          description: updatedDescription,
        });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        description: newDescription,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleFollowDataModel = async () => {
    const followerId = currentUser?.id ?? '';
    const dataModelId = dataModelData?.id ?? '';
    try {
      if (isUserFollowing) {
        const response = await removeDataModelFollower(dataModelId, followerId);
        const { oldValue } = response.changeDescription.fieldsDeleted[0];

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          followers: (dataModelData?.followers || []).filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        }));
      } else {
        const response = await addDataModelFollower(dataModelId, followerId);
        const { newValue } = response.changeDescription.fieldsAdded[0];

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          followers: [...(dataModelData?.followers ?? []), ...newValue],
        }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateTags = async (selectedTags: Array<EntityTags> = []) => {
    try {
      const { tags: newTags, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        tags: [...(tier ? [tier] : []), ...selectedTags],
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        tags: sortTagsCaseInsensitive(newTags ?? []),
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (updatedOwner?: DashboardDataModel['owner']) => {
      try {
        const { owner: newOwner, version } = await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          owner: updatedOwner ? updatedOwner : undefined,
        });

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          owner: newOwner,
          version,
        }));
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [dataModelData, dataModelData?.owner]
  );

  const handleUpdateTier = async (updatedTier?: Tag) => {
    try {
      const tags = updateTierTag(dataModelData?.tags ?? [], updatedTier);
      const { tags: newTags, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        tags,
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        tags: newTags,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleColumnUpdateDataModel = async (
    updatedDataModel: DashboardDataModel['columns']
  ) => {
    try {
      const { columns: newColumns, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        columns: updatedDataModel,
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        columns: getSortedDataModelColumnTags(newColumns),
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateDataModel = async (
    updatedDataModel: DashboardDataModel,
    key: keyof DashboardDataModel
  ) => {
    try {
      const response = await handleUpdateDataModelData(updatedDataModel);

      setDataModelData((prev) => ({
        ...prev,
        [key]: response[key],
        version: response.version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleToggleDelete = (version?: number) => {
    setDataModelData((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });
  };

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateDataModelVotes(id, data);
      const details = await getDataModelsByName(
        dashboardDataModelFQN,
        'owner,tags,followers,votes,domain,dataProducts',
        Include.All
      );
      setDataModelData(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateDataModelDetailsState = useCallback((data) => {
    const updatedData = data as DashboardDataModel;

    setDataModelData((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

  useEffect(() => {
    if (hasViewPermission) {
      fetchDataModelDetails(dashboardDataModelFQN);
    }
  }, [dashboardDataModelFQN, dataModelPermissions]);

  useEffect(() => {
    fetchResourcePermission(dashboardDataModelFQN);
  }, [dashboardDataModelFQN]);

  // Rendering
  if (isLoading) {
    return <Loader />;
  }

  if (hasError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(t('label.data-model'), dashboardDataModelFQN)}
      </ErrorPlaceHolder>
    );
  }

  if (!hasViewPermission && !isLoading) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <DataModelDetails
      createThread={createThread}
      dataModelData={dataModelData}
      dataModelPermissions={dataModelPermissions}
      fetchDataModel={() => fetchDataModelDetails(dashboardDataModelFQN)}
      handleColumnUpdateDataModel={handleColumnUpdateDataModel}
      handleFollowDataModel={handleFollowDataModel}
      handleToggleDelete={handleToggleDelete}
      handleUpdateDescription={handleUpdateDescription}
      handleUpdateOwner={handleUpdateOwner}
      handleUpdateTags={handleUpdateTags}
      handleUpdateTier={handleUpdateTier}
      updateDataModelDetailsState={updateDataModelDetailsState}
      onUpdateDataModel={handleUpdateDataModel}
      onUpdateVote={updateVote}
    />
  );
};

export default DataModelsPage;
