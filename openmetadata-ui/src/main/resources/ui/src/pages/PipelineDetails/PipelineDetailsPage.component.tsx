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
import { compare, Operation } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import PipelineDetails from '../../components/Pipeline/PipelineDetails/PipelineDetails.component';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { Paging } from '../../generated/type/paging';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  patchPipelineDetails,
  removeFollower,
  updatePipelinesVotes,
} from '../../rest/pipelineAPI';
import {
  pipelineQueryFn,
  pipelineQueryKey,
} from '../../rest/queries/pipelineQuery';
import { getEntityMissingError } from '../../utils/EntityDisplayUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { defaultFields } from '../../utils/PipelineDetailsUtils';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const PipelineDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { entityFqn: decodedPipelineFQN } = useFqn({
    type: EntityType.PIPELINE,
  });

  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true);
  const [paging] = useState<Paging>({} as Paging);

  const [pipelinePermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermissionByFqn } = usePermissionProvider();

  const viewUsagePermission = useMemo(
    () =>
      getPrioritizedViewPermission(
        pipelinePermissions,
        PermissionOperation.ViewUsage
      ),
    [pipelinePermissions]
  );

  const canViewPipeline = useMemo(
    () =>
      getPrioritizedViewPermission(
        pipelinePermissions,
        PermissionOperation.ViewBasic
      ) === true,
    [pipelinePermissions]
  );

  const pipelineFields = useMemo(() => {
    let fields = defaultFields;
    if (viewUsagePermission) {
      fields += `,${TabSpecificField.USAGE_SUMMARY}`;
    }

    return fields;
  }, [viewUsagePermission]);

  const pipelineCacheKey = useMemo(
    () => pipelineQueryKey(decodedPipelineFQN, pipelineFields),
    [decodedPipelineFQN, pipelineFields]
  );

  const {
    data: pipelineDetails,
    isLoading: pipelineLoading,
    error: pipelineError,
  } = useQuery({
    queryKey: pipelineCacheKey,
    queryFn: pipelineQueryFn(decodedPipelineFQN, pipelineFields),
    enabled: Boolean(
      decodedPipelineFQN && canViewPipeline && !permissionsLoading
    ),
  });

  const isError = useMemo(
    () => (pipelineError as AxiosError | undefined)?.response?.status === 404,
    [pipelineError]
  );

  useEffect(() => {
    const status = (pipelineError as AxiosError | undefined)?.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    } else if (status && status !== 404) {
      showErrorToast(
        pipelineError as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.pipeline'),
          entityName: decodedPipelineFQN,
        })
      );
    }
  }, [pipelineError, navigate, decodedPipelineFQN, t]);

  useEffect(() => {
    if (!pipelineDetails) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(pipelineDetails),
      entityType: EntityType.PIPELINE,
      fqn: pipelineDetails.fullyQualifiedName ?? '',
      serviceType: pipelineDetails.serviceType,
      timestamp: 0,
      id: pipelineDetails.id,
    });
  }, [pipelineDetails]);

  const setPipelineDetails = useCallback(
    (
      updater:
        | Pipeline
        | undefined
        | ((prev: Pipeline | undefined) => Pipeline | undefined)
    ) => {
      queryClient.setQueryData<Pipeline | undefined>(pipelineCacheKey, updater);
    },
    [queryClient, pipelineCacheKey]
  );

  const refetchPipelineDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: pipelineCacheKey }),
    [queryClient, pipelineCacheKey]
  );

  const { pipelineId, currentVersion, followers } = useMemo(() => {
    return {
      pipelineId: pipelineDetails?.id,
      currentVersion:
        pipelineDetails?.version !== undefined
          ? pipelineDetails.version + ''
          : '',
      followers: pipelineDetails?.followers ?? [],
    };
  }, [pipelineDetails]);

  const isFollowing = useMemo(
    () => followers.some(({ id }) => id === USERId),
    [followers, USERId]
  );

  // See DashboardDetailsPage for the rationale on NOT using useCallback here.
  const fetchResourcePermission = async (entityFqn: string) => {
    setPermissionsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.PIPELINE,
        entityFqn
      );
      setPipelinePermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', { entity: entityFqn })
      );
    } finally {
      setPermissionsLoading(false);
    }
  };

  const saveUpdatedPipelineData = useCallback(
    (updatedData: Pipeline) => {
      if (!pipelineDetails || !pipelineId) {
        return Promise.reject(new Error('Pipeline not loaded'));
      }
      const jsonPatch = compare(
        omitBy(pipelineDetails, isUndefined),
        updatedData
      );

      return patchPipelineDetails(pipelineId, jsonPatch);
    },
    [pipelineDetails, pipelineId]
  );

  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: Pipeline | undefined }
  >({
    mutationFn: async () => {
      if (!pipelineId) {
        return;
      }
      if (isFollowing) {
        await removeFollower(pipelineId, USERId);
      } else {
        await addFollower(pipelineId, USERId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: pipelineCacheKey });
      const previous = queryClient.getQueryData<Pipeline | undefined>(
        pipelineCacheKey
      );
      queryClient.setQueryData<Pipeline | undefined>(
        pipelineCacheKey,
        (prev) => {
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
            ] as Pipeline['followers'],
          };
        }
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Pipeline | undefined>(
          pipelineCacheKey,
          context.previous
        );
      }
      showErrorToast(
        error as AxiosError,
        isFollowing
          ? t('server.entity-unfollow-error', {
              entity: getEntityName(pipelineDetails),
            })
          : t('server.entity-follow-error', {
              entity: getEntityName(pipelineDetails),
            })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pipelineCacheKey });
    },
  });

  const followPipeline = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const unFollowPipeline = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const descriptionUpdateHandler = async (updatedPipeline: Pipeline) => {
    try {
      const response = await saveUpdatedPipelineData(updatedPipeline);
      setPipelineDetails(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onPipelineUpdate = async (
    updatedPipeline: Pipeline,
    key?: keyof Pipeline
  ) => {
    try {
      const response = await saveUpdatedPipelineData(updatedPipeline);
      setPipelineDetails((previous) => {
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

  const settingsUpdateHandler = async (updatedPipeline: Pipeline) => {
    try {
      const res = await saveUpdatedPipelineData(updatedPipeline);
      setPipelineDetails(res);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: getEntityName(pipelineDetails),
        })
      );
    }
  };

  const onTaskUpdate = async (jsonPatch: Array<Operation>) => {
    if (!pipelineId) {
      return;
    }
    try {
      const response = await patchPipelineDetails(pipelineId, jsonPatch);
      setPipelineDetails(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const versionHandler = () => {
    navigate(
      getVersionPath(EntityType.PIPELINE, decodedPipelineFQN, currentVersion)
    );
  };

  const handleExtensionUpdate = async (updatedPipeline: Pipeline) => {
    if (!pipelineDetails) {
      return;
    }
    try {
      const data = await saveUpdatedPipelineData({
        ...pipelineDetails,
        extension: updatedPipeline.extension,
      });
      setPipelineDetails(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: getEntityName(pipelineDetails),
        })
      );
    }
  };

  const handleToggleDelete = (version?: number) => {
    setPipelineDetails((prev) => {
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
      await updatePipelinesVotes(id, data);
      await queryClient.invalidateQueries({ queryKey: pipelineCacheKey });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updatePipelineDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Pipeline;
      setPipelineDetails((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setPipelineDetails]
  );

  useEffect(() => {
    fetchResourcePermission(decodedPipelineFQN);
  }, [decodedPipelineFQN]);

  if (permissionsLoading || pipelineLoading) {
    return <Loader />;
  }

  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('pipeline', decodedPipelineFQN)}
      </ErrorPlaceHolder>
    );
  }

  if (!pipelinePermissions.ViewAll && !pipelinePermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.pipeline-detail-plural'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (!pipelineDetails) {
    return <Loader />;
  }

  return (
    <PipelineDetails
      descriptionUpdateHandler={descriptionUpdateHandler}
      fetchPipeline={refetchPipelineDetails}
      followPipelineHandler={followPipeline}
      handleToggleDelete={handleToggleDelete}
      paging={paging}
      pipelineDetails={pipelineDetails}
      pipelineFQN={decodedPipelineFQN}
      settingsUpdateHandler={settingsUpdateHandler}
      taskUpdateHandler={onTaskUpdate}
      unFollowPipelineHandler={unFollowPipeline}
      updatePipelineDetailsState={updatePipelineDetailsState}
      versionHandler={versionHandler}
      onExtensionUpdate={handleExtensionUpdate}
      onPipelineUpdate={onPipelineUpdate}
      onUpdateVote={updateVote}
    />
  );
};

export default PipelineDetailsPage;
