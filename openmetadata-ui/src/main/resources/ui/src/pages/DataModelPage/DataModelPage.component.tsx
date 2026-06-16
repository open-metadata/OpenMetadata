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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import DataModelDetails from '../../components/Dashboard/DataModel/DataModels/DataModelDetails.component';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
    OperationPermission,
    ResourceEntity
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { DashboardDataModel } from '../../generated/entity/data/dashboardDataModel';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
    addDataModelFollower,
    patchDataModelDetails,
    removeDataModelFollower,
    updateDataModelVotes
} from '../../rest/dataModelsAPI';
import {
    dashboardDataModelQueryFn,
    dashboardDataModelQueryKey
} from '../../rest/queries/dashboardDataModelQuery';
import { getEntityMissingError } from '../../utils/EntityDisplayUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { updateTierTag } from '../../utils/TagsPureUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DATA_MODEL_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.VOTES,
  TabSpecificField.DOMAINS,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.EXTENSION,
].join(',');

const DataModelsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const queryClient = useQueryClient();

  const { entityFqn: dashboardDataModelFQN } = useFqn({
    type: EntityType.DASHBOARD_DATA_MODEL,
  });

  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true);
  const [dataModelPermissions, setDataModelPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const { hasViewPermission } = useMemo(() => {
    return {
      hasViewPermission:
        dataModelPermissions.ViewAll || dataModelPermissions.ViewBasic,
    };
  }, [dataModelPermissions]);

  const dataModelCacheKey = useMemo(
    () => dashboardDataModelQueryKey(dashboardDataModelFQN, DATA_MODEL_FIELDS),
    [dashboardDataModelFQN]
  );

  const {
    data: dataModelData,
    isLoading: dataModelLoading,
    error: dataModelError,
  } = useQuery({
    queryKey: dataModelCacheKey,
    queryFn: dashboardDataModelQueryFn(
      dashboardDataModelFQN,
      DATA_MODEL_FIELDS
    ),
    enabled: Boolean(
      dashboardDataModelFQN && hasViewPermission && !permissionsLoading
    ),
  });

  const isError = useMemo(
    () => (dataModelError as AxiosError | undefined)?.response?.status === 404,
    [dataModelError]
  );

  useEffect(() => {
    const status = (dataModelError as AxiosError | undefined)?.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    } else if (dataModelError && status !== 404) {
      showErrorToast(dataModelError as AxiosError);
    }
  }, [dataModelError, navigate]);

  useEffect(() => {
    if (!dataModelData) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(dataModelData),
      entityType: EntityType.DASHBOARD_DATA_MODEL,
      fqn: dataModelData.fullyQualifiedName ?? '',
      serviceType: dataModelData.serviceType,
      timestamp: 0,
      id: dataModelData.id,
    });
  }, [dataModelData]);

  const setDataModelData = useCallback(
    (
      updater:
        | DashboardDataModel
        | undefined
        | ((
            prev: DashboardDataModel | undefined
          ) => DashboardDataModel | undefined)
    ) => {
      queryClient.setQueryData<DashboardDataModel | undefined>(
        dataModelCacheKey,
        updater
      );
    },
    [queryClient, dataModelCacheKey]
  );

  const refetchDataModelDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: dataModelCacheKey }),
    [queryClient, dataModelCacheKey]
  );

  const isUserFollowing = useMemo(
    () =>
      dataModelData?.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ) ?? false,
    [dataModelData?.followers, currentUser?.id]
  );

  // See DashboardDetailsPage for the rationale on NOT using useCallback here.
  const fetchResourcePermission = async (entityFqn: string) => {
    setPermissionsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.DASHBOARD_DATA_MODEL,
        entityFqn
      );
      setDataModelPermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleUpdateDataModelData = useCallback(
    (updatedData: DashboardDataModel) => {
      const jsonPatch = compare(
        omitBy(dataModelData ?? {}, isUndefined),
        updatedData
      );

      return patchDataModelDetails(dataModelData?.id ?? '', jsonPatch);
    },
    [dataModelData]
  );

  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: DashboardDataModel | undefined }
  >({
    mutationFn: async () => {
      const dataModelId = dataModelData?.id ?? '';
      const followerId = currentUser?.id ?? '';
      if (isUserFollowing) {
        await removeDataModelFollower(dataModelId, followerId);
      } else {
        await addDataModelFollower(dataModelId, followerId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: dataModelCacheKey });
      const previous = queryClient.getQueryData<DashboardDataModel | undefined>(
        dataModelCacheKey
      );
      const followerId = currentUser?.id ?? '';
      queryClient.setQueryData<DashboardDataModel | undefined>(
        dataModelCacheKey,
        (prev) => {
          if (!prev) {
            return prev;
          }
          const currentFollowers = prev.followers ?? [];
          if (isUserFollowing) {
            return {
              ...prev,
              followers: currentFollowers.filter(({ id }) => id !== followerId),
            };
          }

          return {
            ...prev,
            followers: [
              ...currentFollowers,
              { id: followerId, type: 'user' },
            ] as DashboardDataModel['followers'],
          };
        }
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<DashboardDataModel | undefined>(
          dataModelCacheKey,
          context.previous
        );
      }
      showErrorToast(error as AxiosError);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dataModelCacheKey });
    },
  });

  const handleFollowDataModel = useCallback(async () => {
    try {
      await followMutation.mutateAsync();
    } catch {
      // Errors surfaced via mutation onError handler — swallow rethrow.
    }
  }, [followMutation]);

  const handleUpdateOwner = useCallback(
    async (updatedOwners?: DashboardDataModel['owners']) => {
      try {
        const { owners: newOwners, version } = await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          owners: updatedOwners,
        });

        setDataModelData((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            owners: newOwners,
            version,
          };
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [dataModelData, handleUpdateDataModelData, setDataModelData]
  );

  const handleUpdateTier = useCallback(
    async (updatedTier?: Tag) => {
      try {
        const tags = updateTierTag(dataModelData?.tags ?? [], updatedTier);
        const { tags: newTags, version } = await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          tags,
        });

        setDataModelData((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            tags: newTags,
            version,
          };
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [dataModelData, handleUpdateDataModelData, setDataModelData]
  );

  const handleUpdateDataModel = useCallback(
    async (
      updatedDataModel: DashboardDataModel,
      key?: keyof DashboardDataModel
    ) => {
      try {
        const response = await handleUpdateDataModelData(updatedDataModel);

        setDataModelData((prev) => {
          if (!prev) {
            return response;
          }

          return {
            ...response,
            ...(key && { [key]: response[key] }),
          };
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [handleUpdateDataModelData, setDataModelData]
  );

  const handleToggleDelete = useCallback(
    (version?: number) => {
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
    },
    [setDataModelData]
  );

  const updateVote = useCallback(
    async (data: QueryVote, id: string) => {
      try {
        await updateDataModelVotes(id, data);
        await queryClient.invalidateQueries({ queryKey: dataModelCacheKey });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [queryClient, dataModelCacheKey]
  );

  const updateDataModelDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as DashboardDataModel;
      setDataModelData((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setDataModelData]
  );

  useEffect(() => {
    fetchResourcePermission(dashboardDataModelFQN);
  }, [dashboardDataModelFQN]);

  if (permissionsLoading || dataModelLoading) {
    return <Loader />;
  }

  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(t('label.data-model'), dashboardDataModelFQN)}
      </ErrorPlaceHolder>
    );
  }

  if (!dataModelPermissions.ViewAll && !dataModelPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.data-model'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (!dataModelData) {
    return <Loader />;
  }

  return (
    <DataModelDetails
      dataModelData={dataModelData}
      dataModelPermissions={dataModelPermissions}
      fetchDataModel={refetchDataModelDetails}
      handleFollowDataModel={handleFollowDataModel}
      handleToggleDelete={handleToggleDelete}
      handleUpdateOwner={handleUpdateOwner}
      handleUpdateTier={handleUpdateTier}
      updateDataModelDetailsState={updateDataModelDetailsState}
      onUpdateDataModel={handleUpdateDataModel}
      onUpdateVote={updateVote}
    />
  );
};

export default DataModelsPage;
