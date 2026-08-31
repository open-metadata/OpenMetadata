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
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PageLoader } from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import MlModelDetailComponent from '../../components/MlModel/MlModelDetail/MlModelDetail.component';
import { ROUTES } from '../../constants/constants';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
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
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { defaultFields } from '../../utils/MlModelDetailsUtils';
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

  // Fetch-owner, by fqn. Deliberately kept even though MlModelDetailComponent (child) also
  // calls useEntityPermissions itself (by id, for its own edit-tier flags) — this page's
  // view-tier flags gate the ml-model entity query below (canViewUsage decides whether
  // USAGE_SUMMARY is requested; hasViewAccess decides whether the query fires and drives
  // the permission-denied placeholder), and the child only exists once mlModelId is known
  // — a real ordering cycle, same shape as TableDetailsPageV1's documented two-call split.
  // Noted as a double-fetch for a later consolidation pass (Task 8 Batch 10).
  const {
    isLoading: permissionsLoading,
    error: permissionsError,
    canViewUsage: viewUsagePermission,
    hasViewAccess: canViewMlModel,
  } = useEntityPermissions(ResourceEntity.ML_MODEL, mlModelFqn, {
    enabled: Boolean(mlModelFqn),
  });

  useEffect(() => {
    if (permissionsError) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: mlModelFqn,
        })
      );
    }
  }, [permissionsError]);

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

  if (permissionsLoading || mlModelLoading) {
    return <PageLoader />;
  }

  if (mlModelError) {
    return (
      <ErrorPlaceHolder className="mt-0-important">
        {getEntityMissingError('mlModel', mlModelFqn)}
      </ErrorPlaceHolder>
    );
  }

  if (!canViewMlModel) {
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
    return <PageLoader />;
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
