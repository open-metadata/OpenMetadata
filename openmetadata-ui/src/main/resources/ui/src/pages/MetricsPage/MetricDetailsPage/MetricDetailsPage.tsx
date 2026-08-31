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

import {
  Box,
  Button,
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import MetricDetails from '../../../components/Metric/MetricDetails/MetricDetails';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import type { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../../enums/Axios.enum';
import { EntityType } from '../../../enums/entity.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import { Operation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  addMetricFollower,
  patchMetric,
  removeMetricFollower,
  restoreMetric,
} from '../../../rest/metricsAPI';
import {
  metricQueryFn,
  metricQueryKey,
  METRIC_DEFAULT_FIELDS,
} from '../../../rest/queries/metricQuery';
import { getEntityMissingError } from '../../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import { addToRecentViewed } from '../../../utils/RecentActivityUtils';
import { getVersionPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';

const MetricDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const queryClient = useQueryClient();

  const { fqn: metricFqn } = useRequiredParams<{ fqn: string }>();
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
    refetch: refetchMetricQuery,
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
    }
  }, [metricError, navigate]);

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

      throw error;
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

  const restoreMetricHandler = useCallback(async () => {
    if (!metricId) {
      return;
    }

    const restoredMetric = await restoreMetric(metricId);
    setMetricDetails(restoredMetric);
  }, [metricId, setMetricDetails]);

  const deleteMetricHandler = useCallback(
    (isSoftDelete: boolean) => {
      if (isSoftDelete) {
        setMetricDetails((previous) =>
          previous ? { ...previous, deleted: true } : previous
        );

        return;
      }

      navigate(ROUTES.METRICS);
    },
    [navigate, setMetricDetails]
  );

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(EntityType.METRIC, metricFqn, toString(currentVersion))
      );
  };

  useEffect(() => {
    fetchResourcePermission(metricFqn);
  }, [metricFqn]);

  const documentTitle = (
    <DocumentTitle title={entityName || t('label.metric')} />
  );

  if (permissionsLoading || metricLoading) {
    return (
      <main className="tw:min-h-full tw:bg-secondary tw:p-6">
        {documentTitle}
        <Box
          aria-label={t('label.loading')}
          direction="col"
          gap={3}
          role="status">
          <Skeleton height={72} variant="rounded" />
          <Skeleton height={320} variant="rounded" />
        </Box>
      </main>
    );
  }
  if (isError) {
    return (
      <main className="tw:min-h-full tw:bg-secondary tw:p-6">
        {documentTitle}
        <Card>
          <Card.Content>
            <Typography className="tw:text-error-primary" size="text-sm">
              <span role="alert">
                {getEntityMissingError(EntityType.METRIC, metricFqn)}
              </span>
            </Typography>
          </Card.Content>
        </Card>
      </main>
    );
  }
  if (!metricPermissions.ViewAll && !metricPermissions.ViewBasic) {
    return (
      <main className="tw:min-h-full tw:bg-secondary tw:p-6">
        {documentTitle}
        <Card>
          <Card.Content>
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('message.no-permission-to-view')}
            </Typography>
          </Card.Content>
        </Card>
      </main>
    );
  }
  if (metricError) {
    return (
      <main className="tw:min-h-full tw:bg-secondary tw:p-6">
        {documentTitle}
        <Card>
          <Card.Content>
            <Box direction="col" gap={3}>
              <Typography className="tw:text-error-primary" size="text-sm">
                <span role="alert">
                  {t('server.entity-details-fetch-error', {
                    entityType: t('label.metric'),
                    entityName: metricFqn,
                  })}
                </span>
              </Typography>
              <Button
                className="tw:self-start"
                color="secondary"
                onPress={() => refetchMetricQuery()}>
                {t('label.try-again')}
              </Button>
            </Box>
          </Card.Content>
        </Card>
      </main>
    );
  }
  if (!metricDetails) {
    return null;
  }

  return (
    <>
      {documentTitle}
      <MetricDetails
        currentUser={currentUser}
        fetchMetricDetails={refetchMetricDetails}
        metricDetails={metricDetails}
        metricPermissions={metricPermissions}
        onDeleteMetric={deleteMetricHandler}
        onFollowMetric={followMetric}
        onMetricUpdate={handleMetricUpdate}
        onRestoreMetric={restoreMetricHandler}
        onUnFollowMetric={unFollowMetric}
        onVersionChange={versionHandler}
      />
    </>
  );
};

export default MetricDetailsPage;
