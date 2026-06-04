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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import MlModelDetailComponent from '../../components/MlModel/MlModelDetail/MlModelDetail.component';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  patchMlModelDetails,
  removeFollower,
  updateMlModelVotes,
} from '../../rest/mlModelAPI';
import {
  mlModelQueryFn,
  mlModelQueryKey,
} from '../../rest/queries/mlModelQuery';
import { getEntityMissingError } from '../../utils/EntityDisplayUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { defaultFields } from '../../utils/MlModelDetailsUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const MlModelPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { entityFqn: mlModelFqn } = useFqn({ type: EntityType.MLMODEL });
  const USERId = currentUser?.id ?? '';

  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true);
  const [mlModelPermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermissionByFqn } = usePermissionProvider();

  const viewUsagePermission = useMemo(
    () =>
      getPrioritizedViewPermission(
        mlModelPermissions,
        PermissionOperation.ViewUsage
      ),
    [mlModelPermissions]
  );

  const canViewMlModel = useMemo(
    () =>
      getPrioritizedViewPermission(
        mlModelPermissions,
        PermissionOperation.ViewBasic
      ) === true,
    [mlModelPermissions]
  );

  const mlModelFields = useMemo(() => {
    let fields = defaultFields;
    if (viewUsagePermission) {
      fields += `,${TabSpecificField.USAGE_SUMMARY}`;
    }

    return fields;
  }, [viewUsagePermission]);

  const mlModelCacheKey = useMemo(
    () => mlModelQueryKey(mlModelFqn, mlModelFields),
    [mlModelFqn, mlModelFields]
  );

  const {
    data: mlModelDetail,
    isLoading: mlModelLoading,
    error: mlModelError,
  } = useQuery({
    queryKey: mlModelCacheKey,
    queryFn: mlModelQueryFn(mlModelFqn, mlModelFields),
    enabled: Boolean(mlModelFqn && canViewMlModel && !permissionsLoading),
  });

  useEffect(() => {
    if (!mlModelError) {
      return;
    }
    const status = (mlModelError as AxiosError | undefined)?.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });

      return;
    }
    showErrorToast(mlModelError as AxiosError);
  }, [mlModelError, navigate]);

  useEffect(() => {
    if (!mlModelDetail) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(mlModelDetail),
      entityType: EntityType.MLMODEL,
      fqn: mlModelDetail.fullyQualifiedName ?? '',
      serviceType: mlModelDetail.serviceType,
      timestamp: 0,
      id: mlModelDetail.id,
    });
  }, [mlModelDetail]);

  const setMlModelDetail = useCallback(
    (
      updater:
        | Mlmodel
        | undefined
        | ((prev: Mlmodel | undefined) => Mlmodel | undefined)
    ) => {
      queryClient.setQueryData<Mlmodel | undefined>(mlModelCacheKey, updater);
    },
    [queryClient, mlModelCacheKey]
  );

  const refetchMlModel = useCallback(
    () => queryClient.invalidateQueries({ queryKey: mlModelCacheKey }),
    [queryClient, mlModelCacheKey]
  );

  const { mlModelId, followers } = useMemo(() => {
    return {
      mlModelId: mlModelDetail?.id,
      followers: mlModelDetail?.followers ?? [],
    };
  }, [mlModelDetail]);

  const isFollowing = useMemo(
    () => followers.some(({ id }) => id === USERId),
    [followers, USERId]
  );

  const fetchResourcePermission = async (entityFqn: string) => {
    setPermissionsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.ML_MODEL,
        entityFqn
      );
      setPipelinePermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: entityFqn,
        })
      );
    } finally {
      setPermissionsLoading(false);
    }
  };

  const saveUpdatedMlModelData = useCallback(
    (updatedData: Mlmodel) => {
      if (!mlModelDetail || !mlModelId) {
        return Promise.reject(new Error('MlModel not loaded'));
      }
      const jsonPatch = compare(
        omitBy(mlModelDetail, isUndefined),
        updatedData
      );

      return patchMlModelDetails(mlModelId, jsonPatch);
    },
    [mlModelDetail, mlModelId]
  );

  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: Mlmodel | undefined }
  >({
    mutationFn: async () => {
      if (!mlModelId) {
        return;
      }
      if (isFollowing) {
        await removeFollower(mlModelId, USERId);
      } else {
        await addFollower(mlModelId, USERId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: mlModelCacheKey });
      const previous = queryClient.getQueryData<Mlmodel | undefined>(
        mlModelCacheKey
      );
      queryClient.setQueryData<Mlmodel | undefined>(mlModelCacheKey, (prev) => {
        if (!prev) {
          return prev;
        }
        const currentFollowers = prev.followers ?? [];
        if (isFollowing) {
          return {
            ...prev,
            followers: currentFollowers.filter(({ id }) => id !== USERId),
          };
        }

        return {
          ...prev,
          followers: [
            ...currentFollowers,
            { id: USERId, type: 'user' },
          ] as Mlmodel['followers'],
        };
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Mlmodel | undefined>(
          mlModelCacheKey,
          context.previous
        );
      }
      showErrorToast(
        error as AxiosError,
        isFollowing
          ? t('server.entity-unfollow-error', {
              entity: getEntityName(mlModelDetail),
            })
          : t('server.entity-follow-error', {
              entity: getEntityName(mlModelDetail),
            })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mlModelCacheKey });
    },
  });

  const followMlModel = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const unFollowMlModel = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const settingsUpdateHandler = async (
    updatedMlModel: Mlmodel
  ): Promise<void> => {
    try {
      const { displayName, owners, tags, version } =
        await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => {
        if (!preVDetail) {
          return preVDetail;
        }

        return {
          ...preVDetail,
          displayName,
          owners,
          tags,
          version,
        };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: getEntityName(mlModelDetail),
        })
      );
    }
  };

  const versionHandler = () => {
    navigate(
      getVersionPath(
        EntityType.MLMODEL,
        mlModelFqn,
        toString(mlModelDetail?.version)
      )
    );
  };

  const handleToggleDelete = (version?: number) => {
    setMlModelDetail((prev) => {
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
      await updateMlModelVotes(id, data);
      await queryClient.invalidateQueries({ queryKey: mlModelCacheKey });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateMlModelDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Mlmodel;
      setMlModelDetail((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setMlModelDetail]
  );

  const handleMlModelUpdate = useCallback(
    async (data: Mlmodel) => {
      try {
        const response = await saveUpdatedMlModelData(data);
        setMlModelDetail((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            ...response,
          };
        });
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: getEntityName(mlModelDetail),
          })
        );
      }
    },
    [saveUpdatedMlModelData, setMlModelDetail, mlModelDetail, t]
  );

  const onMlModelUpdateCertification = async (
    updatedMlModel: Mlmodel,
    key?: keyof Mlmodel
  ) => {
    try {
      const response = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          version: response.version,
          ...(key ? { [key]: response[key] } : response),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchResourcePermission(mlModelFqn);
  }, [mlModelFqn]);

  if (permissionsLoading || mlModelLoading) {
    return <Loader />;
  }

  if (mlModelError) {
    return (
      <ErrorPlaceHolder className="mt-0-important">
        {getEntityMissingError('mlModel', mlModelFqn)}
      </ErrorPlaceHolder>
    );
  }

  if (!mlModelPermissions.ViewAll && !mlModelPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.ml-model'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (!mlModelDetail) {
    return <Loader />;
  }

  return (
    <MlModelDetailComponent
      fetchMlModel={refetchMlModel}
      followMlModelHandler={followMlModel}
      handleToggleDelete={handleToggleDelete}
      mlModelDetail={mlModelDetail}
      settingsUpdateHandler={settingsUpdateHandler}
      unFollowMlModelHandler={unFollowMlModel}
      updateMlModelDetailsState={updateMlModelDetailsState}
      versionHandler={versionHandler}
      onMlModelUpdate={handleMlModelUpdate}
      onMlModelUpdateCertification={onMlModelUpdateCertification}
      onUpdateVote={updateVote}
    />
  );
};

export default MlModelPage;
