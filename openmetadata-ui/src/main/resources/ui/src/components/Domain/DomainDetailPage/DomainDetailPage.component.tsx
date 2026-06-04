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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { useMarketplaceStore } from '../../../hooks/useMarketplaceStore';
import {
  addFollower,
  patchDomains,
  removeFollower,
  updateDomainVotes,
} from '../../../rest/domainAPI';
import {
  domainQueryFn,
  domainQueryKey,
  DOMAIN_DEFAULT_FIELDS,
} from '../../../rest/queries/domainQuery';
import { getEntityMissingError } from '../../../utils/EntityDisplayUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import { QueryVote } from '../../Database/TableQueries/TableQueries.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import '../domain.less';
import DomainDetails from '../DomainDetails/DomainDetails.component';

const DomainDetailPage = () => {
  const { fqn: domainFqn } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { domainBasePath } = useMarketplaceStore();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const { permissions } = usePermissionProvider();
  const [isFollowingLoading, setIsFollowingLoading] = useState<boolean>(false);

  const [viewBasicDomainPermission, viewAllDomainPermission] = useMemo(() => {
    return [
      checkPermission(Operation.ViewBasic, ResourceEntity.DOMAIN, permissions),
      checkPermission(Operation.ViewAll, ResourceEntity.DOMAIN, permissions),
    ];
  }, [permissions]);

  const canViewDomain = viewBasicDomainPermission || viewAllDomainPermission;

  const domainCacheKey = useMemo(
    () => domainQueryKey(domainFqn, DOMAIN_DEFAULT_FIELDS),
    [domainFqn]
  );

  const {
    data: activeDomain,
    isLoading: domainLoading,
    error: domainError,
  } = useQuery({
    queryKey: domainCacheKey,
    queryFn: domainQueryFn(domainFqn, DOMAIN_DEFAULT_FIELDS),
    enabled: Boolean(domainFqn) && canViewDomain,
  });

  const isError = useMemo(
    () => (domainError as AxiosError | undefined)?.response?.status === 404,
    [domainError]
  );

  useEffect(() => {
    if (domainError && !isError) {
      showErrorToast(
        domainError as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.domain-lowercase'),
        })
      );
    }
  }, [domainError, isError, t]);

  const setActiveDomain = useCallback(
    (
      updater:
        | Domain
        | undefined
        | ((prev: Domain | undefined) => Domain | undefined)
    ) => {
      queryClient.setQueryData<Domain | undefined>(domainCacheKey, updater);
    },
    [queryClient, domainCacheKey]
  );

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: activeDomain?.followers?.some(
        ({ id }) => id === currentUserId
      ),
    };
  }, [activeDomain?.followers, currentUserId]);

  const handleDomainUpdate = async (updatedData: Domain) => {
    if (activeDomain) {
      const jsonPatch = compare(activeDomain, updatedData);
      try {
        const response = await patchDomains(activeDomain.id, jsonPatch);

        setActiveDomain(response);

        if (activeDomain?.name !== updatedData.name) {
          navigate(getDomainPath(response.fullyQualifiedName));
        }
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error as AxiosError;
      }
    }
  };

  const handleDomainDelete = () => {
    navigate(domainBasePath);
  };

  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: Domain | undefined }
  >({
    mutationFn: async () => {
      if (!activeDomain?.id) {
        return;
      }
      if (isFollowing) {
        await removeFollower(activeDomain.id, currentUserId);
      } else {
        await addFollower(activeDomain.id, currentUserId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: domainCacheKey });
      const previous = queryClient.getQueryData<Domain | undefined>(
        domainCacheKey
      );
      queryClient.setQueryData<Domain | undefined>(domainCacheKey, (prev) => {
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
          ] as Domain['followers'],
        };
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Domain | undefined>(
          domainCacheKey,
          context.previous
        );
      }
      showErrorToast(
        error as AxiosError,
        isFollowing
          ? t('server.entity-unfollow-error', {
              entity: getEntityName(activeDomain),
            })
          : t('server.entity-follow-error', {
              entity: getEntityName(activeDomain),
            })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: domainCacheKey });
    },
  });

  const handleFollowingClick = useCallback(async () => {
    setIsFollowingLoading(true);
    try {
      await followMutation.mutateAsync();
    } finally {
      setIsFollowingLoading(false);
    }
  }, [followMutation]);

  const handleUpdateVote = useCallback(
    async (data: QueryVote, id: string) => {
      try {
        await updateDomainVotes(id, data);
        await queryClient.invalidateQueries({ queryKey: domainCacheKey });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [queryClient, domainCacheKey]
  );

  useEffect(() => {
    if (!domainFqn) {
      navigate(domainBasePath);
    }
  }, [domainFqn, navigate, domainBasePath]);

  if (!canViewDomain) {
    return (
      <ErrorPlaceHolder
        className="mt-0-important"
        permissionValue={t('label.view-entity', {
          entity: t('label.domain'),
        })}
        size={SIZE.LARGE}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (domainLoading) {
    return <Loader />;
  }

  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('domain', domainFqn)}
      </ErrorPlaceHolder>
    );
  }

  if (!activeDomain) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1 pageTitle={getEntityName(activeDomain)}>
      <DomainDetails
        domain={activeDomain}
        handleFollowingClick={handleFollowingClick}
        isFollowing={isFollowing}
        isFollowingLoading={isFollowingLoading}
        onDelete={handleDomainDelete}
        onUpdate={handleDomainUpdate}
        onUpdateVote={handleUpdateVote}
      />
    </PageLayoutV1>
  );
};

export default DomainDetailPage;
