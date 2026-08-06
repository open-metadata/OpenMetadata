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
import { PageLoader } from '../../components/common/Loader/Loader';
import DashboardDetails from '../../components/Dashboard/DashboardDetails/DashboardDetails.component';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  patchDashboardDetails,
  removeFollower,
  updateDashboardVotes,
} from '../../rest/dashboardAPI';
import {
  dashboardQueryFn,
  dashboardQueryKey,
} from '../../rest/queries/dashboardQuery';
import { defaultFields } from '../../utils/DashboardDetailsUtils';
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { entityFqn: dashboardFQN } = useFqn({ type: EntityType.DASHBOARD });
  const queryClient = useQueryClient();

  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true);
  const [dashboardPermissions, setDashboardPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const viewUsagePermission = useMemo(
    () =>
      getPrioritizedViewPermission(
        dashboardPermissions,
        PermissionOperation.ViewUsage
      ),
    [dashboardPermissions]
  );

  const canViewDashboard = useMemo(
    () =>
      getPrioritizedViewPermission(
        dashboardPermissions,
        PermissionOperation.ViewBasic
      ) === true,
    [dashboardPermissions]
  );

  const dashboardFields = useMemo(() => {
    let fields = defaultFields;
    if (viewUsagePermission) {
      fields += `,${TabSpecificField.USAGE_SUMMARY}`;
    }

    return fields;
  }, [viewUsagePermission]);

  const dashboardCacheKey = useMemo(
    () => dashboardQueryKey(dashboardFQN, dashboardFields),
    [dashboardFQN, dashboardFields]
  );

  const {
    data: dashboardDetails,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useQuery({
    queryKey: dashboardCacheKey,
    queryFn: dashboardQueryFn(dashboardFQN, dashboardFields),
    enabled: Boolean(dashboardFQN && canViewDashboard && !permissionsLoading),
  });

  const isError = useMemo(
    () => (dashboardError as AxiosError | undefined)?.response?.status === 404,
    [dashboardError]
  );

  useEffect(() => {
    const status = (dashboardError as AxiosError | undefined)?.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    } else if (status && status !== 404) {
      showErrorToast(
        dashboardError as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.dashboard'),
          entityName: dashboardFQN,
        })
      );
    }
  }, [dashboardError, navigate, dashboardFQN, t]);

  useEffect(() => {
    if (!dashboardDetails) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(dashboardDetails),
      entityType: EntityType.DASHBOARD,
      fqn: dashboardDetails.fullyQualifiedName ?? '',
      serviceType: dashboardDetails.serviceType,
      timestamp: 0,
      id: dashboardDetails.id,
    });
  }, [dashboardDetails]);

  const setDashboardDetails = useCallback(
    (
      updater:
        | Dashboard
        | undefined
        | ((prev: Dashboard | undefined) => Dashboard | undefined)
    ) => {
      queryClient.setQueryData<Dashboard | undefined>(
        dashboardCacheKey,
        updater
      );
    },
    [queryClient, dashboardCacheKey]
  );

  const refetchDashboardDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: dashboardCacheKey }),
    [queryClient, dashboardCacheKey]
  );

  const { id: dashboardId, version, charts } = dashboardDetails ?? {};
  const isFollowing = useMemo(
    () => dashboardDetails?.followers?.some(({ id }) => id === USERId) ?? false,
    [dashboardDetails?.followers, USERId]
  );
  const entityName = useMemo(
    () => getEntityName(dashboardDetails),
    [dashboardDetails]
  );

  // Intentionally NOT a useCallback. The {@code t} from {@link useTranslation} is a fresh
  // reference per render in the testing-library mocked env (and in some non-test paths too),
  // which would make this callback unstable and create an infinite re-render via the useEffect
  // below. Keep it as a plain function — the useEffect depends only on {@code dashboardFQN}.
  const fetchResourcePermission = async (entityFqn: string) => {
    setPermissionsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.DASHBOARD,
        entityFqn
      );
      setDashboardPermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', { entity: entityFqn })
      );
    } finally {
      setPermissionsLoading(false);
    }
  };

  const saveUpdatedDashboardData = useCallback(
    (updatedData: Dashboard) => {
      if (!dashboardDetails || !dashboardId) {
        return Promise.reject(new Error('Dashboard not loaded'));
      }
      const jsonPatch = compare(
        omitBy(dashboardDetails, isUndefined),
        updatedData
      );

      return patchDashboardDetails(dashboardId, jsonPatch);
    },
    [dashboardDetails, dashboardId]
  );

  const onDashboardUpdate = useCallback(
    async (updatedDashboard: Dashboard, key?: keyof Dashboard) => {
      try {
        const response = await saveUpdatedDashboardData(updatedDashboard);
        setDashboardDetails((previous) => {
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
    },
    [saveUpdatedDashboardData, setDashboardDetails]
  );

  // Optimistic follow/unfollow — flip the heart instantly via {@code onMutate}, roll back
  // on error, invalidate on settle so background revalidation absorbs any server-side
  // adjustments (timestamps etc.).
  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: Dashboard | undefined }
  >({
    mutationFn: async () => {
      if (!dashboardId) {
        return;
      }
      if (isFollowing) {
        await removeFollower(dashboardId, USERId);
      } else {
        await addFollower(dashboardId, USERId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: dashboardCacheKey });
      const previous = queryClient.getQueryData<Dashboard | undefined>(
        dashboardCacheKey
      );
      queryClient.setQueryData<Dashboard | undefined>(
        dashboardCacheKey,
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
            ] as Dashboard['followers'],
          };
        }
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Dashboard | undefined>(
          dashboardCacheKey,
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
      queryClient.invalidateQueries({ queryKey: dashboardCacheKey });
    },
  });

  const followDashboard = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const unFollowDashboard = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const versionHandler = useCallback(() => {
    version &&
      navigate(
        getVersionPath(EntityType.DASHBOARD, dashboardFQN, toString(version))
      );
  }, [version, dashboardFQN, navigate]);

  const handleToggleDelete = useCallback(
    (version?: number) => {
      setDashboardDetails((prev) => {
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
    [setDashboardDetails]
  );

  const updateVote = useCallback(
    async (data: QueryVote, id: string) => {
      try {
        await updateDashboardVotes(id, data);
        // Background revalidation pulls authoritative vote counts; the optimistic patch
        // (votes increment is already reflected by the UI button state) keeps the page
        // responsive in the meantime.
        await queryClient.invalidateQueries({ queryKey: dashboardCacheKey });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [queryClient, dashboardCacheKey]
  );

  const updateDashboardDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Dashboard;
      setDashboardDetails((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setDashboardDetails]
  );

  useEffect(() => {
    fetchResourcePermission(dashboardFQN);
  }, [dashboardFQN]);

  if (permissionsLoading || dashboardLoading) {
    return <PageLoader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('dashboard', dashboardFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!dashboardPermissions.ViewAll && !dashboardPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.dashboard-detail-plural-lowercase'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }
  if (!dashboardDetails) {
    return <PageLoader />;
  }

  return (
    <DashboardDetails
      charts={charts ?? []}
      dashboardDetails={dashboardDetails}
      fetchDashboard={refetchDashboardDetails}
      followDashboardHandler={followDashboard}
      handleToggleDelete={handleToggleDelete}
      unFollowDashboardHandler={unFollowDashboard}
      updateDashboardDetailsState={updateDashboardDetailsState}
      versionHandler={versionHandler}
      onDashboardUpdate={onDashboardUpdate}
      onUpdateVote={updateVote}
    />
  );
};

export default DashboardDetailsPage;
