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
import { FunctionComponent, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PageLoader } from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import TopicDetails from '../../components/Topic/TopicDetails/TopicDetails.component';
import { ROUTES } from '../../constants/constants';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { Topic } from '../../generated/entity/data/topic';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../hooks/useFqn';
import {
  topicQueryFn,
  topicQueryKey,
  TOPIC_DEFAULT_FIELDS,
} from '../../rest/queries/topicQuery';
import {
  addFollower,
  patchTopicDetails,
  removeFollower,
  updateTopicVotes,
} from '../../rest/topicsAPI';
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const TopicDetailsPage: FunctionComponent = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { entityFqn: topicFQN } = useFqn({ type: EntityType.TOPIC });

  // Single useEntityPermissions call — no genuine cycle here (contrast
  // TableDetailsPageV1.tsx's two-call pattern): this page never derives a
  // `deleted`-gated canEdit* flag of its own. TopicDetails (below) owns the raw
  // {@code topicPermissions} prop and derives its own edit-tier flags from it plus its
  // own {@code deleted} (sourced from {@code topicDetails.deleted}), so `deleted` is
  // irrelevant to what THIS call returns. `canViewBasic` (prioritized, ViewAll-fallback)
  // still has to run before {@code topicDetails} exists, since it gates the entity
  // {@code useQuery}'s `enabled` below.
  const {
    permissions: topicPermissions, // TopicDetails consumes the raw OperationPermission prop
    isLoading: isPermissionsLoading,
    error: permissionsError,
    canViewBasic: canViewTopic,
    hasViewAccess,
  } = useEntityPermissions(ResourceEntity.TOPIC, topicFQN);

  const topicCacheKey = useMemo(
    () => topicQueryKey(topicFQN, TOPIC_DEFAULT_FIELDS),
    [topicFQN]
  );

  const {
    data: topicDetails,
    isLoading: topicLoading,
    error: topicError,
  } = useQuery({
    queryKey: topicCacheKey,
    queryFn: topicQueryFn(topicFQN, TOPIC_DEFAULT_FIELDS),
    enabled: Boolean(topicFQN && canViewTopic && !isPermissionsLoading),
  });

  const isError = useMemo(
    () => (topicError as AxiosError | undefined)?.response?.status === 404,
    [topicError]
  );

  useEffect(() => {
    const status = (topicError as AxiosError | undefined)?.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    } else if (status && status !== 404) {
      showErrorToast(
        topicError as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.topic'),
          entityName: topicFQN,
        })
      );
    }
  }, [topicError, navigate, topicFQN, t]);

  useEffect(() => {
    if (!topicDetails) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(topicDetails),
      entityType: EntityType.TOPIC,
      fqn: topicDetails.fullyQualifiedName ?? '',
      serviceType: topicDetails.serviceType,
      timestamp: 0,
      id: topicDetails.id,
    });
  }, [topicDetails]);

  const setTopicDetails = useCallback(
    (
      updater:
        | Topic
        | undefined
        | ((prev: Topic | undefined) => Topic | undefined)
    ) => {
      queryClient.setQueryData<Topic | undefined>(topicCacheKey, updater);
    },
    [queryClient, topicCacheKey]
  );

  const refetchTopicDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: topicCacheKey }),
    [queryClient, topicCacheKey]
  );

  const { id: topicId, version: currentVersion } = topicDetails ?? {};
  const isFollowing = useMemo(
    () => topicDetails?.followers?.some(({ id }) => id === USERId) ?? false,
    [topicDetails?.followers, USERId]
  );
  const entityName = useMemo(() => getEntityName(topicDetails), [topicDetails]);

  // Permission fetching itself now lives in useEntityPermissions (called above). Preserves
  // the old fetchResourcePermission catch's exact toast (interpolating the FQN itself, not
  // a translated entity-type label — this page's message differs from the rest of the
  // sweep's `{ entity: t('label.<x>-lowercase') }` shape).
  useEffect(() => {
    if (permissionsError) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', { entity: topicFQN })
      );
    }
  }, [permissionsError, topicFQN]);

  const saveUpdatedTopicData = useCallback(
    (updatedData: Topic) => {
      if (!topicDetails || !topicId) {
        return Promise.reject(new Error('Topic not loaded'));
      }
      const jsonPatch = compare(omitBy(topicDetails, isUndefined), updatedData);

      return patchTopicDetails(topicId, jsonPatch);
    },
    [topicDetails, topicId]
  );

  const onTopicUpdate = async (updatedData: Topic, key?: keyof Topic) => {
    try {
      const res = await saveUpdatedTopicData(updatedData);
      setTopicDetails((previous) => {
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
    { previous: Topic | undefined }
  >({
    mutationFn: async () => {
      if (!topicId) {
        return;
      }
      if (isFollowing) {
        await removeFollower(topicId, USERId);
      } else {
        await addFollower(topicId, USERId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: topicCacheKey });
      const previous = queryClient.getQueryData<Topic | undefined>(
        topicCacheKey
      );
      queryClient.setQueryData<Topic | undefined>(topicCacheKey, (prev) => {
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
          ] as Topic['followers'],
        };
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Topic | undefined>(
          topicCacheKey,
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
      queryClient.invalidateQueries({ queryKey: topicCacheKey });
    },
  });

  const followTopic = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const unFollowTopic = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(EntityType.TOPIC, topicFQN, toString(currentVersion))
      );
  };

  const handleToggleDelete = (version?: number) => {
    setTopicDetails((prev) => {
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
      await updateTopicVotes(id, data);
      await queryClient.invalidateQueries({ queryKey: topicCacheKey });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateTopicDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Topic;
      setTopicDetails((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setTopicDetails]
  );

  if (isPermissionsLoading || topicLoading) {
    return <PageLoader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('topic', topicFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!hasViewAccess) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.topic'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }
  if (!topicDetails) {
    return <PageLoader />;
  }

  return (
    <TopicDetails
      fetchTopic={refetchTopicDetails}
      followTopicHandler={followTopic}
      handleToggleDelete={handleToggleDelete}
      topicDetails={topicDetails}
      topicPermissions={topicPermissions}
      unFollowTopicHandler={unFollowTopic}
      updateTopicDetailsState={updateTopicDetailsState}
      versionHandler={versionHandler}
      onTopicUpdate={onTopicUpdate}
      onUpdateVote={updateVote}
    />
  );
};

export default TopicDetailsPage;
