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
import ChartDetails from '../../components/Chart/ChartDetails/ChartDetails.component';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PageLoader } from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { ROUTES } from '../../constants/constants';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Chart } from '../../generated/entity/data/chart';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  patchChartDetails,
  removeFollower,
  updateChartVotes,
} from '../../rest/chartsAPI';
import { chartQueryFn, chartQueryKey } from '../../rest/queries/chartQuery';
import { defaultFields } from '../../utils/ChartDetailsUtils';
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const ChartDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { fqn: chartFQN } = useFqn();
  const queryClient = useQueryClient();

  // Fetch-owner, by fqn. Deliberately kept even though ChartDetails (child) also calls
  // useEntityPermissions itself (by id, for its own edit-tier flags) — this page's view-tier
  // flags gate the chart entity query below (canViewUsage decides whether USAGE_SUMMARY is
  // requested; hasViewAccess decides whether the query fires and drives the
  // permission-denied placeholder), and the child only exists once chartId is known.
  // NOTE: two network requests — this page fetches by fqn while ChartDetails fetches by id
  // (different query keys, different REST calls — NOT the same shared-cache situation as
  // TableDetailsPageV1's own two same-fqn calls). Consolidation candidate: pass one
  // identifier form through or drop the page fetch if the child's data suffices.
  const {
    isLoading: permissionsLoading,
    error: permissionsError,
    canViewUsage: viewUsagePermission,
    hasViewAccess: canViewChart,
  } = useEntityPermissions(ResourceEntity.CHART, chartFQN, {
    enabled: Boolean(chartFQN),
  });

  useEffect(() => {
    if (permissionsError) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: chartFQN,
        })
      );
    }
  }, [permissionsError]);

  const chartFields = useMemo(() => {
    let fields = defaultFields;
    if (viewUsagePermission) {
      fields += `,${TabSpecificField.USAGE_SUMMARY}`;
    }

    return fields;
  }, [viewUsagePermission]);

  const chartCacheKey = useMemo(
    () => chartQueryKey(chartFQN, chartFields),
    [chartFQN, chartFields]
  );

  const {
    data: chartDetails,
    isLoading: chartLoading,
    error: chartError,
  } = useQuery({
    queryKey: chartCacheKey,
    queryFn: chartQueryFn(chartFQN, chartFields),
    enabled: Boolean(chartFQN && canViewChart && !permissionsLoading),
  });

  const isError = useMemo(
    () => (chartError as AxiosError | undefined)?.response?.status === 404,
    [chartError]
  );

  useEffect(() => {
    const status = (chartError as AxiosError | undefined)?.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    } else if (status && status !== 404) {
      showErrorToast(
        chartError as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.chart'),
          entityName: chartFQN,
        })
      );
    }
  }, [chartError, navigate, chartFQN, t]);

  useEffect(() => {
    if (!chartDetails) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(chartDetails),
      entityType: EntityType.CHART,
      fqn: chartDetails.fullyQualifiedName ?? '',
      serviceType: chartDetails.serviceType,
      timestamp: 0,
      id: chartDetails.id,
    });
  }, [chartDetails]);

  const setChartDetails = useCallback(
    (
      updater:
        | Chart
        | undefined
        | ((prev: Chart | undefined) => Chart | undefined)
    ) => {
      queryClient.setQueryData<Chart | undefined>(chartCacheKey, updater);
    },
    [queryClient, chartCacheKey]
  );

  const refetchChartDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: chartCacheKey }),
    [queryClient, chartCacheKey]
  );

  const { id: chartId, version } = chartDetails ?? {};
  const isFollowing = useMemo(
    () => chartDetails?.followers?.some(({ id }) => id === USERId) ?? false,
    [chartDetails?.followers, USERId]
  );
  const entityName = useMemo(() => getEntityName(chartDetails), [chartDetails]);

  const saveUpdatedChartData = useCallback(
    (updatedData: Chart) => {
      if (!chartDetails || !chartId) {
        return Promise.reject(new Error('Chart not loaded'));
      }
      const jsonPatch = compare(omitBy(chartDetails, isUndefined), updatedData);

      return patchChartDetails(chartId, jsonPatch);
    },
    [chartDetails, chartId]
  );

  const onChartUpdate = async (updatedChart: Chart, key?: keyof Chart) => {
    try {
      const response = await saveUpdatedChartData(updatedChart);
      setChartDetails((previous) => {
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

  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: Chart | undefined }
  >({
    mutationFn: async () => {
      if (!chartId) {
        return;
      }
      if (isFollowing) {
        await removeFollower(chartId, USERId);
      } else {
        await addFollower(chartId, USERId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: chartCacheKey });
      const previous = queryClient.getQueryData<Chart | undefined>(
        chartCacheKey
      );
      queryClient.setQueryData<Chart | undefined>(chartCacheKey, (prev) => {
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
          ] as Chart['followers'],
        };
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Chart | undefined>(
          chartCacheKey,
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
      queryClient.invalidateQueries({ queryKey: chartCacheKey });
    },
  });

  const followChart = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const unFollowChart = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const versionHandler = () => {
    version &&
      navigate(getVersionPath(EntityType.CHART, chartFQN, toString(version)));
  };

  const handleToggleDelete = (version?: number) => {
    setChartDetails((prev) => {
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
      await updateChartVotes(id, data);
      await queryClient.invalidateQueries({ queryKey: chartCacheKey });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateChartDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Chart;
      setChartDetails((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setChartDetails]
  );

  if (permissionsLoading || chartLoading) {
    return <PageLoader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('chart', chartFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!canViewChart) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.chart-plural'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }
  if (!chartDetails) {
    return <PageLoader />;
  }

  return (
    <ChartDetails
      chartDetails={chartDetails}
      fetchChart={refetchChartDetails}
      followChartHandler={followChart}
      handleToggleDelete={handleToggleDelete}
      unFollowChartHandler={unFollowChart}
      updateChartDetailsState={updateChartDetailsState}
      versionHandler={versionHandler}
      onChartUpdate={onChartUpdate}
      onUpdateVote={updateVote}
    />
  );
};

export default ChartDetailsPage;
