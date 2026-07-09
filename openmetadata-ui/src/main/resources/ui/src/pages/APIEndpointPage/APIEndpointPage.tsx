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
import APIEndpointDetails from '../../components/APIEndpoint/APIEndpointDetails/APIEndpointDetails';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PageLoader } from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addApiEndpointFollower,
  patchApiEndPoint,
  removeApiEndpointFollower,
  updateApiEndPointVote,
} from '../../rest/apiEndpointsAPI';
import {
  apiEndpointQueryFn,
  apiEndpointQueryKey,
  API_ENDPOINT_DEFAULT_FIELDS,
} from '../../rest/queries/apiEndpointQuery';
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const APIEndpointPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const queryClient = useQueryClient();

  const { entityFqn: apiEndpointFqn } = useFqn({
    type: EntityType.API_ENDPOINT,
  });

  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true);
  const [apiEndpointPermissions, setApiEndpointPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const canViewApiEndpoint = useMemo(
    () =>
      getPrioritizedViewPermission(
        apiEndpointPermissions,
        PermissionOperation.ViewBasic
      ) === true,
    [apiEndpointPermissions]
  );

  const apiEndpointCacheKey = useMemo(
    () => apiEndpointQueryKey(apiEndpointFqn, API_ENDPOINT_DEFAULT_FIELDS),
    [apiEndpointFqn]
  );

  const {
    data: apiEndpointDetails,
    isLoading: apiEndpointLoading,
    error: apiEndpointError,
  } = useQuery({
    queryKey: apiEndpointCacheKey,
    queryFn: apiEndpointQueryFn(apiEndpointFqn, API_ENDPOINT_DEFAULT_FIELDS),
    enabled: Boolean(
      apiEndpointFqn && canViewApiEndpoint && !permissionsLoading
    ),
  });

  const isError = useMemo(
    () =>
      (apiEndpointError as AxiosError | undefined)?.response?.status === 404,
    [apiEndpointError]
  );

  useEffect(() => {
    const status = (apiEndpointError as AxiosError | undefined)?.response
      ?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    } else if (status && status !== 404) {
      showErrorToast(
        apiEndpointError as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.api-endpoint'),
          entityName: apiEndpointFqn,
        })
      );
    }
  }, [apiEndpointError, navigate, apiEndpointFqn, t]);

  useEffect(() => {
    if (!apiEndpointDetails) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(apiEndpointDetails),
      entityType: EntityType.API_ENDPOINT,
      fqn: apiEndpointDetails.fullyQualifiedName ?? '',
      serviceType: apiEndpointDetails.serviceType,
      timestamp: 0,
      id: apiEndpointDetails.id,
    });
  }, [apiEndpointDetails]);

  const setApiEndpointDetails = useCallback(
    (
      updater:
        | APIEndpoint
        | undefined
        | ((prev: APIEndpoint | undefined) => APIEndpoint | undefined)
    ) => {
      queryClient.setQueryData<APIEndpoint | undefined>(
        apiEndpointCacheKey,
        updater
      );
    },
    [queryClient, apiEndpointCacheKey]
  );

  const refetchApiEndpointDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: apiEndpointCacheKey }),
    [queryClient, apiEndpointCacheKey]
  );

  const { id: apiEndpointId, version: currentVersion } =
    apiEndpointDetails ?? {};
  const isFollowing = useMemo(
    () =>
      apiEndpointDetails?.followers?.some(({ id }) => id === currentUserId) ??
      false,
    [apiEndpointDetails?.followers, currentUserId]
  );
  const entityName = useMemo(
    () => getEntityName(apiEndpointDetails),
    [apiEndpointDetails]
  );

  // See DashboardDetailsPage for the rationale on NOT using useCallback here.
  const fetchResourcePermission = async (entityFqn: string) => {
    setPermissionsLoading(true);
    try {
      const permissions = await getEntityPermissionByFqn(
        ResourceEntity.API_ENDPOINT,
        entityFqn
      );
      setApiEndpointPermissions(permissions);
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

  const saveUpdatedApiEndpointData = useCallback(
    (updatedData: APIEndpoint) => {
      if (!apiEndpointDetails || !apiEndpointId) {
        return Promise.reject(new Error('API Endpoint not loaded'));
      }
      const jsonPatch = compare(
        omitBy(apiEndpointDetails, isUndefined),
        updatedData
      );

      return patchApiEndPoint(apiEndpointId, jsonPatch);
    },
    [apiEndpointDetails, apiEndpointId]
  );

  const handleApiEndpointUpdate = async (
    updatedData: APIEndpoint,
    key?: keyof APIEndpoint
  ) => {
    try {
      const res = await saveUpdatedApiEndpointData(updatedData);

      setApiEndpointDetails((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          ...res,
          ...(key && { [key]: res[key] }),
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
    { previous: APIEndpoint | undefined }
  >({
    mutationFn: async () => {
      if (!apiEndpointId) {
        return;
      }
      if (isFollowing) {
        await removeApiEndpointFollower(apiEndpointId, currentUserId);
      } else {
        await addApiEndpointFollower(apiEndpointId, currentUserId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: apiEndpointCacheKey });
      const previous = queryClient.getQueryData<APIEndpoint | undefined>(
        apiEndpointCacheKey
      );
      queryClient.setQueryData<APIEndpoint | undefined>(
        apiEndpointCacheKey,
        (prev) => {
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
            ] as APIEndpoint['followers'],
          };
        }
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<APIEndpoint | undefined>(
          apiEndpointCacheKey,
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
      queryClient.invalidateQueries({ queryKey: apiEndpointCacheKey });
    },
  });

  const followApiEndPoint = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const unFollowApiEndPoint = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(
          EntityType.API_ENDPOINT,
          apiEndpointFqn,
          toString(currentVersion)
        )
      );
  };

  const handleToggleDelete = (version?: number) => {
    setApiEndpointDetails((prev) => {
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
      await updateApiEndPointVote(id, data);
      await queryClient.invalidateQueries({ queryKey: apiEndpointCacheKey });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateApiEndpointDetails = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as APIEndpoint;
      setApiEndpointDetails((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setApiEndpointDetails]
  );

  useEffect(() => {
    fetchResourcePermission(apiEndpointFqn);
  }, [apiEndpointFqn]);

  if (permissionsLoading || apiEndpointLoading) {
    return <PageLoader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('apiEndpoint', apiEndpointFqn)}
      </ErrorPlaceHolder>
    );
  }
  if (!apiEndpointPermissions.ViewAll && !apiEndpointPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.api-endpoint'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }
  if (!apiEndpointDetails) {
    return <PageLoader />;
  }

  return (
    <APIEndpointDetails
      apiEndpointDetails={apiEndpointDetails}
      apiEndpointPermissions={apiEndpointPermissions}
      fetchAPIEndpointDetails={refetchApiEndpointDetails}
      onApiEndpointUpdate={handleApiEndpointUpdate}
      onFollowApiEndPoint={followApiEndPoint}
      onToggleDelete={handleToggleDelete}
      onUnFollowApiEndPoint={unFollowApiEndPoint}
      onUpdateApiEndpointDetails={updateApiEndpointDetails}
      onUpdateVote={handleUpdateVote}
      onVersionChange={versionHandler}
    />
  );
};

export default APIEndpointPage;
