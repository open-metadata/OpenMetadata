/*
 *  Copyright 2024 Collate.
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

import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../../components/Database/TableQueries/TableQueries.interface';
import MetricDetails from '../../../components/Metric/MetricDetails/MetricDetails';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { Metric } from '../../../generated/entity/data/metric';
import { Operation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import {
  addMetricFollower,
  patchMetric,
  removeMetricFollower,
  updateMetricVote,
} from '../../../rest/metricsAPI';
import {
  metricQueryFn,
  metricQueryKey,
  METRIC_DEFAULT_FIELDS,
} from '../../../rest/queries/metricQuery';
import { getEntityMissingError } from '../../../utils/EntityDisplayUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import { addToRecentViewed } from '../../../utils/RecentActivityUtils';
import { getVersionPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const MetricDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const queryClient = useQueryClient();

  const { fqn: metricFqn } = useFqn();
  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true);

  const [metricPermissions, setMetricPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const canViewMetric = useMemo(
    () =>
      getPrioritizedViewPermission(metricPermissions, Operation.ViewBasic) ===
      true,
    [metricPermissions]
  );

  const metricCacheKey = useMemo(
    () => metricQueryKey(metricFqn, METRIC_DEFAULT_FIELDS),
    [metricFqn]
  );

  const {
    data: metricDetails,
    isLoading: metricLoading,
    error: metricError,
  } = useQuery({
    queryKey: metricCacheKey,
    queryFn: metricQueryFn(metricFqn, METRIC_DEFAULT_FIELDS),
    enabled: Boolean(metricFqn && canViewMetric && !permissionsLoading),
  });

  const isError = useMemo(
    () => (metricError as AxiosError | undefined)?.response?.status === 404,
    [metricError]
  );

  useEffect(() => {
    const status = (metricError as AxiosError | undefined)?.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    } else if (status && status !== 404) {
      showErrorToast(
        metricError as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.metric'),
          entityName: metricFqn,
        })
      );
    }
  }, [metricError, navigate, metricFqn, t]);

  useEffect(() => {
    if (!metricDetails) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(metricDetails),
      entityType: EntityType.METRIC,
      fqn: metricDetails.fullyQualifiedName ?? '',
      timestamp: 0,
      id: metricDetails.id,
    });
  }, [metricDetails]);

  const setMetricDetails = useCallback(
    (
      updater:
        | Metric
        | undefined
        | ((prev: Metric | undefined) => Metric | undefined)
    ) => {
      queryClient.setQueryData<Metric | undefined>(metricCacheKey, updater);
    },
    [queryClient, metricCacheKey]
  );

  const refetchMetricDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: metricCacheKey }),
    [queryClient, metricCacheKey]
  );

  const { id: metricId, version: currentVersion } = metricDetails ?? {};
  const isFollowing = useMemo(
    () => metricDetails?.followers?.some(({ id }) => id === currentUserId),
    [metricDetails?.followers, currentUserId]
  );
  const entityName = useMemo(
    () => getEntityName(metricDetails),
    [metricDetails]
  );

  // See DashboardDetailsPage for the rationale on NOT using useCallback here.
  const fetchResourcePermission = async (entityFqn: string) => {
    setPermissionsLoading(true);
    try {
      const permissions = await getEntityPermissionByFqn(
        ResourceEntity.METRIC,
        entityFqn
      );
      setMetricPermissions(permissions);
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

  const saveUpdatedMetricData = useCallback(
    (updatedData: Metric) => {
      if (!metricDetails || !metricId) {
        return Promise.reject(new Error('Metric not loaded'));
      }
      const jsonPatch = compare(
        omitBy(metricDetails, isUndefined),
        updatedData
      );

      return patchMetric(metricId, jsonPatch);
    },
    [metricDetails, metricId]
  );

  const handleMetricUpdate = async (
    updatedData: Metric,
    key?: keyof Metric
  ) => {
    try {
      const res = await saveUpdatedMetricData(updatedData);

      if (key === 'unitOfMeasurement') {
        setMetricDetails((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            version: res.version,
            unitOfMeasurement: res.unitOfMeasurement,
            customUnitOfMeasurement: res.customUnitOfMeasurement,
          };
        });
      } else {
        setMetricDetails((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            version: res.version,
            ...(key ? { [key]: res[key] } : res),
          };
        });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: Metric | undefined }
  >({
    mutationFn: async () => {
      if (!metricId) {
        return;
      }
      if (isFollowing) {
        await removeMetricFollower(metricId, currentUserId);
      } else {
        await addMetricFollower(metricId, currentUserId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: metricCacheKey });
      const previous = queryClient.getQueryData<Metric | undefined>(
        metricCacheKey
      );
      queryClient.setQueryData<Metric | undefined>(metricCacheKey, (prev) => {
        if (!prev) {
          return prev;
        }
        const currentFollowers = prev.followers ?? [];
        if (isFollowing) {
          return {
            ...prev,
            followers: currentFollowers.filter(
              ({ id }) => id !== currentUserId
            ),
          };
        }

        return {
          ...prev,
          followers: [
            ...currentFollowers,
            { id: currentUserId, type: 'user' },
          ] as Metric['followers'],
        };
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Metric | undefined>(
          metricCacheKey,
          context.previous
        );
      }
      showErrorToast(
        error as AxiosError,
        isFollowing
          ? t('server.entity-unfollow-error', { entity: entityName })
          : t('server.entity-follow-error', { entity: entityName })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: metricCacheKey });
    },
  });

  const followMetric = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const unFollowMetric = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(EntityType.METRIC, metricFqn, toString(currentVersion))
      );
  };

  const handleToggleDelete = (version?: number) => {
    setMetricDetails((prev) => {
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

  const handleUpdateVote = async (data: QueryVote, id: string) => {
    try {
      await updateMetricVote(id, data);
      await queryClient.invalidateQueries({ queryKey: metricCacheKey });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateMetricDetails = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Metric;
      setMetricDetails((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setMetricDetails]
  );

  useEffect(() => {
    fetchResourcePermission(metricFqn);
  }, [metricFqn]);

  if (permissionsLoading || metricLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(EntityType.METRIC, metricFqn)}
      </ErrorPlaceHolder>
    );
  }
  if (!metricPermissions.ViewAll && !metricPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.metric'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }
  if (!metricDetails) {
    return <Loader />;
  }

  return (
    <MetricDetails
      fetchMetricDetails={refetchMetricDetails}
      metricDetails={metricDetails}
      metricPermissions={metricPermissions}
      onFollowMetric={followMetric}
      onMetricUpdate={handleMetricUpdate}
      onToggleDelete={handleToggleDelete}
      onUnFollowMetric={unFollowMetric}
      onUpdateMetricDetails={updateMetricDetails}
      onUpdateVote={handleUpdateVote}
      onVersionChange={versionHandler}
    />
  );
};

export default MetricDetailsPage;
